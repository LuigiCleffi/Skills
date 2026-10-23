---
name: ddia-data-models-and-query-languages
description: How to choose between the relational, document and graph data models and their query languages: one-to-many trees vs many-to-one and many-to-many relationships, normalization with IDs vs duplication, object-relational impedance mismatch and ORMs, document locality and size limits, schema-on-read vs schema-on-write and migrations, declarative vs imperative queries, MapReduce vs aggregation pipelines, property graphs with Cypher, triple-stores with RDF and SPARQL, Datalog rules, and recursive SQL CTEs, based on Chapter 2 (Data Models and Query Languages) of Designing Data-Intensive Applications. Use when designing a schema or data model, deciding "SQL or NoSQL", "MongoDB or Postgres", whether to embed or reference, whether to use a JSON/JSONB column, a graph database or a join table, modeling hierarchies, social graphs, recommendations or org charts, writing WITH RECURSIVE, Cypher MATCH, SPARQL or $lookup/$group pipelines, adding a field to existing documents, handling old documents missing a field, choosing polyglot persistence, or fighting N+1 queries and ORM mapping pain.
---

# Data Models and Query Languages

Pick the data model from the shape of the relationships: self-contained trees loaded as a whole fit documents; many-to-one and many-to-many references fit relational; data where anything may connect to anything, with variable-depth traversals, fits graphs. Prefer a declarative query language so the engine, not your code, chooses access paths.

## Classify the relationships first

| Relationship | Example | Natural model |
|---|---|---|
| One-to-many, owned, read together | profile -> positions, education, contacts; order -> line items | Document (embed) or JSON column |
| Many-to-one | many users -> one region, industry, company | Relational (foreign key + join) |
| Many-to-many, bounded depth | users <-> groups, products <-> tags | Relational join table |
| Many-to-many, variable-depth traversal, heterogeneous entities | social graph, location hierarchy, fraud rings, dependency graphs | Graph (property graph or triples) |

- Data tends to become more interconnected as features are added (free-text company names become company entities; recommendations reference other users). Model for the next likely feature, not only today's screen.
- One model can emulate another, but the emulation is usually awkward; that is why polyglot persistence (different stores for different jobs) is common.

## IDs vs duplicated text: normalization

- Store a reference (ID) when the value is meaningful to humans and may change, needs consistent spelling, needs disambiguation, needs translation, or supports hierarchical search (city within state).
- IDs carry no human meaning, so they never need to change; duplicated text must be updated everywhere it appears, which costs writes and risks inconsistency.
- Rule of thumb: if a value that could live in one place is copied into many records, the schema is not normalized. Denormalize only on purpose (read performance, derived views) and name the code that keeps copies in sync.

## Relational vs document

| Concern | Document favors | Relational favors |
|---|---|---|
| Tree-shaped data read whole | One read, good locality, no shredding into many tables | Multiple queries or a multi-way join |
| Many-to-one / many-to-many | Joins weak or emulated in app code (N+1, slower, more code) | Joins in the engine, optimizer picks the plan |
| Referencing a nested item | Positional paths ("2nd position of user 251") | Every row addressable by key |
| Schema enforcement | Schema-on-read (implicit, in code) | Schema-on-write (explicit, enforced) |
| Heterogeneous items | Natural | Many tables or sparse columns |

- Shredding a document-like structure into many tables can make schemas and code needlessly complex; embedding many-to-many data makes code complex and slow. Let the relationship shape decide.
- ORMs reduce translation boilerplate but cannot hide the model mismatch; watch for N+1 query patterns and lazy-loading surprises.
- Document locality only pays when you read most of the document. The engine usually loads and rewrites the whole document on update, so keep documents small and avoid writes that grow them (unbounded arrays of comments, events or logs belong in their own collection/table).
- Locality is not exclusive to documents: interleaved tables (Spanner), multi-table clusters (Oracle) and column families (Bigtable, HBase, Cassandra) give relational-style schemas similar grouping.

### Convergence: use the hybrid

Relational engines store and index documents (PostgreSQL `jsonb`, also JSON in MySQL, SQL Server, Oracle, DB2); document stores add joins. Often the right answer is a relational table with a JSON column for the self-contained part:

```sql
CREATE TABLE users (
  user_id     bigint PRIMARY KEY,
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  region_id   text REFERENCES regions (region_id),   -- many-to-one: reference
  industry_id int  REFERENCES industries (industry_id),
  profile     jsonb NOT NULL DEFAULT '{}'            -- positions, education, contacts: tree
);
CREATE INDEX users_profile_gin ON users USING gin (profile jsonb_path_ops);

SELECT user_id FROM users WHERE profile @> '{"positions": [{"organization": "Acme"}]}';
```

