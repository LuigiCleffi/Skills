---
name: ddia-batch-processing
description: How to design batch jobs that derive output from bounded, immutable input: the Unix-pipeline mindset (uniform interface, separating logic from wiring), sort vs in-memory aggregation, MapReduce on a distributed filesystem (map, shuffle, reduce, partitioning, data locality), workflows and schedulers, reduce-side sort-merge joins, secondary sort, GROUP BY and sessionization, skew handling, map-side broadcast hash, partitioned hash and merge joins, building search indexes and read-only key-value stores as job output, immutable outputs and human fault tolerance, data lakes and schema-on-read vs MPP databases, dataflow engines (Spark, Flink, Tez), materialization vs recomputation, deterministic operators, iterative graph processing with Pregel/BSP, and declarative high-level APIs, based on Chapter 10 (Batch Processing) of Designing Data-Intensive Applications. Use when writing or reviewing an ETL or nightly job, a Spark/Flink/Hive/Beam/dbt pipeline, a backfill or reprocessing run, choosing a join strategy for large datasets, a job is slow because of one straggler task or a hot key, a job calls a production database per record, output must be loaded into a serving store, the user mentions MapReduce, Hadoop, HDFS, S3, Parquet, Avro, shuffle, broadcast join, bucketing, skew join, salting, Airflow, Oozie, data lake, PageRank, GraphX or idempotent re-runs.
---

# Batch Processing

A batch job reads a bounded, immutable input and writes a brand-new output, with no other side effects. Keep that contract and you get cheap retries, safe re-runs and rollback by switching back to the previous output; break it (writing to live databases from inside tasks, mutating inputs, non-deterministic operators) and you inherit every distributed-systems failure mode yourself.

## Choose the right processing style

| Style | Input | Primary metric | Use for |
|---|---|---|---|
| Online service | One request | Response time, availability | User-facing reads and writes |
| Batch job | Bounded dataset, fixed snapshot | Throughput | Indexes, ML features, reports, backfills, ETL |
| Stream job | Unbounded events | Latency of derived output | Same derivations, kept fresh continuously (see Stream Processing) |

- Before reaching for a cluster, check whether one machine is enough. A shell pipeline or a single-process script over gigabytes is often faster to build and run than a distributed job.
- Graphs or datasets that fit in memory (or on one disk) usually process faster single-machine than distributed, because cross-machine message overhead dominates.

## Unix ideas that carry over

- **One job, one purpose.** Compose small jobs instead of growing one job with flags for every new need.
- **Uniform interface.** Every stage reads and writes the same kind of thing (files of records). In clusters prefer self-describing, schema-evolvable formats such as Avro or Parquet over ad-hoc text that every consumer must re-parse.
- **Separate logic from wiring.** The job takes input and output locations as parameters; it never hardcodes paths, tables or endpoints. This lets the scheduler, tests and re-runs point it anywhere.
- **Transparency.** Inputs are read-only, so you can re-run with different options, inspect any intermediate output, and restart from a saved stage.

### Sort vs in-memory aggregation

- Hash-table aggregation is fine when the working set (distinct keys, not total rows) fits in memory.
- When it does not, sort and merge: chunks are sorted in memory, spilled to disk, then merged sequentially. This scales past memory because the access pattern is sequential.

## MapReduce model (still the mental model under every engine)

1. Split input files into records.
2. **Map**: per record, emit zero or more key-value pairs. No state between records.
3. **Shuffle**: partition pairs by hash of key, sort each partition, copy it to the reducer that owns it.
4. **Reduce**: called once per key with an iterator over all its values; emit output records.

- Map tasks follow input blocks and are scheduled near a replica of the data (locality). Reduce task count is chosen by the job author.
- A second ordering (for example ranking by count) needs another stage; chain jobs into a workflow.
- Output is visible only when the whole job succeeds; failed or speculative task output is discarded. One downstream job starts only after its inputs are complete.
- Use a workflow scheduler (Airflow, Oozie, Luigi, Azkaban, Dagster) for dependencies, retries and backfills, and keep dataset metadata (partitioning key, partition count, sort order, format) in a catalog such as the Hive metastore.

Current note: hand-written Hadoop MapReduce is largely legacy. Spark, Flink, Beam and SQL engines (Trino, Hive on Tez, BigQuery, Snowflake) run the same partition-shuffle-aggregate pattern, and object stores (S3, GCS, ADLS) commonly replace HDFS, trading data locality for decoupled storage and compute.

## Joins in batch: pick the algorithm deliberately

