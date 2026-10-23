---
name: dba-plsql-tuning
description: Tuning PL/SQL code by fixing its SQL first, applying procedural best practices, profiling line-by-line with DBMS_PROFILER, and replacing row-by-row loops with FORALL and BULK COLLECT, based on Chapter 37 (PL/SQL Tuning) of Oracle Database 11g: The Complete Reference. Use when a procedure, package or batch job is slow, when the user asks "why is this PL/SQL slow", "profile this block", "speed up this loop", when code does insert/update/delete or fetch inside a cursor FOR loop over many rows, or when choosing VARCHAR2 sizes and condition ordering in hot code.
---

# PL/SQL Tuning

Most of a slow procedure's time is usually spent in its SQL, so tune the statements first, then measure the procedural code line by line, then remove per-row round trips with bulk operations. Never guess: profile, change one thing, profile again.

## 1. Tune the SQL first

- Pull each statement out of the procedure and check its plan with `explain plan` or `set autotrace` (see the tuning skill).
- If the SQL is built dynamically or uses binds you cannot reproduce exactly, capture what actually ran from `V$SQL` (or a session trace) instead of rewriting it by hand.
- Look for statements with many physical reads (often a missing index) or many logical reads (inefficient access path or poor index choice).

```sql
select sql_id, executions, buffer_gets, disk_reads, sql_text
  from v$sql
 where sql_text like '%ORDERS%'
 order by buffer_gets desc;
```

## 2. Procedural best practices

- **Use built-ins.** Prefer Oracle-supplied functions, sorting and searching over hand-written versions.
- **Order conditions for short-circuiting.** PL/SQL evaluates conditions in the order written and stops once the result is known. Put the cheap, most decisive test first and expensive function calls last:

```sql
if l_amount > 1000 or risk_score(l_customer_id) > 80 then  -- function rarely runs
```

- **Avoid implicit datatype conversion.** Compare values of the same type; convert once before a loop, not on every iteration.
- **Size VARCHAR2 deliberately.** Below 2000, PL/SQL allocates the full declared length; at 2000 or more it allocates only what the actual value needs. A blanket `VARCHAR2(1000)` holding short values wastes memory; size to the real maximum, or declare 2000+ when lengths vary widely.

## 3. Profile with DBMS_PROFILER

Setup (once per database and per user):
- If the package is missing (common after upgrades), a DBA runs `profload.sql` from `$ORACLE_HOME/rdbms/admin` as SYS. Confirm the target database before running SYS scripts.
- Each user runs `proftab.sql` in their own schema to create the profiler tables; `profrep.sql`, where shipped, adds reporting views such as `PLSQL_PROFILER_LINES_CROSS_RUN`. Rerunning `proftab.sql` drops and re-creates the tables and erases earlier runs: confirm before doing so.

Run:

```sql
exec dbms_profiler.start_profiler('orders batch, 10k rows')
exec process_orders(:batch_id)
exec dbms_profiler.stop_profiler
```

Read the results:

```sql
select line#, total_occur, total_time, min_time, max_time
  from plsql_profiler_data
 where runid = :runid
 order by total_time desc;
```

- `PLSQL_PROFILER_RUNS` lists runs; `PLSQL_PROFILER_DATA` holds per-line occurrence counts and times in nanoseconds.
- Run the code once before profiling so parse time does not distort the numbers.
- Compare runs at two data volumes. If the time per execution of a line stays constant, total cost grows linearly with rows: the work is row-by-row and will not scale.

## 4. FORALL for bulk DML

`FORALL` binds a whole collection and sends it to the SQL engine in one call instead of one call per row.

```sql
declare
  type id_tab is table of orders.order_id%type index by pls_integer;
  l_ids id_tab;
begin
  select order_id bulk collect into l_ids
    from orders where status = 'CANCELLED';
  forall i in 1 .. l_ids.count
    delete from order_lines where order_id = l_ids(i);
end;
/
```

- The body is a single DML statement (static or dynamic), not a block.
- Be careful with the bounds: they must match the populated elements of the collection.
- Gains are small for a handful of rows and grow with volume.

## 5. BULK COLLECT for queries

`BULK COLLECT` fills collections in one operation; it works with `select into`, `fetch into` and `returning into`.

```sql
declare
  type name_tab is table of customers.name%type;
  l_names name_tab;          -- initialized automatically
begin
  select name bulk collect into l_names
    from customers where region = :region;
  dbms_output.put_line(l_names.count || ' customers');
end;
/
```

- Every target must be a collection. A VARRAY target must be large enough for every row returned.
- Check `count` before looping `first .. last`; an empty result leaves the collection empty.

## Workflow

1. Reproduce the slow call with realistic data volume.
2. Find the SQL it runs (source, `V$SQL`, trace) and tune each expensive statement first.
3. Profile the procedure with DBMS_PROFILER; sort lines by total time.
4. Attack the most expensive line. If it is DML or a fetch inside a loop, convert to `BULK COLLECT` plus `FORALL`.
5. Fix procedural details on hot lines: condition order, type conversions, VARCHAR2 sizing.
6. Re-profile at two volumes to confirm the cost no longer grows per row; revisit as data grows.

## Red flags

- Tuning PL/SQL logic while the SQL inside it does full scans or huge logical reads.
- `for r in cur loop insert/update/delete ... end loop` over large row counts.
- An expensive function call placed first in an `or`/`and` chain.
- Comparing values of different datatypes inside loops.
- `BULK COLLECT` into a VARRAY that can overflow.
- Rerunning `proftab.sql` and losing profiler history someone else needed.
- Claiming a speedup without a before/after profile.

## Related

- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — explain plan, autotrace and the SQL tuning that comes first.
- `../IntroductionToPlSql/introductionToPlSql.md` — blocks, cursors and loops being tuned here.
- `../DynamicSql/dynamicSql.md` — dynamic DML, which FORALL can also drive.
- `../../ObjectRelational/Collectors/collectors.md` — nested tables and varrays used as bulk-bind targets.
- `../../../../CleanCode/Functions/functions.md` — keep hot code small enough to profile and reason about.
