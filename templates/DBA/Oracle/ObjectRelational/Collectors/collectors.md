---
name: dba-collectors
description: Storing repeating values in a row with varying arrays (VARRAY) and nested tables, querying and changing them with TABLE(), using collection functions such as CARDINALITY and MULTISET, and deciding between a varray, a nested table and a separate relational table, based on Chapter 39 (Collectors (Nested Tables and Varying Arrays)) of Oracle Database 11g: The Complete Reference. Use when the user writes CREATE TYPE ... AS VARRAY or AS TABLE OF, NESTED TABLE ... STORE AS, queries TABLE(t.col), gets ORA-22909 (exceeded maximum VARRAY limit), needs to insert/update/delete elements of a nested table, or asks whether to model a one-to-many relationship as a collection column.
---

# Collectors (Nested Tables and Varying Arrays)

Collectors keep a row's repeating values in one column: a varray has a fixed maximum size and is stored with the row; a nested table is unbounded and stored out of line in its own segment. Use them only when the child data truly belongs to the parent; otherwise a separate relational table is more flexible.

## Varying arrays

```sql
create or replace type phone_list_va as varray(5) of varchar2(20);
/
create table contacts
 (contact_id number primary key,
  phones     phone_list_va);

insert into contacts values (:id, phone_list_va(:p1, :p2));
```

- Prefer a single-column varray based on a built-in type; it avoids nested constructor calls. A varray of an object type needs `phone_list_va(phone_ty(...), ...)`.
- Exceeding the declared limit raises ORA-22909. `alter type ... modify limit` raises the maximum.
- Varrays cannot be indexed, and every consumer must share the same limit; reuse across tables pushes the limit up to the largest need.

## Nested tables

```sql
create type line_ty as object (product_id number, qty number);
/
create type lines_nt as table of line_ty;
/
create table orders
 (order_id number primary key,
  lines    lines_nt)
nested table lines store as orders_lines_nt (tablespace app_data);
```

- `store as` names the storage table; it is required. Specify its tablespace in the same clause.
- `alter table orders move` does not move the nested table; move the storage table separately (`alter table orders_lines_nt move tablespace ...`).
- Insert with nested constructors: `lines_nt(line_ty(:p1, :q1), line_ty(:p2, :q2))`.

## Querying with TABLE()

A collection type is not a table; flatten it with `TABLE()`:

```sql
select o.order_id, l.product_id, l.qty
  from orders o, table(o.lines) l
 where l.product_id = :product_id;
```

- For a varray of a scalar type, the element column is `COLUMN_VALUE`.
- Uninitialized trailing varray slots explicitly set to NULL show up as NULL rows.

## Changing elements in place

Target one parent row's collection with a subquery inside `TABLE()`:

```sql
insert into table(select lines from orders where order_id = :id)
values (line_ty(:product_id, :qty));

update table(select lines from orders where order_id = :id) l
   set l.qty = :qty
 where l.product_id = :product_id;

delete table(select lines from orders where order_id = :id) l
 where l.product_id = :product_id;
```

- The subquery must return exactly one parent row; confirm the key before running.

## In PL/SQL

- Loop with `for i in 1 .. v.count`; `count` is the current number of elements and `limit` is the varray maximum.
- Convert numbers with `to_char` when concatenating for `dbms_output.put_line`.

## Collection functions

- `CARDINALITY(col)`: number of elements.
- `MULTISET EXCEPT`, `MULTISET INTERSECT`, `MULTISET UNION [ALL | DISTINCT]`: set operations between nested tables (UNION defaults to ALL).
- `SET(col)`: the nested table without duplicates.
- Also available: `COLLECT`, `POWERMULTISET`, `POWERMULTISET_BY_CARDINALITY`.

## Choosing a structure

| Need | Choose |
|---|---|
| Few values, fixed small maximum, always read with the parent | Varray |
| Unbounded child rows, methods on the type, accessed through the parent | Nested table |
| Child data related to many other tables or queried independently | Separate relational table |

- Nested-table data is out of line, so queries that ignore the collection read less data; varray data is read with the row.
- Varrays degrade as they grow because they cannot be indexed; nested tables and relational tables can.
- Do not share one catch-all nested table type across tables whose columns mean different things; create a type per use.
- Naming: singular `_TY` for the element, plural `_VA` or `_NT` for the collection, `_NT_TAB` or similar for the storage table.

## Workflow

1. Confirm the child data belongs exclusively to the parent; if not, use a relational table.
2. Pick varray (bounded, small) or nested table (unbounded, indexable).
3. Create the element type, then the collection type, then the table with `store as` and tablespace for nested tables.
4. Load with constructors; query and modify with `TABLE()`.
5. Verify with `USER_TYPES` (typecode COLLECTION), `USER_COLL_TYPES` (kind, element type, upper bound), `USER_TAB_COLUMNS` and `USER_NESTED_TABLES`.

## Red flags

- Varrays used for growing lists that must be searched.
- One shared collection type with columns that are valid only in some tables.
- `TABLE(select ...)` DML whose subquery can match zero or several parent rows.
- Moving the parent table and assuming the nested table moved too.
- Selecting from the collection type name as if it were a table.

## Related

- `../ObjectTypes/objectTypes.md` — the object types collectors are built from.
- `../LargeObjects/largeObjects.md` — another out-of-line storage model.
- `../AdvancedObjectConcepts/advancedObjectConcepts.md` — row objects and REFs as an alternative to embedding.
- `../../PlSql/PlSqlTuning/plSqlTuning.md` — collections as BULK COLLECT and FORALL targets.
