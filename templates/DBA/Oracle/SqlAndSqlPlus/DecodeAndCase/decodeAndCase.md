---
name: dba-decode-and-case
description: "Expressing if-then-else logic inside Oracle SQL with DECODE, simple and searched CASE, COALESCE, NVL and NULLIF, and building crosstab reports with MAX(DECODE(...)), PIVOT and UNPIVOT, based on Chapter 16 (DECODE and CASE: if, then, and else in SQL) of Oracle Database 11g: The Complete Reference. Use when the user asks to map codes to labels, apply tiered rates or thresholds in a query, turn rows into columns (crosstab, pivot table) or columns into rows, replace NULLs with fallbacks, or maintain deeply nested DECODE expressions that should become CASE."
---

# DECODE and CASE: if, then, and else in SQL

Conditional logic belongs in SQL when it shapes the result set: labels, tiers, thresholds, pivots. Use CASE for anything beyond a simple value lookup, PIVOT for crosstabs, and keep volatile mappings in tables rather than hard-coded in queries.

## DECODE

`DECODE(expr, search1, result1, search2, result2, ..., default)` compares `expr` with each search value in order and returns the matching result, or the default (NULL if omitted).

- `expr`, searches, results and default may be columns, literals or expressions (date differences, `SUBSTR`, arithmetic).
- Up to 255 arguments in total.
- DECODE treats a NULL search value as matching a NULL `expr`: `DECODE(col1, NULL, col2, col1)` returns `col2` when `col1` is NULL.
- DECODE only tests equality. For ranges, compare via `SIGN(expr - limit)`, which returns -1, 0 or 1; or, better, use searched CASE.

```sql
select order_id,
       DECODE(status, 'N', 'New', 'S', 'Shipped', 'C', 'Cancelled', status) as status_label
  from orders;
```

Hard-coding a lookup like this avoids a join and is acceptable only for small, static code lists; for data that changes, join to a lookup table. Always supply a default (often the original value) so unknown codes are visible.

## CASE

Simple CASE mirrors DECODE; searched CASE accepts any condition, including `<`, `>`, `between` and `is null`.

```sql
select order_id,
       CASE
         when total_amount >= 10000 then total_amount * 0.90
         when total_amount >= 1000  then total_amount * 0.95
         else total_amount
       end as discounted_amount
  from orders;
```

- The first true `when` wins; order conditions from most to least specific.
- CASE can be nested and wrapped in parentheses to compare its result, for example `CASE when (CASE ... end) < :min_fee then 0 else ... end`.
- CASE is wordier than DECODE but far easier to read and maintain, especially when logic is nested or uses ranges. Prefer it for new code.
- Repeating the same CASE in select and where is common; consider an inline view that computes it once and filters in the outer query.

## NULL fallbacks

- `NVL(a, b)`: two arguments only.
- `COALESCE(a, b, c, ...)`: first non-NULL value in the list.
- `NULLIF(a, b)`: NULL when `a = b`, otherwise `a`.
- The names do not explain intent; add a short comment when the logic is not obvious.

## Crosstabs (rows to columns)

The classic form aggregates a DECODE or CASE per output column:

```sql
select region,
       SUM(CASE when status = 'NEW'     then 1 else 0 end) as new_orders,
       SUM(CASE when status = 'SHIPPED' then 1 else 0 end) as shipped_orders
  from orders
 group by region;
```

Since 11g, `PIVOT` states the same thing directly:

```sql
select *
  from (select region, status, order_id from orders)
 pivot (COUNT(order_id) for status in ('NEW' as new_orders, 'SHIPPED' as shipped_orders));
```

- The source must be an inline view containing only the grouping column(s), the pivot column and the measured column; any other column becomes an extra grouping key.
- Adding a value to the `in` list adds a column; with the DECODE form each new column must be written by hand.
- `UNPIVOT` turns columns back into rows (`unpivot (value for value_type in (col1, col2, col3))`). It cannot recreate detail rows that a PIVOT aggregated.

## Workflow

1. Decide where the logic belongs: a lookup table (changing data), DECODE or simple CASE (small static mapping), searched CASE (ranges, NULL tests, multiple columns).
2. Write each rule as a separate `when`, ordered by precedence, with an explicit `else`.
3. For a crosstab, first write and verify the plain `group by` over rows, then pivot it with PIVOT (11g and later) or aggregated CASE.
4. Test edge values: boundary amounts, NULLs, unknown codes.
5. Check that totals across pivoted columns match the unpivoted aggregate.

## Red flags

- Nested `DECODE(SIGN(...))` chains for range logic that a searched CASE would express directly.
- The same long expression duplicated three times in one statement.
- DECODE or CASE with no default, silently returning NULL for new codes.
- Business mappings that change over time hard-coded into many queries.
- PIVOT over a source with extra columns, producing unexpected extra rows.
- Expecting UNPIVOT to reverse an aggregating PIVOT.

## Related

- `../ConversionFunctions/conversionFunctions.md` — DECODE introduced alongside TRANSLATE and datatype rules.
- `../Grouping/grouping.md` — the group by layer underneath every crosstab.
- `../ComplexQueries/complexQueries.md` — DECODE with GROUPING to label ROLLUP and CUBE totals.
- `../NumberFunctions/numberFunctions.md` — SIGN, NVL and other numeric helpers.
- `../ChangingData/changingData.md` — conditional routing with multitable INSERT FIRST.
- `../../PlSql/IntroductionToPlSql/introductionToPlSql.md` — procedural if-then-else when logic outgrows SQL.
