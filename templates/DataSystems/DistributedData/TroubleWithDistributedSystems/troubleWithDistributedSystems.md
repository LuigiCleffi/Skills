---
name: ddia-trouble-with-distributed-systems
description: "How to design and review code that talks to other nodes under partial failure: unreliable networks and indistinguishable failure causes, timeouts and adaptive failure detection (Phi Accrual), network congestion and queueing, time-of-day vs monotonic clocks, clock drift, NTP limits and leap seconds, why last-write-wins timestamps lose data, clock confidence intervals and TrueTime, process pauses (GC, VM suspension, swapping), leases, fencing tokens, quorum decisions, Byzantine vs crash faults, system models, and safety vs liveness, based on Chapter 8 (The Trouble with Distributed Systems) of Designing Data-Intensive Applications. Use when choosing a timeout or retry policy, a request times out and you do not know if it was applied, implementing a distributed lock, leader lease or leader election check, debugging split-brain, lost writes, a zombie leader or duplicate processing after a GC pause, ordering events with timestamps across machines, using System.currentTimeMillis, Date.now or wall-clock time to measure durations or expire leases, comparing clocks between servers, configuring NTP or chrony, or the user mentions partial failure, network partition, netsplit, heartbeat, health check, failure detector, cascading failure, clock skew, LWW, Redlock, fencing token, stop-the-world pause, Byzantine fault, system model or safety and liveness."
---

# The Trouble with Distributed Systems

Assume every remote call can be lost, delayed, duplicated or applied without you hearing back; assume clocks lie and that your own process can freeze at any line. Design so that safety never depends on timing: timeouts only decide when to stop waiting, ordering comes from counters not wall clocks, and any "I am the only one" belief is checked by the resource itself with a fencing token.

## Partial failure is the default

- On one machine, hardware faults usually crash everything; across machines, some parts fail while others work, and the outcome of an operation can be unknown.
- A missing response is ambiguous: request lost, request queued, remote node crashed, remote node paused, response lost, or response still on its way. You cannot tell which.
- A timeout tells you only that you stopped waiting. The request may still be executed later.
- Consequence for code: every remote write needs a defined answer to "what if it actually succeeded?" Usually that means idempotency.

```ts
// Retry-safe write: the server stores processed keys and returns the original result on replay.
await payments.charge({ orderId, amountCents }, {
  headers: { "Idempotency-Key": `charge-${orderId}` },
  timeoutMs: 2000,
});
```

```sql
-- Server side: make the side effect and the dedup record one atomic step.
INSERT INTO processed_requests (idempotency_key, result)
VALUES ($1, $2)
ON CONFLICT (idempotency_key) DO NOTHING;   -- 0 rows inserted: replay, return stored result
```

- Handling a network fault does not always mean tolerating it; showing an error during an outage can be acceptable. What is not acceptable is unknown behavior: define it, test it, and confirm the system recovers when the network does.
- Inject faults deliberately (drop, delay, partition, one-way links, pause a process) in a test environment. Untested fault paths have caused clusters to deadlock or delete data.

## Detecting faults

| Signal | What it tells you | Limit |
|---|---|---|
| TCP RST / connection refused | Host up, no process on the port | If the crash was mid-request, you do not know how much was done |
| Node-local watchdog announcing a crash | Fast takeover without waiting for a timeout | Needs the OS to still be alive |
| Switch / hardware link status | Link or power down | Usually unavailable in cloud or over the internet |
| ICMP unreachable | Router believes the host is unreachable | Routers have no better knowledge than you |
| Timeout | Nothing heard in time | Cannot separate slow from dead |

- A TCP ack means the kernel got the bytes, not that the application processed them. Only an application-level response confirms success.
- Treat fast negative signals as a bonus; the general case is silence, and timeouts are the fallback.
- Degraded ("limping") nodes, such as a NIC running at a tiny fraction of its speed, are worse than dead ones; health checks should measure useful work and latency, not just liveness.

## Choosing timeouts

