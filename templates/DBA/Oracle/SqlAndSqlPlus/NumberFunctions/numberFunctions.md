---
name: dba-number-functions
description: "Calculating with Oracle numbers correctly — single-value functions (ROUND, TRUNC, CEIL, FLOOR, MOD, ABS, SIGN, POWER, SQRT, EXP/LN/LOG), NULL handling (NVL, NVL2, COALESCE, NANVL), aggregates (SUM, AVG, COUNT, MIN, MAX, STDDEV, VARIANCE, DISTINCT), list functions (GREATEST, LEAST) and operator precedence, based on Chapter 9 (Playing the Numbers) of Oracle Database 11g: The Complete Reference. Use when the user computes totals, averages, rounding or differences in SQL, gets NULL from arithmetic, sees ORA-00937 or ORA-00978, needs the row holding a MAX/MIN, or writes where clauses mixing AND and OR."
---

# Playing the Numbers

Oracle number functions come in three classes: single-value (per row), group-value (across rows) and list (across columns of one row). Know how each class treats NULL, because that decides whether your result is right, misleading or empty.

## The three classes

- **Single-value**: one input per row, one output per row (`ROUND(price,2)`). NULL in, NULL out.
- **Group-value (aggregate)**: many rows in, one value out (`AVG(price)`). NULLs are ignored.
- **List**: several values within a row, picks one (`GREATEST(a,b,c)`). Any NULL makes the result NULL.

## NULL in arithmetic

- Any `+ - * /` involving NULL yields NULL. NULL means unknown or not applicable, never zero.
- Substitute only when a value is genuinely unknown and a defensible estimate exists:

```sql
select order_id, NVL(weight_kg, :default_weight) as est_weight
  from shipments;
```

- `NVL(v, sub)`: sub when v is NULL; both must be the same datatype. Works for numbers, text and dates.
- `NVL2(e, if_not_null, if_null)`: picks between two other expressions.
- `COALESCE(a, b, c, ...)`: first non-NULL in the list.
- `NANVL(x, sub)`: for BINARY_FLOAT/BINARY_DOUBLE NaN values.

## Single-value functions

| Function | Behaviour |
|---|---|
| `ROUND(v[,p])` | rounds half away from zero: 55.5 -> 56, -55.5 -> -56 |
| `TRUNC(v[,p])` | chops digits toward zero: -55.5 -> -55 |
| `CEIL(v)` | smallest integer >= v: -2.3 -> -2 |
| `FLOOR(v)` | largest integer <= v: -2.3 -> -3 |
| `MOD(v,d)` | remainder using FLOOR; `MOD(v,1) = 0` tests for an integer |
| `REMAINDER(v,d)` | like MOD but based on ROUND |
| `ABS(v)`, `SIGN(v)` | magnitude; sign as -1, 0, 1 |
| `POWER(v,e)`, `SQRT(v)` | SQRT of a negative raises an error |
| `EXP`, `LN`, `LOG(base,v)` | exponential and logarithms |
| `SIN`, `COS`, `TAN`, `ASIN`, `ATAN2`... | radians, not degrees |

- Precision `p` may be negative: `ROUND(revenue, -6)` rounds to millions.
- Decide explicitly between ROUND, TRUNC, CEIL and FLOOR for money and quantities, and test negative values.

## Aggregates

```sql
select AVG(amount), COUNT(amount), COUNT(*), SUM(amount), MIN(amount), MAX(amount)
  from payments
 where customer_id = :cust;
```

- `COUNT(col)` counts non-NULL values; `COUNT(*)` counts rows. COUNT never returns NULL.
- AVG is fairly robust to randomly missing values; SUM, MIN and MAX are not. A SUM over a column with many NULLs understates the total. Report `COUNT(col)` next to it.
- `DISTINCT` works in every aggregate but changes the meaning: `AVG(DISTINCT age)` is not the average age. Use it mainly with COUNT.
- `STDDEV`, `VARIANCE` measure spread.

## Combining functions

- Single-value functions nest inside aggregates and are evaluated per row first: `AVG(ABS(planned - actual))` averages magnitudes, while `AVG(planned - actual)` lets signs cancel.
- Arithmetic between aggregates is fine: `MAX(temp) - MIN(temp) as swing`.
- Nesting aggregates (`SUM(AVG(x))`) without `group by` raises ORA-00978.
- Mixing plain columns with aggregates without `group by` raises ORA-00937 (not a single-group group function).

## Finding the row behind a MAX or MIN

```sql
select order_id, customer_id, amount
  from orders
 where amount = (select MAX(amount) from orders);
```

Expect more than one row when values tie. Combine conditions with `or` for both extremes.

## List functions

- `GREATEST(a,b,...)` and `LEAST(a,b,...)` compare across columns of one row. They also work on strings (alphabetical order).
- If any argument is NULL the result is NULL. Wrap arguments in NVL/COALESCE if that is wrong for your case.

## Precedence

- Parentheses first, then `*` and `/`, then `+` and `-`, left to right among equals: `2/2/4 = .25`, `2/(2/4) = 4`.
- In conditions, `AND` binds tighter than `OR`:

```sql
where status = 'OPEN' and (priority = 1 or priority = 2)
```

Without the parentheses, every priority 2 row matches regardless of status. Always parenthesise mixed AND/OR.

## Workflow
1. Check the column datatypes and how many NULLs exist (`COUNT(*)` vs `COUNT(col)`).
2. Decide what NULL means for this column (unknown or not applicable) and whether substitution is justified.
3. Choose the rounding function deliberately and test it with positive, negative and .5 values on `DUAL`.
4. Build per-row expressions first, then wrap them in aggregates.
5. Parenthesise every mixed arithmetic or AND/OR expression.
6. Sanity-check results: compare SUM with AVG * COUNT, and look at ties when locating MAX/MIN rows.

## Red flags
- Totals that silently ignore NULLs, presented as complete.
- `NVL(col, 0)` used where NULL means "unknown", turning missing data into false zeros.
- Signed differences averaged where a magnitude was meant.
- `AVG(DISTINCT ...)` or `SUM(DISTINCT ...)` used by mistake.
- TRUNC used where ROUND was required (or the reverse) in financial calculations.
- `where a and b or c` without parentheses.
- Assuming a MAX/MIN subquery returns exactly one row.
- GREATEST/LEAST over nullable columns without handling NULL.

## Related
- `../BasicSql/basicSql.md` — NULL in where clauses and comparison operators.
- `../Grouping/grouping.md` — `group by` and `having` for per-group aggregates.
- `../Subqueries/subqueries.md` — subqueries such as the MAX/MIN row lookup.
- `../DecodeAndCase/decodeAndCase.md` — conditional calculations, often combined with SIGN.
- `../ConversionFunctions/conversionFunctions.md` — converting text to numbers safely.
