---
name: postgres-sql-the-postgres-way
description: Writing idiomatic PostgreSQL SQL with updatable views and WITH CHECK OPTION, INSTEAD OF triggers on views, materialized views and REFRESH ... CONCURRENTLY, DISTINCT ON, LIMIT/OFFSET, :: casts, VALUES lists, ILIKE and ANY(array), set-returning functions, ONLY, DELETE USING, RETURNING, INSERT ... ON CONFLICT (upsert), composite rows and json_agg, dollar quoting, DO blocks, FILTER, percentile_cont/percentile_disc/mode, window functions, CTEs (basic, writable, recursive), LATERAL, WITH ORDINALITY and GROUPING SETS/ROLLUP/CUBE, based on Chapter 7 (SQL: The PostgreSQL Way) of PostgreSQL: Up and Running, 3rd edition. Use when the agent writes or reviews PostgreSQL queries or DML, needs an upsert, "first row per group", top-N per group, running totals, a tree walk, subtotals, query-to-JSON output, or sees errors such as "new row violates check option for view", "there is no unique or exclusion constraint matching the ON CONFLICT specification", "cannot refresh materialized view concurrently" or "invalid reference to FROM-clause entry".
---

# SQL: The PostgreSQL Way

PostgreSQL offers shorthand and extensions that replace pages of portable SQL with a single clause. Prefer the PostgreSQL construct when the code only targets PostgreSQL, keep standard SQL where portability is a stated requirement, and always verify DML scope (rows affected, RETURNING output) before committing.

## Safety rules for agents

- Confirm the database, schema and environment before any DML or DDL. Get explicit approval before changing data outside a disposable dev database.
- PostgreSQL DDL is transactional: wrap risky changes in `BEGIN; ... ROLLBACK;` to rehearse, then rerun with `COMMIT`. (Oracle habit to drop: DDL does not auto-commit here.)
- `DROP ... CASCADE` silently drops dependent views, foreign keys and more. List dependents first and get approval.
- `UPDATE`, `DELETE` and writable CTEs on a parent table also reach inherited child tables unless you say `ONLY`.
- Add `RETURNING` to data fixes so the changed rows are visible before you commit.

## Views

- A view is a stored query. Single-table views that expose plain columns are automatically updatable (9.3+); updates and deletes honor the view's `WHERE`.
- An update can move a row out of the view (e.g. changing the filtered column). Add `WITH CHECK OPTION` to reject inserts and updates that would not be visible through the view.

```sql
CREATE OR REPLACE VIEW sales.active_orders AS
SELECT order_id, customer_id, status, total
FROM sales.orders WHERE status = 'active'
WITH CHECK OPTION;
```

- Multi-table views are not auto-updatable. Write an `INSTEAD OF INSERT OR UPDATE OR DELETE ... FOR EACH ROW` trigger whose function inspects `TG_OP` and writes to the base tables using `OLD` keys and `NEW` values. Return `NEW` (or `OLD` for delete) to count the row, `NULL` to skip it.
- Rules (`CREATE RULE`) are the older mechanism; prefer `INSTEAD OF` triggers.
- `CREATE OR REPLACE VIEW` can add columns at the end but cannot drop or retype existing ones.
- Verify: `\d+ view_name` in psql shows the definition; `information_schema.views.is_updatable` shows updatability.

## Materialized views

Use when the query is expensive and slightly stale data is acceptable (reports, dashboards, OLAP).

```sql
CREATE MATERIALIZED VIEW sales.daily_totals AS
SELECT order_date, sum(total) AS total FROM sales.orders GROUP BY order_date;
CREATE UNIQUE INDEX ON sales.daily_totals (order_date);
REFRESH MATERIALIZED VIEW CONCURRENTLY sales.daily_totals;
```

- Data is captured at creation and at each `REFRESH`; nothing refreshes automatically. Schedule it (cron, pgAgent, pg_cron) or trigger it.
- Plain `REFRESH` locks out readers for its duration. `CONCURRENTLY` keeps the view readable but requires a unique index (on plain columns, no `WHERE`) and is usually slower.
- You can index a materialized view like a table. For physical ordering, either put `ORDER BY` in the definition (kept on every refresh, costs refresh time) or `CLUSTER ... USING index` (must be repeated after each refresh).
- No `CREATE OR REPLACE`: changes require `DROP MATERIALIZED VIEW` and re-create, which also drops its indexes. Script the indexes with the view.

## Handy shorthands

- `DISTINCT ON (expr)`: one row per group; `ORDER BY` must start with the same expressions, then decides which row wins.

```sql
SELECT DISTINCT ON (customer_id) customer_id, order_id, ordered_at
FROM sales.orders
ORDER BY customer_id, ordered_at DESC;   -- latest order per customer
```

