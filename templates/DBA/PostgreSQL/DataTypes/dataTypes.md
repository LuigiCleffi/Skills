---
name: postgres-data-types
description: "Choosing and using PostgreSQL data types and their functions and operators - serial and sequences, generate_series, text types and string/regex functions, date/time types and time zones, intervals, arrays, range types, json and jsonb, xml, full text search (tsvector, tsquery, ranking) and custom composite types and operators, based on Chapter 5 (Data Types) of PostgreSQL: Up and Running, 3rd edition. Use when designing columns, choosing timestamp vs timestamptz, char vs varchar vs text, json vs jsonb, querying with ->, ->>, @>, &&, ?, regexp_matches, unnest, string_to_array, array_agg, daterange or tstzrange, building full text search with to_tsvector, to_tsquery and @@, or creating CREATE TYPE and CREATE OPERATOR."
---

# Data Types

Pick the type that encodes the rule you need, then use the operators built for it: ranges for periods, `timestamptz` for real moments, `jsonb` for documents you query, arrays for small ordered lists, `tsvector` for keyword search. A well-chosen type gives you validation, operators and indexability for free; a generic `text` column gives you none.

## Oracle habits that mislead here

- Empty string `''` is not NULL in PostgreSQL. `NULL` checks need `IS NULL`.
- `date` has no time part; `timestamp`/`timestamptz` do.
- Use `text`/`varchar`, `integer`/`bigint`/`numeric`, not `VARCHAR2`/`NUMBER`.
- No `DUAL`: `SELECT now();` works without FROM. Sequences are read with `nextval('seq_name')`, not `seq_name.NEXTVAL`.
- Unquoted identifiers fold to lowercase, not uppercase.

## Numbers, serials and series

- `serial`/`bigserial` create an integer column plus a sequence `table_column_seq` and set the default to `nextval`. Dropping the column drops the sequence; renaming the table does not rename it.
- Sequences are standalone objects (`CREATE SEQUENCE`, `ALTER SEQUENCE ... RESTART`, increment, bounds) and can be shared across tables by using `DEFAULT nextval('seq')` on a plain `bigint` column.
- For new tables prefer `GENERATED ... AS IDENTITY` (see Tables, Constraints, and Indexes). Use `bigint` keys for large or fast-growing tables.
- `generate_series(start, stop[, step])` replaces a loop: numbers, or timestamps with an interval step. It never passes the stop value.

```sql
SELECT d::date AS month_start
FROM generate_series(date '2024-01-01', date '2024-06-01', interval '1 month') AS d;
```

## Text

- `char(n)` pads with spaces and is never faster; use it only for truly fixed-length codes. `varchar(n)` enforces a maximum; `varchar` without n and `text` are effectively the same. Values up to 1 GB; large values are moved to TOAST automatically.
- Comparisons are case-sensitive. For case-insensitive lookup, compare `lower(col)` and index that expression (or use the `citext` extension).
- Useful functions: `lpad`/`rpad` (truncate if the input is longer), `trim`/`ltrim`/`rtrim`/`btrim` with optional characters, `substring`, `split_part(s, delim, n)`, `string_to_array`, `string_agg(expr, sep ORDER BY ...)`, `||` for concatenation.
- Regex: `~` (match), `~*` (case-insensitive), `regexp_replace(s, pattern, repl, flags)` with `\1` back-references, `regexp_matches(s, pattern, 'g')` (returns arrays; with `g`, one row per match), `substring(s from pattern)` for the first match. `similar to` is a different, SQL-standard pattern syntax, not `~`.
- With `standard_conforming_strings` on (the default), backslashes in ordinary `'...'` literals are literal; `E'...'` strings treat backslash as escape, so patterns there need doubled backslashes.

## Dates, times and time zones

| Type | Stores | Use for |
|---|---|---|
| `date` | calendar day | birthdays, business days |
| `timestamp` | date + time, no zone | wall-clock times with no location |
| `timestamptz` | an instant, stored as UTC | events, audit columns, anything that happened |
| `time`, `timetz` | time of day | rarely; `timetz` ignores dates and DST |
| `interval` | duration | arithmetic: `ts + interval '90 minutes'` |

- `timestamptz` does not store the zone. Input is converted to UTC; output is converted to the session `TimeZone` (session, then role, then database, then server). Moving a server or changing `TimeZone` changes how values display, not what they mean.
- Plain `timestamp` arithmetic ignores DST transitions; `timestamptz` gets them right. Use full zone names (`America/Sao_Paulo`), not fixed offsets, when the region matters.
- `ts AT TIME ZONE 'Europe/Paris'` converts a `timestamptz` to local wall-clock `timestamp` there (and the reverse for a `timestamp` input).
- Write literals in ISO form (`2024-03-10 14:00`); other formats depend on `DateStyle`.
- `date_part`/`extract`, `date_trunc`, `to_char(ts, 'YYYY-MM-DD HH24:MI')`, `age`, `now()` (transaction start) vs `clock_timestamp()` (actual time).
- `(start1, end1) OVERLAPS (start2, end2)` treats periods as half-open, unlike `BETWEEN`, which includes both ends.
- `'infinity'` and `'-infinity'` are valid timestamp and date values; use them instead of magic far-future dates.

