---
name: ddia-transactions
description: How to decide whether you need transactions and at which isolation level, covering ACID (atomicity as abortability, application-defined consistency, isolation, durability), single-object vs multi-object writes, safe retries after aborts, read committed, snapshot isolation and MVCC, repeatable read naming confusion, lost updates (atomic updates, SELECT FOR UPDATE, automatic detection, compare-and-set, replicated conflicts), write skew and phantoms, materializing conflicts, and serializability via actual serial execution, two-phase locking with predicate and index-range locks, and serializable snapshot isolation (SSI), based on Chapter 7 (Transactions) of Designing Data-Intensive Applications. Use when choosing an isolation level, debugging a race condition, double booking, double spending, oversold inventory, duplicate usernames, a counter that loses increments, a negative balance, or an invariant violated only under load, or when the user mentions ACID, BEGIN/COMMIT, rollback, dirty read, dirty write, read skew, non-repeatable read, lost update, write skew, phantom read, MVCC, snapshot isolation, REPEATABLE READ, SERIALIZABLE, SELECT ... FOR UPDATE, optimistic locking, version column, deadlock, serialization failure, SQLSTATE 40001, 2PL, SSI, stored procedures for transactions, or retrying aborted transactions.
---

# Transactions

A transaction exists so the application can treat a group of reads and writes as one unit that either fully happens or can be safely retried. Decide per operation which anomalies would break an invariant, pick the weakest mechanism that provably prevents them (atomic update, constraint, explicit lock, or serializable isolation), and always pair it with a correct retry policy.

## What ACID actually promises

| Letter | Real meaning | Who owns it |
|---|---|---|
| Atomicity | On any fault mid-transaction, all its writes are discarded; think *abortability* | Database |
| Consistency | Application invariants (balanced ledger, at least one on-call doctor) hold before and after | Application; the DB only enforces what you declare (FK, UNIQUE, CHECK, EXCLUDE) |
| Isolation | Concurrent transactions do not see or clobber each other's partial work; ideally serializable | Database, at the level you choose |
| Durability | Committed data survives crashes: WAL + fsync, and/or replication to N nodes | Database plus your ops (backups, replicas) |

- "ACID compliant" is marketing until you know the isolation level and durability settings. "BASE" means little more than "not ACID".
- ACID atomicity is not about concurrency (that is isolation), and the ACID "C" is not replica consistency or CAP consistency.
- Durability is risk reduction, not a guarantee: disks lie about fsync, async replicas lose recent writes on failover, silent corruption reaches replicas and recent backups. Combine local persistence, replication and tested restores.

## Single-object vs multi-object operations

- Storage engines nearly always make a single-object write atomic and isolated (no half-written JSON, no torn value). Single-object atomic increments and compare-and-set are useful but are not transactions, whatever vendors call them ("lightweight transactions").
- You need multi-object transactions when: inserting rows that reference each other, keeping denormalized fields in sync (unread counter vs message rows), and keeping secondary indexes consistent with the base data.
- A multi-key "batch put" without transaction semantics can partially succeed. Check the docs before assuming all-or-nothing.
- In SQL, transaction scope is tied to the connection between `BEGIN` and `COMMIT`. If the connection drops after `COMMIT` is sent, the outcome is unknown to the client.
- A document model avoids multi-object transactions only while everything that changes together lives in one document.

Current note: MongoDB supports multi-document transactions since 4.0 (replica sets) and 4.2 (sharded clusters); many distributed SQL databases (CockroachDB, Spanner, YugabyteDB, FoundationDB) offer multi-partition transactions. "NoSQL means no transactions" is no longer a safe assumption either way; check the specific product.

## Aborts and retries

The point of an abort is a safe retry, yet most ORMs just raise an exception. Wrap retryable units explicitly:

```ts
const RETRYABLE = new Set(["40001", "40P01"]); // PostgreSQL: serialization_failure, deadlock_detected

async function inTransaction<T>(pool: Pool, work: (c: PoolClient) => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await work(client);   // DB work only: no emails, HTTP calls or queue publishes
      await client.query("COMMIT");
      return result;
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      if (!RETRYABLE.has(err.code) || attempt >= maxAttempts) throw err;
      await sleep(2 ** attempt * 10 + Math.random() * 50); // exponential backoff with jitter
    } finally {
      client.release();
    }
  }
}
```

