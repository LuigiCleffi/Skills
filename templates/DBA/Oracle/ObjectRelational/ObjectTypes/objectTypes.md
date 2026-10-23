---
name: dba-object-types
description: Creating and using Oracle object types, sharing them across schemas, indexing their attributes, layering object views over relational tables, writing INSTEAD OF triggers, and defining member, map and order methods, based on Chapter 38 (Implementing Object Types, Object Views, and Methods) of Oracle Database 11g: The Complete Reference. Use when the user writes CREATE TYPE ... AS OBJECT or CREATE TYPE BODY, queries attributes like t.col.attr, gets PLS-00201 or "Type created with compilation errors" referencing another schema's type, needs to index an object attribute, wants an object view over an existing table, hits ORA-01779 updating a join view, or needs methods to compare or sort objects.
---

# Implementing Object Types, Object Views, and Methods

Object types group related columns (an address, a person) into reusable datatypes with methods. Design the schema relationally first, then apply types where groups of columns recur; object views let you add types to tables that already exist without rebuilding them.

## Creating and nesting types

```sql
create type address_ty as object
 (street varchar2(50), city varchar2(25), state char(2), zip varchar2(10));
/
create type person_ty as object
 (name varchar2(25), address address_ty);
/
create table customers (customer_id number primary key, person person_ty);
```

- A column of `person_ty` holds all nested attributes. Insert with nested constructors: `person_ty(:name, address_ty(:street, :city, :state, :zip))`.
- Oracle creates a constructor method for every type automatically, so every type has executable code even with no methods declared.

## Types owned by another schema

- To build on another user's type you need `EXECUTE` on it; without it, `create type` reports compilation errors and `show errors` shows PLS-00201.
- `grant execute on address_ty to app_user;` covers the type and all its methods; never grant methods individually.
- Qualify the owner (`hr.address_ty(...)`) in DDL and in constructor calls, or create a private synonym. Synonyms are not validated at creation time; a bad target fails only when used.

## Querying and indexing attributes

```sql
select c.customer_id, c.person.name
  from customers c
 where c.person.address.city like :city_prefix;

create index customers_city_ix on customers (person.address.city);
```

- A table alias (correlation variable) is required to reference attributes in queries; `create index` uses the path without an alias.
- The optimizer treats each attribute as a separate column. Index the attributes used in filters, per table: an index on one table's `city` does nothing for another table that uses the same type. Shared logical types do not give shared physical design.
- In SQL*Plus, `set describe depth 2` (up to 50) shows nested attributes; `column person.name format a25` formats one.

## Object views over relational tables

Overlay types on an existing table instead of rebuilding it:

```sql
create or replace view customers_ov (customer_id, person) as
select customer_id,
       person_ty(name, address_ty(street, city, state, zip))
  from customers_rel;
```

- In the view query, call the constructors; the `where` clause refers to the base table's relational columns.
- The table stays usable relationally, and DML can also go through the view using constructors, so applications can standardize on one style.
- Order: table, then inner types, then outer types, then the view.

## INSTEAD OF triggers

When a view cannot be updated directly (ORA-01779 on a non key-preserved join), an `instead of` trigger defines how to change the base tables. It works on object views and plain views.

```sql
create or replace trigger order_summary_upd
instead of update on order_summary_v
for each row
begin
  if :old.status <> :new.status then
    update orders set status = :new.status where order_id = :old.order_id;
  end if;
end;
/
```

- Write one trigger per DML action you need to support; test that the trigger touches exactly the intended rows.

## Methods

Declare methods in the type spec, implement them in the type body:

```sql
create or replace type contract_ty as object
 (contract_id number, start_date date,
  member function age_days return number);
/
create or replace type body contract_ty as
  member function age_days return number is
  begin
    return trunc(sysdate - start_date);
  end;
end;
/
```

- Call through the column with an alias: `select c.contract.age_days() from contracts c;`
- Derive volatile values (age, totals) with methods instead of storing them.
- To add methods, `alter type` listing all methods (old and new), then re-create the body with all of them.
- A type used by a table cannot be dropped or re-created; plan type changes carefully.
- **Map method:** a function returning a scalar that gives the object's relative position; at most one per type.
- **Order method:** a function taking another instance and returning a negative, zero or positive INTEGER; at most one per type. Define one of these to compare or `order by` objects.

## Workflow

1. Normalize the design relationally; identify recurring column groups.
2. Create inner types first, then outer types; grant `EXECUTE` to consuming schemas.
3. For new tables, use the types as column datatypes; for existing tables, create object views.
4. Index each attribute used in filters, in each table that uses the type.
5. Add methods in the type spec and body; add map or order methods if objects are compared.
6. Add INSTEAD OF triggers for views that must accept DML.
7. Verify with `show errors`, `describe` at higher depth, `USER_TYPES` and `USER_TYPE_ATTRS`.

## Red flags

- Ignoring "Type created with compilation errors" (usually a missing grant or owner prefix).
- Assuming an index on a type attribute in one table covers every table using the type.
- Referencing attributes without a table alias.
- Planning to `create or replace` a type already used by tables in production; confirm impact and get approval first.
- INSTEAD OF triggers whose `where` clause can update more rows than the view row implies.
- Storing derived values a method could compute.

## Related

- `../Collectors/collectors.md` — varrays and nested tables built on object types.
- `../AdvancedObjectConcepts/advancedObjectConcepts.md` — object tables, REFs and object views with OIDs.
- `../../PlSql/Triggers/triggers.md` — trigger fundamentals behind INSTEAD OF triggers.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — views and indexes.
- `../../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — when data plus behavior earns its keep.
