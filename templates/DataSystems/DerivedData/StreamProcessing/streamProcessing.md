---
name: ddia-stream-processing
description: "How to transmit, store and process unbounded event streams: events, producers, consumers and topics, backpressure vs buffering vs dropping, direct messaging and webhooks, AMQP/JMS message brokers (load balancing, fan-out, acknowledgements, redelivery reordering) vs partitioned log brokers (offsets, consumer groups, retention, replay), keeping systems in sync without dual writes, change data capture with initial snapshots and log compaction, event sourcing, commands vs events, CQRS read views, immutability and true deletion, stream uses (CEP, stream analytics, materialized views, search on streams), event time vs processing time, stragglers and watermarks, device clock skew, tumbling/hopping/sliding/session windows, stream-stream, stream-table and table-table joins, and fault tolerance via microbatching, checkpointing, atomic commit, idempotent writes and state recovery, based on Chapter 11 (Stream Processing) of Designing Data-Intensive Applications. Use when choosing between RabbitMQ/SQS-style queues and Kafka/Kinesis/Pulsar logs, designing topics, partition keys and consumer groups, a consumer lags or reprocesses messages, messages arrive out of order or twice, keeping a cache, search index or warehouse in sync with a database, setting up Debezium, CDC, logical decoding, the outbox pattern or compacted topics, building event-sourced or CQRS systems, windowed aggregations, late events or watermarks in Flink, Kafka Streams, Spark Structured Streaming or Beam, enriching events with reference data, or needing exactly-once, idempotent consumers, or offset commits."
---

# Stream Processing

A stream job is a batch job whose input never ends: it reads events read-only and writes derived output. Make one durable, ordered log the source of truth for each piece of state, derive every other system (caches, indexes, views) from it by consuming in order, window by event time, and make every side effect either atomic with the offset commit or idempotent.

## Transport: answer two questions first

1. **Producers faster than consumers?** Drop, buffer (how big, in memory or on disk?), or apply backpressure (block the producer).
2. **Node crash or consumer offline?** Which messages are lost, and what durability (disk, replication) does avoiding loss cost?

| Option | Durability | Use for | Watch out |
|---|---|---|---|
| UDP multicast, StatsD-style metrics | Lossy | Low-latency feeds, approximate metrics | Silent loss corrupts counters |
| Brokerless (ZeroMQ, nanomsg), webhooks | Producer and consumer must be online | Simple push between live services | Producer crash loses its retry buffer |
| AMQP/JMS broker (RabbitMQ, ActiveMQ, SQS, Azure Service Bus) | Disk optional, deleted on ack | Task queues, expensive independent jobs | No replay; redelivery reorders |
| Log broker (Kafka, Kinesis, Pulsar, Redpanda) | Durable, retained by time/size or compacted | Ordered high-throughput streams, derived data, replay | Parallelism capped by partitions; head-of-line blocking |

### AMQP/JMS-style brokers

- **Load balancing** (shared queue): each message goes to one consumer; add consumers to parallelize slow work.
- **Fan-out** (topic/exchange bindings): each subscriber group gets every message. Combine both: groups fan out, members of a group share.
- Consumers must **ack** after processing; unacked messages are redelivered. A lost ack means the message is processed twice, so handlers must be idempotent.
- Load balancing plus redelivery reorders messages. Do not use it where messages for the same entity depend on each other.

### Partitioned logs

- Producers append to a partition; each message gets a monotonically increasing **offset**. Order is total within a partition, undefined across partitions.
- Choose the partition key so that every message whose relative order matters (all events for one account, one order) shares a key.
- A consumer group assigns whole partitions to members; each reads its partitions sequentially. Max useful consumers = partition count, so size partitions for future parallelism.
- The broker stores only per-partition committed offsets, like a replication log sequence number. After a crash the replacement resumes from the last committed offset, reprocessing anything after it.
- Retention is a large on-disk ring buffer. Alert on **consumer lag** well before lag exceeds retention, or the consumer silently skips deleted segments.
- Consuming is non-destructive: start a copy of a consumer from an earlier offset, write to a new location, and compare. This is the stream equivalent of re-running a batch job.