- Short timeout: faster detection, more false positives. Long timeout: slower recovery, users wait.
- Declaring a busy node dead shifts its load to others; under high load this can cascade until every node suspects every other.
- There is no correct constant: asynchronous networks and normal servers have no upper bound on delay. Measure round-trip distributions over long periods and many machines, then pick a trade-off.
- Prefer adaptive detection: track observed latency and jitter and derive suspicion from it (Phi Accrual detectors, used by Akka and Cassandra; TCP retransmission timers work similarly).
- Retries: bound them, add exponential backoff with jitter, and only retry operations that are idempotent or carry an idempotency key.

## Where variable delay comes from

- Queueing at congested switch ports (packets dropped when queues fill, then retransmitted).
- OS run queue when all cores are busy; hypervisor pausing a VM while another uses the core (steal time).
- TCP congestion control queueing at the sender; TCP retransmission hides loss but not the delay.
- Noisy neighbors in shared clouds; batch jobs saturating links.
- Delays grow sharply near full utilization. Keep headroom on links and CPUs that carry latency-sensitive traffic.
- Bounded delay is possible only with static resource reservation (circuits, dedicated hardware, strict QoS). That costs utilization, which is why datacenters and the internet use packet switching. UDP trades reliability for lower jitter and fits data that is worthless when late (voice, video, game state).

## Clocks: pick the right one

| Need | Use | Never use |
|---|---|---|
| Timeout, elapsed time, latency, rate limit window | Monotonic clock (`performance.now()`, `process.hrtime.bigint()`, `System.nanoTime()`, `CLOCK_MONOTONIC`) | Wall clock: it can jump back or forward |
| Human-facing date/time, log timestamp, scheduled reminder | Time-of-day clock (`Date.now()`, `System.currentTimeMillis()`, `CLOCK_REALTIME`) | Monotonic clock: its absolute value is meaningless |
| Ordering events across nodes | Logical clocks (Lamport, version vectors), DB sequence or log offset | Wall-clock timestamps from different machines |

- Monotonic values are comparable only within one process on one machine. NTP may slew their rate slightly but not make them jump.
- Time-of-day clocks drift (quartz, temperature dependent; Google budgets 200 ppm, roughly 17 s per day without sync), get stepped backward by NTP, may ignore leap seconds, and depend on network delay to NTP servers.
- Failure is silent: a firewalled NTP port or a bad server lets a clock drift for days while everything appears to work, and the symptom is quietly lost data, not a crash.
- Devices you do not control (phones, browsers, embedded) may have arbitrarily wrong clocks. Never trust client timestamps for ordering, expiry or security decisions.
- If correctness depends on synchronized clocks, monitor offset on every node and eject nodes beyond a threshold.

Current note: since 2022 the international timekeeping bodies have voted to stop inserting leap seconds by about 2035; until then, prefer leap smearing (as public cloud time services do) and test code for 59- and 61-second minutes. Public clouds now also offer much tighter, hardware-backed time sync (for example AWS Time Sync with PTP-based sub-millisecond accuracy on supported instances) and tools such as AWS ClockBound expose an error bound, but you still must treat time as an interval.

## Last write wins loses data

- LWW (used by Cassandra, Riak and many multi-leader setups) keeps the write with the highest timestamp. With skewed clocks, a causally later write can carry a smaller timestamp and be silently discarded, with no error to the application.
- A node with a slow clock cannot overwrite values written by a fast-clock node until the skew elapses.
- LWW cannot tell sequential writes from truly concurrent ones; equal millisecond timestamps need an arbitrary tiebreaker.
- NTP accuracy is bounded by network round-trip time, the very thing you would need to order finer than. Better sync does not fix this.
- Instead: version vectors or conditional writes (compare-and-set on a version column), CRDTs for mergeable data, or route all writes for a key through one leader.

```sql
UPDATE accounts SET balance = $1, version = version + 1
WHERE id = $2 AND version = $3;     -- 0 rows: someone else wrote first; re-read and retry
```

## Clock readings are intervals

