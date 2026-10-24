---
name: postgres-query-performance-tuning
description: "How to find and fix slow PostgreSQL queries with EXPLAIN (ANALYZE, BUFFERS), pg_stat_statements, query rewrites, parallel query, planner strategy settings, table and multicolumn statistics, random_page_cost and buffer cache inspection, based on Chapter 9 (Query Performance Tuning) of PostgreSQL: Up and Running, 3rd edition. Use when a query or endpoint is slow, the user asks why an index is not used, wants a plan read, sees Seq Scan, Bitmap Heap Scan, Gather or Rows Removed by Filter in output, estimated rows differ wildly from actual rows, or mentions pg_stat_statements, enable_seqscan, max_parallel_workers_per_gather, CREATE STATISTICS, SET STATISTICS, VACUUM ANALYZE, random_page_cost, shared_buffers, pg_buffercache or pg_prewarm."
---

# Query Performance Tuning

Fix the SQL first, then indexes, then statistics, and only then planner settings or hardware knobs. Find the expensive statements with `pg_stat_statements`, read their plans with `EXPLAIN (ANALYZE, BUFFERS)`, change one thing, and re-measure on realistic data.

## Find what is actually slow: pg_stat_statements

The extension ships with most distributions but must be preloaded.

```
# postgresql.conf (restart required)
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all
```

```sql
CREATE EXTENSION pg_stat_statements;   -- in each database you monitor

SELECT s.query, s.calls, s.total_time, s.rows,
       100.0 * s.shared_blks_hit
         / NULLIF(s.shared_blks_hit + s.shared_blks_read, 0) AS hit_pct
FROM pg_stat_statements s
JOIN pg_database d ON d.oid = s.dbid
WHERE d.datname = current_database()
ORDER BY s.total_time DESC
LIMIT 5;
```

- Rank by total time (calls x mean), not only by the single slowest call: a fast query run a million times often matters more.
- `pg_stat_statements_reset()` clears the counters (superuser by default); note the baseline before resetting.
- Changing `shared_preload_libraries` requires a server restart: confirm the environment and get approval first.

Version note: since PostgreSQL 13 the timing columns are `total_exec_time`, `mean_exec_time` (plus `total_plan_time`); `total_time` no longer exists.

## Read the plan: EXPLAIN

| Form | Runs the query? | Shows |
|---|---|---|
| `EXPLAIN q` | No | Estimated plan and costs |
| `EXPLAIN (ANALYZE) q` | Yes | Estimates vs actual time, rows, loops |
| `EXPLAIN (ANALYZE, BUFFERS) q` | Yes | Plus shared hits (cache) vs reads (disk) |
| `EXPLAIN (ANALYZE, VERBOSE, BUFFERS) q` | Yes | Plus output columns per node |

- `FORMAT JSON | YAML | XML` produces machine-readable output for tools and visualizers (pgAdmin graphical explain, explain.depesz.com).
- `ANALYZE` executes the statement. For INSERT, UPDATE or DELETE, wrap it so no change persists:

```sql
BEGIN;
EXPLAIN (ANALYZE, BUFFERS)
UPDATE orders SET status = 'closed' WHERE closed_at < now() - interval '1 year';
ROLLBACK;
```

Even rolled back, the statement takes row locks and fires triggers while it runs; do not do this on production without approval.

### Interpreting nodes

- `cost=startup..total` is in arbitrary planner units; compare plans only on the same server. Startup is work before the first row (index scan, sort, hash build).
- Children are indented under parents; a parent's figures include its children. Multiply per-loop `actual time` and `rows` by `loops`.
- `Rows Removed by Filter` large relative to returned rows: missing or unusable index.
- Estimated `rows=` far from actual rows: stale or insufficient statistics; fix that before anything else.
- `Planning time` vs `Execution time` are reported separately; a second run is usually faster because of plan and data caching, so time warm and cold runs deliberately.
- Common nodes: `Seq Scan`, `Index Scan`, `Index Only Scan`, `Bitmap Index Scan` + `Bitmap Heap Scan` (many rows or OR-ed conditions), `Nested Loop`, `Hash Join`, `Merge Join`, `HashAggregate`, `Sort`, `Gather`.

