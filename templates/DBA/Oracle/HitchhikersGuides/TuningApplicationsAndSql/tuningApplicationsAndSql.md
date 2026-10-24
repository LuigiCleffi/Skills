---
name: dba-tuning-applications-and-sql
description: "How to diagnose and fix slow Oracle applications and SQL, from design-level waste to reading explain plans, access paths, join methods, hints, statistics and stored outlines, based on Chapter 46 (The Hitchhiker's Guide to Tuning Applications and SQL) of Oracle Database 11g: The Complete Reference. Use when a query or screen is slow, the user asks why an index is not used, wants an explain plan read or a hint added, sees TABLE ACCESS FULL, SORT, MERGE JOIN or HASH JOIN in a plan, a plan changed after an upgrade or stats refresh, or code queries DUAL in loops, opens a connection per call or runs one query per form field."
---

# The Hitchhiker's Guide to Tuning Applications and SQL

Tune the application, not just the statement: many performance problems are designed in, and no parameter fixes needless work. First remove work (calls, logical reads, sorts, round trips), then read the plan of what remains and change the access path, join method or statistics, verifying each change with a new plan and a timing.

## Step 1: Look for design waste before touching SQL

- **Needless logical reads.** Repeated tiny queries (such as reading SYSDATE from DUAL in a loop to wait) burn CPU while looking "fast". A near-100% buffer cache hit ratio can signal excess logical reads, not health.
- **Too many trips.** One query per field, functions calling functions per row, or re-querying values already known. Bundle related work into one call or a stored procedure; keep values in local variables.
- **Connection churn.** Open once and reuse (connection pooling). Do not run "is the database up?" probes; handle errors from the real call.
- **Reporting on raw OLTP tables.** If the report queries are known, store data in the shape they need (materialized views, reporting tables refreshed in batch).
- **Wrong indexes.** Every extra index slows inserts, updates and deletes (roughly threefold per index is a common rule of thumb). No bitmap indexes in OLTP; low-cardinality columns often need no index.
- **Monster statements in batch.** Split long batch jobs into atomic steps with work tables (filter, index, join, sort last, insert); each step can be tuned and parallelized on its own.
- **Unneeded sorts.** ORDER BY, DISTINCT, UNION, MINUS, INTERSECT and GROUP BY are set operations: nothing returns until the whole set is processed. Use UNION ALL when duplicates are impossible or acceptable.
- **Hot rows read by many while being changed.** Forces reads from undo for consistency; a design issue, not an undo-sizing one.

## Step 2: Get the execution plan

```sql
-- SQL*Plus, needs PLAN_TABLE and the PLUSTRACE role
set autotrace trace explain     -- plan only, does not run the query
set autotrace on                -- runs it, then shows plan and statistics
set autotrace off

-- any client, plan without running
explain plan set statement_id = 'q1' for
select o.order_id, c.name
  from orders o join customers c on c.customer_id = o.customer_id
 where o.status = :status;
select * from table(dbms_xplan.display);
```

- Create PLAN_TABLE with `$ORACLE_HOME/rdbms/admin/utlxplan.sql`; re-create it after each upgrade because its structure changes. utlxplp.sql displays the latest plan.
- Use `explain plan` (or `trace explain`) when the query's runtime is unknown; use `autotrace on` when it is safe to execute.
- Plans for the same SQL can differ between databases; always explain in the target environment with realistic statistics.

## Step 3: Read the plan

- Each step has an Id and a parent Id; Cost is cumulative (the step plus its children); Rows (Card) is the estimated row count.
- Read inside out, top to bottom: the most indented step runs first; at equal indentation, the lower Id runs first.
- NESTED LOOPS is the exception: of its two children, the first listed is the driving (outer) table, the second is probed per row.
- Check the Predicate Information section: `access` predicates drive index use, `filter` predicates discard rows after reading.
- Hunt for steps that read many rows to return few (a full scan of millions of rows to return three) and for estimated rows far from reality, which points to missing or stale statistics.

## Access paths