- Retry only transient errors: deadlock, serialization failure, failover, brief network loss. Never retry constraint violations or validation errors.
- Cap attempts and back off; retrying overload errors makes the overload worse.
- If the commit acknowledgment is lost, a blind retry can apply the change twice. Make the operation idempotent: a client-generated request ID stored under a UNIQUE constraint in the same transaction.
- External side effects inside the transaction body repeat on every retry and happen even on abort. Move them after commit, or write an outbox row in the transaction and publish it asynchronously. Cross-system atomic commit is 2PC (see Consistency and Consensus).
- Other equivalents: MySQL deadlock error 1213, Oracle ORA-08177 (cannot serialize) and ORA-00060 (deadlock), SQL Server 1205 (deadlock victim) and 3960 (snapshot update conflict).

## Anomalies and which level prevents them

| Anomaly | What happens | Read committed | Snapshot isolation | Serializable |
|---|---|---|---|---|
| Dirty read | See another transaction's uncommitted write | Prevented | Prevented | Prevented |
| Dirty write | Overwrite another's uncommitted write (mixed-up multi-row results) | Prevented | Prevented | Prevented |
| Read skew / non-repeatable read | Different rows observed at different points in time (transfer appears to lose money) | Possible | Prevented | Prevented |
| Lost update | Two read-modify-write cycles; one silently clobbers the other | Possible | Detected by some engines only | Prevented |
| Write skew | Each reads a shared premise, writes different rows; invariant broken | Possible | Possible | Prevented |
| Phantom causing write skew | Check for absence of rows, then insert a matching row | Possible | Possible | Prevented |

Defaults and naming, which differ by engine:

| Engine | Default | "REPEATABLE READ" / "SERIALIZABLE" really are |
|---|---|---|
| PostgreSQL | Read committed | RR = snapshot isolation that aborts lost updates; SERIALIZABLE = SSI |
| MySQL InnoDB | Repeatable read | RR = snapshot reads with no lost-update detection; SERIALIZABLE = lock-based |
| Oracle | Read committed | SERIALIZABLE = snapshot isolation (write skew still possible) |
| SQL Server | Read committed (locking; RCSI optional) | SNAPSHOT = snapshot isolation; SERIALIZABLE = 2PL with key-range locks |
| CockroachDB, FoundationDB | Serializable | Serializable by default |

Never infer guarantees from the level's name. Read the engine's isolation documentation for the exact version you run.

## Read committed and snapshot isolation (MVCC)

- Read committed: row write locks held until commit stop dirty writes; readers get the last committed version, so readers do not wait for writers.
- Snapshot isolation: each transaction reads a consistent snapshot as of its start. Implemented with MVCC: rows carry creator/deleter transaction IDs, an update is a delete plus an insert, and visibility rules hide writes from transactions that were in progress, aborted, or started later.
- Reads and writes do not wait on each other. Use snapshot isolation for backups, long analytic queries and integrity checks so they do not see half-applied changes.
- Cost: old versions accumulate until garbage collection. In PostgreSQL, long-open transactions block vacuum, causing bloat and, at worst, transaction ID wraparound risk. Monitor `pg_stat_activity` for old `xact_start` and `idle in transaction` sessions.
- Append-only (copy-on-write) B-trees (LMDB, CouchDB, Datomic) give each commit a new root that is itself a snapshot.

## Preventing lost updates

Order of preference:

1. **Atomic write in the database.** Push the computation into one statement:

```sql
UPDATE page_views SET hits = hits + 1 WHERE page_id = 42;
UPDATE accounts SET balance = balance - 100 WHERE id = 7 AND balance >= 100; -- check rows affected
```

   Document stores have equivalents (MongoDB `$inc`, `$push`; Redis `INCR`, sorted-set ops). Watch for ORMs that load an object, mutate a field and save the whole row: that is an unprotected read-modify-write.

2. **Explicit lock** when logic cannot be expressed in SQL (game rules, complex validation):

