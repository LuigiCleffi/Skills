---
name: dba-planning-applications
description: Planning an Oracle application around users' tasks, normalizing data to Third Normal Form, naming tables, columns and values in plain business language, avoiding codes and overloaded keys, and budgeting extra testing, based on Chapter 4 (Planning Oracle Applications—Approaches, Risks, and Standards) of Oracle Database 11g: The Complete Reference. Use when the user designs a new schema or data model, asks about normalization or naming conventions, reviews tables with cryptic abbreviations, repeating columns (phone1, phone2), smart or composite codes packed into one key, quoted mixed-case identifiers, or plans the testing of a database project.
---

# Planning Oracle Applications: Approaches, Risks, and Standards

A poor design hurts the application whatever SQL you write later. Build the design with the business users, start from the tasks they perform, normalize the data as analysis (not as the design itself), and name every table, column and value so a user could write the query.

## The main risk: it is easy

Relational tools let teams build fast, and fast building squeezes out testing. Plan a longer, more thorough test cycle than a traditional project: screens and reports, data loads and updates, integrity and concurrency, and transaction and storage volumes at peak load.

## Start from tasks, not data

- Write two converging documents with the users: a **task document** and a **data document**.
- Task document: a three-to-ten word active sentence describing the business ("We sell insurance."), then numbered major tasks (1.0, 2.0...) decomposed down to **atomic tasks**: units that are either completed or dropped, never left half-done.
- Ask for the reason behind every step. Weak answers ("we've always done it this way") go on a list for resolution; many such tasks turn out to be obsolete.
- Tasks that keep spanning several major tasks signal a wrong top-level breakdown or incomplete atomization.
- Data document: for each task, list the data the task actually needs, not the fields on today's form. Elements nobody can explain go on the resolution list.

## Normalize (analysis)

- **1NF**: remove repeating groups into their own tables; give each table a primary key. `author1, author2, author3` becomes a child table.
- **2NF**: move attributes that depend on only part of a composite key.
- **3NF**: every non-key column depends on the key, the whole key and nothing else. Reaching 3NF implies 1NF and 2NF.
- Model many-to-many relationships with an association table; the referenced primary key becomes a foreign key there.
- Keep reference rows (categories, ratings) even when nothing uses them yet.
- Normalization alone is not enough: also decompose mixed elements (full name into first and last name, address parts) as far as the application will actually use them, and no further.

```sql
create table book (title varchar2(100) primary key, publisher varchar2(50));
create table author (author_id number primary key, first_name varchar2(40), last_name varchar2(40));
create table book_author (
  title     varchar2(100) references book,
  author_id number        references author,
  primary key (title, author_id));
```

Then build atomic data models per task (keys, major columns, row counts, transaction rates), merge them into the business model, and trace each transaction's access path to confirm every required column is reachable and no insert breaks referential integrity. Only after that design screens (by task, not by table) and reports.

## Codes and overloaded keys

- Codes ("01" for receivables) were a workaround for expensive hardware. Store meaningful values; users make fewer entry errors and reports read without a code manual.
- A category with too many members to name usually means the category is too broad; split it.
- If codes must stay for performance, hide them from users behind views and lookups.
- An **overloaded ("intelligent") key** packs several facts into one value (region + catalog number + cost center). Add proper primary and foreign keys, keep the old value as a unique column for legacy lookups, steer users to the new keys, and retire the old column later.

## Naming standards

- Meaningful, memorable, descriptive English words. Clarity beats brevity; between two equally clear names, pick the shorter.
- **Singular** names for tables and columns (`customer`, `address`); exception only for terms the business already uses in plural, such as sales.
- No unexplained or inconsistent abbreviations; underscores used consistently or not at all.
- **Level-name integrity**: do not embed the owner in table names or the table name in column names (`cust_name` in `customer` should be `name`). Qualify with `owner.table` or `table.column` instead.
- When a foreign key collides with a local column name, choose one consistent remedy (prefix with the source table, rename one side).
- Let Oracle store identifiers in uppercase; do not create quoted mixed-case names, which then must be quoted forever.
- Keep data case consistent (the book stores most data in uppercase) and convert for display with functions.
- Name columns and their values together with users, and keep an application thesaurus of approved names and abbreviations.
- Reuse attribute definitions through types (for example an address type) only if defined carefully up front.

```sql
-- avoid: quoted identifiers make every later query case-sensitive
create table "OrderLine" ("qty" number);
-- prefer
create table order_line (quantity number);
```

## Workflow
1. Put users on the team; agree the one-sentence business description and the numbered task outline.
2. Decompose to atomic tasks; derive each task's data needs; list unresolved questions.
3. Replace codes with meaningful values; decompose overloaded keys and mixed elements.
4. Normalize to 3NF; draw atomic models with keys, volumes and rates; merge into the business model.
5. Agree names with users and record them in the thesaurus; check every name against the rules above.
6. Trace each transaction through the model; then design task-oriented screens and reports.
7. Plan an extended test phase covering integrity, concurrency and peak volumes.

## Red flags
- Repeating columns (`phone1..phone3`, `category1..category3`).
- Normalized diagram presented as the finished design.
- Cryptic or mixed abbreviations, plural and singular table names side by side, inconsistent underscores.
- Column names that repeat the table name, or table names that repeat the owner.
- Keys whose substrings carry meaning or drive joins.
- Quoted mixed-case identifiers.
- Schedules where testing shrinks because development was fast.

Version note: identifiers were limited to 30 characters through 12.1; from 12.2 they may be up to 128 bytes.

## Related
- `../ArchitectureOptions/architectureOptions.md` — choosing the physical structures after the design.
- `../../SqlAndSqlPlus/BasicSql/basicSql.md` — querying the tables you designed.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — creating tables, constraints and views.
- `../../ObjectRelational/ObjectTypes/objectTypes.md` — reusable attribute types such as addresses.
- `../../../../CleanCode/MeaningfulNames/namingRules.md` — the same naming discipline applied to code.
