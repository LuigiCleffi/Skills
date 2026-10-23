---
name: dba-dates
description: Storing, computing, comparing and formatting dates and times in Oracle — DATE arithmetic, SYSDATE/CURRENT_DATE/SYSTIMESTAMP, ADD_MONTHS, MONTHS_BETWEEN, NEXT_DAY, LAST_DAY, ROUND/TRUNC on dates, TO_DATE/TO_CHAR format models, EXTRACT, NEW_TIME, the RR century rule, TIMESTAMP and INTERVAL types, based on Chapter 10 (Dates: Then, Now, and the Difference) of Oracle Database 11g: The Complete Reference. Use when the user computes ages, durations or due dates, filters by date ranges, gets fractional day differences, sees ORA-01843, ORA-01858 or ORA-01722 around dates, finds years off by a century, confuses MM and MI, or needs time zones or fractional seconds.
---

# Dates: Then, Now, and the Difference

An Oracle DATE always holds a time down to the second, and date literals are only dates when Oracle knows to convert them. Convert strings explicitly with TO_DATE and a four-digit-year format, normalise times with TRUNC before comparing days, and format output with TO_CHAR.

## Date arithmetic

- `date + n` is n days later; `date + 1/24` is one hour later.
- `date2 - date1` is a number of days, often fractional because of the time part.
- `SYSDATE` is the database server's current date and time; `CURRENT_DATE` uses the session time zone; `SYSTIMESTAMP` returns TIMESTAMP WITH TIME ZONE with fractional seconds.
- Use `DUAL` to try expressions: `select SYSDATE + 30 from DUAL;`

## Calendar functions

| Function | Use |
|---|---|
| `ADD_MONTHS(d, n)` | n months later; negative n goes back |
| `MONTHS_BETWEEN(d2, d1)` | months between, fractional |
| `LAST_DAY(d)` | last day of d's month |
| `NEXT_DAY(d, 'FRIDAY')` | first Friday strictly after d |
| `ROUND(d)`, `TRUNC(d)` | to midnight; ROUND moves to the next day from noon on |
| `EXTRACT(YEAR from d)` | numeric component (YEAR, MONTH, DAY, HOUR, TIMEZONE_HOUR...) |
| `GREATEST`, `LEAST` | latest / earliest of DATE values |

```sql
select FLOOR(MONTHS_BETWEEN(SYSDATE, birth_date) / 12) as age_years,
       LAST_DAY(ADD_MONTHS(hire_date, 6)) + 1           as review_date,
       NEXT_DAY(cycle_date - 1, 'FRIDAY')               as pay_day
  from employees;
```

- `NEXT_DAY` is "strictly after": subtract 1 when the start date itself may qualify.
- Use FLOOR for ages; nobody reports age 61.7.

## Times inside dates

- Literals and dates entered without a time default to midnight; SYSDATE carries the current time.
- To compare by day, truncate: `where TRUNC(created_at) = TRUNC(SYSDATE)` or, better for ranges, `created_at >= TRUNC(SYSDATE) and created_at < TRUNC(SYSDATE) + 1`.
- `BETWEEN :d1 and :d2` excludes rows later than midnight on `:d2` unless you account for the time part.

## TO_DATE and TO_CHAR

```sql
select TO_CHAR(order_date, 'YYYY-MM-DD HH24:MI:SS') from orders;
insert into orders (order_id, order_date)
values (:id, TO_DATE(:order_date_text, 'YYYY-MM-DD'));
```

- `TO_CHAR(date, 'format')` needs a real DATE; passing a string raises an error (often a misleading ORA-01722). Wrap strings in TO_DATE first.
- `TO_DATE(string, 'format')`: the format must match the string. Without a format, the string must match `NLS_DATE_FORMAT` (`alter session set NLS_DATE_FORMAT = 'DD-MON-YYYY'`), otherwise ORA-01843 or ORA-01858.
- TO_DATE accepts numbers too (`TO_DATE(20240115, 'YYYYMMDD')`), but not quoted text, spelled-out days or other output-only elements in the format.

Common format elements:

| Element | Meaning |
|---|---|
| `YYYY`, `RR`, `YY` | 4-digit year, 2-digit year with century rule, 2-digit year in current century |
| `MM`, `MON`, `Month` | month number, abbreviation, full name (case of the mask sets output case) |
| `DD`, `Dy`, `Day` | day of month, short / full weekday name |
| `HH`, `HH24`, `MI`, `SS` | hour (12), hour (24), minutes, seconds |
| `AM` / `P.M.` | meridian indicator, shows the actual value |
| `th`, `sp`, `spth` | ordinal suffix, spelled out, spelled ordinal |
| `fm` | remove blank padding from names and leading zeros |
| `"text"` | literal text in the output |

## Centuries

- `YY` puts two-digit years in the current century: '21-NOV-39' becomes 2039.
- `RR` picks 19xx for 50-99 and 20xx for 00-49 relative to the current century.
- Always store and pass four-digit years; use `YYYY` in TO_DATE.

## Literal strings that look like dates

Comparisons with a DATE column (`=`, `BETWEEN`, `IN`) implicitly convert string literals using NLS_DATE_FORMAT, but GREATEST and LEAST on two string literals compare them as text, so '20-DEC-04' sorts before '20-JAN-04'. Convert every literal with TO_DATE and an explicit format so results do not depend on session settings.

## Time zones and precision

- `NEW_TIME(d, 'EST', 'HST')` converts between named zones using three-letter abbreviations.
- `TIMESTAMP(p)`: fractional seconds, precision 0-9 (default 6).
- `TIMESTAMP WITH TIME ZONE`: stores the offset or region.
- `TIMESTAMP WITH LOCAL TIME ZONE`: normalised to database time zone, shown in session time zone.
- `INTERVAL YEAR(p) TO MONTH` and `INTERVAL DAY(p) TO SECOND(s)` store durations.

## Workflow
1. Check the column type (DATE, TIMESTAMP, or text pretending to be a date) with `describe`.
2. Check `NLS_DATE_FORMAT` for the session, but never rely on it in code: use explicit formats.
3. Decide whether the time part matters; TRUNC or use half-open ranges when it does not.
4. Prototype the expression against `DUAL` with boundary values (month ends, leap days, a date that already falls on the target weekday).
5. Display with TO_CHAR using `HH24:MI`, and double-check MM versus MI.
6. Before an update that rewrites stored dates (for example fixing centuries), preview affected rows, confirm the target database, get approval and keep original values.

## Red flags
- `'HH:MM:SS'` in a format: MM is month, minutes are MI.
- Two-digit years in inserts or TO_DATE without RR or YYYY.
- Equality or BETWEEN on DATE columns that contain times.
- String literals passed to GREATEST, LEAST or TO_CHAR without TO_DATE.
- Code that only works with one session's NLS_DATE_FORMAT.
- Dates stored in VARCHAR2 columns.
- Using SYSDATE when the user's session time zone matters (CURRENT_DATE / SYSTIMESTAMP).

## Related
- `../ConversionFunctions/conversionFunctions.md` — TO_CHAR/TO_DATE in depth and other conversions.
- `../NumberFunctions/numberFunctions.md` — FLOOR, ROUND and arithmetic on date differences.
- `../SqlPlusReports/sqlPlusReports.md` — column formats for date output in reports.
- `../../BeyondTheBasics/FlashbackQueries/flashbackQueries.md` — queries as of a timestamp.
