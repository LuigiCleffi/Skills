---
name: dba-conversion-functions
description: Converting between Oracle datatypes explicitly (TO_CHAR, TO_DATE, TO_NUMBER, TO_TIMESTAMP and the specialized conversion functions) and avoiding the traps of implicit conversion, based on Chapter 11 (Conversion and Transformation Functions) of Oracle Database 11g: The Complete Reference. Use when SQL compares a VARCHAR2 column to a number or a string to a date, an index on an ID column is not used, a query fails with ORA-01722 (invalid number) or ORA-00932 (inconsistent datatypes), code relies on NLS_DATE_FORMAT, or the user asks about TRANSLATE, BIN_TO_NUM, SCN_TO_TIMESTAMP, CAST or RAWTOHEX.
---

# Conversion and Transformation Functions

Oracle will silently convert one datatype into another whenever a value "looks like" the type a function or operator expects. That convenience hides bugs and kills index use. Convert explicitly, with a format mask, at the point where the data enters the expression.

## The workhorse conversions

| Need | Function | Always pass |
|---|---|---|
| DATE or NUMBER to text | `TO_CHAR(value, 'fmt')` | a format mask |
| Text or number to DATE | `TO_DATE(text, 'fmt')` | a format mask |
| Text to TIMESTAMP | `TO_TIMESTAMP` / `TO_TIMESTAMP_TZ` | a format mask |
| Text to NUMBER | `TO_NUMBER(text [, 'fmt'])` | a mask when the text has separators |

```sql
select order_id
  from orders
 where order_date >= TO_DATE(:start_date, 'YYYY-MM-DD')
   and order_date <  TO_DATE(:end_date,   'YYYY-MM-DD') + 1;

select TO_CHAR(amount, '999G999D99') as amount_txt from invoices;
```

## How implicit conversion behaves

Know the rules so you can recognize them in existing code, not so you can rely on them:

- Any NUMBER or DATE is converted to a string when passed to a string function (`SUBSTR`, `LPAD`, `RTRIM`, `INITCAP`). The result is a string.
- A string is converted to a NUMBER only if it contains digits, a decimal point and an optional leading minus sign. Anything else raises ORA-01722.
- A string is converted to a DATE only if it matches the session default format (`NLS_DATE_FORMAT`). `GREATEST` and `LEAST` treat such values as strings; `BETWEEN` converts only when the column on its left is a DATE.
- A NUMBER is never converted to a DATE, and a DATE is never converted to a NUMBER (ORA-00932). Use `TO_DATE` on the number first.
- Date arithmetic is limited to adding or subtracting days. A bare date-looking literal plus 1 fails with ORA-01722 because the literal is treated as a number; `TO_DATE(...) + 1` works.

## Why implicit conversion hurts

- **Indexes are skipped.** If `customer_code` is VARCHAR2 and the code binds a NUMBER, Oracle converts the column side, and the index on `customer_code` cannot be used. Match the bind type to the column type.
- **Latent failures.** A query that does arithmetic on a VARCHAR2 column works until the first non-numeric row arrives, then fails in production. `TO_NUMBER` still fails on bad data, but it documents the expectation.
- **Session dependence.** Code that passes a string as a date breaks when another client sets a different `NLS_DATE_FORMAT` or language.
- **Readability.** A reader cannot tell whether a string function on a number is intentional. If you must rely on implicit conversion, leave a comment saying so.

Low-risk direction: string functions on numbers. High-risk direction: arithmetic or date functions on strings.

## Specialized conversions (know they exist)

- Character sets and Unicode: `CONVERT`, `TO_NCHAR`, `TO_NCLOB`, `TO_CLOB`, `UNISTR`, `ASCIISTR`, `COMPOSE`, `DECOMPOSE`, `TO_SINGLE_BYTE`, `TO_MULTI_BYTE`, `TRANSLATE ... USING`.
- Binary and row identifiers: `HEXTORAW`, `RAWTOHEX`, `RAWTONHEX`, `CHARTOROWID`, `ROWIDTOCHAR`, `ROWIDTONCHAR`, `BIN_TO_NUM(1,0,1)` (returns 5).
- Intervals: `NUMTODSINTERVAL`, `NUMTOYMINTERVAL`, `TO_DSINTERVAL`, `TO_YMINTERVAL`.
- Floating point: `TO_BINARY_FLOAT`, `TO_BINARY_DOUBLE`.
- LOBs: `TO_LOB` converts a LONG to a LOB inside `insert ... select`.
- Flashback support: `SCN_TO_TIMESTAMP` and `TIMESTAMP_TO_SCN` map between system change numbers and approximate times.
- Collections: `CAST` converts built-in or collection types (used with nested tables and varrays).

## Transformation functions

- `TRANSLATE(string, from_chars, to_chars)` substitutes character by character by position. Characters not in `from_chars` pass through unchanged. Useful for masking digits, normalizing separators or simple character maps.

```sql
-- replace every digit with 9 to inspect the shape of phone numbers
select TRANSLATE(phone, '0123456789', '9999999999') as shape
  from customers;
```

- `DECODE(value, if1, then1, ..., else)` substitutes value by value. See the DECODE and CASE skill.
- For pattern-based replacement use `REGEXP_REPLACE` instead of chaining `TRANSLATE` or `REPLACE`.

## Workflow

1. Check the real column types first (`describe table` or `USER_TAB_COLUMNS`) before writing predicates.
2. Make every literal and bind match its column type; wrap strings that represent dates in `TO_DATE` with an explicit mask.
3. When a column stores numbers as text, decide on purpose: bind a string (keeps the index) or clean the data; do not wrap the column in `TO_NUMBER` in a hot predicate.
4. Apply `TO_CHAR` with a mask for output formatting in the select list, not on the column side of the where clause.
5. Verify index use with the execution plan when a predicate mixes types.
6. Test with a row that would break the implicit assumption (non-numeric text, a different date format).

## Red flags

- `where varchar_id = 12345`, or a NUMBER bind against a VARCHAR2 key.
- Date literals written as bare strings with no `TO_DATE` and mask.
- Two-digit years in masks for new data.
- `TO_NUMBER(col)` or `TO_CHAR(date_col)` on the column side of a where clause on a large table.
- ORA-01722 that appears only "sometimes": a non-numeric value has reached a column used in arithmetic.
- Multiplication or division applied to DATE values (ORA-00932).

## Related

- `../Dates/dates.md` — date formats, date arithmetic and TO_CHAR masks in depth.
- `../TextFunctions/textFunctions.md` — the string functions that trigger implicit conversion.
- `../NumberFunctions/numberFunctions.md` — numeric functions and their input expectations.
- `../DecodeAndCase/decodeAndCase.md` — DECODE and CASE for value substitution.
- `../RegularExpressions/regularExpressions.md` — REGEXP_REPLACE for pattern-based transformation.
- `../../BeyondTheBasics/FlashbackQueries/flashbackQueries.md` — where SCN and timestamp conversion is used.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — confirming index use in execution plans.
