---
name: postgres-basics
description: Orienting in PostgreSQL - when it fits and when it does not, the client tools (psql, pgAdmin, phpPgAdmin, Adminer), the object hierarchy (cluster, database, schema, table, view, extension, function, language, operator, type, cast, sequence, foreign table, trigger, catalog, full text search objects), GUC settings, the version and upgrade policy, and the language drivers, based on Chapter 1 (The Basics) of PostgreSQL: Up and Running, 3rd edition. Use when the agent starts work on an unfamiliar PostgreSQL database, must map Oracle or SQL Server concepts to PostgreSQL terms, needs to know which object type solves a problem, asks "which version am I on and should I upgrade", chooses a client tool or driver (JDBC, psycopg2, Npgsql, node-postgres), or meets terms such as GUC, pg_catalog, information_schema, CREATE EXTENSION or foreign data wrapper.
---

# The Basics

PostgreSQL is a relational database that is also an application platform: types, operators, functions in several languages, extensions and foreign tables are all first-class objects. Before changing anything, find out which server version you are on, which database and schema you are in, and which extensions are installed; then use the database's own features instead of rebuilding them in application code.

## When PostgreSQL fits, and when it does not

- Fits: transactional applications, analytics, geospatial (PostGIS), semi-structured data (`jsonb`, `hstore`), graph-like paths (`ltree`), heavy in-database logic.
- Poor fit: tiny embedded devices or simple caches (the install is over 100 MB), and single-user apps that handle all security themselves; SQLite or an embedded engine is lighter.
- Common pairing: PostgreSQL as the system of record, Redis or Memcached caching query results, SQLite for offline copies.
- Managed offerings (Amazon RDS and Aurora, Google Cloud SQL, Azure, Heroku) track community versions but may restrict superuser, extensions and file access. Check what the provider allows before planning a feature.

## Client tools

- **psql**: the command-line client shipped with every install. Scriptable, works over SSH, has `\copy` import/export and HTML output. Default choice for agents. See `../Psql/psql.md`.
- **pgAdmin**: free GUI with a tree browser of every object type; good for exploring privileges and server objects visually.
- **phpPgAdmin**: web UI in the style of phpMyAdmin, with PostgreSQL-specific objects (schemas, casts, languages).
- **Adminer**: one PHP file for several engines. No port field (append `:port` to the host), treats each schema as a database, and lacks role and privilege management. Fine for quick edits, not for DBA work.

Version note: pgAdmin 3 is retired; use pgAdmin 4 (desktop or web mode).

## The object hierarchy

A server (cluster) holds many databases; a database holds schemas; most objects belong to a schema. A session connects to one database at a time, so cross-database queries need a foreign data wrapper or `dblink`.

- **Database**: the unit you connect to. Every cluster has `postgres` plus the templates `template0` and `template1`.
- **Schema**: namespace inside a database. New databases get `public`. Split large designs into schemas; resolution of unqualified names follows `search_path`.
- **Table**: belongs to a schema. Tables can inherit from other tables, and every table automatically defines a composite type of the same name.
- **View**: a single-table view is updatable directly; a multi-table view needs an `INSTEAD OF` trigger. Materialized views (9.3+) cache results and need `REFRESH MATERIALIZED VIEW`.
- **Extension**: a packaged set of functions, types, operators, index methods and tables installed or removed as a unit, per database.
- **Function**: written in a procedural language; may return a scalar, array, row or set of rows.
- **Language**: SQL, PL/pgSQL and C are built in; PL/Python, PL/Perl, PL/V8, PL/R and others are added as extensions.
- **Operator**: a symbol bound to a function; you can define new ones for custom types.
- **Type**: built-in, composite, domain, enum or custom. Every type gets a companion array type automatically.
- **Cast**: conversion between types, implicit or explicit, backed by a function. Custom casts change behavior database-wide; add them sparingly.
- **Sequence**: generator behind `serial` columns; can be shared across tables to give a key unique across them.
- **Foreign table / foreign data wrapper (FDW)**: a table whose rows live elsewhere (another PostgreSQL, Oracle, SQL Server, CSV, web APIs), queried with ordinary SQL (SQL/MED).
- **Trigger and trigger function**: row- or statement-level, before, after or instead of an event, with `WHEN` conditions and `UPDATE OF col`. Event triggers (9.3+) fire on DDL.
- **Catalogs**: `pg_catalog` (system tables, views, built-in functions) and `information_schema` (ANSI-standard metadata views such as `tables`, `columns`, `views`).
- **Full text search objects**: configurations, dictionaries and parsers; the defaults cover most needs.
- **Rules**: a query-rewrite mechanism. Prefer triggers; do not introduce new rules.

Coming from Oracle:
- An Oracle "schema = user" does not hold here: roles and schemas are separate objects, and a schema is not created by creating a role.
- Unquoted identifiers fold to lower case, not upper case. `"Orders"` and `orders` are different tables.
- There is no `DUAL`; `SELECT 1;` or `SELECT now();` works without a `FROM`.
- An empty string `''` is not NULL.
- DDL is transactional: `CREATE TABLE` inside `BEGIN` can be rolled back, and DDL does not commit pending work.
- Extensions are roughly what Oracle packages and options are to an Oracle install, but you enable them per database.