```sql
BEGIN;
SELECT * FROM seats WHERE show_id = 88 AND seat_no = 'F12' FOR UPDATE;
-- check the seat is still free in application code
UPDATE seats SET held_by = $1 WHERE show_id = 88 AND seat_no = 'F12';
COMMIT;
```

   Easy to forget on one code path; centralize it in a repository method.

3. **Automatic detection**: PostgreSQL REPEATABLE READ, Oracle SERIALIZABLE and SQL Server SNAPSHOT abort one of the conflicting transactions. MySQL InnoDB REPEATABLE READ does not. This is the least error-prone option where supported, but requires the retry loop.

4. **Compare-and-set / optimistic locking** with a version column:

```sql
UPDATE wiki_pages SET content = $1, version = version + 1
WHERE id = $2 AND version = $3;   -- 0 rows affected => someone else won; reload and retry or show a conflict
```

   Verify the engine evaluates the `WHERE` against the latest committed row, not an old snapshot, before relying on it.

- **Replicated data (multi-leader, leaderless)**: locks and compare-and-set assume one authoritative copy and do not work across asynchronously replicated nodes. Use commutative operations (counters, set adds; CRDTs) or keep conflicting siblings and merge them. Last-write-wins, a common default, silently loses updates.

## Write skew and phantoms

Pattern to recognize: (1) SELECT checks a condition over a set of rows, (2) the application decides, (3) it writes, and (4) that write changes the result of step 1 for a concurrent transaction. Examples: on-call minimum, meeting-room double booking, two pieces on one board square, duplicate username, spending more than the balance.

- Atomic single-object operations and lost-update detection do not help: different rows are written.
- If the premise rows exist, lock them: `SELECT ... WHERE shift_id = 1234 AND on_call FOR UPDATE`.
- If the check is for **absence** (no overlapping booking, name not taken), there is nothing to lock. That is a phantom. Options, best first:
  - A declarative constraint: `UNIQUE (username)`; in PostgreSQL an exclusion constraint for overlaps:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, tstzrange(start_time, end_time) WITH &&);