## Write better queries

- **Join, do not stack correlated subqueries in SELECT.** Each scalar subquery can rescan a table per outer row. Rewrite as one join plus `GROUP BY`; treat the query as a whole, not as assembled black boxes.
- **Do not reuse join types blindly.** A LEFT JOIN copied from a previous query where INNER JOIN is correct prevents better plans.
- **Avoid `SELECT *`.** Wide text and bytea values live in TOAST side tables and must be reassembled; selecting only needed columns from a view also lets the planner skip joins and subqueries for unused columns entirely.
- **Conditional aggregates in one pass.** Replace per-category subqueries with `FILTER` (9.4+) or `CASE`:

```sql
SELECT c.customer_id,
       count(*)                                     AS orders,
       count(*) FILTER (WHERE o.status = 'returned') AS returned
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id;
```

- Write predicates the index can serve. A GIN index on an array column serves `&&`, `@>`, `<@`, but not `'x' = ANY(col)`; check the operator class of the index against your operator.

## Parallel query

Parallel plans (9.6+) split work across background workers; a `Gather` (or `Gather Merge`) node marks the parallel part, with `Workers Planned` and `Workers Launched`.

- Requirements: `max_worker_processes > 0`, `max_parallel_workers > 0` (10+), `max_parallel_workers_per_gather > 0` (settable per session or function), `dynamic_shared_memory_type` not `none`.
- Not parallelized in 10: data-modifying statements, DDL, queries run from cursors or loops, aggregates with DISTINCT or ORDER BY, and user functions not marked `PARALLEL SAFE` (default is `PARALLEL UNSAFE`).
- Worker startup costs milliseconds; parallelism helps scans and aggregates over millions of rows, not short OLTP queries.
- Parallel hash and merge joins in 10 repeat one side per worker, so an expensive hash build can make the parallel plan slower.
- Compare by toggling in a session: `SET max_parallel_workers_per_gather = 0;` vs `= 4;` and re-run `EXPLAIN (ANALYZE)`.
- `force_parallel_mode` is a debugging aid to see whether a query can parallelize; never enable it in production.

Version note: `force_parallel_mode` was renamed `debug_parallel_query` in PostgreSQL 16; later releases also parallelize more operations (for example parallel-aware hash joins in 11).

## Guide the planner

PostgreSQL has no index hints. You influence the planner through indexes, statistics and settings.

- **Strategy settings** (`enable_seqscan`, `enable_nestloop`, `enable_hashjoin`, `enable_bitmapscan`, ...) discourage a strategy; the planner still uses it when there is no alternative. Use them per session as a diagnostic, not as a permanent fix:

```sql
SET enable_seqscan = off;
EXPLAIN (ANALYZE) SELECT * FROM products WHERE tags && '{sale}';
RESET enable_seqscan;
```

  If the seq scan persists with `enable_seqscan = off`, no usable index exists for that predicate. If the index plan appears but is slower, the planner was right.
- **Is the index used at all?** `pg_stat_user_indexes.idx_scan` near zero over a representative period means an unused index that still costs on every write. `pg_stat_user_tables.seq_scan` and `seq_tup_read` show tables read by full scans.

## Statistics

The planner works from sampled statistics, not from the data itself.

- Inspect: `SELECT attname, n_distinct, most_common_vals, most_common_freqs FROM pg_stats WHERE tablename = 'orders';`
- Refresh after bulk loads or mass deletes: `ANALYZE orders;` (or `VACUUM ANALYZE orders;` to also reclaim dead rows). Autovacuum does this eventually, not immediately.
- Raise the sample for skewed columns used in joins and filters:

```sql
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 1000;
ANALYZE orders;
```