## Arrays

- Every type has an array type (`int[]`, `text[]`). Build with `ARRAY[1,2,3]`, `'{a,b}'::text[]`, `array(SELECT ...)`, `array_agg(x ORDER BY x)` or `string_to_array`.
- Subscripts start at 1. Out-of-range access returns NULL, not an error. Slices: `a[2:4]`. Bounds: `array_length(a, 1)`, `array_upper(a, 1)`, `cardinality(a)`.
- `||` appends elements or concatenates arrays.
- Operators: `=` (same elements, same order), `@>` contains, `<@` is contained by, `&&` overlaps, `x = ANY(a)` for membership. GIN indexes support `@>`, `<@`, `&&`, `=`.
- `unnest(a)` expands to rows; `unnest(a, b) WITH ORDINALITY` in FROM pads unequal arrays with NULL. Avoid several `unnest` calls in the select list with arrays of different lengths.
- Arrays suit small, owned lists (tags, codes). If you need foreign keys or per-element updates, use a child table.

## Range types

- Built in: `int4range`, `int8range`, `numrange`, `daterange`, `tsrange`, `tstzrange`. `[` includes a bound, `(` excludes it; an empty bound means unbounded.
- Discrete ranges (integers, dates) are canonicalized to `[)`: `'[2024-01-01,2024-01-31]'::daterange` displays as `[2024-01-01,2024-02-01)`. Use `[)` everywhere for consistency.
- Constructors: `daterange(lower, upper, '[)')`; always pass the third argument.
- Operators: `&&` overlap, `@>` contains a value or range, `<@`, `-|-` adjacent, `*` intersection, `+` union; `lower(r)`, `upper(r)`, `isempty(r)`.
- Index range columns with GiST and use exclusion constraints to forbid overlaps.

```sql
CREATE TABLE price_periods (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                            sku text NOT NULL, valid daterange NOT NULL);
CREATE INDEX ix_price_periods_valid ON price_periods USING gist (valid);
SELECT sku FROM price_periods WHERE valid @> current_date;
```

## json and jsonb

- `json` keeps the input text (whitespace, key order, duplicate keys) and reparses on every access. `jsonb` stores a parsed binary form: faster to query, indexable with GIN, keys deduplicated (last wins) and reordered. Default to `jsonb`; use `json` only when the exact text must round-trip.
- Invalid JSON is rejected on insert or cast.
- Navigation: `->` returns json, `->>` returns text, `#>`/`#>>` take a path array. JSON arrays are zero-based. Only the last step can be `->>`.
- Set functions: `jsonb_array_elements`, `jsonb_each`, `jsonb_object_keys`; building output: `row_to_json`, `to_jsonb(row)`, `jsonb_agg`, `jsonb_build_object`.
- jsonb-only operators: `@>`, `<@`, `?` (key exists), `?|`, `?&`, `||` merge (replaces existing keys), `-` remove key, `#-` remove path; `jsonb_set(doc, path, value, create_missing)`, `jsonb_insert`.

```sql
CREATE INDEX ix_orders_doc ON orders USING gin (doc);
SELECT id FROM orders WHERE doc @> '{"status":"paid"}';
UPDATE orders SET doc = jsonb_set(doc, '{shipping,carrier}', '"ups"', true)
WHERE id = 42 RETURNING doc;
```

- A plain GIN index serves `@>`, `?` and friends, not `->>` equality. For a hot single key, add an expression index on `(doc->>'status')`.
- Version note: PostgreSQL 12 added SQL/JSON path (`jsonb_path_query`, `@?`, `@@` on jsonpath); later releases add more SQL/JSON functions.

## xml

- The `xml` type checks well-formedness only, not DTD/XSD. Enforce structure with a CHECK using `xpath_exists`.
- `xpath(path, doc)` always returns an array; subscript it and cast: `(xpath('/a/b/text()', doc))[1]::text`.
- `XMLTABLE(... PASSING doc COLUMNS ...)` (10+) shreds XML into rows and columns; prefer it to nested `xpath` plus `unnest`.
- No direct index support; index extracted expressions.

## Full text search

