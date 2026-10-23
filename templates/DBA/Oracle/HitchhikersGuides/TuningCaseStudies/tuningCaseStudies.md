---
name: dba-tuning-case-studies
description: A diagnostic method for Oracle performance problems drawn from three cases (I/O waits, application-killing queries, long batch loads), covering per-second AWR analysis, query rewrite, the 10053 optimizer trace and partition-exchange loading, based on Chapter 48 (Case Studies in Tuning) of Oracle Database 11g: The Complete Reference. Use when the system slows under concurrency or month-end batch, AWR/Statspack shows high db file sequential read or buffer busy waits, a query uses leading-wildcard LIKE, LOWER() on an indexed column or literals instead of binds, plans differ between environments, or a daily load overruns its window.
---

# Case Studies in Tuning

Most performance problems are designed in. Before touching parameters, decide whether the bottleneck is the environment, specific queries, or the application's data-flow architecture, using measured statistics in consistent units. Then fix the biggest contributor and keep measuring.

## Case 1: environment — waits everywhere

Gather AWR (or Statspack) snapshots for a good period and a bad period. Compare, at minimum: executions, logical reads, physical reads, physical writes, transactions, sorts (memory vs disk), buffer busy waits, undo header waits, and `db file sequential read` / `db file scattered read` waits.

- **Normalize to per-second values** (divide interval totals by elapsed seconds) before reasoning.
- Compute ratios: read waits / physical reads, buffer busy waits / physical writes. A high share of I/O requests waiting points at the I/O subsystem.
- Check file-level I/O distribution (AWR, `V$FILESTAT`). Even distribution with high waits implicates shared components (controllers, NICs, array cache, storage network), not one disk.
- Do not chase full scans by reflex: if scattered reads are a small share of read waits, removing them barely helps. Parallel full scans always read from disk.
- Fixes in the case: configure the storage cache correctly, and move batch-capable work out of online hours. Physical reads fell 40% while waits fell over 80%.
- Keep tracking the same statistics afterward; growth and new modules will move the bottleneck.

Pulling cumulative values from `V$SYSSTAT`/`V$WAITSTAT` since startup mixes in unrelated activity; prefer interval snapshots.

## Case 2: application-killing queries

Find the top statements by total cost and by frequency in `V$SQL` (`executions`, `buffer_gets`, `disk_reads`) or AWR. A cheap query run millions of times can out-read every other statement.

A typical offender, and what is wrong with it:

```sql
select order_id from orders
 where lower(customer_name) like '%smith%';
```

- **Literals, no binds** — every value is hard parsed and floods the shared pool. Use bind variables (`like :pattern`); `CURSOR_SHARING` is only a database-side workaround.
- **Function on the column** — a plain index on `customer_name` cannot be used; create a function-based index on `lower(customer_name)` if the predicate is needed.
- **Leading wildcard** — forces a full scan regardless. Rethink the search: Oracle Text (`CONTAINS`) with a context index handles wildcard and word searches. For name searches use an empty stoplist so short names are not dropped.

Then ask the architectural question for each top query: what is it for, and does it need to touch this many rows? Work with as few rows as possible, and cache or eliminate repeated reads of static data.

## Seeing optimizer decisions: event 10053

```sql
alter session set events '10053 trace name context forever, level 1';
-- run (hard parse) the statement to analyze
alter session set events '10053 trace name context off';
```

- The trace file goes to the user dump/diagnostic trace directory on the server.
- It is written only on a hard parse; a statement already in the shared pool shows no calculations. Change the text slightly or parse in a fresh environment.
- Content: initialization parameters, object and index statistics, access paths, join orders and methods considered, costs, chosen plan.
- Use it to explain plan differences across versions, platforms, parameters, statistics or hints. Parameters shift costs, e.g. higher `DB_FILE_MULTIBLOCK_READ_COUNT` cheapens full scans; lower `OPTIMIZER_INDEX_COST_ADJ` cheapens index access.
- To reproduce production plans in test, export production statistics (`DBMS_STATS.EXPORT_SCHEMA_STATS`) and import them into test. Changing statistics or session parameters on a shared system alters other users' plans: get approval first.

## Case 3: long-running batch loads

A daily file must be loaded within a window; failures meant deleting and reloading. Options, in light of how users read the data:

- **Incremental loads** during the day, if they do not disturb queries.
- **External tables** instead of loading, when few well-defined queries read the data, or when only aggregates are needed (`insert ... select` from the external table into a summary).
- **Partition exchange**: load into a standalone table, index and analyze it, then swap it in.
- **Materialized views** that users query, made fast-refreshable so the base load applies incrementally.
- **Parallelism and bulk paths**: parallel DML/query, SQL*Loader direct path, parallel Data Pump, `nologging` loads, partition-level operations.

```sql
alter table sales_fact
  exchange partition p_2024_06_01 with table sales_stage
  including indexes without validation;
```

- Exchange separates loading from querying; with local indexes, user impact is near zero.
- `nologging` operations cannot be recovered from archived redo; take a backup after the load. Confirm the environment before exchanging partitions on production tables.

**Set size trade-off.** Row-by-row master/detail processing collapses at volume; one giant set operation may choke on sorts. Middle path: process chunks (for example 100,000 rows) into a work table, index and analyze it, finish the transforms, insert into production, then truncate the work table. In the case, 12 hours became 3. Test chunk sizes and add restart/exception handling, since there are more failure points.

## Workflow

1. Capture AWR snapshots for good and bad periods; normalize to per-second.
2. Classify the problem: environment (waits, I/O), queries (top SQL by cost and frequency), or architecture (batch design).
3. For I/O, verify distribution and shared components with storage/system admins before changing SQL.
4. For queries, get the explain plan, fix binds, function-based or Text indexes, and row counts touched.
5. For unexplained plan choices, run a 10053 trace on a hard parse and compare statistics and parameters.
6. For batch, separate load from query (exchange partition, external tables, MVs) and pick a tested set size.
7. Re-measure the same statistics and keep monitoring as data grows.

## Red flags

- Comparing raw interval totals instead of per-second rates.
- Tuning full scans when single-block read waits dominate.
- Literal SQL in hot paths; relying on `CURSOR_SHARING` instead of binds.
- `lower(col)` or `like '%x%'` predicates on large tables with no matching index strategy.
- Ignoring high-frequency cheap queries because each run is fast.
- Delete-and-reload recovery for failed batch loads in the query window.
- `nologging` loads with no backup afterward.
- Changing statistics or optimizer parameters on shared systems without approval.

## Related

- `../TuningApplicationsAndSql/tuningApplicationsAndSql.md` — AWR, explain plans and the tuning method these cases apply.
- `../ResultCache/resultCache.md` — caching repeated queries of static data.
- `../../BeyondTheBasics/OracleText/oracleText.md` — text indexes for wildcard searches.
- `../../BeyondTheBasics/ExternalTables/externalTables.md` — querying files without loading.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md` — exchange partition and local indexes.
- `../../BeyondTheBasics/MaterializedViews/materializedViews.md` — fast-refreshable summaries.
- `../../BeyondTheBasics/SqlLoader/sqlLoader.md` — direct path loads.

Version note: `CURSOR_SHARING=SIMILAR`, which the book prefers, was deprecated in 11g Release 2 and removed in 12c; use binds (or `FORCE` as a stopgap).
