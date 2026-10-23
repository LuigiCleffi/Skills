---
name: dba-complex-queries
description: Building layered summary views, hypothetical rankings (RANK and PERCENT_RANK WITHIN GROUP), global temporary tables, subtotals with ROLLUP, CUBE and GROUPING, and tree reports with START WITH / CONNECT BY PRIOR and LEVEL, based on Chapter 14 (Some Complex Possibilities) of Oracle Database 11g: The Complete Reference. Use when the user needs subtotals and grand totals in a single SQL statement, a crosstab of all total combinations, an org chart, bill of materials or parent-child hierarchy report, "where would this value rank", or a session- or transaction-scoped scratch table.
---

# Some Complex Possibilities

When a report needs several levels of summary, totals, rankings or a hierarchy, push that work into SQL instead of the reporting tool: stack views for each level, let ROLLUP and CUBE produce totals, and let CONNECT BY walk trees. The result is the same in every client that runs the query.

## Layered summary views

- Build one view per summarization level (detail, per category, overall) and join them. Three or four levels cover almost every calculation: percentage of total, percentage of subtotal, weighted averages.
- Inline views in `from` work the same way when the level is used only once.
- Hypothetical ranking asks where a value would land in an existing set without inserting it:

```sql
select RANK(250) within group (order by order_count desc)         as would_rank,
       PERCENT_RANK(250) within group (order by order_count desc) as pct_rank
  from customer_order_counts;   -- a summary view
```

## Global temporary tables

Use one for private intermediate results (specialized rollups, multi-step processing). Each session sees only its own rows.

```sql
create global temporary table order_rollup (
  order_year  NUMBER(4),
  order_month VARCHAR2(9),
  order_count NUMBER
) on commit preserve rows;   -- or: on commit delete rows
```

- `on commit preserve rows` keeps rows for the session; `on commit delete rows` clears them at each commit.
- Verify with `USER_TABLES.DURATION`: `SYS$SESSION` or `SYS$TRANSACTION`.
- No space is allocated at creation; it is allocated as rows are inserted.
- Populate with `insert ... select`, then join it like any table.

## ROLLUP, CUBE and GROUPING

- `group by ROLLUP(a, b)` returns the normal (a, b) groups plus a subtotal per `a` and a grand total.
- `group by CUBE(a, b)` returns subtotals for every combination: per `a`, per `b`, and the grand total.
- Subtotal rows show NULL in the rolled-up column. `GROUPING(col)` returns 1 on a generated subtotal row and 0 otherwise, which distinguishes a total from a real NULL value.

```sql
select DECODE(GROUPING(region), 1, 'All regions', region)  as region,
       DECODE(GROUPING(status), 1, 'All statuses', status) as status,
       SUM(total_amount)                                   as amount
  from orders
 group by ROLLUP(region, status)
 order by region, status;
```

- Grouping by an expression (for example `TO_CHAR(order_date, 'YYYY-MM')`) works; repeat the same expression inside `GROUPING`.
- Prefer these to SQL*Plus `break`/`compute` when the totals must be available to any tool, not just one report.

## Hierarchies with CONNECT BY

Tables that store a parent key per row (employee/manager, part/assembly) can be walked as a tree.

```sql
select LPAD(' ', 2 * (LEVEL - 1)) || employee_name as org_chart,
       LEVEL as depth
  from employees
 start with manager_id is null
connect by manager_id = prior employee_id;
```

- `start with` picks the root row(s); only that branch is reported.
- `prior` marks the column from the row already visited. `child_col = prior parent_col` walks down toward the leaves; `parent_col = prior child_col` (prior on the other side) walks up toward the root.
- `LEVEL` is a pseudo-column: 1 for the root, 2 for its children, and so on. Indent by concatenating `LPAD(' ', n*(LEVEL-1))` in front of the name; applying `LPAD` directly to the name right-justifies it and makes the root disappear.
- When walking up, reverse the indentation (for example `n*(max_depth - LEVEL)`) and order by a meaningful column so the output reads top-down.
- Clause order: `select`, `from`, `where`, `start with`, `connect by`, `order by`.

### Excluding rows versus branches

- A condition in `where` removes only the matching rows; their descendants still appear.
- A condition added to `connect by` (`... and employee_id != :excluded_id`) prunes the row and its entire subtree (or its ancestors, when walking up).
- An `order by` on a hierarchical query destroys the tree order; use it only when a flat sorted list is wanted.
- Several roots (for example two independent founders) produce separate trees; a single tree needs a common root row.

## Workflow

1. Identify the report levels (detail, subtotal, total) or the tree's parent and child columns.
2. For totals, start with a plain `group by`, verify it, then switch to `ROLLUP` or `CUBE` and label totals with `GROUPING`.
3. For multi-level calculations, create one view per level and join; keep each view simple and testable.
4. For trees, choose the root with `start with`, set the direction with `prior`, and decide whether exclusions prune rows (`where`) or branches (`connect by`).
5. Validate totals against an independent `SUM` and tree sizes against a plain `COUNT`.

## Red flags

- Totals computed in application code or by unioning separate total queries when ROLLUP would do.
- Subtotal rows detected with `is null` instead of `GROUPING`, which mislabels real NULL data.
- A `where` clause used when the requirement is to drop a whole branch, or vice versa.
- `LPAD` applied directly to the name column in a tree report (misaligned names, missing root).
- Permanent "scratch" tables shared by sessions where a global temporary table would isolate the data.

## Related

- `../Grouping/grouping.md` — the group by, having and view-of-groups foundation.
- `../Subqueries/subqueries.md` — inline views and joins used to combine levels.
- `../DecodeAndCase/decodeAndCase.md` — DECODE and CASE for labeling GROUPING output and pivoting.
- `../SqlPlusReports/sqlPlusReports.md` — break and compute as the tool-side alternative.
- `../TextFunctions/textFunctions.md` — LPAD used for tree indentation.
- `../SchemaObjects/schemaObjects.md` — creating and managing tables and views.
