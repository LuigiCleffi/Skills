---
name: dba-subqueries
description: "Combining queries in Oracle with nested and correlated subqueries, EXISTS and NOT EXISTS, ANSI inner, outer, natural and full joins, and the set operators UNION, UNION ALL, INTERSECT and MINUS, based on Chapter 13 (When One Query Depends upon Another) of Oracle Database 11g: The Complete Reference. Use when the user asks for rows with or without matches in another table (\"customers with no orders\"), converts old (+) outer-join syntax, sees ORA-01789 (query block has incorrect number of result columns), gets missing or duplicated rows from a join or UNION, or must choose between IN, EXISTS, joins and set operators."
---

# When One Query Depends upon Another

Most "find rows related to other rows" questions can be written as a join, a subquery, an EXISTS test or a set operation. Pick the form that states the intent clearly and returns exactly the rows asked for, then check how it handles unmatched rows and duplicates.

## Joins across several tables

- Join N tables with N-1 join conditions; each table links to one already in the query.
- Use `distinct` only when the question really asks for distinct combinations, not to hide a bad join.
- Prefer ANSI syntax: `inner join ... on`, `left|right|full outer join ... on`, or `using (col)`.

```sql
select c.customer_name, COUNT(o.order_id) as order_count
  from customers c
  left outer join orders o
    on o.customer_id = c.customer_id
 group by c.customer_name;
```

- `A right outer join B` equals `B left outer join A`: all rows of B are kept. The side you keep matters; the wrong side silently drops unmatched rows.
- `full outer join` keeps unmatched rows from both sides.
- `using (col)` columns must not be qualified with an alias anywhere in the statement.
- `natural join` joins on every same-named column. It breaks silently when someone adds a column with a shared name; prefer explicit `on`.
- Legacy syntax puts `(+)` after the column of the table that may be missing: `where o.customer_id (+) = c.customer_id`. Recognize it in old code and third-party tools; write new code in ANSI form.

## Subqueries

- A subquery in `where` can itself contain subqueries; read nested ones from the innermost outward.
- A correlated subquery references a column of the outer query and is evaluated per outer row. Alias both sides so the correlation is explicit.
- An unqualified column in a subquery resolves to the outer table if the inner table lacks it. Always qualify columns to avoid accidental correlation.
- A table referenced at several levels is accessed separately each time.

## EXISTS and NOT EXISTS

`EXISTS` tests whether the subquery returns any row; the select list is irrelevant (`select 'x'` or `select 1`).

```sql
-- customers who have never ordered
select c.customer_id, c.customer_name
  from customers c
 where not exists (select 1
                     from orders o
                    where o.customer_id = c.customer_id);
```

- `NOT EXISTS` is efficient for anti-joins, especially with indexed, multi-column join keys.
- Equivalent forms: `not in (subquery)`, an outer join with `where inner.key is null`, or `MINUS`. The optimizer may transform one into another.
- `EXISTS` also solves "show detail rows for groups that satisfy an aggregate condition" when grouping by the full key would make every count equal 1; an `IN` subquery with `group by ... having` works too.

## Set operators

| Operator | Result |
|---|---|
| `UNION` | rows from either query, duplicates removed |
| `UNION ALL` | rows from either query, duplicates kept (no sort) |
| `INTERSECT` | rows returned by both queries |
| `MINUS` | rows from the first query not returned by the second |

- Each query must return the same number of columns with matching datatypes (lengths may differ). Pad with literals or NULLs to match.
- Column names and `order by` come from the first query only; `order by` goes once at the end.
- With three or more queries, especially mixing INTERSECT and MINUS, use parentheses to fix precedence.
- In `where col in (q1 union q2)`, put the whole union inside the parentheses; otherwise `in` binds to the first query only.
- Use `UNION ALL` when duplicates are impossible or wanted; plain `UNION` pays for a sort.

## Workflow

1. Restate the question as "rows of X that have / do not have / are in both ..." to pick join, EXISTS, NOT EXISTS or a set operator.
2. Decide which table must keep its unmatched rows and choose the outer join side accordingly.
3. Qualify every column with an alias, especially inside subqueries.
4. Check NULL behavior: unmatched rows from an outer join come back with NULLs in the optional table's columns.
5. Compare row counts with a simple count of the driving table to catch dropped or multiplied rows.
6. Review the execution plan for anti-join and semi-join choices on large tables.

## Red flags

- `distinct` added to make a join "look right".
- An outer join written with the wrong driving side, so unmatched rows vanish.
- `natural join` in production code.
- Unqualified columns in correlated subqueries.
- `UNION` used where `UNION ALL` would be correct and cheaper.
- New code written with `(+)`.

## Related

- `../Grouping/grouping.md` — group by and having used inside subqueries.
- `../ComplexQueries/complexQueries.md` — views on views, rollups and hierarchies built from these joins.
- `../ChangingData/changingData.md` — subqueries in insert, update and delete.
- `../BasicSql/basicSql.md` — basic joins and where clauses.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — how the optimizer executes joins and subqueries.
