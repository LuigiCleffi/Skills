---
name: ddia-reliable-scalable-maintainable
description: "How to reason about the three core non-functional goals of a data system: reliability (faults vs failures, hardware faults, correlated software errors, human error, fault injection), scalability (load parameters, fan-out, throughput vs response time, percentiles p50/p95/p99/p999, tail latency amplification, head-of-line blocking, SLOs and SLAs, scaling up vs scaling out, elastic vs manual scaling) and maintainability (operability, simplicity and accidental complexity, evolvability), based on Chapter 1 (Reliable, Scalable and Maintainable Applications) of Designing Data-Intensive Applications. Use when designing or reviewing a system architecture, writing non-functional requirements, choosing between a cache, queue, search index and database, defining SLOs or latency targets, reading latency dashboards, the user says \"will it scale\", \"make it highly available\", \"it's slow under load\", mentions p99, tail latency, average response time, fan-out, read vs write path, precomputed timelines, chaos testing, cascading failure, runaway process, config error outage, single point of failure, vertical vs horizontal scaling, autoscaling, big ball of mud, or technical debt in a data system."
---

# Reliable, Scalable and Maintainable Applications

Before choosing tools, state which faults the system must tolerate, describe load with concrete load parameters and performance with response-time percentiles, and design so operators and future engineers can run and change it. "Scalable" and "reliable" are not labels you attach to a technology; they are answers to specific questions about specific growth and specific faults.

## You are building a composite data system

Most applications stitch together a primary database, a cache, a search index, a queue and batch jobs with application code. Once you do, your service is itself a data system and you own its guarantees.

- Write down the guarantee the composite offers to clients (for example: "a write is visible in search within 5 s", "the cache never serves data older than the last committed write").
- Name the code that enforces each guarantee (cache invalidation on write, index update via change capture, retry of failed async tasks). If no code owns it, the guarantee does not exist.
- Category boundaries are blurry: some stores double as queues, some logs offer database-like durability. Choose by access pattern and guarantees, not by product category.

## Reliability: faults vs failures

A fault is one component deviating from spec; a failure is the whole system no longer serving users. You cannot drive faults to zero, so design mechanisms that keep faults from becoming failures.

| Fault class | Character | Primary defenses |
|---|---|---|
| Hardware (disk, RAM, power, network cable, VM vanishing) | Mostly random and independent; frequent at fleet scale | Component redundancy (RAID, dual PSU), then software tolerance of whole-machine loss; rolling restarts |
| Software (bad input crashes every node, leap-second bug, runaway resource use, slow dependency, cascading failure) | Systematic and correlated across nodes; lies dormant until an assumption breaks | Question assumptions, isolate processes, let them crash and restart, limits/quotas, timeouts, self-checking invariants with alerts |
| Human (operator config errors are a leading outage cause) | Inevitable | Safe-by-default APIs and admin tools, sandboxes with realistic data, tests at every level, fast rollback, gradual rollout, tools to recompute data, telemetry |

- Prefer tolerating faults over preventing them, except where no cure exists (security breaches, irreversible data loss): there, prevention wins.
- Deliberately inject faults (kill processes, drop nodes) in a controlled environment so recovery paths are exercised continuously. Many critical bugs live in rarely-run error handling.
- Arithmetic matters: with thousands of disks, a disk dies most days. Plan for routine failure, not exceptional failure.
- Systems that survive the loss of a node can also be patched node by node without planned downtime.
- Add self-checks for invariants the system promises (messages in == messages out, row counts between source and derived store) and alert on drift.
- Cutting reliability for a prototype or low-margin service can be a valid choice; make it explicit and recorded, not accidental.

## Scalability: describe load first

Scalability is the question "if load grows in this particular way, what are our options?" Start with load parameters that fit the architecture:

- requests per second per endpoint, read/write ratio, concurrently active users, cache hit rate, data volume, and the distribution of a key quantity (followers per user, items per cart, rows per tenant).
- Check whether the average or a few extreme cases dominate the bottleneck.

### Fan-out: do work on write or on read

When one write must be seen by many readers (feeds, notifications, timelines, dashboards):

