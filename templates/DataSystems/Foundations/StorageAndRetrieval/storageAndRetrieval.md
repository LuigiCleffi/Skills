---
name: ddia-storage-and-retrieval
description: "How storage engines store and find data and how to choose and tune one for a workload: append-only logs, hash indexes (Bitcask), compaction and segment merging, tombstones, SSTables, memtables and LSM-trees, Bloom filters, B-trees with write-ahead logs, write amplification, LSM vs B-tree trade-offs, secondary, clustered, covering, concatenated, multi-dimensional (R-tree) and fuzzy indexes, in-memory databases, OLTP vs OLAP, data warehouses and ETL, star and snowflake schemas, column-oriented storage, bitmap and run-length compression, vectorized processing, sort keys in column stores, materialized views and data cubes, based on Chapter 3 (Storage and Retrieval) of Designing Data-Intensive Applications. Use when choosing a database or storage engine, deciding between RocksDB/LevelDB/Cassandra-style LSM engines and B-tree engines (PostgreSQL, MySQL InnoDB), adding or removing indexes, writes slow down after adding indexes, p99 latency spikes during compaction, designing a key-value store or an append-only log, modeling fact and dimension tables, analysts' queries hurt the production database, picking Parquet or a columnar warehouse, or the user mentions memtable, SSTable, WAL, write amplification, heap file, INCLUDE columns, composite index column order, geospatial index, Redis durability, ETL, fact table, star schema, bitmap index, sort key or OLAP cube."
---

# Storage and Retrieval

Pick the storage engine for the access pattern, not by habit: OLTP serves many small keyed reads and writes, so it needs indexes; analytics scans and aggregates huge numbers of rows, so it needs compact columnar layout. Every index speeds some reads and slows every write, so add only the indexes real queries need, and benchmark candidate engines on your own workload.

## The core trade-off: indexes

- An index is derived data kept beside the primary data; adding or dropping it changes performance, never content.
- The cheapest possible write is an append to a file. Every index adds work to each write (and storage), so do not index everything "just in case".
- Choose indexes from the application's actual query patterns; re-check them when patterns change, and drop ones nothing uses.
- In this skill "log" means an append-only sequence of records (often binary), not human-readable application logs.

## Log-structured engines

### Hash index over an append-only log (Bitcask style)

- Writes append `key,value` to a log; an in-memory hash map holds `key -> byte offset`. Reads cost one seek, or none if the page is cached.
- Fits workloads with few distinct keys and many updates per key (counters, last-seen values). All keys must fit in RAM.
- Cannot do range queries; on-disk hash maps perform poorly.
- Required machinery for a real implementation:
  - Segments: close the log at a size limit, start a new file; compact (keep latest value per key) and merge segments in the background, then swap atomically and delete old files.
  - Binary, length-prefixed records instead of CSV (no escaping).
  - Deletes as tombstone records that tell compaction to drop earlier values.
  - Checksums per record to detect and skip torn writes after a crash.
  - Snapshot the hash maps to disk so restart does not rescan every segment.
  - Single writer thread; immutable segments allow concurrent readers.

### SSTables and LSM-trees

- SSTable: segment sorted by key, each key once. Merging is a mergesort over files larger than memory; when keys collide, the newest segment wins.
- Only a sparse in-memory index is needed (one key per few KB); scan forward from the nearest indexed key. Blocks between index entries can be compressed.
- Write path: insert into a sorted in-memory tree (memtable); when it passes a threshold (MBs), flush it as a new SSTable. Append every write to a separate WAL first so a crash does not lose the memtable; discard that WAL after the flush.
- Read path: memtable, then newest to oldest SSTable. Missing keys are the worst case; Bloom filters skip segments that surely lack the key.
- Strengths: very high write throughput (random writes become sequential), efficient range scans, good compression, works with datasets far larger than RAM.
- Used by LevelDB, RocksDB, Cassandra, HBase, and Lucene's term dictionary (term -> postings list).

Current note: RocksDB is now embedded in many systems (for example MyRocks for MySQL, and the storage of several distributed SQL and streaming systems); LSM tuning (compaction style, level sizes, Bloom filter bits) is a routine operational task there.

## B-trees

