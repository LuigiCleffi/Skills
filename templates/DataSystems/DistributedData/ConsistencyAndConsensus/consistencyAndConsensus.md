---
name: ddia-consistency-and-consensus
description: How to choose and verify consistency guarantees in replicated systems and when a problem needs consensus, covering eventual consistency, linearizability vs serializability, linearizable locks, leader election and uniqueness constraints, cross-channel races, which replication schemes can be linearizable, why strict quorums are not enough, CAP and the latency cost of linearizability, causal consistency, Lamport timestamps vs version vectors, non-causal sequence generators, total order broadcast and state machine replication, two-phase commit (2PC), coordinator failure and in-doubt transactions, XA/JTA heuristic decisions, 3PC, consensus properties, epochs and majority quorums (Raft, Paxos, Zab, VSR), and coordination services such as ZooKeeper, etcd and Consul, based on Chapter 9 (Consistency and Consensus) of Designing Data-Intensive Applications. Use when the user asks for "strong consistency", read-after-write across services, a distributed lock, leader election, split brain, fencing tokens, a globally unique username or seat booking, CAP, CP vs AP, w + r > n, linearizable reads, etcd or ZooKeeper sync, Lamport clocks, ordering events across nodes, total order or atomic broadcast, 2PC, XA, PREPARE TRANSACTION, in-doubt or stuck prepared transactions, exactly-once processing across a database and a queue, distributed transactions across microservices, Raft or Paxos, quorum size, or designing automatic failover.
---

# Consistency and Consensus

First name the guarantee the feature actually needs: eventual, causal, or linearizable. Pay for linearizability (and the consensus behind it) only where a single up-to-date answer must be decided right now (locks, leader, uniqueness, last seat); use causal ordering or compensation everywhere else; and never implement consensus yourself when a proven service (etcd, ZooKeeper, Consul, a consensus-backed database) can do it.

## Pick the consistency model

| Model | Guarantee | Cost | Good for |
|---|---|---|---|
| Eventual (convergence) | Replicas agree once writes stop; no bound on when | Cheapest, stays available | Counters, feeds, caches, analytics |
| Causal | Cause is seen before effect everywhere; concurrent ops may differ in order | No cross-replica wait; survives partitions | Comments/replies, chat, collaborative edits, most "read your writes" needs |
| Linearizable | Acts like one copy; once any read sees a value, every later read does | Latency on every op, unavailable on the minority side of a partition | Locks, leader election, uniqueness at write time, CAS, fencing |

- Eventual consistency bugs surface only under faults or high concurrency, so tests passing proves little. Assume the weakest guarantee the store documents, not what you observe.
- Linearizability is a recency guarantee on a single object. Serializability is an isolation guarantee over multi-object transactions. Both together are strict serializability. SSI and snapshot reads are serializable but not linearizable by design.
- Partitioning per key does not break linearizability for single-key ops; cross-partition operations are a separate problem (see atomic commit below).

## Where linearizability is truly required

- **Locks and leader election:** every node must agree who holds the lock, or it is useless. Use a lease plus a fencing token, never a bare lock.
- **Uniqueness and hard limits enforced at write time:** username, file path, seat, stock never below zero, balance never negative.
- **Cross-channel races:** when two components talk through two channels (write blob to storage, then send a queue message), the message can outrun storage replication and the consumer reads a stale or missing object.

Before demanding linearizability, ask whether an apology is acceptable. Overbooking, oversold stock and overdrafts can often be fixed by a compensating action (cancel, refund, reorder, daily limit), and the business usually needs that workflow anyway for physical-world errors. Foreign keys and attribute checks do not need linearizability.

Fix for cross-channel races when you own both channels: pass the version with the message and make the consumer wait or retry until it sees it.

```ts
// producer
const { version } = await blobStore.put(key, bytes);          // returns etag/generation
await queue.send({ key, version });

// consumer
const obj = await blobStore.get(key, { ifMatch: msg.version }); // fail -> retry later, never process stale
```

## Which replication setups can be linearizable