```

  - Run the transaction at true SERIALIZABLE and retry on failure.
  - Materialize the conflict: pre-create lock rows (room x 15-minute slot, or one row per account) and `SELECT ... FOR UPDATE` them. Use this as a last resort because it leaks concurrency control into the data model.
- Multi-row invariants enforced by triggers or materialized views are fragile under concurrency unless the transaction is serializable.

## Serializability: three implementations

| Approach | How | Strengths | Costs and limits | Where |
|---|---|---|---|---|
| Actual serial execution | One thread runs whole transactions in order | Simple, no lock overhead | Every transaction must be short; data in memory; throughput of one core per partition; cross-partition transactions are very slow | VoltDB, Redis (Lua/Functions), Datomic |
| Two-phase locking (2PL) | Shared locks for reads, exclusive for writes, all held to commit; predicate or index-range (next-key) locks stop phantoms | Prevents all anomalies, pessimistic and predictable correctness | Readers and writers block each other; frequent deadlocks; unstable tail latency; one long transaction stalls others; missing index can escalate to table lock | MySQL SERIALIZABLE, SQL Server SERIALIZABLE, DB2 |
| Serializable snapshot isolation (SSI) | Snapshot reads plus tracking of stale MVCC reads and writes that affect earlier reads; abort at commit if the premise changed | No blocking, small overhead over SI, read-only queries run lock-free | Aborts rise with contention and long read-write transactions; needs retries and spare capacity | PostgreSQL SERIALIZABLE (9.1+), FoundationDB |

- 2PL (two-phase locking) is not 2PC (two-phase commit).
- Serial execution requires submitting the whole transaction at once (stored procedure), never an interactive multi-round-trip transaction. Replicas that re-execute procedures require deterministic code (no wall clock or random without the engine's deterministic APIs).
- Stored procedures trade versioning, testing, debugging and monitoring convenience for fewer round trips; put them under the same review, versioning and tests as application code.
- For SSI and 2PL alike: keep read-write transactions short, index the columns used in predicates (so locks or read tracking stay narrow), and use commutative atomic updates on hot rows to reduce conflicts.
- Never keep a transaction open across user think time or multiple HTTP requests. Use optimistic version checks for edits that span requests.

Current note: Redis 7 added Functions alongside Lua scripts for server-side atomic logic. Distributed databases such as CockroachDB and Spanner provide serializable (or stricter) multi-partition transactions using their own timestamp-based schemes; check each product's docs for its exact guarantees and retry requirements.

## Workflow

1. List the invariants the operation must preserve (uniqueness, no overlap, balance >= 0, at least N remaining, counters match rows).
2. For each operation, write down its read set and write set and which other operations can run concurrently on the same data.
3. Classify the risk: dirty read/write, read skew, lost update (same row read-modify-write), or write skew/phantom (premise over a set of rows, possibly absent).
4. Identify the engine, version and current isolation level (`SHOW transaction_isolation;`, `SELECT @@transaction_isolation;`) and check its actual semantics in the docs.
5. Choose the narrowest sufficient fix: declarative constraint, then atomic statement, then version check or `FOR UPDATE`, then SERIALIZABLE for the affected transactions, then materialized conflicts.
6. Implement one retry wrapper: retryable error codes only, bounded attempts with backoff and jitter, idempotency key for writes, side effects after commit or via an outbox.
7. Prove it with a concurrency test: two connections, interleave steps with a barrier (or `pg_sleep`), and assert the invariant; repeat many times. A single-threaded test cannot catch these bugs.
8. Watch production signals: serialization-failure and deadlock rates, lock waits, long-running and idle-in-transaction sessions, MVCC bloat.
9. Changing a database-wide default isolation level, adding constraints to large live tables, or backfilling to repair data broken by a race touches production: confirm the environment, check existing data violates nothing (or clean it first), get approval, run during a safe window, and keep a revert plan (old setting value, `DROP CONSTRAINT`, backup or snapshot before the repair).

## Red flags

- "We use an ACID database, so races cannot happen" while running at read committed.
- Check-then-insert or check-then-update logic (`SELECT COUNT(*)` followed by `INSERT`) with no constraint, lock or serializable isolation.
- ORM load-modify-save of counters, balances, stock levels or JSON arrays.
- Assuming MySQL REPEATABLE READ or Oracle SERIALIZABLE prevents lost updates or write skew.
- `FOR UPDATE` on a query that can return zero rows, used to guard an insert.
- Exceptions from deadlocks or 40001 surfaced to users instead of retried; or retry loops that also retry constraint violations, have no cap, or resend emails.
- Transactions held open across HTTP requests, user input, or slow external calls.
- Multi-key batch writes assumed atomic without checking the store's semantics.
- Last-write-wins replication used for data where concurrent updates must merge.
- Durability assumed from "acknowledged" writes on an asynchronously replicated leader.
- Concurrency correctness "verified" only by single-threaded tests.

## Related

- `../Replication/replication.md` — replication lag, failover data loss, and conflict resolution that interact with lost updates and durability.
- `../Partitioning/partitioning.md` — why single-partition transactions are cheap and cross-partition ones are not.
- `../TroubleWithDistributedSystems/troubleWithDistributedSystems.md` — timeouts and unknown commit outcomes behind unsafe retries.
- `../ConsistencyAndConsensus/consistencyAndConsensus.md` — linearizability, two-phase commit and distributed transactions.
- `../../Foundations/StorageAndRetrieval/storageAndRetrieval.md` — WAL, B-trees and copy-on-write trees underlying atomicity and MVCC.
- `../../Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — document vs relational models and denormalization that creates multi-object writes.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — outbox, exactly-once and keeping derived data in sync without distributed transactions.
- `../../../DBA/PostgreSQL/TablesConstraintsIndexes/tablesConstraintsIndexes.md` — UNIQUE, CHECK and exclusion constraints that enforce invariants declaratively (when installed).
- `../../../DBA/PostgreSQL/WritingFunctions/writingFunctions.md` — server-side functions for single-round-trip transactions (when installed).
- `../../../DBA/Oracle/PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` — Oracle stored procedures as transaction units (when installed).
- `../../../CleanCode/Concurrency/concurrency.md` — general concurrency discipline for the application side (when installed).
- `../../../CleanCode/ErrorHandling/errorHandling.md` — structuring retries and exceptions cleanly (when installed).
