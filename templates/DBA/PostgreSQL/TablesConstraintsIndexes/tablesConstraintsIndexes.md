---
name: postgres-tables-constraints-indexes
description: "Designing PostgreSQL tables (identity and serial keys, inherited, declaratively partitioned, unlogged and typed tables), enforcing rules with primary key, foreign key, unique, check and exclusion constraints, and choosing and writing indexes (B-tree, BRIN, GiST, GIN, SP-GiST, hash, operator classes, expression, partial and multicolumn indexes), based on Chapter 6 (Tables, Constraints, and Indexes) of PostgreSQL: Up and Running, 3rd edition. Use when writing CREATE TABLE or ALTER TABLE, choosing serial vs GENERATED AS IDENTITY, partitioning with PARTITION BY RANGE, seeing \"no partition of relation found for row\", adding foreign keys or EXCLUDE USING gist, asking why an index is not used for LIKE or lower(), creating partial unique indexes, or picking an index method."
---

# Tables, Constraints, and Indexes

Put the rules in the schema: keys, foreign keys, checks and exclusion constraints stop bad data no matter which application writes it. Then add only the indexes your real queries need, written so the query's expressions, operators and filters match the index exactly, and prove each one with `EXPLAIN`.

## Safety rules for agents

- DDL is transactional in PostgreSQL (unlike Oracle): run migrations inside `BEGIN; ... COMMIT;` and you can `ROLLBACK` a failed one. Exceptions: `CREATE INDEX CONCURRENTLY` and a few others cannot run in a transaction block.
- `DROP TABLE`, `DROP ... CASCADE`, `ALTER TYPE ... CASCADE`, `TRUNCATE` and detaching or dropping partitions destroy data or dependent objects. List dependents first, confirm the database and environment, take a backup, and get explicit approval.
- Most `ALTER TABLE` forms take an `ACCESS EXCLUSIVE` lock; some rewrite the whole table (column type changes, `SET LOGGED`/`SET UNLOGGED`). On busy production tables, plan a window or use the low-lock variants below.
- Plain `CREATE INDEX` blocks writes for the whole build. On live tables use `CREATE INDEX CONCURRENTLY` (slower; if it fails, it leaves an INVALID index to drop and retry).

## Creating tables and keys

```sql
CREATE TABLE app.events (
  event_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_name  varchar(50) NOT NULL,
  detail     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- Identity columns (10+) are SQL-standard and owned by the table: `ALTER TABLE t ALTER COLUMN id RESTART WITH 5000`. `GENERATED ALWAYS` rejects manual values (unless `OVERRIDING SYSTEM VALUE`); `BY DEFAULT` allows them, which helps when loading existing keys.
- `serial`/`bigserial` create a separate sequence you must name to reset; keep them only when one sequence must feed several tables via `DEFAULT nextval('seq')`.
- After bulk-loading explicit ids, move the generator past the max id or the next insert collides.
- Unquoted names fold to lowercase. Name constraints and indexes explicitly (`pk_events`, `fk_orders_customer`); index and constraint names must be unique per schema.

## Inherited tables

- `CREATE TABLE child (...) INHERITS (parent)` adds the parent's columns; querying the parent includes children (`ONLY parent` excludes them). Schema changes on the parent propagate.
- Check constraints and NOT NULL are inherited; primary keys, unique and foreign keys and indexes are not. Each child needs its own.
- Inserts into the parent stay in the parent unless a trigger reroutes them.
- Children may add columns and may inherit from several parents. Use inheritance for this flexibility; use declarative partitioning for partitioning.

## Declarative partitioning (10+)

```sql
CREATE TABLE app.measurements (
  sensor_id int NOT NULL, taken_at timestamptz NOT NULL, value numeric
) PARTITION BY RANGE (taken_at);