- Text becomes a `tsvector` of lexemes with positions; search terms become a `tsquery`; match with `@@`. Always name the configuration (`'english'`, `'simple'`, ...) on both sides, and use the same one; `SHOW default_text_search_config;` reveals the default; `\dF` lists configurations.
- Query builders: `to_tsquery('a & (b | c)')` (operators `&`, `|`, `!`, `<->`, `<N>`), `plainto_tsquery` (ANDs words), `phraseto_tsquery` (words in order), `websearch_to_tsquery` (11+). Casting text to `tsquery` skips stemming.
- Weight sources with `setweight(..., 'A'..'D')` and concatenate vectors with `||`; rank with `ts_rank` or `ts_rank_cd` (needs positions); highlight with `ts_headline`. `strip()` removes positions and weights, saving space but disabling phrase and proximity searches and `ts_rank_cd`.
- Store the vector and index it with GIN (GiST is smaller and faster to build, but lossy and slower to search):

```sql
ALTER TABLE articles ADD COLUMN fts tsvector;
UPDATE articles SET fts = setweight(to_tsvector('english', coalesce(title,'')), 'A')
                       || setweight(to_tsvector('english', coalesce(body,'')),  'B');
CREATE INDEX ix_articles_fts ON articles USING gin (fts);
SELECT id, ts_rank(fts, q) AS rank
FROM articles, to_tsquery('english', 'refund & (late | delay)') AS q
WHERE fts @@ q ORDER BY rank DESC LIMIT 20;
```

- Keep the vector current with a trigger (`tsvector_update_trigger` does not support weights; write your own trigger function for weighted vectors).
- Version note: since 12 a stored generated column (`GENERATED ALWAYS AS (to_tsvector('english', ...)) STORED`) replaces the trigger; trigger DDL is written `EXECUTE FUNCTION` since 11.
- `to_tsvector` and `ts_headline` accept `json`/`jsonb` (10+) and index only values, not keys.
- Installing extra dictionaries (hunspell, etc.) copies files into the server's `share` directory and runs `CREATE EXTENSION`: a server change that needs approval.

## Composite and custom types

- Every table is also a composite type; `CREATE TYPE money_pair AS (amount numeric, currency char(3));` makes a standalone one. Use composites mainly as function return types and query shapes, not as nested column storage.
- Reference fields with parentheses: `(price).amount`, `(price).*`; without them PostgreSQL looks for a table named `price`.
- NULL rules: a row `IS NULL` only if every field is NULL, and `IS NOT NULL` only if every field is non-NULL, so both can be false.
- Custom operators: write a function, then `CREATE OPERATOR + (FUNCTION = add_money, LEFTARG = money_pair, RIGHTARG = money_pair, COMMUTATOR = +)` (spelled `PROCEDURE =` on 10). Operators can be overloaded by argument type.
- Columns of a table's composite type create dependencies; `DROP TABLE ... CASCADE` silently drops those columns elsewhere. Never use CASCADE without listing dependents first and getting explicit approval.

## Workflow

1. State the rule the column must enforce (instant vs wall clock, period, document, list, searchable text) and pick the type that encodes it.
2. Check Oracle or other-database assumptions (empty string, date with time, case folding, sequences).
3. Choose operators and the matching index type (B-tree for scalars, GIN for jsonb/arrays/tsvector, GiST for ranges).
4. Write a small query that proves the behavior on edge values: DST boundaries, empty and NULL, unbounded ranges, missing JSON keys, duplicate keys.
5. Verify the plan uses the index with `EXPLAIN` on realistic data volume, and check types with `\d table` and `pg_typeof(expr)`.

## Red flags

- `timestamp` (without zone) for event times in a multi-region or DST-observing system.
- Start and end columns where a range plus an exclusion constraint would enforce the rule.
- `json` chosen for data you filter on, or jsonb queried with `->>` equality but indexed only with plain GIN.
- `char(n)` for variable-length text; comparisons broken by padding.
- Delimited strings stored in text and parsed in every query instead of arrays or a child table.
- Full text queries without an explicit configuration, or with a different one than the vector.
- `LIKE '%word%'` scans where full text search or trigram indexes fit.
- `DROP ... CASCADE` on a table or type used as a column type elsewhere.

## Related

- `../TablesConstraintsIndexes/tablesConstraintsIndexes.md` — identity columns, exclusion constraints and choosing GIN, GiST or B-tree indexes.
- `../SqlThePostgresWay/sqlThePostgresWay.md` — set-returning functions, LATERAL and json output in queries.
- `../WritingFunctions/writingFunctions.md` — functions behind custom operators and trigger functions.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — confirming index use for these types.
- `../../Oracle/SqlAndSqlPlus/Dates/dates.md` — Oracle counterpart for dates; do not apply its syntax here.
- `../../Oracle/SqlAndSqlPlus/RegularExpressions/regularExpressions.md` — Oracle counterpart for regex; do not apply its syntax here.
- `../../Oracle/BeyondTheBasics/OracleText/oracleText.md` — Oracle counterpart for text search; do not apply its syntax here.
- `../../Oracle/ObjectRelational/ObjectTypes/objectTypes.md` — Oracle counterpart for custom types; do not apply its syntax here.
