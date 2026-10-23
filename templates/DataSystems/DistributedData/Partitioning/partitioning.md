---
name: ddia-partitioning
description: How to split a dataset across nodes (partitioning, also called sharding, regions, tablets, vnodes or vBuckets) by key range or by hash of key, compound keys that hash one part and sort the rest, skew and hot spots including celebrity keys and key salting, local (document-partitioned) vs global (term-partitioned) secondary indexes and scatter/gather reads, rebalancing strategies (why not hash mod N, fixed number of partitions, dynamic splitting and merging, pre-splitting), automatic vs manual rebalancing, and request routing via any node, a routing tier or partition-aware clients with a coordination service or gossip, based on Chapter 6 (Partitioning) of Designing Data-Intensive Applications. Use when a single database node can no longer hold the data or the write load, choosing a shard key or partition key, designing Cassandra, DynamoDB, MongoDB, HBase, Elasticsearch or Citus tables, one shard or node is much busier than the others, time-series writes all land on today's partition, a secondary index query fans out to every shard and has bad p99 latency, a global index is stale right after a write, adding or removing nodes, picking a shard count, or the user mentions hot partition, hot key, consistent hashing, hash ring, resharding, shard rebalancing, partition-aware routing, mongos, ZooKeeper, KRaft or gossip.
---

# Partitioning

Partition only when one node cannot hold the data or sustain the load, and then choose the partition key from the dominant access pattern: key range when you need range scans over the key, hash of key when you need even load. Every other decision here (secondary indexes, rebalancing, routing) follows from that choice, and a wrong key is expensive to change later.

## Before you partition

- Each record belongs to exactly one partition; each partition is usually replicated (see Replication), so a node leads some partitions and follows others.
- Exhaust cheaper options first: better indexes, read replicas, caching, archiving cold data, a bigger machine. Single-node table partitioning (PostgreSQL declarative partitioning, Oracle partitioning) helps maintenance and pruning but does not add nodes.
- The goal is even spread of both data and queries. Uneven spread is **skew**; a partition with outsized load is a **hot spot**.
- Random placement spreads load perfectly but forces every read to query all nodes; deterministic placement by key is the norm.

## Choose the partitioning scheme

| Scheme | How a key maps | Good for | Risk |
|---|---|---|---|
| Key range | Sorted ranges of keys per partition; boundaries adapt to data | Range scans, prefix queries, keys as concatenated index | Hot spots when writes cluster (timestamps, sequential IDs) |
| Hash of key | Ranges of hash values per partition | Even spread of distinct keys | Range queries on the key hit every partition |
| Compound (hash + sort) | Hash the first key part, sort by the rest within the partition | One-to-many data: all events of one user, sorted by time | Cannot range-scan across the hashed part |

- Use a stable, well-distributed hash (MD5, Murmur3, FNV); never a language's built-in object hash, which may differ across processes or versions. It need not be cryptographic.
- Avoid the term "consistent hashing" in designs: it usually means hash partitioning, and has nothing to do with replica or ACID consistency.
- Time-series by range: lead the key with something high-cardinality (sensor ID, tenant ID) and then the timestamp, accepting one range query per sensor when reading many.

```sql
-- CQL: hash by user_id, sorted by ts inside each user's partition
CREATE TABLE user_updates (
  user_id bigint, ts timestamp, body text,
  PRIMARY KEY ((user_id), ts)
) WITH CLUSTERING ORDER BY (ts DESC);
-- efficient: one partition, range on the clustering column
SELECT * FROM user_updates WHERE user_id = 42 AND ts >= '2026-01-01';
```

Current note: Cassandra, DynamoDB and MongoDB (hashed shard keys since 2.4) all support the compound pattern; distributed SQL systems (Spanner, CockroachDB, YugabyteDB, TiDB) range-partition with automatic splitting and let you hash-shard sequential keys to avoid write hot spots.

## Hot keys

