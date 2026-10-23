---
name: dba-text-functions
description: Inspecting and reshaping character data with Oracle string functions (||, CONCAT, LPAD/RPAD, LTRIM/RTRIM/TRIM, UPPER/LOWER/INITCAP, LENGTH, SUBSTR, INSTR, ASCII/CHR, SOUNDEX) and choosing CHAR versus VARCHAR2, based on Chapter 7 (Getting Text Information and Changing It) of Oracle Database 11g: The Complete Reference. Use when the user needs to clean, split, pad, trim, recase or search text columns in SQL, parse "Last, First" names, extract part of a code or phone number, find near-duplicate names, sort or filter by string length, or sees unexpected trimming or blank-padding behaviour.
---

# Getting Text Information and Changing It

String functions either produce a modified string (UPPER, SUBSTR, TRIM...) or report a fact about it (LENGTH, INSTR, SOUNDEX). Compose them from the inside out, one step at a time, and prefer storing clean, separated data over parsing messy strings in every query.

## Datatypes first

- `VARCHAR2(n)`: variable length. Use it for nearly all text.
- `CHAR(n)`: fixed length, blank-padded to n; comparisons pad both sides. Use only for truly fixed-length codes.
- Do not declare `VARCHAR`; it is currently a synonym for VARCHAR2 but its meaning may change.
- String functions do not work on `LONG` columns.
- Literals go in single quotes; column names never do. `LOWER('City')` is the word, `LOWER(city)` is the column.

## Function reference

| Need | Function | Notes |
|---|---|---|
| Join strings | `a || b`, `CONCAT(a,b)` | no separator added |
| Fixed-width / leaders | `RPAD(s,n[,set])`, `LPAD(s,n[,set])` | pads with spaces by default; truncates if s is longer than n |
| Strip characters | `LTRIM(s[,set])`, `RTRIM(s[,set])` | removes any char in set until one not in set |
| Strip both ends | `TRIM([leading|trailing|both] 'c' from s)` | single character only |
| Case | `UPPER`, `LOWER`, `INITCAP` | `INITCAP(LOWER(s))` for title case |
| Length | `LENGTH(s)` | counts characters, including spaces |
| Cut | `SUBSTR(s,start[,count])` | negative start counts from the end |
| Locate | `INSTR(s,set[,start[,occurrence]])` | returns 0 when not found |
| Codes | `ASCII(s)`, `CHR(n)`, `DUMP(s)` | ASCII looks at the first character only |
| Sounds like | `SOUNDEX(s)` | English phonetics, same first letter required |

## Trim sets are character sets, not words

`LTRIM(title, 'THE ')` removes any leading T, H, E or space in any order, so "THE ETHNIC..." becomes "NIC...". Order of the set is irrelevant; matching is case sensitive. To remove a word, locate it with `INSTR`/`SUBSTR` (or `REGEXP_REPLACE`, see Related).

## Composing functions

Read nested calls from the inside out and lay them out over several lines while building them:

```sql
select INITCAP(LOWER(
         LTRIM(RTRIM(title, '."'), '"')
       )) as clean_title
  from articles;
```

## Splitting with INSTR and SUBSTR

Turn "SMITH, JOHN" into "JOHN SMITH" by locating the comma once and cutting around it:

```sql
select SUBSTR(full_name, INSTR(full_name, ',') + 2)
       || ' ' ||
       SUBSTR(full_name, 1, INSTR(full_name, ',') - 1) as by_first_name
  from authors
 where INSTR(full_name, ',') > 0;
```

- `INSTR(s, set, 1, 2)` finds the second occurrence; specifying an occurrence requires a start position.
- Guard against rows without the delimiter (`INSTR(...) > 0`); otherwise the expression returns garbage.
- This only works when every row follows the same convention. Suffixes and prefixes (Jr., von) break it; storing first and last names in separate columns is the robust fix.

## SUBSTR details

- `SUBSTR(phone, 5)` returns from position 5 to the end.
- `SUBSTR(phone, -4)` returns the last four characters. On `CHAR` columns the count starts from the padded end, so use it only on VARCHAR2.
- A negative count returns NULL.

## Strings in where and order by

```sql
select customer_name from customers
 where INSTR(customer_name, 'O', 1, 2) > 0   -- at least two O's
 order by LENGTH(customer_name);
```

`LIKE '%O%O%'` expresses the same filter more readably. When several forms give the same result, choose the clearest one.

## Finding near-duplicates with SOUNDEX

```sql
select a.customer_id, a.last_name, b.customer_id, b.last_name
  from customers a join customers b
    on SOUNDEX(a.last_name) = SOUNDEX(b.last_name)
   and a.customer_id < b.customer_id;
```

Exclude self-matches with an inequality on the key. SOUNDEX is a hint, not proof: review candidates before merging or deleting anything.

## National language support

- NCHAR / NVARCHAR2 store national character set data.
- `NLS_UPPER`, `NLS_LOWER`, `NLS_INITCAP`, `NLSSORT` apply language-specific rules.
- `SUBSTRB` (bytes), `SUBSTRC`, `SUBSTR2`, `SUBSTR4` cut by different units; use the byte variant only when you really mean bytes.

## Workflow
1. Check the column datatype (`describe table`) and whether it is CHAR, VARCHAR2 or LONG.
2. Sample real values and list the formats present; count rows that break the expected pattern.
3. Build the expression in `select` against a few rows (or `DUAL` literals) one function at a time.
4. Add guards for NULLs and missing delimiters; test edge rows explicitly.
5. Only then use the expression in an `update`, view or report. For updates that rewrite data, confirm the target database and get approval, and keep a copy of the original values.
6. Prefer fixing the data model (separate columns, validated input) when the same parsing recurs.

## Red flags
- Using LTRIM/RTRIM to remove a word or prefix.
- SUBSTR/INSTR parsing applied to data with inconsistent formats, without checking for exceptions.
- Negative SUBSTR start on a CHAR column.
- `CHAR` columns compared to VARCHAR2 values and failing because of padding.
- Treating SOUNDEX matches as confirmed duplicates.
- Bulk `update ... set col = TRIM(...)` run without a preview or backup.
- Quoting a column name, which turns it into a literal.

## Related
- `../RegularExpressions/regularExpressions.md` — REGEXP_ functions when patterns get complex.
- `../BasicSql/basicSql.md` — LIKE and where-clause basics.
- `../ConversionFunctions/conversionFunctions.md` — TO_CHAR, TO_NUMBER and REPLACE/TRANSLATE.
- `../DecodeAndCase/decodeAndCase.md` — conditional logic for word-level cleanup.
- `../../BeyondTheBasics/OracleText/oracleText.md` — word and fuzzy searches.
