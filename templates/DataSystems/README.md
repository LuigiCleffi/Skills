## AI Skills

Before choosing a datastore or data model, designing storage or schemas,
changing an encoding or API payload, replicating or partitioning data,
choosing transaction isolation, reasoning about faults, clocks or
consistency, or building batch and stream pipelines, find the skills that
apply to the task in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of Martin Kleppmann's *Designing
Data-Intensive Applications* (O'Reilly, 2017). The skills are
engine-neutral: they decide *what* the system needs (ordering, isolation,
durability, compatibility). For the exact SQL and administration of a given
database, also read the matching engine skills in `../DBA/README.md` when
installed. The book predates several product changes; where that matters,
a skill carries a short "Current note". Check the version of the product
the project actually runs before relying on version-specific behavior.

### Foundations (Part I) — one machine, any data system

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` | Defining SLOs, latency percentiles, load parameters, fan-out, a fault model, scale-up vs scale-out, or operability for a data system. |
| 2 | `./Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` | Choosing relational, document or graph models; embed vs reference; JSONB; schema-on-read; Cypher, SPARQL or recursive SQL queries. |
| 3 | `./Foundations/StorageAndRetrieval/storageAndRetrieval.md` | Choosing a storage engine or indexes, LSM vs B-tree, OLTP vs analytics, star schemas, columnar storage, or compaction and write amplification. |
| 4 | `./Foundations/EncodingAndEvolution/encodingAndEvolution.md` | Changing schemas, messages or API payloads safely; choosing JSON, Protobuf or Avro; rolling upgrades, API versioning, broker message formats. |

### Distributed Data (Part II) — many machines

| Ch | Skill | Use when |
|---|---|---|
| 5 | `./DistributedData/Replication/replication.md` | Adding replicas or failover, users not seeing their own writes, multi-region or active-active writes, quorum tuning, resolving write conflicts. |
| 6 | `./DistributedData/Partitioning/partitioning.md` | Choosing a shard key, fixing hot partitions or keys, scatter/gather secondary indexes, rebalancing or resharding, routing requests to shards. |
| 7 | `./DistributedData/Transactions/transactions.md` | Choosing an isolation level or fixing races: lost updates, write skew, phantoms, double booking, deadlocks, serialization retries, SELECT FOR UPDATE. |
| 8 | `./DistributedData/TroubleWithDistributedSystems/troubleWithDistributedSystems.md` | Timeouts and retries with unknown outcomes, distributed locks or leases needing fencing tokens, clock skew, last-write-wins data loss, GC pauses, split brain. |
| 9 | `./DistributedData/ConsistencyAndConsensus/consistencyAndConsensus.md` | Choosing eventual, causal or linearizable consistency; leader election, uniqueness, distributed locks; 2PC/XA; Raft, etcd, ZooKeeper. |

### Derived Data (Part III) — integrating many systems

| Ch | Skill | Use when |
|---|---|---|
| 10 | `./DerivedData/BatchProcessing/batchProcessing.md` | Designing ETL, backfills or Spark/Hive jobs, choosing large-scale join strategies, fixing skew, or publishing job output safely. |
| 11 | `./DerivedData/StreamProcessing/streamProcessing.md` | Choosing queues vs log-based brokers, replacing dual writes with CDC or an outbox, windowing by event time, or making consumers exactly-once. |

The source PDF is an early release that ends at Chapter 11; the final
chapter of the published book (The Future of Data Systems) is not a skill.

# Context for AI: Working on Data-Intensive Systems

## 1. Start From Requirements, Not Products

Name the load (requests per second, read/write ratio, data volume, fan-out),
the latency target as percentiles, the faults the system must survive, and
the consistency each operation actually needs. Choose tools only after that.
No single datastore serves every access pattern; most real systems combine a
database, caches, search indexes, and pipelines.

## 2. Know the System of Record

For every dataset, state which store holds the authoritative copy and which
stores are derived from it (caches, indexes, materialized views, analytics
copies). Derived data must be rebuildable from the source. When the two
disagree, the system of record wins, and the fix is to re-derive, not to
patch the copy by hand.

## 3. Name the Guarantee You Rely On

"Consistent", "transactional" and "real-time" mean different things in
different products. Say which guarantee the code depends on (read-your-writes,
snapshot isolation, serializability, linearizability, at-least-once or
effectively-once delivery) and verify the product and its configuration
provide it. Do not infer guarantees from marketing names or defaults.

## 4. Assume Partial Failure

Networks drop and delay messages, clocks drift, and processes pause. A timeout
means the outcome is unknown, not that the operation failed. Make retried
operations idempotent, fence locks and leases with monotonic tokens, and do
not order events by wall-clock time across machines.

## 5. Evolve Without Breaking Readers

Old and new code run side by side during every deploy, and old data lives
for years. Keep encodings backward and forward compatible, migrate schemas
with expand-and-contract, and make backfills resumable and batched.

## 6. Destructive and Hard-to-Reverse Operations

Failover, promoting a replica, resharding or rebalancing, changing isolation
or replication settings, resetting consumer offsets, replaying topics,
dropping replication slots, backfills, and schema migrations on production
data need explicit approval for the specific target before they run. State
what will change, how to verify it, and how to back out.

## 7. Report Honestly

Say which guarantees were verified (by test, by documentation for the running
version, or by inspection of configuration) and which were assumed. Do not
claim a design is correct under concurrency or failure without naming the
scenarios that were considered.