Version note: the book says PostgreSQL has functions only; since 11, `CREATE PROCEDURE` plus `CALL` gives procedures that can commit or roll back inside their body.

## Extensions in brief

```sql
CREATE SCHEMA IF NOT EXISTS ext;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA ext;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder CASCADE;  -- installs dependencies (9.6+)
```

- Enable an extension only in the databases that need it.
- Put extensions in a dedicated schema instead of `public`, and add that schema to `search_path` if callers should not qualify names. Some extensions dictate their own schema.
- Check what is installed with `\dx` or `pg_extension`; what is available on the server with `pg_available_extensions`.
- Details: `../DatabaseAdministration/databaseAdministration.md`.

## Settings (GUC)

"GUC" (grand unified configuration) just means configuration settings. They can be set at server, database, role, session and function level, and the most specific level wins.

```sql
SHOW work_mem;
SELECT name, setting, unit, context, source FROM pg_settings WHERE name = 'work_mem';
SET work_mem = '64MB';                           -- this session only
```

## Versions and upgrades

```sql
SELECT version();
SHOW server_version;
```

- A new major version ships yearly. Since 10, the first number is the major version (10, 11, 12...); before 10, the first two numbers were (9.5, 9.6).
- Minor releases (for example 10.3 to 10.4) contain only fixes: replace binaries and restart. Apply them routinely.
- Major upgrades need `pg_dump`/restore, `pg_upgrade`, or logical replication, and every installed extension must exist for the new version.
- Versions past end of life get no security fixes. Check the community support policy and plan the upgrade.
- Feature landmarks the book highlights: 9.4 `jsonb`, `ALTER SYSTEM`, `WITH ORDINALITY`; 9.5 `INSERT ... ON CONFLICT`, `SKIP LOCKED`, row-level security, BRIN, `GROUPING SETS`; 9.6 parallel query, phrase search, `\gexec`; 10 declarative partitioning, logical replication, `IDENTITY` columns, `CREATE STATISTICS`, `XMLTABLE`.
- Check the feature matrix before assuming a feature exists on the target server.

## Drivers

- Java: PostgreSQL JDBC. .NET: Npgsql. Python: psycopg2 (Django and SQLAlchemy build on it). Ruby: `pg` gem. Node.js: node-postgres (`pg`). PHP: `pdo_pgsql`. Perl: DBD::Pg. ODBC driver for Office tools.
- Keep the driver current with the server so newer types and authentication methods work.
- Pass credentials through the driver's configuration, a `.pgpass` file or environment-based secrets, never hardcoded in code or chat.

## Forks and derivatives

Amazon Redshift, Greenplum, Netezza, EnterpriseDB Advanced Server, Citus (now an extension) and others derive from PostgreSQL. Syntax and features drift; confirm the actual engine and version before applying community-PostgreSQL advice.

## Workflow

1. Identify the engine and version (`SELECT version();`), hosting model (self-managed or managed) and the environment (dev, test, prod).
2. Identify the connection context: `SELECT current_database(), current_user, current_setting('search_path');`.
3. Inventory: `\dn` (schemas), `\dt *.*` (tables), `\dx` (extensions), `\df` (functions).
4. Map the problem to a PostgreSQL feature (type, extension, function, FDW, trigger) before writing application-side workarounds.
5. Check that the feature exists in the target version and is allowed by the hosting provider.
6. Make changes in a transaction where possible (DDL is transactional) and verify with catalog queries.

## Red flags

- Assuming Oracle behavior: uppercase identifiers, `''` as NULL, implicit commit after DDL, `DUAL`.
- Everything, including extension objects, dumped into `public`.
- Running an end-of-life major version, or skipping minor releases.
- Creating custom casts or operators that silently change existing queries.
- Using rules where a trigger fits.
- Credentials embedded in source code or connection strings checked into the repository.
- Advice for a fork (Redshift, Aurora) applied to community PostgreSQL or the reverse, without checking.

## Related

- `../DatabaseAdministration/databaseAdministration.md` — configuration files, roles, privileges, extensions, backup and restore.
- `../Psql/psql.md` — working in the command-line client.
- `../PgAdmin/pgAdmin.md` — the GUI tool.
- `../DataTypes/dataTypes.md` — built-in and custom types.
- `../TablesConstraintsIndexes/tablesConstraintsIndexes.md` — inheritance, partitioning, identity columns.
- `../WritingFunctions/writingFunctions.md` — functions and procedural languages.
- `../ReplicationAndExternalData/replicationAndExternalData.md` — FDWs and replication.
- `../../Oracle/CriticalConcepts/ArchitectureOptions/architectureOptions.md` — Oracle counterpart; do not apply its syntax here.
- `../../../CleanCode/Boundaries/boundaries.md` — keeping driver and database-specific code at the edges of the application.
