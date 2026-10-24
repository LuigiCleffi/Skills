---
name: dba-basic-sql
description: "Writing basic Oracle queries in SQL*Plus: connecting, describe, select/from/where/order by, comparison, LIKE, NULL and list operators, AND/OR precedence, simple subqueries, joins and views, based on Chapter 5 (The Basic Parts of Speech in SQL) of Oracle Database 11g: The Complete Reference. Use when the user writes or debugs a simple query, a filter returns too many or too few rows, a LIKE or case-sensitive match fails, NULL comparisons misbehave, numbers stored as text sort wrongly, or errors such as ORA-01017, ORA-01427, ORA-00904 or an ambiguous column appear."
---

# The Basic Parts of Speech in SQL

SQL tells Oracle what to `select`, `insert`, `update`, `delete` (and `merge`); SQL*Plus is the client that sends it and formats the reply. Write queries as clear sentences: name the columns, the tables, the conditions and the order, and make precedence and data types explicit.

## SQL*Plus essentials

- `sqlplus user@service`, then enter the password at the prompt; `exit` or `quit` to leave.
- `ORA-01017: invalid username/password`: wrong credentials or the account does not exist yet. After three failures SQL*Plus exits.
- `describe orders` lists columns, `NOT NULL` rules and types. It is a SQL*Plus command and does not work in other tools.
- `set feedback off` / `set feedback 25` controls the "n rows selected" message; `show feedback` displays a setting.
- `set numwidth n` sets default number display width; a value too wide for it prints as `#` signs. `set pagesize` avoids page breaks in output.
- Keywords and identifiers are case-insensitive; **string literals are not**: `'f'` does not match `'F'`.

## Query skeleton

```sql
variable p_status varchar2(10)
exec :p_status := 'SHIPPED'

select order_id, customer_id, order_date
  from orders
 where status = :p_status
 order by order_date desc, order_id;
```

- `select` names columns (`*` means all, in creation order; prefer explicit lists in code).
- `from` names tables; `where` filters each row; `order by` sorts, `desc` reverses one key. Without `order by`, row order is not guaranteed.
- Quote string literals with single quotes; do not quote numbers compared with `NUMBER` columns.

## Operators in where

| Test | Operators |
|---|---|
| Single value | `=`, `>`, `>=`, `<`, `<=`, not equal as `!=`, `^=` or `<>` |
| Pattern | `LIKE 'Mo%'` (`%` any run of characters, including none), `LIKE '__i%'` (`_` exactly one character) |
| Missing data | `IS NULL`, `IS NOT NULL` |
| List | `IN (...)`, `NOT IN (...)` |
| Range | `BETWEEN low AND high` (inclusive of both ends), `NOT BETWEEN` |

- Never compare with `= NULL` or `!= NULL`; it does not return meaningful results. Use `IS [NOT] NULL`. NULL means unknown, not zero.
- Numbers stored in `CHAR`/`VARCHAR2` compare as text: `'9' > '12'`. Store numbers as `NUMBER`, or convert explicitly before comparing.
- `LIKE` is case-sensitive on data; match the stored case.

## AND / OR precedence

`AND` binds tighter than `OR`. Always parenthesize mixed conditions:

```sql
-- wrong: reads as status = 'NEW' or (status = 'OPEN' and total > 100)
where status = 'NEW' or status = 'OPEN' and total > 100
-- right
where total > 100 and (status = 'NEW' or status = 'OPEN')
```

## Subqueries in where

- A subquery in parentheses supplies values to the outer condition.
- Single-value operators (`=`, `<`...) need a subquery returning one row, otherwise `ORA-01427: single-row subquery returns more than one row`. Use `IN` when several rows are possible.
- The subquery selects one column, or a column list matched against a parenthesized column list in the outer query.

```sql
select customer_id, name
  from customers
 where customer_id in (select customer_id from orders where status = :p_status);
```

## Joins

List both tables and state the relationship in `where`; qualify columns that exist in both tables, or Oracle reports the column as ambiguous. Only rows matching in both tables are returned.

```sql
select o.order_id, c.name, o.total
  from orders o, customers c
 where o.customer_id = c.customer_id
   and c.country = :p_country;
```

## Views

- `create or replace view` stores a named query; it holds no data and always reflects current table contents. `or replace` keeps existing grants instead of dropping and recreating.
- A view exposes only its selected columns: filtering on a base-table column not in the view raises `ORA-00904: invalid identifier`. Add the column or the filter to the view definition.
- Use views to hide join logic and to restrict rows, for example to the current user via the `USER` pseudo-column:

```sql
create or replace view my_orders as
select * from orders where sales_rep = user;
```

## Workflow
1. `describe` each table to confirm column names, types and nullability.
2. Write `select` / `from` first, then add `where` conditions one at a time, checking row counts.
3. Use bind variables for values; quote only string literals and match their case.
4. Parenthesize every mix of `AND` and `OR`; use `IS NULL` for missing values.
5. Use `IN` for subqueries that may return several rows; qualify columns in joins.
6. Add `order by` whenever order matters; wrap reusable logic in a view.

## Red flags
- `= NULL`, `!= NULL`, or treating NULL as zero.
- Unparenthesized `OR` next to `AND`.
- `=` against a subquery that can return many rows.
- Range comparisons on numbers stored as text.
- Relying on row order without `order by`.
- Unqualified column names in multi-table queries.
- `select *` in application code or view definitions that should expose specific columns.

## Related
- `../SqlPlusReports/sqlPlusReports.md` — formatting SQL*Plus output.
- `../Subqueries/subqueries.md` — correlated, multi-column and EXISTS subqueries.
- `../ComplexQueries/complexQueries.md` — outer joins and complex views.
- `../SchemaObjects/schemaObjects.md` — creating tables, views and constraints.
- `../RegularExpressions/regularExpressions.md` — pattern matching beyond LIKE.
- `../../CriticalConcepts/PlanningApplications/planningApplications.md` — naming and normalization that make queries readable.
