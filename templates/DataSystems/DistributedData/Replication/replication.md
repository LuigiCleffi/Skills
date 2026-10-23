---
name: ddia-replication
description: How to choose and operate a replication scheme (single-leader, multi-leader, leaderless), synchronous vs asynchronous and semi-synchronous followers, adding followers from a snapshot plus log position, catch-up recovery, failover and split brain, replication log formats (statement-based, WAL shipping, logical row-based, trigger-based), replication lag anomalies and the read-after-write, monotonic reads and consistent prefix guarantees, write conflict avoidance and convergent resolution, replication topologies, quorums (n, w, r), sloppy quorums, hinted handoff, read repair, anti-entropy, last write wins, happens-before, siblings, tombstones and version vectors, based on Chapter 5 (Replication) of Designing Data-Intensive Applications. Use when adding read replicas or a standby, planning failover or a primary promotion, a user does not see their own update after saving, data appears and then disappears on refresh, comments show before the post they answer, designing multi-region or active-active writes, building offline sync or collaborative editing, tuning Cassandra or Dynamo-style consistency levels, choosing QUORUM or LOCAL_QUORUM, or the user mentions replication lag, eventual consistency, leader election, STONITH, fencing, LSN, binlog, CDC, conflict resolution, LWW, CRDT, vector clock or sibling merge.
---

# Replication

Replicate for one of four reasons (availability, read throughput, latency to users, offline operation) and pick the simplest scheme that meets it: single-leader unless you have a concrete need for writes in several places at once. Then decide explicitly what the application promises users while replicas lag, because every scheme except fully synchronous single-leader will serve stale reads sometimes.

## Choose the scheme

| Scheme | Writes go to | Strengths | Costs |
|---|---|---|---|
| Single-leader (primary/replica) | One leader; followers apply its log in order | No write conflicts, easy to reason about, built into most RDBMSs | Leader is a write bottleneck and a failover point; cross-region writes pay WAN latency |
| Multi-leader (active/active) | Any of several leaders, replicated async to the others | Local writes per region, survives region or link outages, offline clients | Concurrent writes conflict; resolution is your problem; autoincrement, triggers and constraints misbehave |
| Leaderless (Dynamo-style) | Several replicas in parallel, quorum acknowledged | No failover, tolerates slow or dead nodes, tunable latency vs staleness | Weak guarantees, conflicts on concurrent writes, hard to monitor staleness |

- Within one datacenter, multi-leader rarely pays for its complexity. Reserve it for multi-region writes, offline-capable clients (each device is a leader) and real-time collaborative editing.
- Leader-based replication also underpins brokers (Kafka partitions) and replicated block devices; the same failure analysis applies.

Current note: "master/slave" is now usually "primary/replica" or "leader/follower". PostgreSQL BDR lives on as EDB Postgres Distributed; DynamoDB global tables offer multi-region active/active with last-writer-wins reconciliation.

## Synchronous vs asynchronous

- **Synchronous follower:** commit waits for its acknowledgement. Guarantees an up-to-date copy, but if it stalls, all writes stall.
- **Asynchronous follower:** leader does not wait. Writes keep flowing when followers fall behind, but a leader crash loses acknowledged writes not yet shipped.
- **Semi-synchronous:** one synchronous follower, the rest async; promote another follower to synchronous if it fails. Data is on at least two nodes at commit.
- Many followers or geographically distant followers force async in practice. Lag is usually sub-second but unbounded: recovery, load spikes and network trouble push it to minutes.

```sql
-- PostgreSQL: one of two named standbys must confirm each commit
ALTER SYSTEM SET synchronous_standby_names = 'ANY 1 (replica_a, replica_b)';
SELECT pg_reload_conf();
```

## Adding followers and recovering them

1. Take a consistent snapshot without locking the whole database (the backup tool usually does this).
2. Record the exact replication-log position the snapshot corresponds to (PostgreSQL LSN, MySQL binlog coordinates or GTID).
3. Restore on the new node, connect to the leader and stream everything after that position until caught up.

