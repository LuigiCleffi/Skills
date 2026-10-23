---
name: postgres-writing-functions
description: Writing PostgreSQL functions in SQL, PL/pgSQL, PL/Python and PL/V8, including arguments with defaults and named notation, RETURNS TABLE / SETOF / OUT parameters, volatility (IMMUTABLE, STABLE, VOLATILE), STRICT, COST, ROWS, PARALLEL SAFE, SECURITY DEFINER, trusted versus untrusted languages, trigger functions and CREATE TRIGGER, custom aggregates with CREATE AGGREGATE, and window functions, based on Chapter 8 (Writing Functions) of PostgreSQL: Up and Running, 3rd edition. Use when the agent writes or reviews CREATE FUNCTION, CREATE TRIGGER or CREATE AGGREGATE, ports Oracle stored procedures or packages, adds an audit or timestamp trigger, needs a function usable in an index, or sees errors such as "functions in index expression must be marked IMMUTABLE", "cannot change return type of existing function", "permission denied for language" or "control reached end of trigger procedure without RETURN".
---

# Writing Functions

In PostgreSQL the function is the unit of server-side logic: queries, triggers, aggregates and window functions are all built from it. Choose the simplest language that does the job (SQL first, then PL/pgSQL, then others), declare volatility and security honestly, and test the function like any other code before deploying it.

## Safety rules for agents

- Confirm the target database and environment before creating, replacing or dropping functions, triggers or languages. Get explicit approval outside a disposable dev database: replacing a function changes behavior for every caller immediately.
- `CREATE OR REPLACE FUNCTION` keeps grants and dependencies but cannot change the return type or argument types; that needs `DROP FUNCTION`, which can cascade to triggers, views and indexes. List dependents first (`pg_depend`, or try `DROP` without `CASCADE` inside `BEGIN ... ROLLBACK`).
- Back-out: save the current definition first (`\sf schema.func` in psql, or `pg_get_functiondef(oid)`), and deploy inside a transaction; DDL is transactional.
- Creating untrusted-language functions and `CREATE EXTENSION` for languages are superuser operations. Treat them as privileged changes and get approval.
- `SECURITY DEFINER` functions run with the owner's rights. Always pin `SET search_path` on them and revoke `EXECUTE` from `PUBLIC`, then grant to specific roles.
- Never embed passwords, API keys or connection strings in function bodies; bodies are readable in `pg_proc`.

## Anatomy

```sql
CREATE OR REPLACE FUNCTION app.order_total(p_order_id bigint,
                                           p_include_tax boolean DEFAULT true)
RETURNS numeric
LANGUAGE sql STABLE PARALLEL SAFE AS
$$
  SELECT sum(qty * price) * CASE WHEN p_include_tax THEN 1.2 ELSE 1 END
  FROM app.order_items WHERE order_id = p_order_id;
$$;
```

- Arguments may have defaults; defaulted arguments must come last.
- Named arguments can be referenced by name in the body (older SQL functions use `$1`, `$2`). Prefix them (`p_`) to avoid clashing with column names.
- Call positionally `app.order_total(42, false)` or by name `app.order_total(p_include_tax => false, p_order_id => 42)`; named notation lets you skip defaults in any order. `:=` is the legacy form.
- Functions are overloaded by argument types; drop or replace with the full signature.
- Oracle habits: there are no packages (group related functions in a schema); a function returning `void` replaces a procedure; `DUAL` is not needed (`SELECT app.order_total(42);`).
- Version note: PostgreSQL 11 added `CREATE PROCEDURE` and `CALL`; procedures can `COMMIT` and `ROLLBACK` inside their body, functions cannot.

## Qualifiers that matter

- **Volatility.** `IMMUTABLE`: same output for same input, no table reads; required for index expressions. `STABLE`: constant within one statement, may read tables. `VOLATILE` (default): may change data or depend on time or randomness. Mislabeling a function as `IMMUTABLE` gives wrong results from indexes and cached plans; it is a promise, not an optimization switch.
- **STRICT** (`RETURNS NULL ON NULL INPUT`): returns NULL without running when any argument is NULL. On SQL functions it can block inlining, so test the plan.
- **COST**: relative expense (default 100 for SQL and PL languages, 1 for C); raise it for expensive functions so the planner evaluates cheap predicates first.
- **ROWS**: expected row count for set-returning functions; set it when the default 1000 is far off.
- **PARALLEL** (9.6+): `SAFE` for pure computation, `RESTRICTED` when using temp tables or session state, `UNSAFE` (default) when writing data or using sequences.
- **SECURITY DEFINER**: run as the owner, to allow a controlled action without granting table rights:

