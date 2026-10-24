---
name: dba-schema-objects
description: "Designing and changing Oracle tables, constraints, views, indexes, clusters and sequences, based on Chapter 17 (Creating and Managing Tables, Views, Indexes, Clusters, and Sequences) of Oracle Database 11g: The Complete Reference. Use when writing or reviewing CREATE/ALTER/DROP TABLE, adding or dropping columns, choosing column widths and NUMBER precision, naming constraints, creating views, B-tree/bitmap/function-based/invisible indexes, index-organized tables, CTAS, sequences, or when hitting ORA-12899, ORA-01438, ORA-01758, ORA-00001, ORA-04063 or DDL lock timeouts."
---

# Creating and Managing Tables, Views, Indexes, Clusters, and Sequences

Let the schema do the integrity work: size columns for the future, declare named constraints, and add indexes only for real access paths. Treat every DROP, TRUNCATE and column change on a populated table as a production change that needs a plan and a way back.

## Tables and datatypes

- Names: 1 to 30 characters, start with a letter, letters/digits/underscore, not a reserved word. Never quote identifiers; quoted names become case-sensitive forever.
- `VARCHAR2` (max 4000) costs nothing extra when declared wide; trailing space is not stored and NULL stores nothing. Size for every future value, not today's longest. Too narrow fails with ORA-12899.
- `CHAR` (max 2000) is fixed width; avoid it for names and free text.
- `NUMBER(p,s)`: `p` total digits, `s` digits right of the decimal point.
  - Too many digits left of the point: ORA-01438, row rejected.
  - Extra digits right of the point: silently rounded to `s`.
  - Negative `s` rounds to tens, hundreds...; plain `NUMBER` keeps full precision.
- Check the result with `describe` or `USER_TAB_COLUMNS`.

## Constraints

Declare them in `create table` (column form for one column, table form for several) and always name them: `<TABLE>_PK`, `<TABLE>_UK`, `<TABLE>_<PARENT>_FK`, `<TABLE>_<COL>_CK`. Unnamed constraints become `SYS_Cnnnnnn` and are hard to manage.

```sql
create table orders (
  order_id     number(12)    not null,
  customer_id  number(12)    not null,
  status       varchar2(20)  default 'NEW' not null,
  amount       number(12,2),
  constraint orders_pk primary key (order_id)
    using index tablespace app_idx,
  constraint orders_customers_fk foreign key (customer_id)
    references customers (customer_id),
  constraint orders_amount_ck check (amount >= 0)
);
```

- `PRIMARY KEY`: one per table, implies NOT NULL. `UNIQUE`: any number, a candidate key. Both create a unique index; place it with `using index tablespace`.
- `FOREIGN KEY` must reference a PK or UK, possibly in the same table, never in a remote database. `on delete cascade` deletes children with the parent; use it deliberately.
- `CHECK` cannot reference other rows or pseudo-columns such as `SYSDATE`, `USER`, `NEXTVAL`, `ROWNUM`. Use the table form to compare several columns.
- More constraints mean less application code but slightly slower DML; the trade is almost always worth it.

## Altering tables

- Always allowed: widen character columns, add NUMBER digits, change decimal places.
- Only when the column is NULL in every row: change datatype, shrink width or digits. Exception: `LONG` can be modified to `CLOB` with data in place.
- Adding a NOT NULL column to a populated table fails (ORA-01758) unless you give a default. In 11g `add (col ... default 'X' not null)` is a metadata-only change; existing rows are not rewritten.
- Otherwise: add nullable, backfill with `update`, then `modify (col not null)`.
- `alter table t read only` / `read write` (11g) blocks DML at table level; check `USER_TABLES.READ_ONLY`.
- Busy table, DDL fails on the lock: `alter session set ddl_lock_timeout = 60;` retries for up to 60 seconds.
- Virtual columns (11g): `col generated always as (expr) virtual`. Not stored, cannot be inserted into, can be indexed and used as a partition key.

## Dropping columns, tables and data

- `alter table t drop column c` rewrites the blocks now; `set unused column c` is instant, then `drop unused columns` in a quiet window. Unused columns are unreachable immediately; see `USER_UNUSED_COL_TABS`.
- Several columns: `alter table t drop (c1, c2)`, without the `column` keyword. Add `cascade constraints` if they belong to a PK/UK.
- `drop table t` goes to the recycle bin (recoverable with flashback); `drop table t purge`, `purge table t`, `purge recyclebin` are permanent.
- `truncate table t` removes all rows, cannot be rolled back and does not fire delete triggers. `drop storage` (default) releases space, `reuse storage` keeps it.

## Create table as select (CTAS)

- Copies column definitions and data, not constraints (not even NOT NULL), indexes or grants. Re-create them.
- Expressions need a column alias; computed numbers lose their precision. Fails on `LONG` columns.
- Empty copy: `create table orders_shell as select * from orders where 1 = 2;`
- `nologging` speeds large CTAS but the table cannot be recovered from redo; take a backup right after.

## Index-organized tables