- A follower that restarts or loses its link replays from the last position in its local log (catch-up recovery). Make sure the leader retains enough log (slots, retention settings) for that, and alert when retained log threatens the disk.
- Plain file copies of a live database are not consistent; never seed a replica that way.

## Failover

Steps: detect the leader is dead (almost always a timeout), choose the most up-to-date follower (a consensus problem; use the database's or a proven coordinator's election, never a homegrown one), repoint clients and other followers, and force the old leader to rejoin as a follower.

What goes wrong:
- **Lost writes:** an async follower promoted without the last writes; when the old leader returns, its unreplicated writes are usually discarded.
- **Outside systems disagree:** if IDs, cache keys or messages already left the database (Redis, search index, emails), a promoted laggard can reissue the same autoincrement IDs for different rows. Prefer IDs that cannot collide (UUIDs, sequences with gaps reserved, or reconcile external stores on failover).
- **Split brain:** two nodes both accept writes. Fence the old leader (STONITH, revoke its storage or network access, fencing tokens) and verify fencing cannot kill both.
- **Timeout tuning:** too long means slow recovery; too short means spurious failovers that add load exactly when the system is already struggling.

Many teams keep failover manual or require approval even when automation exists. Any promotion, demotion or fencing action on production: confirm the environment, get approval, record the current topology and log positions, and have a documented path back.

## Replication log formats

| Format | How | Watch out for |
|---|---|---|
| Statement-based | Ship the SQL text | `NOW()`, `RAND()`, autoincrement order, triggers and UDFs diverge across replicas |
| WAL / physical shipping | Ship storage-engine byte changes | Ties replicas to the same engine version and platform; major upgrades usually need downtime or a logical path |
| Logical (row-based) | Ship row inserts/updates/deletes (by primary key) plus commit markers | Tables without a primary key need full old-row images; good for cross-version, CDC and warehouses |
| Trigger-based / app-level | Triggers write to a change table, a process ships it | Flexible (subset, cross-engine, custom conflict logic) but slower and buggier than built-in |

- Prefer logical replication when you need zero-downtime major upgrades (upgrade followers, then fail over), selective tables, or a change stream for other systems.

Current note: MySQL defaults to row-based binlogs (since 5.7.7); PostgreSQL has built-in logical replication since 10, and Debezium-style CDC over logical logs is the common way to feed Kafka, caches and search indexes.

## Replication lag: decide the guarantee

Ask: what does a user see if lag reaches minutes? If the answer is "a bug report", pick a guarantee below and implement it deliberately rather than pretending replication is synchronous.

| Anomaly | Guarantee | Practical techniques |
|---|---|---|
| User saves, reloads, change is gone | Read-after-write (read-your-writes) | Read user-editable data from the leader; read from leader for N seconds after a write; track the user's last write position and only use replicas past it |
| Data appears, then vanishes on refresh | Monotonic reads | Pin each user to one replica (hash of user ID), fail over to another only when it is down |
| Reply visible before the question | Consistent prefix reads | Keep causally related writes in one partition, or use a store with snapshot reads across partitions |

```ts
// Read-your-writes with PostgreSQL LSNs: remember the write position, read only from caught-up replicas
const { rows } = await primary.query("SELECT pg_current_wal_lsn() AS lsn");
session.minLsn = rows[0].lsn;

async function readPool(session: Session): Promise<Pool> {
  if (!session.minLsn) return pickReplica(session.userId); // stable per user: monotonic reads
  const r = await pickReplica(session.userId).query(
    "SELECT pg_wal_lsn_diff(pg_last_wal_replay_lsn(), $1) >= 0 AS fresh", [session.minLsn]);
  return r.rows[0].fresh ? pickReplica(session.userId) : primary;
}
```