CREATE TABLE app.measurements_2024 PARTITION OF app.measurements
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE INDEX ON app.measurements_2024 (sensor_id, taken_at);
```

- Rows inserted into the parent are routed automatically. A row with no matching partition fails with "no partition of relation ... found for row"; create the partition ahead of time (or, from 11, a `DEFAULT` partition).
- Ranges are lower-inclusive, upper-exclusive, must not overlap, and may use `MINVALUE`/`MAXVALUE` for open ends. `LIST` partitioning is also available.
- All partitions have exactly the parent's columns, one parent each, and the parent stores no rows itself.
- The planner skips partitions that cannot match the WHERE clause (check with `EXPLAIN`); filter on the partition key with constants or parameters for this to work. `\d+ parent` lists partitions and bounds.
- On 10, the parent cannot have primary keys, unique constraints or indexes; create them on each partition, and uniqueness holds only within a partition.
- Version note: PostgreSQL 11 added indexes and primary/unique keys on the partitioned parent (keys must include the partition key), hash partitioning, default partitions and row movement on UPDATE; later releases keep improving pruning and foreign keys.
- Removing old data: `ALTER TABLE parent DETACH PARTITION p;` then archive or drop `p`. This is a destructive step that needs approval.

## Unlogged and typed tables

- `CREATE UNLOGGED TABLE` skips WAL: much faster writes, but the table is emptied after a crash and is not replicated to standbys. Use only for rebuildable data (caches, staging, sessions). `ALTER TABLE t SET LOGGED` (9.5+) rewrites it into a normal table.
- `CREATE TABLE t OF some_type` builds a table from a composite type; change columns with `ALTER TYPE ... ADD ATTRIBUTE ... CASCADE`, which alters every typed table using it.

## Constraints

- **Primary key / unique**: create a unique B-tree index automatically. Unique constraints allow multiple NULLs. Need uniqueness only for some rows, or on an expression? Use a unique partial or expression index.
- **Foreign key**: choose `ON DELETE`/`ON UPDATE` actions (`RESTRICT`, `NO ACTION` default, `CASCADE`, `SET NULL`, `SET DEFAULT`) deliberately, and state them. PostgreSQL does not index the referencing column; add that index yourself or deletes on the parent and joins become scans.
- **Check**: any boolean expression on the row (`CHECK (user_name = lower(user_name))`). Inherited by child tables; used by the planner to skip inheritance children (constraint exclusion).
- **Exclusion**: generalized uniqueness with any commutative operator, enforced by a GiST (or SP-GiST) index. Classic use: no overlapping bookings per resource. Mixing scalar `=` with ranges needs `btree_gist`; integer-array overlap needs `intarray`.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE app.bookings ADD CONSTRAINT ex_bookings_room_slot
  EXCLUDE USING gist (room_id WITH =, slot WITH &&);
```

- Adding a constraint validates all existing rows under a heavy lock. On large tables add FK and check constraints `NOT VALID`, then `ALTER TABLE ... VALIDATE CONSTRAINT name;` separately.
- Inspect constraints with `\d table` or `pg_constraint`; failing inserts name the violated constraint, so good names make errors self-explanatory.

## Choosing an index method

| Method | Use for | Notes |
|---|---|---|
| B-tree | equality, ranges, sorting, PK/unique | default; the only method for unique constraints |
| BRIN | huge, naturally ordered tables (time-series appends) | tiny and fast to build; coarse, needs physical correlation |
| GiST | ranges, geometry, exclusion constraints, full text | lossy, rechecks rows |
| SP-GiST | points, ranges, text with skewed distributions | alternative to GiST |
| GIN | jsonb, arrays, tsvector, `pg_trgm` for LIKE/regex | larger, slower updates, fast lookups |
| hash | equality only | crash-safe and replicated only from 10 |

- `btree_gist`/`btree_gin` let one compound index mix scalar columns with complex types.
- Indexes work on tables and materialized views, not on foreign tables.

## Operator classes, expressions and partial indexes