- Correlated columns (city and zip, product and year): multicolumn statistics (10+).

```sql
CREATE STATISTICS orders_region_city (dependencies, ndistinct)
  ON region, city FROM orders;
ANALYZE orders;
```

  `dependencies` helps equality filters on both columns; `ndistinct` helps `GROUP BY` on exactly those columns. Stored in `pg_statistic_ext`; remove with `DROP STATISTICS`. Run `ANALYZE` after creating them or they are unused.

## Cost settings and caching

- `random_page_cost` (default 4, tuned for spinning disks) is the random vs sequential I/O ratio. On SSD or good cloud storage, values around 1.1 to 2.5 make index plans more realistic. Set it in `postgresql.conf`, per database, or per tablespace: `ALTER TABLESPACE fast_ssd SET (random_page_cost = 1.5);`
- `shared_buffers` sizes PostgreSQL's own cache (restart required); bigger is not always better, the OS cache also holds data.
- `pg_buffercache` shows which relations occupy shared buffers (join `pg_buffercache.relfilenode` to `pg_class.relfilenode`, filtered to `current_database()`).
- `pg_prewarm` loads hot tables into cache after a restart so first users do not pay the cold-cache cost.

## Workflow
1. Define the target: which statement, how slow now, how fast it must be, OLTP latency or batch throughput.
2. Use `pg_stat_statements` (or the application log) to confirm it is the real cost by total time and call count.
3. Run `EXPLAIN (ANALYZE, BUFFERS)` on a production-like copy; wrap writes in `BEGIN ... ROLLBACK`.
4. Compare estimated vs actual rows per node; if far off, `ANALYZE`, raise `SET STATISTICS`, or add `CREATE STATISTICS`.
5. Find the expensive node: big seq scan returning few rows, repeated subplan, large sort or hash, wasted parallel setup.
6. Fix in order: rewrite the SQL (joins, FILTER, needed columns only), add or reshape an index that matches the operator, fix statistics, then adjust cost settings.
7. Re-run the plan and timing warm and cold; keep before/after plans in the change record.
8. For any server-level change (`postgresql.conf`, `ALTER SYSTEM`, tablespace options, new index on a large table), confirm the environment, get approval, and record the old value to revert.

## Red flags
- Tuning from `EXPLAIN` without `ANALYZE`, or from a single warm run.
- `EXPLAIN ANALYZE` on a production UPDATE or DELETE outside a rolled-back transaction.
- Estimated rows off by orders of magnitude and nobody ran `ANALYZE`.
- Scalar subqueries per row in SELECT lists; `SELECT *` from wide tables or heavy views.
- `enable_seqscan = off` or `force_parallel_mode` set in `postgresql.conf` permanently.
- User functions in hot queries left `PARALLEL UNSAFE` (or `VOLATILE`) without reason.
- Indexes with `idx_scan = 0` piling up on write-heavy tables.
- Expecting Oracle-style hints; they are comments in PostgreSQL unless an extension such as pg_hint_plan is installed.
- Creating indexes on large live tables without `CONCURRENTLY`, or changing `shared_buffers`, `random_page_cost` or preload libraries without approval and a revert plan.

## Related
- `../TablesConstraintsIndexes/tablesConstraintsIndexes.md` — index types and operator classes that decide whether a plan can use an index.
- `../SqlThePostgresWay/sqlThePostgresWay.md` — FILTER, window functions, LATERAL and CTEs used in rewrites.
- `../WritingFunctions/writingFunctions.md` — PARALLEL SAFE and volatility markings on functions.
- `../DatabaseAdministration/databaseAdministration.md` — `postgresql.conf`, `ALTER SYSTEM`, reloads and restarts.
- `../PgAdmin/pgAdmin.md` — graphical explain.
- `../Psql/psql.md` — `\timing` and running EXPLAIN interactively.
- `../../Oracle/HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — Oracle counterpart; do not apply its syntax (hints, PLAN_TABLE, outlines) here.
