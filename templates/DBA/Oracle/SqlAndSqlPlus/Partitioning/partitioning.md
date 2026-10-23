---
name: dba-partitioning
description: Splitting large Oracle tables and indexes into partitions (range, hash, list, composite, reference, interval) and maintaining them, based on Chapter 18 (Partitioning) of Oracle Database 11g: The Complete Reference. Use when a table is very large or time-based, when designing data aging/archiving, choosing a partition key, writing PARTITION BY clauses, choosing local vs global indexes, doing bulk loads with exchange partition, or when partition maintenance (add, drop, split, truncate, exchange) is requested.
---

# Partitioning

Partition a very large table when queries, loads, purges or backups naturally work on a subset of its rows. Pick the key from how data is filtered and aged, keep index partitioning aligned with the table, and treat partition drops and truncates as data deletion.

## Why partition

- Partition pruning: queries filtered on the key touch only the matching partitions.
- Manageability: load, delete or archive one partition instead of running massive DML.
- Backup and recovery: smaller units, each partition can live in its own tablespace.
- The table still behaves as one table for SQL; Oracle routes each inserted row by the partition definition. You can also name a partition explicitly: `select ... from orders partition (p_2024_01)`.

## Choosing the method

| Data shape | Method |
|---|---|
| Ordered key, especially dates; data ages out | Range |
| Range, but you do not want to pre-create every period (11g) | Interval |
| Discrete values (region, category, status) | List, with a `DEFAULT` partition |
| No natural ranges; spread I/O evenly | Hash, partition count a power of 2 |
| Child table without the parent's key column (11g) | Reference, via the FK |
| Very large range/list partitions needing more division | Composite (subpartitions) |

## Range and interval

```sql
create table orders (
  order_id    number(12) primary key,
  customer_id number(12) not null,
  order_date  date       not null
)
partition by range (order_date)
interval (numtoyminterval(1, 'MONTH'))
(partition p_initial values less than (date '2024-01-01'));
```

- Each range partition states only its upper bound (`values less than`); the lower bound is the previous partition's. Use `MAXVALUE` in the last partition to catch everything else.
- Interval partitions are created automatically on first insert, with system-generated names. Code must not depend on partition names, and a bad value (year 2098 instead of 2008) silently creates a partition. Validate dates (CHECK constraint or application) before insert.

## Hash and list

```sql
partition by hash (customer_id) partitions 8 store in (data_ts1, data_ts2);

partition by list (region)
 (partition p_east  values ('NY', 'NJ'),
  partition p_west  values ('CA', 'OR'),
  partition p_other values (default));
```

- Hash with `partitions n store in (...)` yields `SYS_Pnnn` names and assigns tablespaces round-robin; name partitions explicitly when you need control.
- Without a `DEFAULT` list partition, inserts with unlisted values fail.

## Composite and reference

- `partition by range (...) subpartition by hash (...) subpartitions n (...)` divides each range partition further.
- Reference partitioning equips a child with the parent's scheme through a NOT NULL foreign key, so headers and lines age out together:

```sql
create table order_lines (
  order_id number(12) not null,
  line_no  number(4)  not null,
  amount   number(12,2),
  constraint order_lines_orders_fk foreign key (order_id) references orders
)
partition by reference (order_lines_orders_fk);
```

## Indexing partitioned tables

- `local`: one index partition per table partition, maintained with it. Easiest to manage; the default choice.
- `global`: one index (non-partitioned or partitioned on its own ranges) across all partitions. Can check uniqueness faster on non-key columns, but partition maintenance affects the whole index.
- You cannot create a global index on hash partitions or subpartitions (per the book).

```sql
create index orders_customer_lix on orders (customer_id) local;
create index orders_id_gix on orders (order_id) global;
```

## Maintenance

`alter table` can add, drop, exchange, move, modify, rename, split and truncate partitions. Re-split or add partitions when value distribution or the maximum value changes.

Bulk-load pattern with minimal user impact:

1. Create a staging table shaped like one partition.
2. Load it, then build its indexes and gather statistics.
3. Add (or locate) the empty target partition.
4. `alter table orders exchange partition p_2024_06 with table orders_stage;`

The exchange is a dictionary swap, so users never see the load in progress.

Version note: since 12.2 a non-partitioned table can be converted online with `alter table ... modify partition by ... online`.

## Workflow

1. Confirm the table is large enough and that queries or purges filter on a candidate key; check with execution plans.
2. Choose method and key from the table above; decide naming and tablespaces per partition.
3. Create local indexes by default; add global ones only for a measured need.
4. For data aging, plan add/drop/exchange steps; get explicit approval before dropping or truncating partitions, and keep a backup or an exchanged-out copy as the back-out.
5. Verify with `USER_PART_TABLES`, `USER_TAB_PARTITIONS`, `USER_PART_INDEXES`, `USER_IND_PARTITIONS` (status USABLE) and plans showing partition pruning.

## Red flags

- Partitioning small tables, or on a key no query filters by.
- Interval partitioning with no validation of the key value.
- Application code that hard-codes system-generated partition names.
- List partitions with no `DEFAULT` while new values keep appearing.
- Hash partition counts that are not powers of 2.
- Global indexes everywhere, then surprised by maintenance cost.
- Loading straight into a live, fully indexed partitioned table instead of exchange.
- Dropping or truncating a partition without confirming environment, range and retention.

## Related

- `../SchemaObjects/schemaObjects.md` — base table, constraint and index syntax.
- `../../BeyondTheBasics/Tablespaces/tablespaces.md` — placing partitions in tablespaces.
- `../../BeyondTheBasics/SqlLoader/sqlLoader.md` — loading the staging table.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — confirming pruning in execution plans.