| Setup | Linearizable? | Notes |
|---|---|---|
| Single leader, reads from leader or sync follower | Potentially | Breaks if a deposed leader keeps serving, or async failover loses writes; snapshot isolation also breaks it |
| Consensus (Raft, Zab, Paxos) | Yes | Built to prevent split brain and stale reads |
| Multi-leader | No | Concurrent writes on several nodes need conflict resolution |
| Leaderless / Dynamo quorums | Assume no | LWW with wall clocks and sloppy quorums are non-linearizable; even strict `w + r > n` can return new then old to successive readers |

- Leaderless quorums can be made linearizable for plain read/write only with synchronous read repair and read-before-write, at a large latency cost; CAS still needs consensus.
- Coordination services: writes are linearizable but reads may be served stale by a follower unless you ask otherwise (ZooKeeper `sync()` before read).

Current note: etcd v3 serves linearizable reads by default; serializable (possibly stale, local) reads must be requested explicitly (`--consistency=s`, or `serializable: true` in the API).

## The cost: CAP and latency

- During a network partition, a linearizable system must make the disconnected side wait or error; a system that tolerates divergence keeps serving. That is the whole useful content of CAP. "Pick 2 of 3" is misleading because partitions are not optional, and the CP/AP labels hide too much: describe behavior per operation instead.
- The bigger cost is everyday latency: linearizable response time is bounded below by network delay uncertainty, partitions or not. Most systems drop linearizability for speed, not fault tolerance (CPU caches do the same).
- Multi-region with one leader: clients in follower regions lose writes and linearizable reads when the inter-region link breaks. If that is unacceptable, either route clients to the leader region or redesign that feature to not need linearizability.

## Ordering and causality

- Causality is a partial order (concurrent ops are incomparable, like git branches); linearizability is a total order. Linearizable implies causal, but causal consistency is the strongest model that does not wait on the network and stays available in a partition. Many "needs strong consistency" requirements only need causal.
- To be causal, a replica must apply an operation only after everything it depended on. Track dependencies by passing the version you read back on the write (version vectors, read tokens).
- Single-leader replication log order is a total order consistent with causality; followers applying it in order are causally consistent even when lagging.

Current note: some products expose causal guarantees directly, for example MongoDB causally consistent sessions (3.6+).

### Sequence numbers

| Generator | Unique | Consistent with causality |
|---|---|---|
| Per-node counters (odd/even, node bits) | Yes | No: nodes run at different rates |
| Wall-clock timestamps (LWW) | Mostly | No: clock skew |
| Pre-allocated ID blocks | Yes | No |
| Lamport timestamp `(counter, nodeId)` | Yes | Yes |
| Single-leader log / linearizable counter | Yes, gap-free | Yes |

```ts
// Lamport clock: carry max seen on every request and response
class LamportClock {
  private counter = 0;
  constructor(private readonly nodeId: number) {}
  tick(): [number, number] { return [++this.counter, this.nodeId]; }
  observe(remoteCounter: number) { this.counter = Math.max(this.counter, remoteCounter); }
}
// order: compare counter, then nodeId
```

- Lamport timestamps give a total order but cannot tell concurrent from dependent; use version vectors when you must detect concurrency (conflict detection).
- Timestamp ordering is not enough to decide "is this username free?" now: a lower timestamp may still arrive from a node you have not heard from. You need to know when the order is final, which is total order broadcast.

## Total order broadcast

Two properties: reliable delivery (delivered to one means delivered to all) and identical order everywhere; once delivered, nothing may be inserted earlier. Equivalent to an append-only log.

- Uses: state machine replication (same writes, same order, deterministic apply), serializable execution of stored procedures across partitions, lock service whose log position is the fencing token (ZooKeeper `zxid`).
- Linearizable CAS on top of a log: append a claim, wait until your own entry comes back, the first claim for the key wins, others abort. Writes are then linearizable; reads from an async-applied store are not (sequential consistency) unless you sequence the read through the log, wait for the latest log position (`sync()`), or read a synchronously updated replica.
- Conversely, a linearizable increment-and-get register gives gap-free sequence numbers and hence total order broadcast. Linearizable CAS, total order broadcast, and consensus are equivalent: building any one fault-tolerantly means building consensus.
- Scope check: partitioned logs (Kafka topic partitions, per-shard leaders) order only within a partition; cross-partition ordering needs extra coordination.