| Approach | Write cost | Read cost | Fits when |
|---|---|---|---|
| Compute on read (query and merge at request time) | Low | High, per read | Writes outnumber reads, or fan-out is huge for some keys |
| Precompute on write (push into each reader's cache/mailbox) | High: one write becomes N | Low | Reads far outnumber writes and N is bounded |
| Hybrid: push for normal keys, pull for very high fan-out keys | Bounded | Moderate | Skewed distributions (celebrity users, hot tenants) |

The distribution of fan-out (not its mean) is the load parameter that decides this.

## Scalability: describe performance with distributions

- Batch systems: throughput (records/s, job duration for a dataset size). Online systems: response time as seen by the client.
- Response time = service time + network delay + queueing delay. Latency is the waiting part. Measure on the client side, because queueing hides from server metrics.
- Treat response time as a distribution. Report median (p50) for the typical user and p95/p99/p999 for the tail. The mean hides how many users suffered.
- Tail amplification: a request that fans out to many backends is as slow as its slowest call. The more backend calls per user request, the more often users hit the backend's tail.
- Head-of-line blocking: a few slow requests occupy limited workers and delay fast ones behind them.
- The very top percentiles (p9999) are often too noisy and costly to optimize; choose the percentile that matches business value.

### Computing percentiles correctly

```ts
// Wrong: averaging per-host p99s is mathematically meaningless.
const p99 = hosts.map(h => h.p99).reduce((a, b) => a + b) / hosts.length;

// Right: merge histograms (or digests), then read the percentile.
const merged = hosts.map(h => h.histogram).reduce(mergeHistograms);
const p99Fixed = merged.valueAtPercentile(99);
```

- Use streaming approximations (HdrHistogram, t-digest, forward decay) for rolling windows instead of sorting every sample.
- Current note: metric systems such as Prometheus expose latency as histogram buckets; aggregate by summing buckets across instances, then apply `histogram_quantile`, rather than averaging precomputed quantiles.

### SLOs and SLAs

Express targets as percentiles plus availability, e.g. "p50 < 200 ms and p99 < 1 s over 5-minute windows; 99.9% of windows meet this". Tie each target to a measured client-side metric.

### Load testing

- The load generator must send requests on a schedule independent of responses (open loop). A client that waits for each reply before sending the next keeps queues artificially short and under-reports tail latency.
- Test with realistic skew (hot keys, large tenants), not uniform random keys.

## Approaches for coping with load

- Expect to revisit architecture at each order-of-magnitude growth; a design for 1x rarely survives 10x unchanged.
- Scale up (bigger machine) vs scale out (shared-nothing across machines): a few strong machines are often simpler and cheaper than many small ones. Mix pragmatically.
- Stateless services distribute easily; stateful data systems gain much complexity when distributed. Keep a database on one node until cost, throughput or availability forces distribution, and know which of those it is.
- Elastic (automatic) scaling helps with unpredictable load; manual scaling is simpler and has fewer surprises. Pick deliberately.
- There is no generic scalable architecture. Volume of reads, writes, stored data, data complexity, latency targets and access patterns each lead to different designs; 100k small requests/s and 3 huge requests/min are different systems even at equal bytes/s.
- Do not build for hypothetical load in an unproven product; iteration speed usually matters more. Do record the load assumptions so you know when they break.

## Maintainability

Most cost is in operating and changing the system after launch. Design for three properties:

**Operability** (easy to run):
- Monitoring and visibility into internals; integration with standard automation and tooling.
- No dependency on any single machine; nodes can be drained for maintenance.
- A documented, predictable operational model ("if I do X, Y happens"), sensible defaults that admins can override, self-healing with manual override available.

**Simplicity** (easy to understand):
- Remove accidental complexity: complexity that comes from the implementation rather than the problem users see.
- Symptoms: state-space explosion, tight coupling, tangled dependencies, inconsistent naming, performance hacks, special cases working around other special cases.
- The main tool is a good abstraction that hides detail behind a clean, reusable interface (as SQL hides storage structures, concurrency and crash recovery).

**Evolvability** (easy to change):
- Requirements will change. Simple systems with good abstractions are easier to evolve; TDD and refactoring apply at the system level too (migrating a read path from compute-on-read to precompute-on-write is a system refactoring).

## Workflow

1. List the building blocks (database, cache, index, queue, batch, stream) and the guarantees the composite offers clients; assign an owner (code path) to each guarantee.
2. Write the fault model: which hardware, software and human faults must be tolerated without failure, and which are accepted risks.
3. Define load parameters from real data (rates, ratios, and distributions of skewed quantities); identify fan-out points.
4. Define performance targets as client-side percentiles and availability (SLOs); confirm how they are measured and aggregated.
5. Choose the read/write work split and the scale-up vs scale-out path for current load and the next order of magnitude; record assumptions.
6. Design operability: metrics, alerts on invariants, runbooks, rolling deploys, fast rollback, a way to recompute derived data.
7. Validate: open-loop load tests with realistic skew; fault injection in a non-production environment first.
8. For any change that touches production (failover drills, fault injection, scaling changes, rollouts), confirm the environment, get approval, and have a tested revert plan before starting.

## Red flags

- "X is scalable" or "Y doesn't scale" with no load parameters attached.
- SLOs or dashboards based on mean response time only; percentiles averaged across hosts or time windows.
- Latency measured only on the server; load tests where the client waits for each response.
- Designing for average fan-out while the distribution has a long tail.
- Redundant hardware treated as sufficient while every node runs the same untested failure path.
- No timeouts, limits or isolation around dependencies; one slow service can cascade.
- No sandbox with realistic data; config changes with no quick rollback; all-at-once deploys.
- Derived data (cache, index, report) with no way to rebuild it from the source of truth.
- Distributed stateful architecture adopted with no stated reason (cost, throughput, availability).
- Fault injection or failover drills run against production without approval or a revert plan.
- Performance hacks and special cases accumulating without an abstraction to contain them.

## Related

- `../DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — choosing the data model that keeps the application simple.
- `../StorageAndRetrieval/storageAndRetrieval.md` — OLTP vs analytics engines behind the performance numbers.
- `../EncodingAndEvolution/encodingAndEvolution.md` — evolvability through compatible data formats and rolling upgrades.
- `../../DistributedData/Replication/replication.md` — tolerating node loss and scaling reads.
- `../../DistributedData/Partitioning/partitioning.md` — scaling out writes and data volume; hot keys and skew.
- `../../DistributedData/TroubleWithDistributedSystems/troubleWithDistributedSystems.md` — timeouts, partial failures and correlated faults in detail.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — keeping caches and indexes in sync with change capture.
- `../../../CleanCode/Systems/systems.md` — separating construction from use and keeping system-level design simple (when installed).
- `../../../CleanCode/ErrorHandling/errorHandling.md` — error paths that make faults recoverable (when installed).
- `../../../CleanCode/Concurrency/concurrency.md` — concurrency defects behind many systematic software faults (when installed).
- `../../../DBA/PostgreSQL/QueryPerformanceTuning/queryPerformanceTuning.md` — finding the slow statements behind a latency target (when installed).
