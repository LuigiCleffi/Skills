---
name: dba-oracle-text
description: "Building full-text search in Oracle with Oracle Text (CONTEXT and CTXCAT indexes, CONTAINS and CATSEARCH queries, scoring, fuzzy, stem and proximity search, index sync and index sets), based on Chapter 27 (Using Oracle Text for Text Searches) of Oracle Database 11g: The Complete Reference. Use when the user needs keyword or relevance search over text or CLOB columns, replaces slow LIKE '%word%' queries, writes CONTAINS, CATSEARCH or SCORE, creates an index with INDEXTYPE IS CTXSYS.CONTEXT or CTXSYS.CTXCAT, or finds new rows missing from text search results."
---

# Using Oracle Text for Text Searches

Oracle Text adds search-engine style queries to SQL: word and phrase matches, Boolean logic, relevance scores, proximity, wildcards, stemming, fuzzy and sound-alike matching. Pick the index type by how the data changes and what the queries need, and always plan how the index stays in sync with the table.

## Choosing an index type

| Need | Index | Query function |
|---|---|---|
| Large documents, relevance ranking, rich operators (stem, fuzzy, NEAR, ABOUT) | `CTXSYS.CONTEXT` | `CONTAINS` + `SCORE` |
| Short text (titles, descriptions) mixed with structured filters and sorting, always current | `CTXSYS.CTXCAT` | `CATSEARCH` |
| Classifying incoming documents against stored rules | `CTXSYS.CTXRULE` | (see Oracle Text guide) |

- The table needs a primary key before a text index can be created.
- A text index is really a set of tables and indexes created in your schema.
- Store long text in CLOB rather than VARCHAR2(4000).

```sql
create index product_desc_ctx on products(description)
  indextype is ctxsys.context
  parameters ('sync (on commit)');
```

## Keeping the index in sync

- **CONTEXT** indexes are not updated by DML by default. New or changed rows are invisible to search until synced:
  - Manual: `execute ctx_ddl.sync_index('PRODUCT_DESC_CTX');` (needs EXECUTE on CTX_DDL).
  - At creation: `parameters ('sync (on commit)')` or `'sync (every "interval")'`; default is `manual`.
- **CTXCAT** indexes are maintained transactionally with the table.
- Rebuild either with `alter index ... rebuild` like any other index.

## Querying with CONTAINS (CONTEXT)

```sql
select product_id, score(1) as relevance
  from products
 where contains(description, 'waterproof AND (jacket OR coat)', 1) > 0
 order by score(1) desc;
```

- `CONTAINS(column, query, label) > 0`; the label links to `SCORE(label)` in the select list, ORDER BY or GROUP BY.
- Matching is case-insensitive.
- Pass user search text as a bind variable, not concatenated SQL.
- CONTAINS and CATSEARCH work only in a SELECT's WHERE clause (or subquery), never directly in UPDATE or DELETE.

Operators:
- `AND` / `&`, `OR` / `|`: both or either term above the threshold. Use parentheses when mixing them.
- `ACCUM` / `,`: sum the scores of terms.
- `MINUS` / `-`: lower the score by the second term (does not exclude).
- `NOT` / `~`: exclude rows containing the term.
- `term*2`: weight a term's score; `EQUIV` / `=`: treat terms as equivalent.
- Phrases: write the words together, `'free shipping'`. Escape reserved words with braces: `'terms {and} conditions'` or `'{terms and conditions}'`.
- Proximity: `'battery NEAR life'` / `;`, or `NEAR((battery, life), 5)` for at most 5 words apart.
- Wildcards: `%` many characters, `_` one character (`'charg%'`).
- Stem: `$run` matches runs, running, ran.
- Fuzzy: `?recieve` or `FUZZY(term, score, numresults, weight)` for misspellings; terms must be at least three characters.
- Soundex: `!smith` matches words that sound alike.
- Theme: `ABOUT(security)` searches by document theme.
- Operators nest: `$?stir` stems the fuzzy expansions.

In SQL*Plus, `set define off` before using `&` in a search string.

## Querying with CATSEARCH (CTXCAT)

```sql
select product_id, name
  from products
 where catsearch(name, 'wireless headphones', null) > 0;
```

- Arguments: column, text query, structured query (or NULL).
- No score is computed; `> 0` is kept for symmetry.
- Words separated by spaces are ANDed by default; `|` for OR; `-` with surrounding spaces or `NOT` excludes; double quotes for phrases; `*` as wildcard.
- `-` means exclude here, unlike CONTAINS where it only reduces the score.
- Do not rely on ACCUM or other CONTAINS-only operators.

## Index sets for mixed queries

Index sets let CTXCAT resolve text and structured conditions together, including ordering:

```sql
execute ctx_ddl.create_index_set('product_iset');
execute ctx_ddl.add_index('product_iset', 'category_id');
execute ctx_ddl.add_index('product_iset', 'created_at');

create index product_name_cat on products(name)
  indextype is ctxsys.ctxcat
  parameters ('index set product_iset');

select * from products
 where catsearch(name, 'headphones',
                 'category_id = 12 order by created_at desc') > 0;
```

Limits: up to 99 indexes on NUMBER, DATE, CHAR, VARCHAR2 columns, no column over 30 bytes, no NULLs in indexed columns. Quote literals inside the structured query by doubling single quotes.

## Diagnosing

- New rows not found: the CONTEXT index has not been synced; sync it or change the sync policy.
- Slow indexing or queries: enable tracing with `CTX_OUTPUT.ADD_TRACE` to see time per component, bytes read and rows processed.
- Inspect text indexes in `USER_INDEXES` (`ITYPE_OWNER = 'CTXSYS'`).

## Workflow
1. Confirm the search requirement: ranking, operators, freshness, and which structured filters accompany the text.
2. Ensure the table has a primary key; choose CONTEXT or CTXCAT (with an index set if filtering and sorting matter).
3. Create the index with an explicit sync policy; grant EXECUTE on CTX_DDL to the owner if manual sync is needed.
4. Write queries with bind variables; use SCORE and ORDER BY for ranking with CONTEXT.
5. Test with inserted and updated rows to prove they appear in results when expected.
6. Schedule syncs (and optimization per the Oracle Text guide) if not syncing on commit.

## Red flags
- `LIKE '%word%'` scans on large text columns where a text index fits.
- CONTEXT index with manual sync and nobody scheduling `SYNC_INDEX`.
- Concatenating raw user input into the CONTAINS query string; reserved words and symbols (`&`, `-`, `?`) change meaning, so escape with braces or validate.
- Using `-` expecting exclusion in CONTAINS (use `NOT` / `~`).
- Dropping and re-creating a text index on a large production table without approval and a maintenance window; search is unavailable until the rebuild finishes.

## Related
- `../../ObjectRelational/LargeObjects/largeObjects.md` — CLOB storage for long documents.
- `../../SqlAndSqlPlus/RegularExpressions/regularExpressions.md` — pattern matching when no text index is needed.
- `../../SqlAndSqlPlus/TextFunctions/textFunctions.md` — SOUNDEX, INSTR and other string functions.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — regular indexes and index rebuilds.
- `../../HitchhikersGuides/XmlInOracle/xmlInOracle.md` — searching XML content.