## Atomic commit and 2PC

Sending "commit" to each node independently can leave some committed and some aborted, and a commit cannot be retracted once visible. 2PC fixes this with two points of no return:

1. Coordinator assigns a global transaction ID; work runs as local transactions on each participant.
2. Prepare: each participant persists everything and checks constraints, then votes yes, giving up the right to abort.
3. Coordinator logs the decision durably (the commit point), then sends commit/abort and retries forever.

- Coordinator crash after yes votes leaves participants **in doubt**, holding row locks until it recovers, possibly forever if its log is lost. Neither timeout-abort nor timeout-commit is safe.
- 3PC needs bounded delays and a perfect failure detector; do not rely on it.
- 2PC is not 2PL (locking for isolation). Keep the names apart in reviews.

```sql
-- PostgreSQL participant side (max_prepared_transactions must be > 0)
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 42;
PREPARE TRANSACTION 'tx-7f3a';      -- vote yes; survives restarts, keeps locks
COMMIT PREPARED 'tx-7f3a';          -- or ROLLBACK PREPARED 'tx-7f3a'

SELECT gid, prepared, owner, database FROM pg_prepared_xacts;  -- find in-doubt ones
```

### Distributed transactions in practice

- Database-internal distributed transactions (one product across its own nodes) can work well. Heterogeneous ones (XA/JTA across two vendors, database plus broker) are the painful kind.
- XA is a C-level API, not a network protocol; the coordinator usually lives inside the app process and logs to its local disk, so the "stateless" app server now holds critical durable state and is a single point of failure.
- XA cannot detect cross-system deadlocks and does not work with SSI. Any unavailable participant fails the transaction, so 2PC amplifies failures and adds fsyncs and round trips.
- Exactly-once message handling via XA (ack plus DB write atomically) only covers participants that speak 2PC; an email or HTTP call inside still happens twice on retry.
- Heuristic commit/abort breaks atomicity: an emergency hatch, not a procedure.

Current note: for database plus messaging, prefer the transactional outbox or idempotent consumers with dedup keys over XA; Kafka has offered idempotent and transactional producers (exactly-once within Kafka) since 0.11.

Safety: resolving in-doubt transactions by hand touches production data. Confirm the environment, check every participant for an already-applied outcome, apply that same outcome everywhere, get approval, and record what was done.

## Fault-tolerant consensus

Properties: uniform agreement, integrity (decide once), validity (decided value was proposed), termination (live nodes decide). The first three are safety and hold even when a majority fails; termination needs a working majority.