Current note: PostgreSQL added binary `jsonb` with GIN indexing in 9.4 (after the plain `json` type in 9.2/9.3 cited in the book). MongoDB supports server-side joins with `$lookup` (3.2+), multi-document ACID transactions (4.0+) and optional `$jsonSchema` validation (3.6+), so "documents cannot join or validate" is no longer strictly true, though joins remain less central than in SQL.

## Schema-on-read vs schema-on-write

"Schemaless" is misleading: readers still assume a structure. The real choice is where it is enforced.

- Schema-on-write (like static typing): the database rejects nonconforming data; change via migration.
- Schema-on-read (like dynamic typing): data is interpreted when read; change by writing the new shape and handling old shapes in code.
- Schema-on-read fits heterogeneous data (many object types, or structure dictated by external systems that change). When all records share a structure, an enforced schema documents and protects it.

Changing a field in each style:

```ts
// Schema-on-read: tolerate old documents at read time.
function normalizeUser(doc: { name?: string; firstName?: string }) {
  if (doc.name && !doc.firstName) doc.firstName = doc.name.split(" ")[0];
  return doc;
}
```

```sql
-- Schema-on-write: additive, nullable column first (fast in most engines).
ALTER TABLE customers ADD COLUMN given_name text;
-- Backfill in batches, not one giant UPDATE, on large tables:
UPDATE customers SET given_name = split_part(full_name, ' ', 1)
WHERE given_name IS NULL AND customer_id BETWEEN $1 AND $2;
```

- Adding a nullable column is usually a metadata change; rewriting every row is slow on any engine. Alternatively leave the new column NULL and fill it lazily at read time.
- Current note: MySQL 5.6+ performs many ALTERs online and 8.0 adds instant ADD COLUMN; PostgreSQL 11+ adds a column with a constant default without rewriting the table. Verify the exact behavior for your engine and version before relying on it.
- Migrations and backfills touch production data: confirm the target environment, get approval, run on a copy first, batch the backfill, and keep a revert plan (the column can be dropped; overwritten values cannot be recovered without a backup).

## Declarative vs imperative queries

- Declarative (SQL, Cypher, SPARQL, CSS selectors): state the pattern of results; the optimizer picks indexes, join order and parallelism. New indexes speed up existing queries with no code change, and the engine may reorganize storage freely because no ordering was promised.
- Imperative (loops over records, CODASYL-style access paths, DOM walking): fixes the algorithm and order, is hard to parallelize, and must be rewritten when access paths change.
- Push filtering, grouping and aggregation into the query; do not fetch rows and loop in application code.

### MapReduce and aggregation pipelines

MapReduce sits between the two: you supply pure `map` and `reduce` functions (no side effects, no extra queries), so the engine can run them anywhere, in any order, and retry on failure. Two coordinated functions are harder to write and optimize than one declarative query, which is why document stores grew declarative pipelines:

```js
db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: {
      _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
      revenueCents: { $sum: "$totalCents" } } }
]);
```

Current note: MongoDB deprecated its `mapReduce` command in 5.0 in favor of aggregation pipelines; prefer pipelines for new code.

## Graph models

**Property graph** (Neo4j and similar): vertices and edges each have an ID and key-value properties; edges have a label, a tail and a head vertex. Any vertex may link to any other; traversals go both directions; labels keep many relationship kinds in one clean graph. Good for evolvability and irregular data (different regional hierarchies per country, varying granularity).

Relational representation, if you must stay in SQL:

```sql
CREATE TABLE vertices (vertex_id bigint PRIMARY KEY, properties jsonb);
CREATE TABLE edges (
  edge_id     bigint PRIMARY KEY,
  tail_vertex bigint NOT NULL REFERENCES vertices,
  head_vertex bigint NOT NULL REFERENCES vertices,
  label       text   NOT NULL,
  properties  jsonb
);
CREATE INDEX edges_tail ON edges (tail_vertex, label);
CREATE INDEX edges_head ON edges (head_vertex, label);   -- traverse backwards too
```

Variable-depth traversal (people who report, at any depth, to the CTO and work at a site located within Brazil):

```cypher
MATCH (e:Employee)-[:REPORTS_TO*1..]->(:Employee {title:'CTO'}),
      (e)-[:WORKS_AT]->()-[:PART_OF*0..]->(:Region {name:'Brazil'})
RETURN e.name
```

