## AI Skills

Before working on a database, identify which database engine the project
uses and read only that engine's entry point. SQL dialects, tooling,
administration commands, and data dictionary views differ between engines;
do not apply one engine's skills to the other.

| Engine | Entry point | Use when |
|---|---|---|
| Oracle | `./Oracle/README.md` | The project connects to Oracle Database (SQL*Plus, PL/SQL, `v$`/`dba_` views, Data Pump, RMAN). |
| PostgreSQL | `./PostgreSQL/README.md` | The project connects to PostgreSQL (psql, PL/pgSQL, `pg_catalog`/`pg_stat_*` views, pg_dump, `postgresql.conf`). |

## Identifying the engine

Check connection strings, drivers and configuration before choosing: for
example `oracle.jdbc`, `cx_Oracle`/`oracledb`, a TNS name or `sqlplus` in
scripts point to Oracle; `postgresql://` URLs, `org.postgresql`, `psycopg`,
`pg`/`node-postgres`, port 5432 or `psql` in scripts point to PostgreSQL. When the project uses more than one engine, read the
entry point for the engine the task touches. When it is unclear, ask before
writing engine-specific SQL.
