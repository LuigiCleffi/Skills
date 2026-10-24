---
name: dba-regular-expressions
description: "Searching, extracting, validating and rewriting text with Oracle's POSIX regular expression functions (REGEXP_LIKE, REGEXP_SUBSTR, REGEXP_INSTR, REGEXP_REPLACE, REGEXP_COUNT), their operators, character classes and match parameters, based on Chapter 8 (Searching for Regular Expressions) of Oracle Database 11g: The Complete Reference. Use when the user needs pattern matching beyond LIKE, wants to validate or reformat phone numbers, codes or emails, extract the nth token, count occurrences, do case-insensitive matching, use backreferences, or replaces nested SUBSTR/INSTR logic."
---

# Searching for Regular Expressions

The REGEXP_ functions extend LIKE, INSTR, SUBSTR, REPLACE and counting with POSIX patterns. Reach for them when the plain functions need nested arithmetic; start with the simplest pattern, test it on literals from DUAL, and grow it step by step.

## The five functions

| Function | Returns | Shape |
|---|---|---|
| `REGEXP_LIKE` | boolean condition (where/check) | `(src, pattern [, match])` |
| `REGEXP_SUBSTR` | matched text or NULL | `(src, pattern [, pos [, occ [, match]]])` |
| `REGEXP_INSTR` | position or 0 | `(src, pattern [, pos [, occ [, return_opt [, match]]]])` |
| `REGEXP_REPLACE` | rewritten string | `(src, pattern [, repl [, pos [, occ [, match]]]])` |
| `REGEXP_COUNT` | number of matches (11g+) | `(src, pattern [, pos [, match]])` |

- `pos` is where to start (default 1); `occ` is which match (default 1).
- `REGEXP_INSTR` `return_opt`: 0 = start of match (default), 1 = position after the match.
- `REGEXP_REPLACE` `occ`: 0 = all matches (default), n = only the nth.
- `REGEXP_COUNT` is a single-row function, unlike the aggregate `COUNT`.
- Patterns may be up to 512 bytes.

## Operators

| Operator | Meaning |
|---|---|
| `.` | any character |
| `*` `+` `?` | zero or more, one or more, zero or one |
| `{m}` `{m,}` `{m,n}` | exactly m, at least m, between m and n |
| `[abc]` `[^abc]` | one of the list, any character not in the list |
| `^` `$` | start and end of string (of each line with `'m'`) |
| `a|b` | alternation |
| `( )` | group; also numbered for backreferences `\1`..`\9` |
| `\` | escape the next character (`\.` is a literal dot) |
| `[[:digit:]]` etc. | character class, only valid inside brackets |
| `[=a=]` | equivalence class: a and its accented forms |
| `[.ch.]` | multi-character collation element |

Character classes: `alnum`, `alpha`, `blank`, `cntrl`, `digit`, `graph`, `lower`, `print`, `punct`, `space`, `upper`, `xdigit`.

## Match parameters

- `'i'` case insensitive, `'c'` case sensitive.
- `'n'` lets `.` match newline.
- `'m'` treat source as multiple lines for `^`/`$`.
- `'x'` ignore whitespace in the pattern (listed for REGEXP_COUNT).
- If omitted, case sensitivity follows `NLS_SORT`, `.` does not match newline, and the source is one line. Contradictory values: the last one wins.

## Core patterns

```sql
-- validate format
select customer_id from customers
 where not REGEXP_LIKE(phone, '^[[:digit:]]{3}-[[:digit:]]{3}-[[:digit:]]{4}$');

-- extract the middle token between hyphens
select REGEXP_SUBSTR(:sku, '[^-]+', 1, 2) as middle from DUAL;

-- reformat with backreferences
select REGEXP_REPLACE(phone,
         '([[:digit:]]{3})-([[:digit:]]{3})-([[:digit:]]{4})',
         '(\1) \2-\3') as pretty
  from customers;

-- count occurrences, case insensitive
select REGEXP_COUNT(:text, 'ge', 1, 'i') from DUAL;
```

## Replacing nested SUBSTR/INSTR

Extracting text between the first and second delimiter with plain functions needs three INSTR calls and subtraction. `REGEXP_SUBSTR(s, '[^-]+', 1, n)` returns the nth token directly. Use `REGEXP_INSTR(..., 1)` (return position after the match) to avoid +length arithmetic.

## Finding bad data

- Rows that will fail `TO_NUMBER`: `where REGEXP_LIKE(amount_text, '[^[:digit:].-]')`.
- Rows with any punctuation: `where REGEXP_LIKE(code, '[[:punct:]]')`.
- Limit a replace to qualifying rows by repeating the pattern in `where REGEXP_INSTR(col, pat, pos, occ) > 0`.

## Workflow
1. Write down the exact format you expect, including anchors and repetition counts.
2. Try the pattern on literal strings from `DUAL`, including good, bad and edge values (empty, NULL, extra spaces, lowercase).
3. Run it read-only against the table: count matches and non-matches with REGEXP_LIKE.
4. Decide case sensitivity explicitly with `'i'` or `'c'` rather than relying on NLS_SORT.
5. For REGEXP_REPLACE in an `update`, preview old and new values side by side first, confirm the target database, get approval, and keep the original values for rollback.
6. If a plain function (LIKE, INSTR, REPLACE) expresses the same thing clearly, prefer it.

## Red flags
- Character classes outside brackets: `'[:digit:]'` is a list of the characters `:`, `d`, `i`, `g`, `t`; write `'[[:digit:]]'`.
- Missing anchors: `REGEXP_LIKE(phone, '415')` matches 415 anywhere, not only as the prefix; use `'^415'`.
- Misreading `+`: `'415+'` means "41 followed by one or more 5s", not "starts with 415".
- Unescaped `.`, `(`, `+` intended as literals.
- Assuming case-insensitive matching by default.
- Mass REGEXP_REPLACE updates without a preview or backup.
- Unreadable one-line patterns with no comment explaining the intended format.

## Related
- `../TextFunctions/textFunctions.md` — INSTR, SUBSTR, LIKE and TRIM basics.
- `../ConversionFunctions/conversionFunctions.md` — REPLACE, TRANSLATE and TO_NUMBER failures.
- `../SchemaObjects/schemaObjects.md` — enforcing formats with check constraints.
- `../../BeyondTheBasics/OracleText/oracleText.md` — linguistic text search instead of patterns.
- `../../../../CleanCode/MeaningfulNames/namingRules.md` — naming patterns and columns so intent is obvious.
