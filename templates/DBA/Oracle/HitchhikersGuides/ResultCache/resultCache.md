---
name: dba-result-cache
description: How to use the SQL Result Cache, PL/SQL function result caching and the OCI client-side query cache to serve repeated queries without re-reading data blocks, based on Chapter 47 (SQL Result Cache and Client-Side Query Cache) of Oracle Database 11g: The Complete Reference. Use when the same read-mostly query or lookup runs thousands of times, the user mentions the RESULT_CACHE hint, RESULT_CACHE_MODE, RESULT_CACHE_MAX_SIZE, DBMS_RESULT_CACHE, V$RESULT_CACHE_*, client result cache or CLIENT_RESULT_CACHE_SIZE, or a cached result looks stale or memory is not released.
---

# SQL Result Cache and Client-Side Query Cache

Even a perfectly tuned query still reads its blocks on every execution. When a read-mostly query runs again and again, cache its result instead: the first run computes and stores it, later runs return it with zero logical reads. Use the cache for static or slowly changing data, and verify that it is actually being hit.

## How the server result cache works

- Lives in the shared pool of the SGA; every session on that instance can reuse a cached result.
- The first execution does the full work and stores the result; the plan shows an extra `RESULT CACHE` operation with a generated name. Later executions show 0 consistent gets.
- Results are read-consistent. Uncommitted changes in another session do not affect the cached result; a **commit** to a dependent table invalidates it, and the next execution recomputes and recaches it.
- In RAC each instance has its own result cache; a result is only cached on the instance where the hinted query ran.

```sql
select /*+ result_cache */ region_code, product_id, sum(amount)
  from orders
 where region_code = :region
 group by region_code, product_id;
```

## Choosing what to cache

- Good: lookups, code tables, aggregates over read-mostly tables, frequently repeated reports, inline views and subqueries (cached even if the outer query differs), flashback queries.
- Bad: tables with frequent commits (constant invalidation), large result sets (crowd out other results), queries that must be fresh to the millisecond.
- Never cached automatically: temporary tables, dictionary tables, queries using `CURRVAL`/`NEXTVAL`, `SYSDATE` or `CURRENT_DATE`.

## Parameters

| Parameter | What it controls |
|---|---|
| `RESULT_CACHE_MODE` | `MANUAL` (default: only hinted queries), `FORCE` (cache everything). Hints `RESULT_CACHE` / `NO_RESULT_CACHE` override the mode. |
| `RESULT_CACHE_MAX_SIZE` | Size of the cache in the shared pool. `0` disables it. Cannot exceed 75% of the shared pool; default derived from memory settings. |
| `RESULT_CACHE_MAX_RESULT` | Largest share one result may use; default 5% of the max size. |
| `RESULT_CACHE_REMOTE_EXPIRATION` | Minutes a result based on a remote object stays valid. Default `0` (do not cache). Nonzero values can return stale data, since remote changes do not invalidate. |

- The cache takes memory from the shared pool. If `SHARED_POOL_SIZE` is set explicitly, consider increasing it when moving to 11g.
- Prefer the hint (`MANUAL`) over `FORCE`; forcing every query into the cache wastes memory on one-off results.

## PL/SQL function result cache

Mark a deterministic lookup function with `RESULT_CACHE`; list the tables it reads in `RELIES_ON` so changes invalidate the cached values.

```sql
create or replace function customer_tier(p_customer_id number)
  return varchar2
  result_cache relies_on (customers)
is
  v_tier customers.tier%type;
begin
  select tier into v_tier from customers where customer_id = p_customer_id;
  return v_tier;
end;
/
```

## Administering with DBMS_RESULT_CACHE

```sql
set serveroutput on
exec dbms_result_cache.memory_report            -- usage breakdown
select dbms_result_cache.status from dual;      -- ENABLED / DISABLED ...
exec dbms_result_cache.invalidate('APP','ORDERS') -- drop results depending on a table
exec dbms_result_cache.flush                    -- empty the whole cache
```

- Memory is not released automatically; use `INVALIDATE` for one table's dependents or `FLUSH` for everything.
- `FLUSH` affects every session on the instance and forces recomputation. Confirm the environment and get approval before flushing a production cache.

## Monitoring views

- `V$RESULT_CACHE_STATISTICS` — settings, creates, finds (hits), invalidations.
- `V$RESULT_CACHE_OBJECTS` — cached results and dependencies with their status.
- `V$RESULT_CACHE_DEPENDENCY` — which results depend on which objects.
- `V$RESULT_CACHE_MEMORY` — memory blocks and their status.

## OCI client-side query cache

Caches results in the memory of OCI client processes, saving the round trip, server CPU and network traffic. Best for lookup tables and read-only or read-mostly data.

- Server side: set `CLIENT_RESULT_CACHE_SIZE` (default 0, static, needs restart) and optionally `CLIENT_RESULT_CACHE_LAG` (ms before the client checks for server changes, default 5000, static).
- Client side (`sqlnet.ora` or client config) can override: `OCI_RESULT_CACHE_MAX_SIZE`, `OCI_RESULT_CACHE_MAX_RSET_SIZE` (bytes), `OCI_RESULT_CACHE_MAX_RSET_ROWS`.
- Queries still need the result cache hint. Applications must be linked with 11g client libraries and connect to an 11g or later database.
- The client cache refreshes automatically when the underlying results change in the database. Monitor with `V$CLIENT_RESULT_CACHE_STATISTICS`.

## Workflow

1. Find repeated, read-mostly statements (high executions in `V$SQL`, stable underlying tables).
2. Confirm the cache is enabled: `dbms_result_cache.status`, `RESULT_CACHE_MAX_SIZE > 0`.
3. Add `/*+ result_cache */` (or `RESULT_CACHE` on the PL/SQL function with `RELIES_ON`).
4. Run twice with `set autotrace on`; the second run should show the `RESULT CACHE` step and 0 consistent gets.
5. Watch `V$RESULT_CACHE_STATISTICS` for hit rate and invalidations; remove the hint if invalidations dominate.
6. For chatty OCI clients reading static lookups, size the client result cache and check its statistics view.

## Red flags

- `RESULT_CACHE_MODE = FORCE` on a busy OLTP system.
- Caching results over tables that are committed to constantly.
- Nonzero `RESULT_CACHE_REMOTE_EXPIRATION` where remote data must be current.
- Hinting queries that return huge result sets, evicting useful entries.
- Function caching without `RELIES_ON` for the tables it reads.
- Expecting results cached on one RAC instance to be visible on another.
- Flushing the cache in production to "fix" a problem without approval.

## Related

- `../TuningApplicationsAndSql/tuningApplicationsAndSql.md` — finding the repeated statements worth caching.
- `../TuningCaseStudies/tuningCaseStudies.md` — frequently executed cheap queries as a hidden cost.
- `../DatabaseAdministration/databaseAdministration.md` — sizing the shared pool that holds the cache.
- `../../PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` — writing the functions you cache.
- `../../PlSql/PlSqlTuning/plSqlTuning.md` — other PL/SQL performance techniques.