```sql
CREATE FUNCTION app.close_ticket(p_id bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = app, pg_temp AS
$$ UPDATE app.tickets SET status = 'closed' WHERE id = p_id; $$;
REVOKE EXECUTE ON FUNCTION app.close_ticket(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.close_ticket(bigint) TO support_role;
```

## Choosing a language

- **SQL**: no variables, loops or dynamic SQL, but the planner can inline simple SQL functions and use indexes through them. Default choice for wrappers around one query.
- **PL/pgSQL**: variables (`DECLARE`), `IF`, loops, exceptions, `EXECUTE format(...)` for dynamic SQL, `RETURN QUERY` for sets. Required for most trigger functions (SQL cannot write triggers).
- **PL/Python, PL/Perl and other untrusted (`...u`) languages**: OS, filesystem and network access, run as the server's OS account. Only superusers can create these functions. Use sparingly and audit them.
- **PL/V8 (JavaScript)**: trusted, fast numeric work, JSON handling, can write window functions. Not part of core PostgreSQL; check availability with `SELECT * FROM pg_available_extensions WHERE name LIKE 'pl%';`.
- Trusted languages (SQL, PL/pgSQL, PL/Perl, PL/V8) cannot reach the OS, so ordinary roles may create functions in them.
- Installed languages: `SELECT lanname, lanpltrusted FROM pg_language;`. Install with `CREATE EXTENSION plpython3u;` per database; the OS-level Python must match the version the extension was built against.
- Version note: Python 2 (`plpythonu`, `plpython2u`) support was removed in PostgreSQL 15; use `plpython3u`.

## Returning sets

Three equivalent shapes; call each with `SELECT * FROM fn(...)`:

```sql
CREATE FUNCTION app.open_tickets(p_owner text)
RETURNS TABLE (id bigint, title text, opened_at timestamptz)
LANGUAGE plpgsql STABLE AS
$$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.opened_at FROM app.tickets t
  WHERE t.owner = p_owner AND t.status = 'open';
END;
$$;
```

- `RETURNS TABLE (...)`: closest to other databases and self-documenting.
- `OUT` parameters plus `RETURNS SETOF record`.
- `RETURNS SETOF existing_table_or_type`: reuses a composite type.
- In PL/pgSQL, `RETURNS TABLE` columns are variables; qualify table columns (`t.id`) to avoid "column reference is ambiguous".

## Trigger functions and triggers

```sql
CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_10_touch BEFORE INSERT OR UPDATE OF title, status
ON app.tickets FOR EACH ROW EXECUTE PROCEDURE app.touch_updated_at();
```

- A trigger function takes no declared arguments and returns `trigger`; it reads `NEW`, `OLD`, `TG_OP`, `TG_TABLE_NAME`, `TG_ARGV`. One function can serve many tables.
- `BEFORE` row triggers can modify `NEW` or skip the row by returning `NULL`; changes to `NEW` in `AFTER` triggers are ignored. Use `AFTER` for auditing and notifications.
- `INSTEAD OF` triggers are for views only; `BEFORE`/`AFTER` for tables.
- `FOR EACH STATEMENT` fires once per statement; `FOR EACH ROW` per affected row.
- Narrow firing with `UPDATE OF col, ...` or `WHEN (OLD.status IS DISTINCT FROM NEW.status)`.
- Several triggers on one event fire in alphabetical order of trigger name; name them with a numeric prefix to control order. An error in any trigger rolls back the whole statement.
- Triggers can also be attached to DDL events (`CREATE EVENT TRIGGER`).
- Version note: since PostgreSQL 11 the preferred spelling is `EXECUTE FUNCTION`; `EXECUTE PROCEDURE` still works.
- Verify: `\d table` lists triggers; `pg_trigger` and `information_schema.triggers` for details.