- Raft, Multi-Paxos, Zab and VSR decide a sequence of values, i.e. they are total order broadcast. Each uses a leader that is unique per epoch (term, ballot, view); a higher epoch wins; every decision needs a majority vote from nodes unaware of a newer epoch, so overlapping quorums expose any newer election.
- Unlike 2PC: majority not unanimity, plus a defined recovery after leader change.
- FLP impossibility applies only to deterministic algorithms without timeouts; real systems use timeouts or randomness.
- Sizing: `2f + 1` voters tolerate `f` failures (3 tolerates 1, 5 tolerates 2). Even sizes add cost without tolerance. The minority side of a partition stops.
- Costs: synchronous replication on every decision, static membership is easiest (membership changes need the protocol's reconfiguration procedure), timeout-driven elections thrash on flaky or cross-region links. Byzantine (lying) nodes are out of scope for these algorithms.

Current note: Raft implementations commonly add PreVote and CheckQuorum to reduce disruptive elections from a partially connected node; enable them where the library supports it.

## Coordination services

ZooKeeper, etcd and Consul give you consensus as a service: linearizable CAS, totally ordered ops with monotonically increasing IDs (fencing tokens), sessions with heartbeats and ephemeral keys (failure detection), and watches (notifications).

- Use them for small, slow-changing metadata: leader of a partition, partition assignment, config, membership. Not for high-rate application state.
- Use library recipes (Apache Curator, etcd `concurrency` package) rather than raw primitives.
- Service discovery does not need consensus (DNS-style staleness is fine); leader discovery does, and non-voting read replicas can serve it.

```text
# Leader election with fencing (pseudocode; map to your client's election recipe)
lease  = coord.grantLease(ttl=10s)                  # kept alive by heartbeats
rev    = coord.createIfAbsent("/election/orders-writer/" + nodeId, lease)
wait until my key has the lowest revision under /election/orders-writer/
token  = rev                                        # monotonically increasing
storage.write(data, fencingToken=token)             # storage rejects token < highest seen
on lease lost: stop writing immediately, re-campaign
```

Current note: Kafka no longer requires ZooKeeper: KRaft mode (Raft-based controller quorum) is production-ready since 3.3 and Kafka 4.0 removed ZooKeeper mode.

Automatic failover without a proven consensus algorithm behaves badly under real network faults. A single-leader database still needs consensus for leadership changes; the leader only moves the problem.

## Workflow
1. List each operation that must "never conflict" and classify it: needs linearizability, causal is enough, or eventual plus compensation is acceptable.
2. For linearizable needs, check what the store actually guarantees per operation (default read mode, leader reads, quorum config, LWW, snapshot isolation); read the docs and any Jepsen analysis rather than assuming.
3. Look for cross-channel races (storage plus queue, DB plus cache, two services) and pass versions or route both through one ordered log.
4. For ordering, choose the generator by need: gap-free and final (log/consensus), causal (Lamport, version vectors), or merely unique (IDs).
5. For multi-system writes, prefer a single database transaction, an outbox, or idempotent steps with compensation; use 2PC only inside one product or when every participant supports it and the coordinator is replicated.
6. For locks, leaders and membership, use a coordination service or consensus-backed database with leases and fencing tokens; size voters as `2f + 1` and place them across failure domains.
7. Test failure: partition a node, pause the leader, kill the coordinator mid-commit, and verify no split brain, no lost acknowledged writes, and that in-doubt transactions are visible and alarmed.
8. For changes to failover, quorum membership, or in-doubt resolution in production: confirm the environment, get approval, and have a written revert plan.

## Red flags
- "We use quorums, so it is strongly consistent" with LWW timestamps, sloppy quorums, or no synchronous read repair.
- A distributed lock without lease expiry and fencing token, or one built on Redis/a cache without consensus.
- Uniqueness checked with a read then write against a replica or eventually consistent store.
- Blob written, message sent, consumer reads blob without version check.
- Ordering events across nodes by wall-clock time or random UUIDs.
- Homegrown leader election or automatic failover script based only on timeouts.
- Even-sized or two-node consensus clusters; all voters in one zone; consensus across high-latency regions without tuning.
- XA coordinator running inside a stateless, auto-scaled app tier with its log on ephemeral disk.
- `pg_prepared_xacts` or XA in-doubt entries older than minutes with nobody alerted; heuristic decisions used routinely.
- Sending email or calling external APIs inside an "exactly-once" distributed transaction.
- Storing high-churn application state in ZooKeeper or etcd.
- Confusing 2PC with 2PL, or linearizability with serializability, in a design doc.

## Related
- `../Replication/replication.md` — leader/follower, failover, replication lag and read-your-writes techniques that this chapter formalizes.
- `../Transactions/transactions.md` — isolation levels, serializability, SSI and write skew versus linearizability.
- `../TroubleWithDistributedSystems/troubleWithDistributedSystems.md` — unreliable clocks, process pauses, majority truth and fencing tokens.
- `../Partitioning/partitioning.md` — per-partition ordering and cross-partition transactions.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — logs, exactly-once and alternatives to distributed transactions.
- `../../Foundations/StorageAndRetrieval/storageAndRetrieval.md` — write-ahead logs and single-node atomic commit.
- `../../../DBA/PostgreSQL/ReplicationAndExternalData/replicationAndExternalData.md` — PostgreSQL synchronous replication and failover settings (when installed).
- `../../../DBA/Oracle/HitchhikersGuides/RealApplicationClusters/realApplicationClusters.md` — shared-disk clustering with fine-grained distributed locks (when installed).
- `../../../DBA/Oracle/BeyondTheBasics/RemoteData/remoteData.md` — database links, where one statement spans several databases (when installed).
- `../../../CleanCode/Concurrency/concurrency.md` — race conditions and shared-state discipline at the code level (when installed).