- `LIMIT n OFFSET m`: always pair with a deterministic `ORDER BY`. Large offsets scan and discard rows; use keyset pagination (`WHERE id > :last_id`) for deep pages. (Oracle habit: no `ROWNUM`; `FETCH FIRST n ROWS ONLY` also works.)
- `value::type` is shorthand for `CAST(value AS type)`; chain when needed (`x::text::int`).
- `SELECT` without `FROM` is valid; there is no `DUAL`.
- Multirow `INSERT ... VALUES (...), (...)`. A `VALUES` list is also an inline table: `FROM (VALUES (1,'a'), (2,'b')) AS v(id, code)`; cast literals when the type cannot be inferred.
- `ILIKE` (operator `~~*`) for case-insensitive pattern matching. Plain `LIKE` and `=` are case-sensitive.
- `col op ANY(array)`: matches if any element matches, works with `=`, `LIKE`, `ILIKE`, `~` and custom boolean operators. `WHERE id = ANY($1::int[])` is the clean way to pass a list as one parameter.
- Unquoted identifiers fold to lowercase (Oracle folds to uppercase). Avoid quoted mixed-case names.

## Set-returning functions

- Functions such as `generate_series` and `unnest` may appear in `SELECT` and multiply rows. Expect the row count to change when wrapping such a query as a subquery.
- Prefer putting them in `FROM` with `LATERAL` (below), which is clearer.
- `WITH ORDINALITY` (9.4+, `FROM` clause only) appends a row-number column to a set-returning function's output: `FROM unnest(tags) WITH ORDINALITY AS t(tag, pos)`. Numbering happens before `WHERE`, so filtering leaves gaps. For tables and subqueries use `row_number()`.

## Changing data the PostgreSQL way

- `DELETE FROM t USING other o WHERE t.k = o.k AND ...` deletes based on a join; `UPDATE t SET ... FROM other o WHERE ...` is the update equivalent. Make sure the join is one-to-one or the target row is matched ambiguously.
- `RETURNING col, ...` on `INSERT`, `UPDATE` and `DELETE` returns affected rows, e.g. generated keys after an insert.
- `ONLY table` restricts a statement to the named table, skipping inheritance children.

### Upsert: INSERT ... ON CONFLICT (9.5+)

```sql
INSERT INTO app.settings (key, value)
VALUES ('theme', 'dark'), ('lang', 'en')
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value, updated_at = now();
```

- Needs a primary key, unique constraint, unique index or exclusion constraint that matches the conflict target exactly (same columns or same expression, e.g. `(lower(email))`). Otherwise it errors.
- `DO NOTHING` may omit the target; `DO UPDATE` requires it, or `ON CONFLICT ON CONSTRAINT name`.
- `EXCLUDED` holds the proposed row. Add `WHERE` to `DO UPDATE` to skip no-op updates.
- Only uniqueness and exclusion violations are handled; check, not-null and type errors still fail the statement.
- Version note: `MERGE` exists since PostgreSQL 15; `ON CONFLICT` remains the concurrency-safe choice for simple upserts.

## Composite rows and JSON

- Every table defines a composite type. Selecting the table alias (`SELECT t FROM tbl t`) returns the whole row as one value.
- `json_agg(t)` turns a set of rows into a JSON array of objects; `row_to_json(t)` does one row; `jsonb_agg` for jsonb. Older code may use `array_to_json(array_agg(t))`.

## Dollar quoting and DO

- `$$...$$` delimits strings without doubling single quotes. Use named tags (`$body$`, `$sql$`) when nesting inside another dollar-quoted block, as in function bodies containing dynamic SQL.
- `DO $$ ... $$;` runs an anonymous PL/pgSQL block once (default language plpgsql). Use it for one-off scripted logic such as looping over objects and running `EXECUTE` of generated SQL. It takes no parameters and returns nothing.
- When generating SQL, quote with `format('%I', ident)` and `%L` / `quote_literal`; never concatenate raw user input.
- Review generated statements (`RAISE NOTICE '%', sql`) before executing DDL or DML from a `DO` block in a shared database.

## Aggregates

- `agg(x) FILTER (WHERE cond)` (9.4+) replaces `CASE WHEN` inside aggregates. It is clearer and, unlike `CASE`, does not feed NULLs into `array_agg` or `string_agg`. Works with any aggregate, including custom ones.
- Ordered-set aggregates: `percentile_cont(0.5) WITHIN GROUP (ORDER BY x)` interpolates the median; `percentile_disc` returns an actual value; `mode()` returns the most frequent value. The aggregated column goes in `ORDER BY`, not the argument. Pass an array (`'{0.25,0.5,0.75}'::float8[]`) to get several percentiles at once.
- `GROUP BY GROUPING SETS ((a,b),(a),())` computes several groupings in one pass. `ROLLUP (a,b)` = `(a,b),(a),()`; column order matters. `CUBE (a,b)` adds every combination. Subtotal rows show NULL in rolled-up columns; use `GROUPING(col)` to tell them apart from real NULLs.

## Window functions

```sql
SELECT customer_id, ordered_at, total,
       sum(total)   OVER w AS running_total,
       lag(total)   OVER w AS previous_total,
       row_number() OVER w AS seq
FROM sales.orders
WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at);
```