- Fixed-size pages (traditionally 4 KB, often 8-16 KB today) form a tree; root to leaf follows key ranges. Branching factor in the hundreds keeps depth at 3-4 levels for huge tables.
- Updates overwrite the page in place; inserts into a full page split it and update the parent.
- Crash safety comes from a write-ahead log (redo log): every change is appended to the WAL before pages are modified, and replayed on restart. Concurrency inside the tree needs latches.
- Optimizations seen in real engines: copy-on-write pages instead of WAL (LMDB), abbreviated keys in interior pages, sibling pointers in leaves for range scans, attempts to keep leaves sequential on disk.
- Default index structure in almost every relational database.

## Choosing LSM vs B-tree

| Concern | LSM-tree | B-tree |
|---|---|---|
| Write throughput | Higher; sequential writes | Lower; random page writes plus WAL |
| Read latency | Can check several segments | Usually one path per lookup |
| Tail latency | Compaction can stall requests at high percentiles | More predictable |
| Disk space | Compresses better, less fragmentation | Pages left partly empty after splits |
| Write amplification | From repeated compaction | WAL plus full page writes |
| Key locations | Same key may exist in several segments | Each key in exactly one place, easy range locks |
| Risk | Compaction falling behind writes fills the disk and slows reads | Mature, well understood |

- Neither wins universally; benchmarks are workload sensitive. Measure with your key distribution, value sizes and read/write ratio.
- With an LSM engine, monitor compaction backlog (pending bytes, number of level-0 files, write stalls); unbounded backlog is an incident in progress.
- Write amplification also matters for SSD wear and for cloud disks billed by IOPS.

## Secondary and other indexes

- Secondary index keys are not unique: store a list of row IDs per key, or make the key unique by appending the row ID. Both engine families support this.
- Where the indexed value lives:

| Layout | What the index holds | Trade-off |
|---|---|---|
| Heap file + nonclustered index | Pointer to row in an unordered heap | No duplication; extra hop per read; moved rows need pointer updates or forwarding |
| Clustered index | The row itself | Fast reads by key; one per table (InnoDB primary key; secondary indexes then hold the primary key) |
| Covering index | Key plus some included columns | Query answered from the index alone; more storage and write cost |

```sql
-- PostgreSQL 11+: covering index so the query below can use an index-only scan
CREATE INDEX orders_customer_created_inc
  ON orders (customer_id, created_at) INCLUDE (status, total);

SELECT status, total FROM orders
WHERE customer_id = $1 AND created_at >= $2;
```

- Concatenated (composite) index: columns appended in a fixed order. It serves the leading column(s), not a filter on a later column alone. Put equality columns first, range column last.
- Multi-dimensional ranges (lat/long box, date plus temperature): a B-tree on one column cannot narrow both. Use a spatial index (R-tree, for example PostGIS on GiST) or a space-filling curve key.
- Fuzzy search (misspellings, edit distance, relevance): use a search engine (Lucene-based) or a trigram index, not B-tree `LIKE '%x%'`.

## In-memory databases

- Fit when the dataset fits in RAM (possibly across machines). Their speed comes mainly from not encoding structures for disk, not from avoiding reads; a disk engine with a large cache also rarely reads disk.
- Durability options: append-only log to disk, periodic snapshots, replication, or none (pure cache such as Memcached).
- They can offer data structures hard to build on disk (Redis sorted sets, queues).
- Decide explicitly how much loss is acceptable on restart. Redis-style async persistence can lose the last moments of writes; configure fsync policy and replication to match the requirement.

## OLTP vs analytics

| Property | OLTP | Analytics (OLAP) |
|---|---|---|
| Reads | Few rows by key | Aggregates over many rows |
| Writes | Random, low latency, user input | Bulk loads (ETL) or event streams |
| Users | Customers via the app | Analysts, reports, BI |
| Data | Current state | History of events |
| Bottleneck | Disk seeks and indexes | Disk and memory bandwidth |

- Do not let ad-hoc analytical scans run against the primary OLTP database; they compete for I/O and cache with user traffic. Extract data into a warehouse (batch dumps or a change stream), transform to an analysis schema, load (ETL).
- Small company, small data: a read replica or the same database may be enough. Decide by measured impact, not by fashion.

### Star and snowflake schemas

- Fact table: one row per event (sale, page view), with measures (quantity, price) and foreign keys to dimension tables (who, what, where, when, how). Facts are kept at event granularity for flexibility.
- Dimensions are wide descriptive tables (product, store, customer, date with holiday flags).
- Snowflake normalizes dimensions into sub-dimensions; star is usually preferred because analysts find it simpler.