| Operation | Meaning | When it is right |
|---|---|---|
| TABLE ACCESS FULL | Multiblock read of every row | No limiting condition, small table, or most rows needed |
| TABLE ACCESS BY INDEX ROWID | Fetch row by ROWID from an index | Few rows from a selective index |
| INDEX UNIQUE SCAN | One entry from a unique index | Equality on a PK or unique key |
| INDEX RANGE SCAN | Range of entries | Range, LIKE 'abc%', or equality on a nonunique index |
| INDEX FULL / FAST FULL SCAN | Read the whole index instead of the table | All needed columns are in the index |
| INDEX SKIP SCAN | Use a composite index without its leading column | Only nonleading columns are constrained; may need INDEX or INDEX_SS |

If every selected column is in the index, the table access disappears.

### Why the index is not used

- A function or expression on the column: `upper(name) = :n`, concatenation, implicit conversion. Create a function-based index or rewrite.
- A leading wildcard: `like '%abc'`.
- `is null` (nulls are not stored in a B-tree index); `is not null` usually favors a full scan.
- Inequalities: `!=`, `not in` (the optimizer may rewrite `not in` as `not exists`).
- Only nonleading columns of a composite index are constrained (skip scan is possible but not guaranteed).
- Low selectivity or skewed data: many rows per value makes a full scan cheaper. Without statistics (and histograms for skew) the optimizer cannot judge selectivity.
- MIN/MAX of an indexed column can be answered from the index.

### Composite index design

- One concatenated index usually beats merging two single-column indexes.
- Lead with the column most often used in limiting conditions; among those, the most selective. Use in predicates matters more than selectivity.
- Every added column makes range scans less efficient; if no column is both frequent and selective, use separate indexes.

## Set operations, views and subqueries

- SORT ORDER BY (order by), SORT UNIQUE (distinct, union, minus, intersect), SORT AGGREGATE (aggregate without group by), SORT GROUP BY, SORT JOIN (inside MERGE JOIN). All block the first row until complete.
- For online screens, minimize these; for batch, total time matters more than first-row time.
- A simple view is merged into the outer query, so outer predicates reach its indexes. A view with GROUP BY cannot be merged: it is resolved first and a FILTER applies the outer predicate afterwards. Keep grouping out of views used by online queries.
- An `in (subquery)` is often rewritten as a join; a subquery that cannot be merged runs as a FILTER, and grouping subqueries behave like grouping views.
- View hints: NO_MERGE (keep the view separate), PUSH_PRED (push a join predicate into the view), PUSH_SUBQ (evaluate a nonmerged subquery early).

## Join methods

| Method | How | Good for | Watch for |
|---|---|---|---|
| NESTED LOOPS | For each driving row, probe the other table, usually by index | Online queries, unequal sizes: small driving set, selective index on the inner table | Large driving table read by full scan; wrong join order |
| HASH JOIN | Build a hash of one input in memory, scan the other | Equijoins of larger sets; small tables scanned quickly | Memory; may be chosen even when indexes exist |
| MERGE JOIN | Sort both inputs (SORT JOIN), then merge | Both inputs tiny, or both huge and parallelized | No rows until both sorts finish; poor for online users |

- Outer joins use the same methods (NESTED LOOPS OUTER and so on), usually driving from the outer table.
- With three or more tables, the result of each join drives the next: join the most selective tables first so intermediate sets stay small. Confirm order and costs in the plan.
- Old tricks such as `col || ''` no longer suppress index use; use hints instead.

## Hints

Syntax: `/*+ HINT(args) */` immediately after SELECT, INSERT, UPDATE or DELETE. A malformed hint is silently treated as a comment, and the optimizer may ignore any hint, so always re-check the plan.

```sql
select /*+ ordered use_nl(o) index(o orders_cust_ix) */
       c.name, o.order_id
  from customers c join orders o on o.customer_id = c.customer_id
 where c.region = :region;
```

- Reference the table alias or the unqualified name, never `owner.table`; with a self-join, use aliases.
- Access: FULL, INDEX, INDEX_ASC, INDEX_DESC, INDEX_FFS, INDEX_SS, ROWID, AND_EQUAL.
- Goal: ALL_ROWS (default, best total time) or FIRST_ROWS (fastest first row; favors NESTED LOOPS, avoids sorts).
- Join: USE_NL, USE_HASH, USE_MERGE, with ORDERED to join in FROM-clause order. Name the tables explicitly; a hint without tables may later apply to a view you did not expect.
- Parallel: PARALLEL(t, n) and NO_PARALLEL. Parallel helps large scans and sorts and can start more server processes than the degree suggests (scan plus sort plus coordinator).
- Prefer fixing statistics or indexes over hints; a fixed join order breaks when data distribution changes.