- A timestamp with microsecond digits may be accurate only to tens of milliseconds (or worse over the public internet). Reason about `[earliest, latest]`.
- Uncertainty grows with time since last sync, plus the server's error, plus round-trip time.
- Spanner's TrueTime exposes the interval and waits out the uncertainty before committing, so non-overlapping intervals give a safe order; this needs GPS or atomic references to keep the wait short.
- Distributed ID generators (Snowflake-style) give roughly ordered unique IDs, not causal order.

Current note: TrueTime-style commit wait is no longer Google-only in spirit; CockroachDB and YugabyteDB use hybrid logical clocks with a configured maximum clock offset and will refuse or restart work when offset is exceeded, so clock monitoring is an operational requirement for them.

## Process pauses

A thread can stop at any line for seconds or minutes and resume unaware. Causes:

- Stop-the-world garbage collection.
- VM suspend/resume and live migration; laptop lid close.
- OS or hypervisor context switches under load (steal time).
- Synchronous disk I/O, including hidden I/O (lazy class loading, network block devices).
- Swapping and thrashing (servers often disable swap for this reason).
- `SIGSTOP` sent by mistake.

Consequences: any check-then-act on time is a race. This lease loop is unsafe twice over, because it compares a remote expiry to the local wall clock and assumes no pause between the check and the work:

```ts
if (lease.expiresAtMs - Date.now() > 10_000) {   // remote time vs local clock
  await process(request);                         // a 15 s pause here: lease expired, another leader active
}
```

Mitigations, none of which replace fencing:

- Measure lease durations with the local monotonic clock from the moment of acquisition, minus a safety margin for clock rate error.
- Treat GC like a planned outage: drain traffic from a node before a predicted collection, or restart processes on a schedule before old-generation buildup, one node at a time.
- Hard real-time guarantees require an RTOS, bounded allocation and exhaustive testing; this is uneconomic for server-side data systems, so design for pauses instead.

Current note: the CMS collector named in the book was removed in JDK 14; ZGC and Shenandoah (production-ready since JDK 15) keep pauses to around a millisecond for most workloads, which reduces but does not remove pauses from VMs, swapping, I/O and the scheduler.

## The truth is defined by the majority

- A node cannot trust its own view: with a one-way network fault it can receive but not be heard; after a long pause it does not know time passed. Others will declare it dead.
- Decisions (who is leader, whether a node is dead, whether a write committed) go to a quorum, typically a majority (2 of 3, 3 of 5). Only one majority can exist, so conflicting decisions cannot both win.
- A node outvoted by the majority must step down, even if it feels healthy.

## Leases, locks and fencing tokens

A lock, lease or leader role guarantees nothing once the holder can pause past expiry. The protected resource must reject stale holders.

- The lock service returns a token that increases on every grant (ZooKeeper `zxid` or znode version; etcd revision or lease ID plus revision).
- Every write to the resource carries the token; the resource remembers the highest token seen and rejects lower ones.
- Checking the lock on the client is not enough. The check must live in the resource, which also protects it from buggy or misbehaving clients.

```sql
-- Storage enforces fencing: a write with an older token is rejected.
UPDATE files
SET content = $1, fencing_token = $2
WHERE path = $3 AND fencing_token < $2;   -- 0 rows: stale lock holder, abort
```

- If the resource cannot check tokens natively, embed the token where it can be checked (key name, conditional write, version column).
- Lock services built on independent Redis nodes and timing assumptions (for example Redlock) do not produce fencing tokens; do not use them for correctness-critical mutual exclusion.

## Byzantine faults and weak lying

- This chapter assumes nodes are unreliable but honest. Byzantine fault tolerance (nodes lying or sending corrupted data) needs more than two-thirds honest nodes and complex protocols; it is warranted for aerospace hardware and mutually untrusting parties (blockchains), rarely inside one organization's datacenter.
- BFT does not protect against a bug deployed to every node, nor against an attacker who can compromise identical nodes. Authentication, authorization, encryption and network controls remain the defense.
- Cheap guards against weak lying are worth it: application-level checksums on messages and stored data, strict input validation and size limits at every boundary, multiple NTP servers so an outlier is voted out.