`organization index` stores the whole row in the primary key B-tree; a PK is required. Fit: lookups always by the full key, the key is most of the row, data fairly static. Non-key columns used often push work to the overflow area. IOTs support `alter table ... move online` (not for partitioned IOTs).

## Views

- A view is a stored query; dropping its base table leaves it invalid (ORA-04063). Materialized views are the exception.
- `select *` is expanded at creation; new base columns appear only after `create or replace view`, which keeps existing grants.
- DML through a view works on one base table when no group by, distinct, `ROWNUM`, or computed target columns are involved, and NOT NULL base columns are present for inserts. Multi-table views allow DML only on key-preserved tables.
- `with read only` blocks DML through the view; use INSTEAD OF triggers for controlled DML.
- `order by` in a view forces a sort on every query; prefer ordering in the caller.

## Indexes

- B-tree (default) for selective columns in where clauses, joins, `order by`, `MIN`/`MAX`. Leave tiny tables unindexed except for keys.
- Composite: lead with the most frequently filtered column; skip-scan can help otherwise. Fewer wide indexes load faster than many narrow ones.
- Rows whose indexed columns are all NULL are not in a B-tree index.
- `create bitmap index` for low-cardinality columns in read-mostly or batch tables only; bitmaps hurt concurrent OLTP DML. Put "bitmap" in the name.
- Function-based: `create index customers_upper_name_ix on customers (upper(last_name));` so `where upper(last_name) = :name` can use it. Add sparingly.
- `reverse` spreads inserts of sequential keys across blocks.
- Unique index vs constraint: a PK/UK constraint can be referenced by foreign keys and reuses an existing index.
- Rebuild with `alter index ... rebuild [online] tablespace ...`; needs space for old and new copies at once.
- Invisible (11g): `alter index ... invisible` hides an index from the optimizer while you test it; it still costs space and DML. Check `USER_INDEXES.VISIBILITY`.

```sql
create index orders_customer_ix on orders (customer_id) tablespace app_idx invisible;
select /*+ index(o orders_customer_ix) */ * from orders o
 where o.customer_id = :cust_id;                  -- only a hint naming it uses it
alter index orders_customer_ix visible;           -- after plans are verified
```

## Clusters

A cluster stores rows of tables usually joined on a key in the same blocks. Create the cluster, create tables with `cluster name (col)` (columns match cluster keys by position, no tablespace clause), then `create index ... on cluster name` before inserting. Hash clusters place rows by hashing the key. Use only for stable, always-joined data.

## Sequences

```sql
create sequence orders_seq start with 1000 increment by 1 cache 1000;
insert into orders (order_id, customer_id) values (orders_seq.nextval, :cust_id);
insert into order_lines (order_id, line_no) values (orders_seq.currval, 1);
```

- `NEXTVAL` first in the session, then `CURRVAL` returns the same value. Neither is allowed in subqueries, view select lists, `distinct`, set operators, or `order by`/`group by`/`having`.
- Numbers are unique, not gap-free: cached values are lost on shutdown or shared pool flush. Cache generously (the book suggests at least 1000; far more per instance on RAC).

Version note: since 12c, identity columns and `default seq.nextval` can replace sequence-plus-trigger patterns.

## Workflow

1. Confirm the target schema and environment; inspect current DDL (`dbms_metadata.get_ddl`), row counts and dependents before changing anything.
2. Design columns for future values; name every constraint; place PK/UK indexes with `using index`.
3. For changes on populated tables, choose the online-friendly form: default + NOT NULL, `set unused`, invisible index first, `ddl_lock_timeout`.
4. Get explicit approval before DROP, TRUNCATE, PURGE, column drops or `nologging`; state the back-out (recycle bin flashback, backup, saved DDL).
5. Verify in `USER_TABLES`, `USER_TAB_COLUMNS`, `USER_CONSTRAINTS`, `USER_INDEXES`, `USER_OBJECTS` (status VALID) and with an execution plan for new indexes.

## Red flags

- Quoted mixed-case identifiers; `SYS_C...` constraint names.
- `CHAR` or tight `VARCHAR2` for names; `NUMBER(p,s)` that silently rounds money.
- CTAS copies assumed to carry constraints, indexes or grants.
- TRUNCATE or `drop ... purge` on an unconfirmed environment; TRUNCATE expected to fire triggers.
- Bitmap indexes on OLTP tables; an index per column; function-based indexes for every function.
- `nologging` loads with no backup afterwards.
- Views with `select *` or `order by` exposed to applications.
- Gap-free business numbers expected from a sequence.

## Related

- `../Partitioning/partitioning.md` — partitioned tables and local/global indexes.
- `../BasicSecurity/basicSecurity.md` — grants on tables, views and sequences.
- `../../BeyondTheBasics/Tablespaces/tablespaces.md` — where tables and indexes are stored.
- `../../BeyondTheBasics/MaterializedViews/materializedViews.md` — views that store data.
- `../../BeyondTheBasics/FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` — recovering dropped tables from the recycle bin.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — when the optimizer uses an index.
