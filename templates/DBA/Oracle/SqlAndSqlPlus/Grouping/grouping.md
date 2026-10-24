---
name: dba-grouping
description: "Writing correct and efficient aggregate queries with GROUP BY, HAVING and ORDER BY, building views and inline views over groups, and finding duplicate keys, based on Chapter 12 (Grouping Things Together) of Oracle Database 11g: The Complete Reference. Use when a query fails with ORA-00937 (not a single-group group function) or ORA-00904 on an alias used in HAVING, the user asks for counts, averages or percentages per category, a unique index cannot be created because of duplicates, or a HAVING clause filters on a grouping column instead of an aggregate."
---

# Grouping Things Together

`group by` collects like rows so group functions can summarize each set; `having` filters those groups the way `where` filters rows. Eliminate rows as early as possible, and use views or inline views when one level of grouping must be compared with another.

## Rules for group queries

- Every non-aggregated column in the select list must appear in `group by`; otherwise ORA-00937.
- `having` may use any group function, even one that is not in the select list.
- Column aliases can be used in `order by` but not in `having` (ORA-00904). Repeat the expression instead.
- Without `group by`, the whole table (after `where`) is a single group.
- `group by` exists to collect rows, not to sort them. Add `order by` whenever order matters.
- A column in `order by` that is not inside a group function must be in `group by`.

```sql
select status, COUNT(*) as order_count, AVG(total_amount) as avg_total
  from orders
 where order_date >= DATE '2025-01-01'
 group by status
having COUNT(*) > 10
 order by order_count desc;
```

## Order of execution

1. `where` removes rows.
2. `group by` forms groups from the remaining rows.
3. Group functions are computed per group.
4. `having` removes groups.
5. `order by` sorts the result (using group functions or grouping columns).

Performance follows from this order: every row removed in step 1 is a row that never has to be grouped or aggregated. If a `having` condition tests only grouping columns (not an aggregate), move it to `where`.

```sql
-- slower: groups every region, then discards most groups
having region like 'EU%'
-- faster: discards rows before grouping
where region like 'EU%'
```

Tune small grouped queries too: a cheap query executed millions of times a day can become the most expensive statement in the database.

## Views and inline views of groups

- A view over a group query behaves like a summary table and reflects new rows as soon as they are committed.
- Give every expression column an alias in the view (`COUNT(*) as order_count`); views require named columns.
- Leave aliases unquoted so they are stored in uppercase. A double-quoted mixed-case alias forces every future query to quote the name exactly.
- To compare one grouping with another (category count versus grand total), at least one side must be a view or inline view.

```sql
select c.status, c.order_count,
       ROUND(c.order_count / t.total_count * 100, 2) as pct
  from (select status, COUNT(*) as order_count from orders group by status) c,
       (select COUNT(*) as total_count from orders) t
 order by c.status;
```

- Joining a one-row view without a join condition is intentional and safe; joining two multi-row sources without one produces a Cartesian product.
- Doing the same in one grouped query forces you to wrap the single value in a group function (for example `MAX(total_count)`); the view or inline view form is clearer and easier to maintain.
- Avoid `order by` inside views unless every consumer needs that order; it adds a sort to every query against the view.

## Finding duplicates

Before creating a unique index or primary key, find the violating values:

```sql
select customer_id, email, COUNT(*)
  from customer_contacts
 group by customer_id, email
having COUNT(*) > 1;
```

Join that result back to the table (as an inline view) to list the full duplicate rows for cleanup.

## Workflow

1. State the grain of the result: one row per what?
2. Put exactly those columns in `group by`; aggregate everything else.
3. Push every row-level filter into `where`; keep only aggregate conditions in `having`.
4. Add `order by` explicitly; never rely on grouping order.
5. For percentages or comparisons across grouping levels, build a view or inline view per level, then join.
6. Check the row count of the result against expectations; an unexpectedly large count signals a missing join condition.

## Red flags

- ORA-00937 "fixed" by adding columns to `group by` until it runs, silently changing the grain.
- `having` conditions that do not involve an aggregate.
- Output that "is sorted" only because of how grouping happened to work.
- Quoted aliases in `create view`.
- Two multi-row sources in `from` with no join predicate.
- AVG or SUM over a VARCHAR2 column that relies on implicit conversion.

## Related

- `../ComplexQueries/complexQueries.md` — ROLLUP, CUBE, GROUPING and ranking over summary views.
- `../Subqueries/subqueries.md` — subqueries in HAVING and EXISTS-based alternatives.
- `../BasicSql/basicSql.md` — group functions, views and joins basics.
- `../SqlPlusReports/sqlPlusReports.md` — break and compute when totals are only a presentation concern.
- `../ConversionFunctions/conversionFunctions.md` — implicit conversion inside aggregates.
- `../SchemaObjects/schemaObjects.md` — creating the unique index once duplicates are resolved.
