## AI Skills

Before writing SQL or functions for a PostgreSQL database, changing a
PostgreSQL schema, configuring the server, moving data, tuning, or setting
up replication, find the skills that apply to the task in the table below
and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of *PostgreSQL: Up and Running*, 3rd
edition, which targets PostgreSQL 10. Where behavior changed materially in
later releases, the skill carries a short version note. Check the server
version (`SELECT version();` or `SHOW server_version;`) before relying on
version-specific syntax.

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./Basics/basics.md` | Starting on an unfamiliar PostgreSQL database: object types, versions, client tools and drivers, mapping Oracle terms. |
| 2 | `./DatabaseAdministration/databaseAdministration.md` | Editing postgresql.conf or pg_hba.conf, killing sessions, roles, grants, schemas, extensions, pg_dump/pg_restore, or a server that won't start. |
| 3 | `./Psql/psql.md` | Running psql interactively or in scripts: \copy CSV import/export, \d inspection, \gexec, \watch, reports. |
| 4 | `./PgAdmin/pgAdmin.md` | Working in pgAdmin: connections, Grant Wizard, backup/restore or import/export dialogs, graphical explain, pgAgent jobs. |
| 5 | `./DataTypes/dataTypes.md` | Choosing column types or querying timestamptz, arrays, ranges, jsonb, xml, full-text search, custom composite types. |
| 6 | `./TablesConstraintsIndexes/tablesConstraintsIndexes.md` | CREATE/ALTER TABLE, identity keys, partitioning, foreign key/check/exclusion constraints, choosing and debugging indexes. |
| 7 | `./SqlThePostgresWay/sqlThePostgresWay.md` | PostgreSQL queries and DML: upserts, first row per group, running totals, recursive CTEs, LATERAL, materialized views. |
| 8 | `./WritingFunctions/writingFunctions.md` | CREATE FUNCTION, CREATE TRIGGER or CREATE AGGREGATE, porting Oracle procedures, volatility, SECURITY DEFINER, PL languages. |
| 9 | `./QueryPerformanceTuning/queryPerformanceTuning.md` | A query is slow, an index goes unused, a plan needs reading, or statistics, parallel query or pg_stat_statements are involved. |
| 10 | `./ReplicationAndExternalData/replicationAndExternalData.md` | Standbys, failover, logical publications and subscriptions, or querying remote servers and files through foreign data wrappers. |

The book's appendices (installation and the command-line option reference)
are not skills. Use the PostgreSQL documentation for the target release when
you need full syntax.

# Context for AI: Working on a PostgreSQL Database

## 1. Know Where You Are

Before running anything, confirm the server, database, role, and whether it
is production: `\conninfo`, or `SELECT current_user, current_database(),
inet_server_addr();`. Check `search_path` before assuming which schema an
unqualified name resolves to.

## 2. Read Before You Change

Inspect the catalog first (`\d`, `\dt+`, `\df`, `\du`, `information_schema`,
`pg_catalog`) to learn what exists: tables, constraints, indexes, functions,
dependent views, grants, extensions.

## 3. PostgreSQL Is Not Oracle

Do not carry Oracle habits over unchecked. An empty string is not NULL.
Unquoted identifiers fold to lower case. DDL is transactional, so it can be
rolled back inside a transaction. There is no DUAL; `SELECT` works without
`FROM`. When the project also uses Oracle, read `../Oracle/README.md` only
for the Oracle side.

## 4. Destructive and Hard-to-Reverse Operations

DROP, TRUNCATE, `DROP DATABASE`, `pg_restore --clean`, `pg_terminate_backend`,
`VACUUM FULL`, configuration changes that need a restart, `pg_hba.conf`
edits, role and privilege grants, and promoting a standby need explicit
approval for the specific target before they run. State what will change,
how to verify it, and how to back out. Never put passwords in scripts, logs,
or chat; use `.pgpass` or environment-based authentication.

## 5. Write SQL That Survives Production

- Use parameters (`$1`, bind variables in the driver), never concatenated
  user input.
- Wrap risky changes in `BEGIN ... COMMIT` and check the result before
  committing; psql autocommits by default.
- Prefer `CREATE INDEX CONCURRENTLY` and `NOT VALID` constraints on busy
  tables, and know which `ALTER TABLE` forms rewrite the table.
- Read `EXPLAIN (ANALYZE, BUFFERS)` before claiming a query is fast, and only
  on statements that are safe to execute.

## 6. Report Honestly

Say which statements were run, against which database, and what was
observed. Distinguish what was executed from what was only written.
