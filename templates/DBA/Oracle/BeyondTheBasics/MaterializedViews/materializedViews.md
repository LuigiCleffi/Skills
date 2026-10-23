---
name: dba-materialized-views
description: Creating, refreshing and tuning materialized views and materialized view logs for local replicas and precomputed summaries, including query rewrite and the SQL Access Advisor, based on Chapter 26 (Using Materialized Views) of Oracle Database 11g: The Complete Reference. Use when the user wants a local copy of remote data, a summary table that stays in sync, faster aggregate queries, CREATE MATERIALIZED VIEW or MATERIALIZED VIEW LOG, fast versus complete refresh, DBMS_MVIEW.REFRESH, EXPLAIN_MVIEW, EXPLAIN_REWRITE, ENABLE QUERY REWRITE, or asks why a fast refresh or rewrite is not happening.
---

# Using Materialized Views

A materialized view stores the result of a query as a table and keeps it in step with its master tables on a schedule, on demand or on commit. Use it to avoid repeated remote queries or repeated aggregation; choose the refresh method deliberately and verify what is actually possible with EXPLAIN_MVIEW rather than guessing.

## When to use one

- A local replica of a remote table that changes rarely, to avoid querying across a database link.
- A summary (GROUP BY, joins) that many reports would otherwise recompute.
- A transparent speed-up through query rewrite: queries against the base tables are redirected to the materialized view without naming it.

Prefer read-only materialized views. Updatable ones (`FOR UPDATE`) create a multimaster setup that needs conflict resolution; avoid them unless replication is genuinely two-way.

## Privileges

- CREATE MATERIALIZED VIEW plus CREATE TABLE (or CREATE ANY TABLE) and tablespace quota.
- Access to a database link for remote masters; the link's remote account must read the master tables. Objects owned by SYS cannot be masters.
- QUERY REWRITE (GLOBAL QUERY REWRITE for other schemas) to enable rewrite.
- ON COMMIT REFRESH (system or object privilege) for on-commit views on tables you do not own.
- Materialized view logs need CREATE TABLE and CREATE TRIGGER in the master's schema.

## Creating

```sql
create materialized view orders_mv
  tablespace mv_data
  build immediate
  refresh fast on demand
  with primary key
  enable query rewrite
as
select order_id, customer_id, status, order_total
  from orders@hq_link;
```

Key clauses:
- **Refresh type**: `FAST` (only changed rows, needs logs), `COMPLETE` (truncate and re-run the query), `FORCE` (fast if possible, else complete), or `NEVER REFRESH`.
- **Timing**: `ON DEMAND`, `ON COMMIT` (joins or single-table aggregates on local masters), or a schedule with `START WITH date NEXT date_expression`.
- **Row matching**: `WITH PRIMARY KEY` (default) or `WITH ROWID`. Prefer primary keys: rowids change after export/import recoveries. Use rowid only when the master has no primary key or a wide key would bloat the log.
- **Build**: `BUILD IMMEDIATE` or `BUILD DEFERRED` (filled by the first complete refresh).
- **Prebuilt**: `ON PREBUILT TABLE [WITH REDUCED PRECISION]` registers an already loaded, indexed table of the same name and columns. Dropping the materialized view later leaves the table.
- Do not use `USER` or `SYSDATE` in the defining query. An ORDER BY affects only the initial build.

## Materialized view logs (fast refresh)

Created on the master table, in the master database:

```sql
create materialized view log on orders
  tablespace mv_logs
  with sequence, rowid (customer_id, status, order_total)
  including new values;
```

- One log serves every materialized view on that master.
- Aggregate views need the referenced columns, `ROWID`, `SEQUENCE` and `INCLUDING NEW VALUES` in the log.
- Logs can grow unpredictably; keep them in a dedicated tablespace and watch their size.
- Do not create logs for masters used only by complex views that cannot fast refresh.

## Fast refresh rules

- Join-only views: include the ROWID of every table in the select list; every table needs a log.
- Aggregate views: select all GROUP BY columns, plus `COUNT(*)` and `COUNT(col)` for each aggregated column.
- No non-repeating expressions (`SYSDATE`, `ROWNUM`), no RAW or LONG RAW.
- Outer joins: only AND-connected joins, no other WHERE selections, and unique constraints on the inner table's join columns.
- Partition Change Tracking (PCT) can refresh only rows affected by partition maintenance.
- Recheck capabilities after an Oracle upgrade.

Check instead of guessing (create `MV_CAPABILITIES_TABLE` with `?/rdbms/admin/utlxmv.sql`):

```sql
execute dbms_mview.explain_mview('ORDERS_MV');

select capability_name, possible, msgtxt
  from mv_capabilities_table
 order by seq;
```

