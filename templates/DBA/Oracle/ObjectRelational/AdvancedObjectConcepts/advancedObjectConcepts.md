---
name: dba-advanced-object-concepts
description: "Working with row objects in Oracle: object tables and OIDs, REF columns, the REF, DEREF and VALUE functions, dangling references, object views WITH OBJECT IDENTIFIER and MAKE_REF over existing primary/foreign keys, and object PL/SQL variables, based on Chapter 41 (Advanced Object-Oriented Concepts) of Oracle Database 11g: The Complete Reference. Use when the user writes CREATE TABLE ... OF type, declares a column as REF type, uses REF(), DEREF(), VALUE() or MAKE_REF, sees hex OID strings in query output, asks why a reference broke after a row was deleted and re-inserted, or wants to expose relational tables as referenceable objects to PL/SQL or object-based code."
---

# Advanced Object-Oriented Concepts

Column objects (object types, varrays, nested tables, LOBs) live inside a row; row objects are whole rows of an object table, each with an object identifier (OID) that other rows can reference. References join by object identity, not by data, so they behave differently from foreign keys. Object views let you get these features on top of ordinary relational tables.

## Object tables

```sql
create type product_ty as object
 (product_id number, name varchar2(50), list_price number);
/
create table products of product_ty;

insert into products values (product_ty(:id, :name, :price));
select name from products where list_price > :min_price;
```

- Every row gets an OID when inserted; OIDs are never reused.
- If the type has no nested types, ordinary relational insert, update, delete and select syntax works; attributes read like columns.

## REF columns and the REF function

```sql
create table order_items
 (item_no number,
  product ref product_ty);

insert into order_items
select :item_no, ref(p) from products p where p.product_id = :product_id;
```

- `REF(alias)` returns the reference to a row object; it takes the table alias, and works only on row objects, not on column objects.
- A REF column of a type can point to rows in any object table of that type.
- Selecting the column shows only an opaque reference value.

## DEREF and VALUE

```sql
select deref(oi.product) from order_items oi where oi.item_no = :item_no;
select value(p)          from products p    where p.product_id = :id;
```

- `DEREF(ref_column)` follows the reference and returns the whole referenced object, performing the join implicitly; the object table is never named in the query.
- `VALUE(alias)` returns a row of an object table as an object instance, in the same form DEREF uses; useful for debugging and for PL/SQL.
- Know how each relationship is built (keys and joins, or REFs) before writing queries against it.

## Dangling references

- Deleting a referenced row leaves a dangling REF. Re-inserting a row with identical data creates a new OID; the old reference still points to the deleted one.
- In relational joins, matching data is enough; with REFs, same data does not mean same object. Account for this before deleting rows that are referenced, and ask the user before deleting or reloading object tables that other tables reference.

## Object views with OIDs and REFs

Expose existing relational tables as row objects using their primary keys (pkOIDs) and foreign keys (pkREFs):

```sql
create or replace type customer_ty as object
 (customer_id number, name varchar2(50), city varchar2(30));
/
create or replace view customers_ov of customer_ty
  with object identifier (customer_id) as
select customer_id, name, city from customers;

create or replace view orders_ov as
select make_ref(customers_ov, customer_id) customer_ref,
       order_id, order_date
  from orders;

select deref(o.customer_ref) from orders_ov o where o.order_id = :order_id;
```

- `with object identifier (key_cols)` builds OIDs from the primary key; the query columns must match the type's attributes.
- `MAKE_REF(object_view, fk_cols)` builds references from the foreign key; give the result a column alias.
- Base tables keep their constraints and normal DML; object-style access is an extra layer.

## Object PL/SQL

```sql
declare
  l_cust customer_ty;
begin
  select value(c) into l_cust from customers_ov c where c.customer_id = :id;
  dbms_output.put_line(l_cust.name);
  insert into customers_ov values (customer_ty(:new_id, :new_name, :new_city));
end;
/
```

- Declare variables of your object types, populate them with `VALUE()` or constructors, read attributes individually (a whole object cannot be passed to `put_line`), and call the type's methods.
- To compare object variables, the type needs a map or order method.

## Design guidance

- Keep designing and tuning relationally; add an object layer (types, object views, methods) on top where it brings abstraction and reuse.
- Start from well-defined core object types; every object feature depends on them.
- Row objects change how relationships are enforced and queried; without object views, they also require new SQL syntax in applications and tools.

## Workflow

1. Decide whether a relationship should be a foreign key, an embedded collection or a REF; default to relational.
2. For new object data, create the type and `create table ... of type`.
3. For existing tables, create a matching type, an object view `with object identifier`, and child views using `MAKE_REF`.
4. Populate REF columns with `insert ... select ref(alias)`.
5. Query with `DEREF` and `VALUE`; use object variables in PL/SQL.
6. Before deleting referenced rows, find the referencing rows and agree how to handle them.

## Red flags

- Expecting a re-inserted row to restore broken references.
- Using REFs where a foreign key with declared integrity would serve better.
- Passing a table name instead of an alias to `REF` or `VALUE`, or a table instead of the REF column to `DEREF`.
- Object view queries whose columns do not match the type attribute order.
- Comparing object instances whose type has no map or order method.

## Related

- `../ObjectTypes/objectTypes.md` — types, methods and basic object views.
- `../Collectors/collectors.md` — embedded collections as the alternative to references.
- `../../PlSql/IntroductionToPlSql/introductionToPlSql.md` — PL/SQL blocks using object variables.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — primary and foreign keys behind pkOIDs.
- `../../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects versus data structures.