- Cross-device read-your-writes needs the last-write position stored server-side, and all of a user's devices routed to the region holding the leader.
- Wall-clock timestamps for "last write" depend on clock sync; prefer log positions.
- These workarounds add application complexity; when they spread, that is a sign you need transactions or a stronger store, not more routing rules.

## Multi-leader: handling write conflicts

Conflicts are detected asynchronously, after both writers were told "ok". Plan in this order:

1. **Avoid them.** Route all writes for a record (or user) to one home leader so each record is effectively single-leader. Re-homing (region failure, user moved) reopens the conflict window.
2. **Converge.** Every replica must reach the same final value. Options: highest write ID or timestamp wins (LWW, loses data), replica priority (loses data), merge values, or store all versions and resolve later.
3. **Custom resolution.** On write: a handler runs in the replication process (fast, no user interaction). On read: all versions are kept and the application or user merges them (CouchDB style).
4. **Use mergeable types** where semantics allow: CRDT counters, sets, maps, lists; operational transformation for text.

- Resolution works per row or document, not per transaction; multi-row invariants can break.
- Some conflicts are semantic, not same-field: two bookings of one room on different leaders both pass the availability check. Identify such invariants before choosing multi-leader.
- Topologies: circular and star forward writes through intermediate nodes (tag writes with origin node IDs to stop loops; one dead node can halt flow). All-to-all is more fault tolerant but writes can arrive out of causal order (an update before its insert); timestamps do not fix that, version vectors do.
- Read the product's documentation on conflict detection and causal ordering, then test it: many tools detect conflicts poorly or not at all.

Current note: CRDT libraries such as Automerge and Yjs are now common for local-first and collaborative apps.

## Leaderless: quorums

- With n replicas, writes wait for w acknowledgements, reads query r replicas; if `w + r > n` the read and write sets overlap. Common: n = 3, w = r = 2 (tolerates one node down); n = 5, w = r = 3 (tolerates two).
- Requests go to all n replicas; w and r only decide how many responses you wait for. Fewer than w or r reachable means an error.
- Repair paths: **read repair** (client writes the newer version back to stale replicas; covers hot keys) and **anti-entropy** (background diffing; covers rarely read keys). Without anti-entropy, cold data can stay under-replicated indefinitely.
- **Sloppy quorum + hinted handoff:** accept writes on reachable non-home nodes and hand them back later. Improves write availability but breaks the overlap guarantee until handoff completes; know whether your store enables it.
- Even with `w + r > n` you can read stale data: sloppy quorums, concurrent writes resolved by LWW, a write concurrent with a read, a failed write left on some replicas (not rolled back), or a node restored from an older replica. Treat quorums as probability tuning, not linearizability, and do not expect read-your-writes or monotonic reads for free.
- Multi-datacenter: count replicas per datacenter and wait only for a local quorum (Cassandra `LOCAL_QUORUM`), letting remote replication proceed async.

```
-- cqlsh: per-session consistency for a read-heavy path that must see its own writes
CONSISTENCY LOCAL_QUORUM;
```

## Concurrent writes, LWW and version vectors

- Two operations are concurrent when neither knew about the other, regardless of wall-clock time. If A happened before B, B may overwrite A; if concurrent, it is a conflict to merge.
- **Last write wins** converges by discarding all but the highest timestamp, silently dropping acknowledged writes (and, with clock skew, even non-concurrent ones). Acceptable for caches; otherwise only safe if each key is written once (for example a fresh UUID per event).
- **Version numbers per key:** clients read before writing, send back the version they read, and merge all returned values. The server overwrites values at or below that version and keeps newer ones as **siblings**. A write without a version overwrites nothing.
- Merging siblings: union works for add-only sets; removals need **tombstones** (deletion markers with versions) or removed items reappear. Prefer built-in CRDT types over hand-written merge code.
- With several replicas accepting writes, use a **version vector** (one counter per replica per key), returned on read and sent back on write; it lets the store tell overwrite from concurrent write when reads and writes hit different replicas.