- `OVER ()` computes over all rows that passed `WHERE`, without collapsing them; `PARTITION BY` restarts per group.
- With `ORDER BY` in the window, aggregates become running totals (default frame: start of partition to current row, ties included). Set the frame explicitly with `ROWS BETWEEN ... AND ...` when that matters.
- `lead`/`lag` take an offset and return NULL past the partition edge; supply a default as third argument if needed.
- Window results cannot be filtered in the same `WHERE`; wrap in a subquery or CTE and filter outside (top-N per group).
- Any aggregate, including user-defined ones, can be used as a window function.

## Common table expressions

- `WITH a AS (...), b AS (... FROM a) SELECT ...`: later CTEs may reference earlier ones.
- Writable CTEs combine DML in one statement, for example moving rows atomically:

```sql
WITH moved AS (
  DELETE FROM ONLY app.events WHERE created_at < now() - interval '90 days'
  RETURNING *
)
INSERT INTO archive.events SELECT * FROM moved;
```

- `WITH RECURSIVE`: an anchor query `UNION ALL` a recursive term that joins back to the CTE; use for trees, hierarchies, graphs and catalog walks (`pg_inherits`, `pg_depend`). Guard against cycles (track a path array, or `CYCLE` clause in 14+) and cap depth.
- Version note: before PostgreSQL 12 every CTE was materialized (an optimization fence). Since 12, side-effect-free CTEs referenced once are inlined; force behavior with `AS MATERIALIZED` / `AS NOT MATERIALIZED`.

## LATERAL

- A `LATERAL` subquery or function in `FROM` may reference columns of items to its left. Use it for top-N per group, per-row function calls, and reusing computed expressions.

```sql
SELECT c.customer_id, r.order_id, r.total
FROM sales.customers c
CROSS JOIN LATERAL (
  SELECT order_id, total FROM sales.orders o
  WHERE o.customer_id = c.customer_id
  ORDER BY total DESC LIMIT 3) r;
```

- Use `LEFT JOIN LATERAL (...) ON true` to keep left rows with no match. Write the `LATERAL` keyword explicitly for clarity. (Oracle/SQL Server counterpart: `CROSS APPLY` / `OUTER APPLY`.)

## Workflow

1. State the problem shape: per-group pick, running value, hierarchy, subtotal, upsert, bulk move.
2. Pick the construct: `DISTINCT ON` or `LATERAL ... LIMIT` for per-group picks, window functions for running values, `WITH RECURSIVE` for trees, `GROUPING SETS`/`ROLLUP` for subtotals, `ON CONFLICT` for upserts, writable CTE for atomic moves.
3. Write the read-only `SELECT` first and check row counts and edge rows (ties, NULLs, partition edges).
4. For DML, run inside `BEGIN` with `RETURNING`, compare counts with the preview, then `COMMIT` or `ROLLBACK`.
5. Check the plan with `EXPLAIN (ANALYZE, BUFFERS)` for anything that runs often or over large tables.
6. For views and materialized views, verify with `\d+`, test writes through views, and confirm refresh scheduling and the unique index for `CONCURRENTLY`.

## Red flags

- `DISTINCT ON` or `LIMIT` without an `ORDER BY` that makes the result deterministic.
- `ON CONFLICT` target that does not match any unique index expression.
- Updatable view without `WITH CHECK OPTION` where callers can move rows out of scope.
- Materialized view treated as live data, or with no refresh job.
- Plain `REFRESH MATERIALIZED VIEW` on a view that users read during business hours.
- `CASE WHEN` inside `array_agg` producing NULL-padded arrays; use `FILTER`.
- Set-returning functions in `SELECT` inside subqueries whose row count matters.
- Recursive CTE with no cycle guard or depth limit.
- Dynamic SQL in `DO` built by concatenating unquoted input.
- `DELETE` or `UPDATE` on an inheritance parent without `ONLY` when children should be untouched.
- `DROP ... CASCADE` run without listing dependents.

## Related

- `../DataTypes/dataTypes.md` — arrays, JSON/JSONB, ranges and composite types used by these constructs.
- `../TablesConstraintsIndexes/tablesConstraintsIndexes.md` — unique indexes needed by `ON CONFLICT` and inheritance used with `ONLY`.
- `../WritingFunctions/writingFunctions.md` — trigger functions for views, custom aggregates and set-returning functions.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — checking plans for CTEs, window functions and LATERAL.
- `../Psql/psql.md` — `\d+`, `\ef` and running scripts inside transactions.
- `../../Oracle/SqlAndSqlPlus/ChangingData/changingData.md` — Oracle counterpart (MERGE, DML safety); do not apply its syntax here.
- `../../Oracle/SqlAndSqlPlus/ComplexQueries/complexQueries.md` — Oracle counterpart for analytic and hierarchical queries; do not apply its syntax here.
- `../../Oracle/SqlAndSqlPlus/Grouping/grouping.md` — Oracle counterpart for ROLLUP and CUBE; do not apply its syntax here.
- `../../Oracle/BeyondTheBasics/MaterializedViews/materializedViews.md` — Oracle counterpart; PostgreSQL has no fast or automatic refresh; do not apply its syntax here.