Hashing does not help when one key itself is hot (a celebrity's post, a viral item). Most stores will not fix this for you.

- **Salt the hot key:** append a small random suffix (for example 0–99) on write so it spreads over many partitions; reads must fetch all suffixes and combine.
- Only salt keys known to be hot, and keep a registry of which keys are split so readers know to fan out.
- Alternatives: aggregate in memory or a stream and write periodically, cache hot reads, or move the hot entity to dedicated capacity.

```ts
const SPLIT = 100;
const hotKeys = new Set(await registry.hotKeys()); // keep this list explicit and small

function writeKey(key: string): string {
  return hotKeys.has(key) ? `${key}#${Math.floor(Math.random() * SPLIT)}` : key;
}
function readKeys(key: string): string[] {
  return hotKeys.has(key) ? Array.from({ length: SPLIT }, (_, i) => `${key}#${i}`) : [key];
}
```

Current note: DynamoDB adaptive capacity and automatic split-for-heat now absorb some skew, but a single very hot item still has a per-partition throughput ceiling.

## Secondary indexes

Secondary indexes do not follow the primary key's partitioning. Choose one of two layouts per index:

| | Local (document-partitioned) | Global (term-partitioned) |
|---|---|---|
| Where entries live | With the documents, per partition | Partitioned by the indexed value (term or its hash) |
| Write | Touches one partition | May touch several index partitions |
| Read by indexed value | Scatter/gather to all partitions; tail latency amplifies | One partition (or a few) |
| Freshness | Same as the data | Usually updated asynchronously; can lag the write |
| Used by | MongoDB, Cassandra, Elasticsearch, SolrCloud, Riak, VoltDB | DynamoDB GSIs, Riak search, Oracle global indexes |

- Prefer designs where frequent secondary queries include the partition key, so they hit one partition. Multi-predicate filters (color and make) rarely manage this.
- With a global index, treat read-after-write on the index as not guaranteed unless the store documents synchronous maintenance; route such reads by primary key instead.
- Do not hand-roll a value-to-ID index in a key-value store without transactions: partial failures and races leave it inconsistent. If you must, make index updates idempotent and add a periodic reconciliation job.
- Partition a global index by term for range scans on the value (price ranges), by hash of term for even load.

Current note: distributed SQL systems maintain global secondary indexes transactionally, trading write latency for consistency.

## Rebalancing

Rebalancing moves data when load grows, data grows, or nodes fail. Requirements: fair share afterward, reads and writes continue during the move, and move no more data than needed.

- **Never `hash(key) % numberOfNodes`.** Changing the node count relocates almost every key.
- **Fixed number of partitions:** create many more partitions than nodes (for example 10 nodes, 1,000 partitions); new nodes take whole partitions from others. Keys never change partition, only partition-to-node assignment does. Stronger nodes can take more partitions. The count caps cluster size and each partition has overhead, so size it for expected growth, not for today.
- **Dynamic partitioning:** split a partition when it exceeds a size threshold, merge when it shrinks; partition count tracks data volume. An empty store starts with one partition, so **pre-split** if you know the key distribution, or the first node takes all writes.
- **Partitions proportional to nodes** (fixed partitions per node, as with Cassandra vnodes): partition size grows with data and shrinks as nodes are added.

```ts
// Fixed partitions: key -> partition never changes; partition -> node is a lookup table
const NUM_PARTITIONS = 1024;                       // decided once, sized for growth
const partitionOf = (key: string) => murmur3(key) % NUM_PARTITIONS;
const nodeOf = (key: string) => assignment[partitionOf(key)]; // updated by rebalancing
```

| Strategy | Typical with | Systems |
|---|---|---|
| Fixed partition count | Hash partitioning | Riak, Cassandra (vnodes), Elasticsearch, Couchbase, Voldemort, Kafka topics |
| Dynamic split/merge | Key range (also hash) | HBase, RethinkDB, MongoDB, Bigtable, distributed SQL |

Current note: Elasticsearch fixes primary shard count at index creation but offers split and shrink APIs; MongoDB supports online resharding since 5.0; Cassandra 4.0 lowered the default `num_tokens` from 256 to 16.

### Automatic vs manual

- Moving partitions is expensive (network, disk, rerouting). Fully automatic rebalancing combined with automatic failure detection can cascade: a slow node is declared dead, its load moves to others, they slow down too.
- Prefer a human approving a proposed assignment, throttled data movement, and off-peak windows. Before rebalancing, resharding or changing partition count on production: confirm the environment, get approval, check free disk and network headroom, and know how to pause or revert the move.

## Request routing

Someone must map a key to a node, and that mapping changes on every rebalance.

| Approach | Who knows the mapping | Notes |
|---|---|---|
| Any node forwards | Every node (often via gossip) | No external dependency; more logic in the database (Cassandra, Riak) |
| Routing tier | A partition-aware proxy | Clients stay simple (mongos, Espresso with Helix) |
| Partition-aware client | The client library | Fewest hops; clients must refresh metadata (Kafka clients, many drivers) |

- All participants must agree on the mapping or requests go to the wrong node; use the database's coordination mechanism (ZooKeeper, config servers, gossip, a Raft-based metadata store) rather than inventing one.
- Node IP discovery changes slowly; DNS is usually enough for that layer.
- Handle stale routing explicitly: a node that no longer owns a partition should reject or redirect, and clients should refresh metadata and retry.
- Analytic MPP databases also split complex queries (joins, aggregations) into parallel stages across partitions; that is different from routing single-key requests.

Current note: Kafka replaced ZooKeeper with its built-in KRaft metadata quorum; ZooKeeper mode was removed in Kafka 4.0.

## Workflow

1. Confirm partitioning is needed: measure data size, write rate and the bottleneck; rule out indexes, replicas, caching and vertical scaling.
2. List the top queries by frequency and latency target; identify the key most of them filter on.
3. Choose range, hash, or compound partitioning from those queries; check range-scan needs against hot-spot risk (timestamps, monotonic IDs, tenants of very different size).
4. Estimate skew: largest tenant or key, celebrity entities, write bursts. Plan salting, caching or dedicated capacity for known hot keys.
5. For each secondary access path, choose local or global index and state the read cost (fan-out) and freshness (async global index) the application must tolerate.
6. Choose the rebalancing strategy and the initial partition count or pre-split points; never mod by node count.
7. Choose routing (any node, routing tier, aware client) and how stale routing is detected and retried.
8. Load-test with production-like key distributions; watch per-partition load, not just cluster averages.
9. For resharding, partition-count changes or rebalancing on production, confirm the environment, get approval, throttle data movement, and keep a revert or pause plan.

## Red flags

- Shard key chosen from the schema's primary key without checking the query patterns.
- Timestamp, autoincrement or other monotonic value as the leading range key for write-heavy data.
- `hash(key) % nodeCount`, or a non-stable hash function, for placement.
- Partition count left at a default that caps future growth, or set so high that per-partition overhead dominates.
- Dynamic-partitioned store loaded in bulk with no pre-split.
- Frequent queries that always scatter/gather across every shard, with p99 latency tracked only as an average.
- Reading a global secondary index right after a write and assuming it reflects it.
- Hand-maintained secondary index in a key-value store with no transactional update or reconciliation.
- Salting every key "just in case", or salting with no registry so readers miss data.
- Fully automatic rebalancing triggered by failure detection with no throttling or human check.
- Cross-partition writes assumed to be atomic without transactions.

## Related

- `../Replication/replication.md` — each partition is replicated; lag across partitions breaks consistent prefix reads.
- `../Transactions/transactions.md` — multi-partition writes and keeping a global index consistent.
- `../ConsistencyAndConsensus/consistencyAndConsensus.md` — agreement on partition assignment and coordination services.
- `../../Foundations/StorageAndRetrieval/storageAndRetrieval.md` — sorted SSTables and B-trees behind range partitions and compound keys.
- `../../Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` — load parameters, percentiles and tail latency amplification.
- `../../DerivedData/BatchProcessing/batchProcessing.md` — partitioned joins and parallel execution over large datasets.
- `../../../DBA/Oracle/SqlAndSqlPlus/Partitioning/partitioning.md` — Oracle range, hash, list and composite partitions with local vs global indexes (when installed).
- `../../../DBA/PostgreSQL/TablesConstraintsIndexes/tablesConstraintsIndexes.md` — single-node PostgreSQL table partitioning and indexes (when installed).
- `../../../CleanCode/Systems/systems.md` — keeping placement and routing concerns behind clear boundaries (when installed).