Current note: Kafka has had idempotent and transactional producers since 0.11, enabling exactly-once read-process-write within Kafka; Kafka runs without ZooKeeper using KRaft (ZooKeeper mode removed in 4.0); recent Kafka releases add share groups (KIP-932) for queue-style per-message consumption on top of logs.

## Keep systems in sync: never dual-write

Writing from application code to the database, then the search index, then the cache causes two problems: concurrent clients can interleave so the systems end permanently different, and one write can fail while another succeeds.

- Pick one **system of record** and make all others followers that consume its change log in order.
- **Change data capture (CDC)**: read the database's replication log (PostgreSQL logical decoding, MySQL binlog, MongoDB change streams/oplog, Oracle GoldenGate or LogMiner) and publish changes to a log broker. Debezium and Kafka Connect are the common tooling. Triggers writing a changelog table also work but are fragile and slow.
- **Transactional outbox**: when the application must emit domain events, insert the event into an `outbox` table in the same transaction as the state change, and let CDC or a relay publish it.
- **Initial snapshot**: a new derived system needs the full current state, not just recent changes. Take a consistent snapshot tied to a log position and apply changes from exactly that position (Debezium does this by default).
- **Log compaction**: with keyed full-row change events, a compacted topic keeps the latest value per key (a null value is a tombstone meaning delete). A new consumer reading from offset 0 rebuilds the whole dataset without touching the source database.

```
# Kafka topic for keyed CDC / state changelog
cleanup.policy=compact
min.compaction.lag.ms=3600000
```

- CDC is asynchronous: derived systems lag, so all replication-lag anomalies apply (read-your-writes, monotonic reads).
- **Safety**: a PostgreSQL replication slot whose consumer stops makes the primary retain WAL until the disk fills. Monitor slot lag, get approval before creating slots or publications on production, and know how to drop the slot as the revert step.

Current note: many databases now expose first-class change streams (MongoDB change streams since 3.6, PostgreSQL logical replication since 10, DynamoDB Streams, Cosmos DB change feed), so prefer the supported interface over parsing internal logs.

## Event sourcing and CQRS

| Aspect | CDC | Event sourcing |
|---|---|---|
| Application writes | Mutable rows, unaware of the log | Immutable domain events, append-only |
| Event meaning | Low-level row change | User intent ("SeatReserved") |
| Compaction | Latest value per key suffices | Needs full history; use snapshots for speed |

- **Commands vs events**: a command may still fail. Validate it synchronously (uniqueness, seat availability) before appending; once appended it is a fact that consumers cannot reject. Alternatively split into a tentative event and a later confirmation event.
- Corrections are new compensating events, never edits of old ones, like an accounting ledger.
- Derive state with deterministic code so replaying the log reproduces it.
- **CQRS**: write in a form optimized for appending; derive several read-optimized, denormalized views. To ship a new feature, build a new view from the log alongside the old one instead of migrating a schema in place, then retire the old view.
- Design each event as a self-contained description of one user action, so one append is atomic and multi-object transactions become unnecessary. Partition the log and the state the same way so a single-threaded consumer per partition needs no locking.
- Read-your-writes on async views: route the user's read to a view that has caught up to their write's offset, or update view and log in one transaction.
- **Deletion**: immutability conflicts with privacy law and leaked secrets. Plan for true deletion (crypto-shredding with per-subject keys, excision, compacting tombstones, purging backups) rather than appending a "deleted" event.

## What to do with a stream

- Write it to a database, cache or index (materialized view, possibly from the beginning of time, so the framework must retain or compact state indefinitely).
- Push it to humans (alerts, notifications, dashboards).
- Derive other streams through a pipeline of operators.
- **CEP**: persistent pattern queries over events (Esper, Flink CEP, `MATCH_RECOGNIZE`). **Stream analytics**: rates, rolling averages, percentiles per window; approximate algorithms (HyperLogLog, sketches) are an optimization, not inherent to streaming. **Search on streams**: store queries, run documents past them (Elasticsearch percolator).
- Actor/RPC messaging is for concurrency between services; stream processing is for durable, multi-subscriber, acyclic data pipelines.