- An index serves only the operators in its operator class. Default B-tree `text_ops` does not serve `LIKE 'abc%'` unless the database collation is `C`; use `text_pattern_ops` (or `varchar_pattern_ops`) for prefix searches, and keep a default index too if you also need `<`/`>` sorting. List classes with `pg_opclass` joined to `pg_am`.
- Expression index: the query must use the identical expression.

```sql
CREATE INDEX ix_customers_email_lower ON app.customers (lower(email));
SELECT * FROM app.customers WHERE lower(email) = lower($1);
```

- Partial index: indexes only rows matching a WHERE, smaller and faster; a unique partial index enforces uniqueness on a subset. The query must include the same condition. Predicates must be immutable (no `now()`, `current_date`, or other tables).

```sql
CREATE UNIQUE INDEX uq_subscriptions_active
  ON app.subscriptions (lower(email)) WHERE is_active;
```

- A view that applies the same expression and filter keeps application queries matching the index.

## Multicolumn indexes

- B-tree multicolumn indexes are most effective when the query filters on the leading column(s); a separate index on just the first column is then redundant.
- The planner can combine single-column indexes with bitmap scans. When access patterns are unknown, start with single-column indexes and add compound ones for proven hot queries.
- Index-only scans read just the index when it holds every needed column (and the visibility map is current after `VACUUM`). Version note: since 11, `INCLUDE (cols)` adds non-key payload columns for this.
- Every index costs write time, disk and memory. Check use with `pg_stat_user_indexes.idx_scan` before keeping or dropping one; dropping needs approval, and you back out by recreating it from its saved definition (`pg_indexes.indexdef`).

## Workflow

1. Write the table with explicit types, NOT NULL, identity key and named constraints that encode the business rules.
2. Add foreign keys with deliberate actions and an index on each referencing column.
3. For very large or time-based data, decide partitioning up front; create partitions (and their indexes and keys) before data arrives.
4. Collect the real queries; for each, choose index method, operator class, expression and partial predicate to match it exactly.
5. Apply DDL in a transaction (indexes on live tables `CONCURRENTLY`, constraints `NOT VALID` then `VALIDATE`) after approval for production.
6. Verify with `\d+ table`, `EXPLAIN (ANALYZE, BUFFERS)` on realistic data, and later `pg_stat_user_indexes` for unused indexes.

## Red flags

- `serial` in new designs, or ids loaded without resetting the identity or sequence.
- Foreign keys with no index on the referencing column.
- Uniqueness enforced in application code instead of a unique or exclusion constraint.
- Overlap checks for bookings done with SELECT-then-INSERT logic (races).
- `LIKE 'abc%'` or `lower(col) =` queries against a plain default index.
- Partial index predicates using `now()`, or queries that omit the index's WHERE condition.
- Partitioned tables with no plan for creating future partitions, or queries that never filter on the partition key.
- Unlogged tables holding data that must survive a crash or reach replicas.
- `CREATE INDEX` without `CONCURRENTLY` on a busy production table; `DROP ... CASCADE` without listing dependents.
- Many overlapping compound indexes nobody has checked against `idx_scan`.

## Related

- `../DataTypes/dataTypes.md` — the types (ranges, jsonb, arrays, tsvector) these indexes and constraints serve.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — reading plans to confirm index use and partition pruning.
- `../SqlThePostgresWay/sqlThePostgresWay.md` — views, RETURNING and upserts that rely on these constraints.
- `../DatabaseAdministration/databaseAdministration.md` — backups before destructive DDL, vacuum and maintenance.
- `../../Oracle/SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — Oracle counterpart; do not apply its syntax here.
- `../../Oracle/SqlAndSqlPlus/Partitioning/partitioning.md` — Oracle counterpart for partitioning; do not apply its syntax here.
- `../../../CleanCode/MeaningfulNames/namingRules.md` — naming tables, constraints and indexes so errors explain themselves.