In batch, a join resolves every occurrence of an association across the whole dataset, so full scans are expected. Never join by calling a remote database per record: it is slow, can overload that database, and makes the job non-deterministic because the data changes underneath you. Copy the dimension data (snapshot or ETL extract) next to the facts instead.

| Join | Preconditions | Cost | Output layout |
|---|---|---|---|
| Reduce-side sort-merge | None | Full shuffle and sort of both sides | Partitioned and sorted by join key |
| Broadcast hash | One side fits in each task's memory (or a local read-only index) | Small side copied to every task, no shuffle | Same as the large input |
| Partitioned (bucketed) hash | Both sides partitioned by the same key, same hash, same partition count | Per-partition hash table | Same as the large input |
| Map-side merge | Both sides partitioned and sorted identically | Streaming merge, no memory limit | Same as the large input |

- **Secondary sort**: order values within a key (for example the user record first, then events by time) so the reducer holds only one record in memory.
- **GROUP BY and sessionization** use the same mechanism: the emitted key is the grouping key (user ID, session cookie), so all related records land in one reducer call.
- With a declarative API (Spark SQL, DataFrames, Hive, Flink Table API) let the cost-based optimizer pick and reorder joins, but check its choice in the plan (`EXPLAIN`) and supply hints or statistics when it guesses wrong.

```sql
-- Spark SQL: force a broadcast when you know the dimension is small
SELECT /*+ BROADCAST(u) */ e.url, u.birth_year
FROM activity_events e
JOIN users u ON u.user_id = e.user_id;
```

### Skew (hot keys)

A job finishes only when its slowest task does, so one celebrity key can stall a whole workflow.

- Detect it: per-task input size or duration far above the median, one reducer still running long after the rest.
- **Skew join**: spread records for hot keys across random reducers and replicate the matching other-side records to all of them (Hive/Pig skew join, Spark AQE skew-join handling).
- **Two-stage aggregation**: first aggregate on `(key, random salt)`, then combine partial results per key.

```sql
-- stage 1: salted partial counts; stage 2: sum per key
WITH partial AS (
  SELECT target_id, salt, count(*) AS c
  FROM (SELECT target_id, floor(rand() * 16) AS salt FROM replies) r
  GROUP BY target_id, salt)
SELECT target_id, sum(c) AS replies FROM partial GROUP BY target_id;
```

## What batch jobs should output

- **Search indexes**: each reducer builds the index for its document partition; files are immutable once written. Rebuild wholesale or update incrementally.
- **Serving key-value stores** (recommendations, features, related items): build the database files inside the job, write them to the output location, then have the serving store bulk-load them and switch atomically, keeping the previous version for instant rollback.
- **Do not** write record-by-record from tasks into a production database: it is slow, floods the database at batch rates, and exposes partial results from failed or speculatively duplicated tasks. If you must load a live store, write to a new table/index version and swap an alias or pointer.

## Immutable outputs and human fault tolerance

- Write each run to a new, versioned location (for example `.../dt=2017-03-01/run=42/`), then atomically repoint consumers. A bad deploy is fixed by rolling back code and re-running, or by repointing to the previous output.
- Make jobs idempotent: re-running for the same input partition replaces that partition's output, never appends duplicates.
- Validate output before publishing: row counts, null rates, key uniqueness, and drift against the previous run. Fail the workflow rather than publish suspicious output.
- **Safety**: backfills and reprocessing touch production data and serving stores. Confirm the target environment, get approval for the scope (date range, tables), dry-run on a sample, keep the previous output until the new one is verified, and have a documented revert step.

## Data lakes vs MPP databases

| Aspect | MPP warehouse | Distributed filesystem / lake + engines |
|---|---|---|
| Storage | Proprietary format, model designed up front | Any bytes, any format; schema-on-read |
| Processing | SQL, tightly optimized | SQL plus arbitrary code (ML, NLP, images) |
| Fault handling | Abort and rerun the query | Retry individual tasks |
| Best fit | Interactive analytics with known queries | Raw collection first, many derived views later |

- Landing raw data quickly ("raw is better") is often worth more than waiting for the perfect model; modeling still happens, but as a separate ETL step.
- Schema-on-read moves interpretation cost to consumers; document formats and keep schemas versioned so they can.

Current note: lakehouse table formats (Delta Lake, Apache Iceberg, Apache Hudi) add transactional commits, schema evolution and time travel on object storage, which gives atomic output swaps and rollbacks without hand-built directory conventions.