## Reasoning about time

- **Event time** (when it happened) vs **processing time** (when the operator saw it). Window by event time; processing-time windows invent spikes after restarts, backlogs and replays.
- Events arrive out of order across producers and partitions; never assume arrival order equals event order.
- **Stragglers**: you can never be sure a window is complete. Either drop late events (count them as a metric and alert on spikes), or emit a corrected result (retract and update). A **watermark** declares "no more events before t" and closes windows; set allowed lateness explicitly.
- **Whose clock**: device clocks are untrustworthy and offline devices send hours later. Record time occurred (device), time sent (device) and time received (server); estimate device offset as received minus sent and adjust the occurred time.

| Window | Definition | Implement as |
|---|---|---|
| Tumbling | Fixed length, no overlap | Round timestamp down to window size |
| Hopping | Fixed length, overlapping by a hop | Aggregate adjacent tumbling windows |
| Sliding | Events within an interval of each other | Time-sorted buffer, evict expired |
| Session | Per key, ends after an inactivity gap | Per-key state with gap timeout |

```sql
-- Flink SQL: event-time tumbling window with a 30 s watermark
CREATE TABLE clicks (
  user_id STRING, url STRING, ts TIMESTAMP(3),
  WATERMARK FOR ts AS ts - INTERVAL '30' SECOND
) WITH ('connector' = 'kafka', 'topic' = 'clicks', 'format' = 'json');

SELECT window_start, url, COUNT(*) AS clicks
FROM TABLE(TUMBLE(TABLE clicks, DESCRIPTOR(ts), INTERVAL '1' MINUTE))
GROUP BY window_start, window_end, url;
```

## Stream joins

| Join | Inputs | State kept | Example |
|---|---|---|---|
| Stream-stream (window join) | Two event streams | Events from both sides within the window, indexed by key | Search and click by session within 1 hour |
| Stream-table (enrichment) | Events + a table's changelog | Local copy of the table, updated via CDC | Add user profile to activity events |
| Table-table (view maintenance) | Two changelogs | Both tables; output is a changelog of the joined view | Per-user timelines from tweets and follows |

- Do not enrich by querying a remote database per event; keep a local, CDC-maintained copy (Kafka Streams `KTable`/`GlobalKTable`, Flink broadcast or keyed state).
- Embedding search details into click events is not a join: you lose the searches nobody clicked.
- Joins are time-dependent: which profile version does an event see? Without a defined cross-stream order the result is non-deterministic on replay. Use versioned (temporal) tables joined on event time when correctness matters.

## Fault tolerance and exactly-once

Exactly-once means the visible effect is as if each event were processed once, even though retries happen.

- **Microbatching** (Spark Streaming): small batches of about a second; implies processing-time tumbling windows of the batch size. **Checkpointing** (Flink): barrier-triggered snapshots of operator state; on failure, restore and replay from the checkpoint's offsets.
- Both only cover state inside the framework. Output that leaves it (database writes, emails, external topics) repeats on retry unless you add one of:
  - **Atomic commit**: output, state changes and offset advance commit together (Kafka transactions with `read_committed` consumers, Flink two-phase-commit sinks).
  - **Idempotent writes**: store the source partition and offset with each write and skip anything already applied. Requires replay in the same order, deterministic processing, a single writer per key, and fencing of zombie instances.

```ts
// Offset and effect committed in one DB transaction: safe to replay
await db.tx(async (t) => {
  const done = await t.oneOrNone(
    "SELECT 1 FROM consumer_offsets WHERE topic=$1 AND part=$2 AND off >= $3",
    [msg.topic, msg.partition, msg.offset]);
  if (done) return;
  await t.none("UPDATE balances SET amount = amount + $2 WHERE account=$1",
    [msg.key, msg.value.delta]);
  await t.none(
    `INSERT INTO consumer_offsets(topic, part, off) VALUES ($1,$2,$3)
     ON CONFLICT (topic, part) DO UPDATE SET off = EXCLUDED.off`,
    [msg.topic, msg.partition, msg.offset]);
});
```