## Column-oriented storage

- Store each column's values together, all columns in the same row order; a query reads only the 4-5 columns it touches out of hundreds.
- Columns compress well: bitmap encoding per distinct value, run-length encoding for sparse bitmaps. `IN (...)` becomes bitwise OR, multi-column equality becomes bitwise AND.
- Compressed column chunks fit CPU caches and allow vectorized (SIMD-friendly) execution.
- Sort order: rows are sorted as whole rows by chosen sort keys. Put the column most often range-filtered (usually date) first; the first sort key compresses best. Some systems keep replicas in different sort orders.
- Writes: in-place update is impractical; buffer writes in memory (LSM style) and merge into new column files in bulk. Expect batch loading, not per-row updates.
- Parquet is a columnar file format for nested (document) data.

Current note: the 2017 warehouse landscape (Shark, Stinger, early SQL-on-Hadoop) has moved on; typical choices now are cloud columnar warehouses (BigQuery, Snowflake, Redshift), ClickHouse, Trino or Spark SQL over Parquet/ORC, often managed by open table formats such as Apache Iceberg or Delta Lake, and DuckDB for single-machine analytics.

## Materialized aggregates

- Materialized view: the stored result of a query, refreshed when underlying data changes. Speeds repeated aggregates; costs write or refresh time, so it fits read-heavy warehouses more than OLTP.
- Data cube: precomputed aggregates along several dimensions. Very fast for those dimensions, useless for questions on attributes not in the cube. Keep raw facts and treat cubes as accelerators.

## Workflow
1. Characterize the workload: read/write ratio, point lookups vs range scans vs full aggregations, data size vs RAM, latency target (p50 and p99), acceptable loss on crash.
2. Classify it as OLTP, analytics, or both; if both, plan a separate analytical store fed by ETL or change data capture rather than one engine for everything.
3. For OLTP, choose B-tree (read-heavy, predictable latency, strong transactions) or LSM (write-heavy, large datasets, compression); confirm with a benchmark on realistic data.
4. List the queries and derive indexes from them: composite column order, covering columns, spatial or full-text needs. Remove indexes with no use.
5. For analytics, model facts and dimensions, pick a columnar store or Parquet, and choose sort keys from the dominant filters.
6. Decide durability and recovery (WAL settings, fsync, snapshots, replicas) and how compaction or vacuum is monitored.
7. Before adding indexes to large live tables, changing storage engines, or rebuilding or backfilling data, confirm the environment, get approval, use online builds (for example `CREATE INDEX CONCURRENTLY`), and have a rollback plan.

## Red flags
- Indexing every column, or never reviewing which indexes are used.
- A composite index whose leading column is not in the query's filter.
- Hash-only storage chosen for data that needs range queries.
- LSM engine in production with no monitoring of compaction backlog or write stalls.
- Custom append-only storage without checksums, tombstones, or crash recovery.
- Analysts or BI dashboards querying the primary OLTP database at peak.
- `SELECT *` over wide fact tables; row-oriented storage for multi-terabyte scans.
- In-memory store treated as durable without checking its persistence settings.
- Data cubes or materialized views replacing raw facts entirely.
- Choosing an engine from a blog benchmark instead of your own workload.

## Related
- `../ReliableScalableMaintainable/reliableScalableMaintainable.md` — load parameters and percentiles used to judge engine choices.
- `../DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — the data model the engine has to serve.
- `../EncodingAndEvolution/encodingAndEvolution.md` — on-disk record formats, Avro and Parquet files.
- `../../DistributedData/Partitioning/partitioning.md` — key-range vs hash partitioning built on these index types.
- `../../DistributedData/Transactions/transactions.md` — WAL, snapshot isolation and range locks on B-trees.
- `../../DerivedData/BatchProcessing/batchProcessing.md` — building warehouses and indexes in bulk.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — logs and change data capture feeding analytics.
- `../../../DBA/PostgreSQL/TablesConstraintsIndexes/tablesConstraintsIndexes.md` — PostgreSQL index types (B-tree, GiST, GIN, BRIN) (when installed).
- `../../../DBA/PostgreSQL/QueryPerformanceTuning/queryPerformanceTuning.md` — verifying index use with EXPLAIN (when installed).
- `../../../DBA/Oracle/BeyondTheBasics/MaterializedViews/materializedViews.md` — materialized views and refresh in Oracle (when installed).