## Dataflow engines and materialization

Spark, Flink and Tez treat a whole workflow as one DAG of operators instead of chained independent jobs.

- They sort only where needed, drop redundant map stages, pipeline operators, keep intermediate state in memory or on local disk, and reuse processes.
- Materialize to durable storage only datasets that other teams consume or that are expensive to recompute; keep other intermediate state ephemeral.
- **Fault tolerance by recomputation**: lost partitions are rebuilt from lineage (Spark RDDs) or from checkpoints (Flink). Checkpoint explicitly when lineage is long, the intermediate result is small, or the computation is CPU-heavy.
- **Determinism**: recomputation is safe only if operators give the same output for the same input. Remove sources of non-determinism: hash-map iteration order, unseeded randomness, `now()`, calls to external services. Pass the logical run date as a parameter instead of reading the clock.

```ts
// Deterministic: the run date and the RNG seed come from the scheduler, not the clock
function sampleUsers(users: User[], runDate: string, rate: number): User[] {
  const rng = seededRandom(`${runDate}:sample`);
  return users.filter(() => rng() < rate);
}
```

## Iterative and graph processing

- Plain MapReduce cannot express "repeat until converged"; an external loop rerunning full jobs rewrites the entire graph each round.
- Use a Pregel/bulk-synchronous-parallel API (Spark GraphX/GraphFrames, Flink Gelly, Giraph): vertices keep state between supersteps and only process incoming messages; checkpoints at superstep boundaries give fault tolerance.
- Expect heavy cross-machine messaging because graphs are usually partitioned by vertex-ID hash; prefer a single machine when the graph fits.

## Workflow
1. State the derivation: input datasets (snapshot date, size, format, partitioning), output consumers, freshness requirement. If minutes matter, consider a stream job instead.
2. Check whether a single machine or a SQL query in the existing warehouse is sufficient before building a distributed job.
3. Define the job as a pure function of its inputs: parameterize input/output locations and the logical run date; remove clocks, unseeded randomness and external calls.
4. Choose the join and grouping strategy from data sizes and layout (broadcast, bucketed, sort-merge); check the engine's plan.
5. Measure key distribution; add skew handling (salting, skew join, two-stage aggregation) for hot keys.
6. Write output to a new versioned location in a schema-evolvable columnar or row format, with metadata registered in the catalog.
7. Validate output (counts, uniqueness, drift vs last run), then publish by atomic swap; keep the previous version for rollback.
8. Wire dependencies, retries and backfill ranges in the workflow scheduler.
9. For backfills or reprocessing that touch production stores, confirm the environment, get approval, run a sample first, and keep a revert plan.

## Red flags
- A mapper, reducer or UDF that queries or writes a production database per record.
- Jobs that append to or overwrite their own input, or append to output so re-runs duplicate data.
- `now()`, `Math.random()` without a seed, or hash-map iteration order influencing output.
- One task taking many times longer than the median and nobody inspecting key distribution.
- Broadcasting a "small" table that grows over time until tasks run out of memory.
- Bucketed joins on inputs with different partition counts or hash functions.
- Chains of jobs fully materializing intermediate data no one else reads.
- Publishing output without validation, or deleting the previous output before the new one is verified.
- Spinning up a cluster for data that fits on a laptop; distributed graph processing for a graph that fits in RAM.
- Running a backfill against production without approval, scope limits or a rollback path.

## Related
- `../StreamProcessing/streamProcessing.md` — the same derivations over unbounded input, with windows, CDC and exactly-once.
- `../../Foundations/StorageAndRetrieval/storageAndRetrieval.md` — SSTables, sort-merge, column storage and data warehouses behind batch engines.
- `../../Foundations/EncodingAndEvolution/encodingAndEvolution.md` — Avro, Parquet and schema evolution for job inputs and outputs.
- `../../Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — declarative vs imperative queries, graph models.
- `../../DistributedData/Partitioning/partitioning.md` — hash partitioning, hot spots and skew.
- `../../DistributedData/TroubleWithDistributedSystems/troubleWithDistributedSystems.md` — why task retries need immutable input and discarded partial output.
- `../../../DBA/PostgreSQL/QueryPerformanceTuning/queryPerformanceTuning.md` — reading plans and join strategies in a single database (when installed).
- `../../../DBA/Oracle/BeyondTheBasics/MaterializedViews/materializedViews.md` — precomputed derived data inside a database (when installed).
- `../../../CleanCode/Systems/systems.md` — separating construction and wiring from logic (when installed).