## Custom aggregates

An aggregate is a state transition function, an optional final function and an initial state:

```sql
CREATE FUNCTION app.product_state(acc numeric, x numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT CASE WHEN x IS NULL THEN acc ELSE acc * x END $$;

CREATE AGGREGATE app.product(numeric) (
  SFUNC = app.product_state, STYPE = numeric, INITCOND = '1');
```

- `SFUNC(state, next)` runs once per input row and returns the new state; `FINALFUNC(state)` converts the state into the result (e.g. sum and count into a mean).
- `INITCOND` is a text literal of the state type. Without it, the state starts NULL.
- `SORTOP` lets a min/max-like aggregate use an index. 9.4+ adds moving-aggregate support for sliding windows; 9.6+ adds `PARALLEL` with `COMBINEFUNC` (and serial/deserial functions for internal states).
- Every aggregate also works as a window function (`app.product(x) OVER (...)`).
- True window functions (`LANGUAGE ... WINDOW`) need C or PL/V8; SQL and PL/pgSQL cannot define them.

## Testing functions

- Treat functions as code under test: keep the DDL in version-controlled migration files, and write SQL test scripts (or pgTAP) that cover normal input, NULLs, empty sets and boundary values.
- Run tests in a transaction that rolls back, so fixture data never persists.
- For trigger logic, assert on the row after `INSERT`/`UPDATE ... RETURNING *`.
- Check inlining and costs with `EXPLAIN (ANALYZE, VERBOSE)` on queries that call the function.

## Workflow

1. Define inputs, outputs and side effects; decide function versus procedure (transaction control needed?).
2. Pick the language: SQL if one statement suffices, PL/pgSQL for control flow or triggers, others only for capabilities PL/pgSQL lacks.
3. Declare volatility, `STRICT`, `PARALLEL` and, if needed, `SECURITY DEFINER` with a pinned `search_path`.
4. Save the existing definition (`\sf`), then create or replace inside `BEGIN`; run tests; `COMMIT` or `ROLLBACK`.
5. Set privileges: `REVOKE EXECUTE ... FROM PUBLIC` where appropriate, then explicit `GRANT`s.
6. Verify with `\df+ schema.func`, `\d table` for triggers, and an `EXPLAIN` of a representative caller.

## Red flags

- `IMMUTABLE` on a function that reads tables, `now()`, settings or the time zone.
- `SECURITY DEFINER` without `SET search_path`, or still executable by `PUBLIC`.
- Dynamic SQL built by concatenating arguments instead of `format('%I', ...)`, `%L` or `EXECUTE ... USING`.
- Trigger that modifies `NEW` in an `AFTER` trigger, or returns `NULL` from a `BEFORE` trigger by accident (silently skips rows).
- Row-level trigger doing heavy work on bulk-loaded tables.
- Untrusted-language functions created without review of what they touch on the OS.
- `DROP FUNCTION ... CASCADE` to change a signature without listing dependents.
- Functions relying on unqualified object names while `search_path` varies between callers.
- PL/pgSQL wrapping a single query that a SQL function could inline.

## Related

- `../SqlThePostgresWay/sqlThePostgresWay.md` — INSTEAD OF triggers on views, DO blocks, dollar quoting and window functions.
- `../DataTypes/dataTypes.md` — composite, array and JSON types used as arguments and return types.
- `../DatabaseAdministration/databaseAdministration.md` — roles, privileges and installing extensions.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — how volatility, cost and inlining affect plans.
- `../Psql/psql.md` — `\df+`, `\sf` and `\ef` for inspecting and editing functions.
- `../../Oracle/PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` — Oracle counterpart; PostgreSQL has no packages; do not apply its syntax here.
- `../../Oracle/PlSql/Triggers/triggers.md` — Oracle counterpart; do not apply its syntax here.
- `../../Oracle/PlSql/DynamicSql/dynamicSql.md` — Oracle counterpart for dynamic SQL; do not apply its syntax here.
- `../../../CleanCode/Functions/functions.md` — small, single-purpose functions with few arguments.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — handling failure paths in function and trigger logic.
- `../../../TDD/Patterns/MasteringTDD/masteringTDD.md` — test-first development applied to database functions.