## System models, safety and liveness

- Timing models: synchronous (bounded delay, pauses and clock error; unrealistic), partially synchronous (usually bounded, occasionally not; realistic), asynchronous (no clocks or timeouts at all; very restrictive).
- Node models: crash-stop, crash-recovery (durable storage survives, memory does not), Byzantine.
- Default for real systems: partially synchronous with crash-recovery.
- Write correctness as properties. Safety: nothing bad happens; a violation happens at an identifiable moment and cannot be undone (two leaders, duplicate token). Liveness: something good eventually happens (a request eventually gets a response; eventual consistency).
- Require safety in every situation the model allows, even total network failure. Liveness may be conditional (only when a majority is up and the network recovers).
- Reality breaks models: disks lose "durable" data, firmware forgets drives, a node with amnesia breaks quorum assumptions. Code paths for "impossible" cases should fail loudly and alert a human rather than continue.

## Workflow

1. Ask whether the job fits on one machine; if fault tolerance or geographic latency do not demand distribution, avoid it.
2. State the system model in the design doc: timing assumptions, crash-recovery, no Byzantine nodes (or why there are).
3. For every remote call, list the outcomes (success, failure, unknown) and define behavior for unknown: idempotency key, conditional write, or reconciliation.
4. Set timeouts from measured latency distributions; use adaptive failure detection where available; bound retries with backoff and jitter.
5. Audit clock use: monotonic for durations and lease expiry, wall clock only for display and logs, logical clocks or sequences for ordering. Remove LWW on data that must not be lost.
6. For any single-owner role (leader, lock, unique claim), require a quorum-backed lock service and fencing tokens checked by the resource.
7. Write safety and liveness properties for the critical path and test them under injected partitions, one-way loss, clock jumps and process pauses.
8. Monitor clock offset, GC pause time, steal time and tail latency; alert before they exceed the assumptions in step 2.
9. Before changing failover timeouts, lease durations, NTP configuration or conflict resolution on a production system, confirm the environment, get approval, and have a revert plan; these settings can cause split-brain or silent data loss.

## Red flags

- Retrying non-idempotent writes after a timeout, or treating a timeout as "it failed".
- Using `Date.now()` / `System.currentTimeMillis()` to measure elapsed time, expire leases or compute timeouts.
- Comparing timestamps from different machines (or from clients) to decide which write wins or which event came first.
- Last-write-wins on counters, balances, carts or anything where a lost update matters.
- A distributed lock without fencing, or a resource that trusts the client's claim to hold the lock.
- Leader checks done once, then long work performed without re-validation or fencing.
- Very short fixed timeouts on a loaded cluster; automatic failover that can flap.
- Health checks that only test "process is up".
- No monitoring of NTP/chrony sync status or clock offset on databases that depend on clocks.
- Fault handling paths that have never been exercised in tests.
- Assuming durable storage never loses acknowledged data.

## Related

- `../Replication/replication.md` — failover, split-brain, replication lag and LWW conflict resolution in practice.
- `../Partitioning/partitioning.md` — rebalancing and routing that depend on accurate failure detection.
- `../Transactions/transactions.md` — snapshot isolation and transaction IDs whose distributed versions need clocks or coordination.
- `../ConsistencyAndConsensus/consistencyAndConsensus.md` — linearizability, ordering, and the consensus algorithms that answer this chapter's problems.
- `../../Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` — faults vs failures, tail latency and chaos testing.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — event time vs processing time, idempotent consumers and exactly-once.
- `../../../CleanCode/Concurrency/concurrency.md` — single-machine concurrency discipline whose tools do not carry over to the network (when installed).
- `../../../CleanCode/ErrorHandling/errorHandling.md` — explicit handling of failures and unknown outcomes (when installed).
- `../../../CleanCode/Boundaries/boundaries.md` — validating and wrapping remote services at system boundaries (when installed).
- `../../../DBA/PostgreSQL/ReplicationAndExternalData/replicationAndExternalData.md` — streaming replication and failover in PostgreSQL (when installed).