```sql
WITH RECURSIVE in_brazil(vertex_id) AS (
  SELECT vertex_id FROM vertices WHERE properties->>'name' = 'Brazil'
  UNION
  SELECT e.tail_vertex FROM edges e JOIN in_brazil b ON e.head_vertex = b.vertex_id
  WHERE e.label = 'part_of'
)
SELECT * FROM in_brazil;   -- repeat for the reports_to chain, then join works_at edges
```

The SQL works (recursive CTEs since SQL:1999) but is several times longer; if most queries look like this, a graph model is the better fit.

**Triple-store** (subject, predicate, object), e.g. RDF with SPARQL: the object is either a literal (a property) or another vertex (an edge). URIs as predicates namespace vocabularies so datasets can be merged. Useful internally even without any semantic-web ambitions.

```sparql
PREFIX : <urn:example:>
SELECT ?name WHERE {
  ?e :name ?name .
  ?e :reportsTo+ / :title "CTO" .
  ?e :worksAt / :partOf* / :name "Brazil" .
}
```

**Datalog** (Datomic and others): facts as `predicate(subject, object)` plus named rules that derive new predicates, including recursive ones. Rules compose and are reused across queries; better for complex logic than one-off lookups.

Graph databases are not CODASYL again: no fixed nesting schema, direct access by ID or property index, no imposed ordering of children, and declarative query languages.

Current note: ISO published GQL (2024) as a standard graph query language, and SQL:2023 added property-graph queries (SQL/PGQ); support varies by engine. Titan, named in the book, is discontinued (JanusGraph is its successor).

## Workflow

1. List entities and classify each relationship (one-to-many owned, many-to-one, many-to-many, variable-depth).
2. Identify the dominant read patterns: whole-tree reads, cross-entity joins, or traversals of unknown depth.
3. Choose the model: relational by default; embed tree-shaped owned data (document store or JSON column); move to a graph model when variable-depth traversals over heterogeneous data dominate.
4. Decide references vs duplication per field; for every deliberate duplicate, name the code or pipeline that keeps it consistent.
5. Decide where the schema is enforced; if schema-on-read, centralize read-time normalization of old shapes in one function.
6. Write the key queries declaratively in the chosen language; check that indexes exist for each filter and both traversal directions.
7. Bound document size and nested arrays; move growing collections into their own table or collection.
8. For schema changes on live data: additive change first, batched backfill, readers tolerant of both shapes, then constraints; confirm environment, get approval and keep a revert plan.

## Red flags

- Choosing "NoSQL" or "SQL" by fashion rather than by relationship shape.
- Many-to-many data embedded in documents, with application code emulating joins in loops (N+1).
- Human-meaningful values (company, city, category names) copied into every record with no sync mechanism.
- Unbounded arrays inside a document, or documents rewritten on every small update.
- A document store called "schemaless" with no code that handles older document shapes.
- A single giant `UPDATE` backfill on a large production table, or a migration run without approval and a rollback plan.
- Filtering, grouping or graph traversal done imperatively in application code instead of in the query.
- Graph data in SQL with an index on only one edge direction.
- Recursive traversals that dominate the workload, hand-rolled as repeated round trips.
- New MapReduce code in a store that offers a declarative aggregation pipeline.

## Related

- `../ReliableScalableMaintainable/reliableScalableMaintainable.md` — simplicity and evolvability goals that the model choice serves.
- `../StorageAndRetrieval/storageAndRetrieval.md` — how each model is laid out on disk and indexed.
- `../EncodingAndEvolution/encodingAndEvolution.md` — schema evolution and compatibility for stored and transmitted data.
- `../../DistributedData/Transactions/transactions.md` — multi-object writes needed when data is normalized or denormalized.
- `../../DerivedData/BatchProcessing/batchProcessing.md` — MapReduce and its successors at scale.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — keeping denormalized copies in sync from a source of truth.
- `../../../DBA/PostgreSQL/DataTypes/dataTypes.md` — `jsonb`, arrays and other types for hybrid models (when installed).
- `../../../DBA/PostgreSQL/TablesConstraintsIndexes/tablesConstraintsIndexes.md` — foreign keys and GIN indexes on JSON (when installed).
- `../../../DBA/PostgreSQL/SqlThePostgresWay/sqlThePostgresWay.md` — recursive CTEs and JSON operators (when installed).
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects vs data structures behind the impedance mismatch (when installed).