```
# Kafka producer / consumer for transactional read-process-write
enable.idempotence=true
acks=all
transactional.id=orders-enricher-1
isolation.level=read_committed
```

- **State recovery**: keep state local to the operator and make it recoverable: periodic snapshots to durable storage (Flink), a compacted changelog topic per state store (Kafka Streams, Samza), or rebuild by replaying a short window or a compacted CDC topic.
- **Safety**: resetting consumer offsets, replaying topics into production sinks, or deleting/compacting topics changes production data. Confirm the environment and consumer group, get approval, prefer replaying into a new output and switching over, and record the original offsets so you can restore them.

## Workflow
1. Identify the system of record for each piece of state and every derived system that must follow it.
2. Choose transport: AMQP-style queue for independent, expensive tasks; partitioned log for ordered, replayable, multi-consumer data. Define overflow behavior (drop, buffer, backpressure) and durability.
3. Pick partition keys that keep causally related events in one partition, and enough partitions for future consumer parallelism.
4. Replace any dual writes with CDC or a transactional outbox; plan the initial snapshot and use compacted topics for keyed state.
5. Define event schemas with evolution rules and decide CDC row events vs domain events (event sourcing); validate commands before they become events.
6. For time-based logic, choose event-time fields, window type, watermark delay and late-event policy; log device and server timestamps for client events.
7. For joins, keep local CDC-fed state instead of remote lookups; decide how time-dependence is resolved.
8. Choose the exactly-once mechanism for every external side effect: transactional sink or idempotent write keyed by offset; add fencing.
9. Monitor consumer lag vs retention, dropped late events, replication slot lag, and state store size.
10. Before replays, offset resets or topic changes in production, confirm the environment, get approval, and keep a revert plan.

## Red flags
- Application code writing to the database and then to a cache, index or queue ("dual writes").
- Processing-time windows feeding business metrics, or rate spikes after every deploy.
- A load-balanced AMQP queue for events whose order matters per entity.
- Offsets committed before the side effect completes (loss) or effects that are not idempotent (duplicates).
- Consumer lag trending toward the retention limit with no alert.
- More consumers in a group than partitions, expecting more throughput.
- Per-event calls to a remote database for enrichment.
- Consumers that "reject" events instead of validating commands before appending.
- Event-sourced systems with no plan for legally required deletion.
- Abandoned replication slots or CDC connectors on a production database.
- Using wall-clock `now()` inside operators, or random order across streams, then expecting deterministic replays.
- Offset resets or topic replays against production sinks without approval and recorded original offsets.

## Related
- `../BatchProcessing/batchProcessing.md` — bounded counterpart: immutable inputs, joins, determinism and reprocessing.
- `../../DistributedData/Replication/replication.md` — replication logs, followers and replication-lag anomalies that CDC inherits.
- `../../DistributedData/Partitioning/partitioning.md` — choosing partition keys and avoiding hot partitions.
- `../../DistributedData/Transactions/transactions.md` — atomicity, serial execution and why one append replaces multi-object transactions.
- `../../DistributedData/TroubleWithDistributedSystems/troubleWithDistributedSystems.md` — unreliable clocks, timeouts and fencing tokens.
- `../../DistributedData/ConsistencyAndConsensus/consistencyAndConsensus.md` — total order broadcast, atomic commit and exactly-once.
- `../../Foundations/EncodingAndEvolution/encodingAndEvolution.md` — event schemas and compatible evolution.
- `../../Foundations/StorageAndRetrieval/storageAndRetrieval.md` — logs, compaction and LSM storage.
- `../../../DBA/PostgreSQL/ReplicationAndExternalData/replicationAndExternalData.md` — logical replication and slots used by CDC (when installed).
- `../../../DBA/Oracle/PlSql/Triggers/triggers.md` — trigger-based change capture and its costs (when installed).
- `../../../CleanCode/Concurrency/concurrency.md` — concurrency hazards that single-threaded partition consumers avoid (when installed).
- `../../../CleanCode/ErrorHandling/errorHandling.md` — retries and failure handling around consumers (when installed).