## Refreshing

- Automatic refreshes need `JOB_QUEUE_PROCESSES > 0`.
- Schedules use date expressions, e.g. `NEXT NEXT_DAY(TRUNC(SYSDATE),'MONDAY') + 12/24` for Mondays at noon. Always give `START WITH` to control the first run.
- Manual: `dbms_mview.refresh('ORDERS_MV', 'f')`. Methods: `c` complete, `f` fast, `p` PCT, `?` force. Several at once: `refresh('A_MV,B_MV', '?c')`. A manual refresh resets the schedule.
- `DBMS_MVIEW.REFRESH_ALL_MVIEWS` refreshes eligible stale local views one by one, so they can end up mutually inconsistent if interrupted; rerun after recovery, or use refresh groups to refresh related views together.
- `DBMS_MVIEW.REFRESH_DEPENDENT` refreshes a tree of nested materialized views.
- `alter materialized view ... consider fresh` (11g) marks a view fresh after you purge history from the master on purpose, so rewrite keeps using it.

Check state in `USER_MVIEWS` (staleness, last refresh, refresh method).

## Query rewrite

- Requires `ENABLE QUERY REWRITE` on the view, `QUERY_REWRITE_ENABLED=TRUE`, a cost-based optimizer mode and current statistics.
- `QUERY_REWRITE_INTEGRITY`: `ENFORCED` (default; fresh data and validated constraints only), `TRUSTED` (trusts dimensions and declared relationships), `STALE_TOLERATED` (also uses stale views). Prebuilt tables need TRUSTED or STALE_TOLERATED.
- `CREATE DIMENSION` declares hierarchies (e.g. city child of country) so rewrite can roll up.
- `REWRITE` / `NOREWRITE` hints control it per statement.
- Verify: the execution plan shows `MAT_VIEW REWRITE ACCESS`; `DBMS_MVIEW.EXPLAIN_REWRITE` (output table from `utlxrw.sql`, REWRITE_TABLE) explains why a query was or was not rewritten.

## Indexing

Oracle indexes only the primary key (or rowid) columns of the container table. Add indexes on columns users filter by. Do not add constraints to the container table; integrity is enforced on the masters.

## SQL Access Advisor

`DBMS_ADVISOR` (needs ADVISOR privilege) recommends materialized views, logs and indexes:
- `QUICK_TUNE(DBMS_ADVISOR.SQLACCESS_ADVISOR, 'task', 'select ...')` for one statement.
- `TUNE_MVIEW` proposes fast-refreshable replacements; results in `USER_TUNE_MVIEW`.
- `CREATE_FILE(GET_TASK_SCRIPT('task'), 'DIR_OBJ', 'file.sql')` writes the script; review tablespaces before running it. `MARK_RECOMMENDATION` records ACCEPT, IGNORE, IMPLEMENTED or REJECT.
- Gather statistics first; single-statement advice ignores the rest of the workload.

## Workflow
1. State the goal: remote replica, summary, or rewrite target, and the acceptable staleness.
2. Write the defining query; check fast-refresh rules and create the needed logs on the masters.
3. Create the materialized view with an explicit refresh type, timing and `START WITH`.
4. Run `EXPLAIN_MVIEW` and fix whatever blocks the capabilities you need.
5. Index the container table for user queries; gather statistics.
6. For rewrite, confirm with the execution plan or `EXPLAIN_REWRITE`.
7. Monitor refresh times, staleness in `USER_MVIEWS` and log growth.

## Red flags
- `REFRESH FORCE` silently doing complete refreshes forever because no log exists.
- Complete refreshes of large views in business hours; they truncate and reload.
- `QUERY_REWRITE_INTEGRITY=STALE_TOLERATED` or `QUERY_REWRITE_ENABLED=FORCE` set at system level without approval: users may get stale answers. ALTER SYSTEM changes need explicit approval and a note of the prior value.
- Dropping a materialized view log while simple views depend on it; fast refresh stops working. Confirm dependants in `USER_MVIEWS` first and get approval for the drop.
- Updatable materialized views without a conflict-resolution plan.
- Running advisor-generated scripts unreviewed.

## Related
- `../RemoteData/remoteData.md` — database links that remote materialized views read through.
- `../../SqlAndSqlPlus/Grouping/grouping.md` — GROUP BY summaries that materialized views precompute.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md` — partition maintenance and PCT refresh.
- `../../SqlAndSqlPlus/Dates/dates.md` — date expressions for refresh schedules.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — reading plans and statistics behind rewrite decisions.
- `../../HitchhikersGuides/ResultCache/resultCache.md` — a lighter alternative for caching query results.