## Statistics and the environment

- Gather statistics after each major data change; per partition for partitioned tables. The automatic job runs in the nightly and weekend maintenance window.
- In 11g you can gather into pending statistics, test them, then publish; extended statistics cover column groups and expressions. Check freshness with Last_Analyzed in USER_TABLES and USER_INDEXES.
- Chained or migrated rows (Chain_Cnt) multiply logical reads: set PCTFREE for the update pattern (low for read-only data, higher for rows that grow).
- Sorts that spill to temp are wasted I/O; size PGA_AGGREGATE_TARGET rather than SORT_AREA_SIZE.
- Small, hot, full-scanned static tables can go to a KEEP buffer pool, but only if the DBA sized that pool to hold them.
- Partition elimination, materialized views with query rewrite and parallelism divide large work; parallelism pays off only on large data sets.
- Design storage for I/O throughput, not just free disk space.

## Stable plans across moves: stored outlines

```sql
create outline orders_by_status for category app_dev on
select order_id from orders where status = :status;
alter session set use_stored_outlines = app_dev;
```

- Needs CREATE ANY OUTLINE; `alter outline ... rebuild | rename to | change category`; manage with OUTLN_PKG.DROP_UNUSED, DROP_BY_CAT, UPDATE_BY_CAT.
- An outline stores hints, so it makes the plan likely, not guaranteed.

Version note: stored outlines are deprecated in favor of SQL plan baselines, which 11g introduced to accept a new plan only after it proves better.

## Test so problems show before production

- Test with production-like data volumes on already-full tables: index level splits, chaining and half-empty blocks appear only with volume.
- Test with many concurrent users running different modules together (shared work tables, deadlocks, undo reads).
- Measure raw insert rate on an unindexed table, then compare with what the application achieves.
- Make tests repeatable: same data, same steps, expected and observed results recorded, on production-caliber hardware.

## Workflow
1. Define the goal: first-row response (online) or total throughput (batch), and the target time.
2. Look at how often and from where the SQL is called; remove redundant calls, round trips and connections first.
3. Explain the statement in the target environment and read it inside out.
4. Compare estimated rows with reality; if far off, check Last_Analyzed and histograms and plan a statistics refresh.
5. Find the costly step: full scan returning few rows, unwanted sort, wrong driving table, unmergeable view.
6. Fix in order of preference: rewrite the predicate, add or reshape an index, fix statistics, restructure the query or view, then hint.
7. Re-explain and time the change with realistic data and concurrency; keep the old plan and timing to compare.

## Red flags
- Tuning one statement while the application runs it thousands of times needlessly.
- Judging health by buffer cache hit ratio alone.
- Functions on indexed columns, leading wildcards, `!=` or `is null` filters on large tables in online paths.
- ORDER BY, DISTINCT or UNION on every online query; UNION where UNION ALL is correct.
- GROUP BY inside views queried by online screens.
- Hints with `owner.table`, wrong aliases or typos (silently ignored), or ORDERED join orders that freeze a plan.
- Bitmap indexes on OLTP tables; indexing every column.
- Single-user tests on small tables used as proof of performance.
- Changing shared state without approval: creating or dropping indexes, gathering or publishing statistics, `alter table ... parallel` or `buffer_pool keep`, enabling outlines, OUTLN_PKG drops, or instance parameters. These can change plans for every user. Confirm the target environment, get explicit approval, record the current plan and settings, and know the back-out (drop the index, restore previous statistics, revert the attribute or parameter).

## Related
- `../DataDictionary/dataDictionary.md` — views for indexes, statistics, PLAN_TABLE and outlines.
- `../ResultCache/resultCache.md` — caching results of frequently run queries.
- `../TuningCaseStudies/tuningCaseStudies.md` — worked tuning examples.
- `../DatabaseAdministration/databaseAdministration.md` — memory, storage and instance-level tuning.
- `../../PlSql/PlSqlTuning/plSqlTuning.md` — reducing per-row calls and context switches in PL/SQL.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — creating indexes, including function-based ones.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md` — partition elimination.
- `../../BeyondTheBasics/MaterializedViews/materializedViews.md` — storing data the way reports query it.
- `../../BeyondTheBasics/SqlReplay/sqlReplay.md` — replaying workloads to test changes.