Current note: Riak, the main sibling and dotted-version-vector example, is no longer actively developed by its original vendor; Cassandra still resolves per-cell conflicts by timestamp (LWW).

## Monitoring

- Leader-based: lag is leader log position minus follower position; alert on it and on replicas excluded from read pools.

```sql
SELECT application_name, state, sync_state, replay_lag FROM pg_stat_replication;  -- PostgreSQL 10+, on the primary
```

- Leaderless: there is no single order to subtract; track hinted-handoff backlog, read-repair rates and repair job completion, and alert when anti-entropy falls behind.
- Put a number on "eventually": define an acceptable lag and page when it is exceeded.

## Workflow

1. State why you replicate: availability, read scaling, latency, or offline/multi-region writes.
2. Default to single-leader; justify multi-leader or leaderless with a requirement single-leader cannot meet.
3. Choose sync, semi-sync or async per follower from durability needs versus write availability; write down the data-loss window on failover.
4. List each user-facing read path and the guarantee it needs (read-your-writes, monotonic, consistent prefix); implement routing or position tracking for each, or route that path to the leader.
5. For multi-leader or leaderless: enumerate conflicting operations (same field and semantic invariants), choose avoidance, merge strategy or CRDT types, and test concurrent writes and node outages explicitly.
6. For leaderless: set n, w, r per datacenter, confirm sloppy-quorum and anti-entropy settings, and decide whether LWW data loss is acceptable per table.
7. Plan failover: detection timeout, election mechanism, fencing, client repointing, ID collision with external systems; rehearse it in a non-production environment.
8. Add lag and repair monitoring with alert thresholds before relying on replicas for reads.
9. Before changing replication or failover settings on production, confirm the environment, get approval, record the current configuration and positions, and have a revert plan.

## Red flags

- Reading from async replicas everywhere with no stated staleness policy, and "save then redirect" flows that read back from a replica.
- All followers synchronous, or a single synchronous follower with no replacement plan (one slow node stops all writes).
- Automatic failover with no fencing, a very short timeout, or no plan for writes the old leader had not shipped.
- Autoincrement IDs shared with caches, search or other stores across a failover.
- Statement-based replication with non-deterministic functions.
- Multi-leader adopted for a single datacenter, or without a written conflict-resolution rule.
- LWW (or Cassandra default timestamps) on data where silently losing an acknowledged write is unacceptable.
- Treating `w + r > n` as strong consistency, or enabling sloppy quorums and still assuming reads see the latest write.
- Hand-written sibling merges without tombstones (deleted items return).
- No alert on replication lag, retained WAL, or abandoned replication slots.

## Related

- `../Partitioning/partitioning.md` — each partition is replicated with one of these schemes; partitioning causes consistent-prefix problems.
- `../Transactions/transactions.md` — stronger guarantees than replica routing can provide; lost updates and write skew.
- `../TroubleWithDistributedSystems/troubleWithDistributedSystems.md` — timeouts, clock skew behind LWW, fencing tokens.
- `../ConsistencyAndConsensus/consistencyAndConsensus.md` — linearizability, leader election and why quorums are not linearizable.
- `../../Foundations/StorageAndRetrieval/storageAndRetrieval.md` — WAL and log-structured storage that physical replication ships.
- `../../Foundations/EncodingAndEvolution/encodingAndEvolution.md` — logical log formats and mixed-version replicas during rolling upgrades.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — change data capture built on logical replication logs.
- `../../../DBA/PostgreSQL/ReplicationAndExternalData/replicationAndExternalData.md` — concrete PostgreSQL streaming and logical replication setup (when installed).
- `../../../DBA/Oracle/HitchhikersGuides/RealApplicationClusters/realApplicationClusters.md` — Oracle clustering and standby context (when installed).
- `../../../CleanCode/Concurrency/concurrency.md` — reasoning about concurrent updates in application code (when installed).
