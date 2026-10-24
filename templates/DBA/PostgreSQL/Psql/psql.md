---
name: postgres-psql
description: "Using psql, the PostgreSQL command-line client, interactively and in scripts - connection environment variables and .pgpass, -c and -f with ON_ERROR_STOP, psqlrc customization, informative prompts, \\timing, AUTOCOMMIT, variables and shortcuts, history, \\! shell escapes, \\watch, describe commands (\\d, \\dt+, \\df, \\dn, \\du, \\dx), \\crosstabview, \\gexec dynamic SQL, \\copy import and export (CSV, delimiters, NULL, HEADER, FROM PROGRAM) versus server-side COPY, and HTML reports, based on Chapter 3 (psql) of PostgreSQL: Up and Running, 3rd edition. Use when the agent runs psql commands or scripts, automates SQL from a shell or cron, loads or exports CSV, sees \"could not open file ... for reading\" from COPY, needs to inspect tables or functions from the command line, wants to pivot output, generate and run SQL, monitor a query repeatedly, or produce a quick report."
---

# psql

psql is the client every PostgreSQL install includes and the one an agent should reach for first: it runs SQL and backslash meta-commands, interactively or from files, and can import, export and format data. Make every psql session self-identifying (who, where, which database), make scripts stop on the first error, and remember that autocommit is on by default.

## Safety rules for agents

- Before running anything, confirm the target: `\conninfo` or `SELECT current_user, inet_server_addr(), current_database();`. Use a prompt that shows user, host, port and database.
- psql autocommits each statement by default. For risky data changes, wrap the work in `BEGIN; ... ;` and inspect before `COMMIT`, or `\set AUTOCOMMIT off` for the session. With autocommit off, uncommitted work is rolled back when psql exits.
- Scripts must use `-v ON_ERROR_STOP=1`; otherwise psql continues past failures and reports success.
- Use `--single-transaction` (`-1`) to make a whole script all or nothing.
- Review generated SQL before `\gexec` runs it; it executes whatever the query returns.
- `\!` and `\copy ... PROGRAM` run shell commands on the client; server `COPY ... PROGRAM` runs them on the server as the postgres OS user. Treat both as command execution requiring approval.
- No passwords on the command line, in scripts or in chat. Use `~/.pgpass` (mode 0600) or `PGPASSFILE`; avoid exporting `PGPASSWORD` except in a throwaway, non-logged environment.

## Connecting

```bash
export PGHOST=db-host PGPORT=5432 PGUSER=app_user PGDATABASE=app_db
psql                                  # uses the variables above
psql "host=db-host dbname=app_db user=app_user sslmode=require"
```

- `~/.pgpass` lines: `host:port:database:user:password`; `*` matches anything. psql ignores the file if permissions are too open.
- Inside psql: `\c other_db` (or `\connect db user host port`) switches databases; `\conninfo` shows the current connection.
- `PSQLRC` points to a custom startup file; `PSQL_HISTORY` to a custom history file.

## Interactive and noninteractive use

- Statements end with `;`; Enter without one continues the statement. Meta-commands start with `\` and end at the line end.
- `\?` lists meta-commands; `\h CREATE INDEX` shows SQL syntax help.
- One-off: `psql -d app_db -c "SELECT count(*) FROM billing.invoices;"`. Several `-c` options run in order.
- Script: `psql -d app_db -v ON_ERROR_STOP=1 -f migrate.sql`. Inside psql, `\i file.sql` runs a file (`\ir` resolves relative to the current script).
- Useful output switches for scripts: `-A` (unaligned), `-t` (tuples only), `-F ','` (field separator), `-X` (skip psqlrc, for reproducible automation), `-q` (quiet).
- Pass values in with `-v name=value` and reference them as `:name`, `:'name'` (quoted literal) or `:"name"` (quoted identifier).
- Schedule scripts with cron, systemd timers, pgAgent or the OS scheduler.

```bash
psql -X -A -t -v ON_ERROR_STOP=1 -v since='2026-01-01' -d app_db \
  -c "SELECT count(*) FROM billing.invoices WHERE issued_on >= :'since';"
```

## psqlrc customization

`~/.psqlrc` on Unix, `%APPDATA%\postgresql\psqlrc.conf` on Windows. Each command on a single line.

```
\set PROMPT1 '%n@%M:%>%x %/%R%# '
\pset null '(null)'
\timing on
\set HISTSIZE 5000
\set HISTFILE ~/.psql_history- :DBNAME
\set active 'SELECT pid, usename, state, left(query, 80) FROM pg_stat_activity WHERE state <> ''idle'';'
```

- Prompt codes: `%n` user, `%M` host, `%>` port, `%/` database, `%x` transaction status (`*` in a transaction, `!` failed transaction).
- `\pset null` makes NULL visible, distinct from an empty string.
- `\timing on` prints elapsed time after each statement.
- `\set name 'text'` stores a shortcut; type `:name` to expand it. Use lowercase for your variables; uppercase names are psql's own (`AUTOCOMMIT`, `ON_ERROR_STOP`, `PROMPT1`, `HISTSIZE`).
- `\unset name` removes a variable. Start with `psql -X` to bypass the file.
- Use forward slashes in paths on every OS.

## Gems

- `\! ls -l` runs a shell command without leaving psql.
- `\watch 5` re-runs the last query every 5 seconds (9.3+); stop with Ctrl-C. Good for watching `pg_stat_activity` or a progress view.
- `\x auto` switches to expanded (one column per line) output for wide rows.
- `\e` opens the query buffer in `$EDITOR`; `\ef func_name` edits a function definition.
- `\if`, `\elif`, `\else`, `\endif` (10+) give conditional logic in scripts; `\gset` stores a query's columns into variables.

```sql
SELECT pid, now() - query_start AS running_for, left(query, 60) AS query
FROM pg_stat_activity
WHERE state = 'active' AND pid <> pg_backend_pid()
\watch 10
```

## Describing objects

- `\l` databases, `\dn` schemas, `\dt schema.*` tables, `\dv` views, `\dm` materialized views, `\di` indexes, `\ds` sequences, `\df` functions, `\dT` types, `\dx` extensions, `\du` roles, `\dp` privileges, `\ddp` default privileges, `\dconfig` settings (15+).
- `+` adds detail (size, description, storage): `\dt+ billing.*`, `\d+ billing.invoices`.
- Patterns take wildcards: `\dt *.pay*`.
- `\sf func_name` prints a function's source; `\sv view_name` a view's.
- `psql -E` (or `\set ECHO_HIDDEN on`) shows the catalog queries behind each `\d` command; reuse them in scripts.

## Crosstabs with \crosstabview

```sql
SELECT region, product, sum(amount) AS total
FROM sales.orders
GROUP BY region, product
ORDER BY region, product
\crosstabview region product total
```

- Runs instead of `;`. Column 1 becomes row headers, column 2 column headers, column 3 cell values; an optional fourth argument sorts the header columns.
- Without arguments the query must return exactly three columns in that order. Missing pairs show as empty cells.
- psql-only (9.6+); for SQL-level pivots use `tablefunc` `crosstab()` or `FILTER` aggregates.

## Dynamic SQL with \gexec

```sql
SELECT format('ANALYZE %I.%I', schemaname, tablename)
FROM pg_tables
WHERE schemaname = 'billing'
\gexec
```

- Each non-null cell of the result is executed as a statement, row by row, then column by column (9.6+).
- It does not validate statements or stop on errors unless `ON_ERROR_STOP` is set. Run the query with `;` first to review the statements.
- Build identifiers with `format('%I')` or `quote_ident`, and literals with `%L` or `quote_literal`, never by bare concatenation.

## Import and export with \copy

```sql
CREATE TABLE staging.customers_raw (id text, name text, email text, signup_date text);
\copy staging.customers_raw FROM 'customers.csv' WITH (FORMAT csv, HEADER true)
\copy staging.customers_raw FROM 'customers.txt' WITH (DELIMITER '|', NULL '')
\copy (SELECT id, email FROM staging.customers_raw WHERE email LIKE '%@%') TO 'emails.csv' WITH (FORMAT csv, HEADER true, FORCE_QUOTE *)
```

- `\copy` reads and writes files on the client machine with the client user's permissions. SQL `COPY` reads and writes files on the database server as the postgres OS account and needs superuser or the `pg_read_server_files`/`pg_write_server_files` roles (11+). "could not open file" from `COPY` usually means the path is on the wrong machine; switch to `\copy`.
- Default format is tab-delimited text; use `FORMAT csv` for CSV. `HEADER` applies to CSV.
- The target table must already exist with matching column count. For unfamiliar files, load into a staging table with `text` columns, inspect, then cast into the real tables.
- Each `\copy` is one transaction: one bad row aborts the whole load.
- `\cd dir` changes psql's working directory for relative paths.
- `\copy tbl FROM PROGRAM 'cmd'` reads a command's output (9.3+); this is command execution, so get approval.
- Verify after loading: compare `SELECT count(*)` with the file's line count (minus header) and spot-check values.

## Reports

- `psql -H -c "query" -o report.html` writes an HTML table.
- In a script: `\o file` redirects output, `\o` alone stops it; `\qecho` writes literal text into the output; `\pset format html|aligned|unaligned|csv`; `\T` sets HTML table attributes; `\t on` hides headers and row counts; `\H` toggles HTML.
- Combine several queries and `\qecho` lines in one `.psql` file to build a multi-section report, then schedule it.

Version note: `\pset format csv` and `psql --csv` exist since 12, the simplest way to get correct CSV output from a query.

## Workflow

1. Connect with environment variables or a connection string plus `.pgpass`; confirm the target with `\conninfo`.
2. Explore with `\dn`, `\dt+`, `\d+ table`, `\df`; use `-E` to learn the catalog queries.
3. For changes, open a transaction (`BEGIN;`), run, inspect counts and rows, then `COMMIT;` or `ROLLBACK;`.
4. For automation, write a `.sql` or `.psql` file and run it with `psql -X -v ON_ERROR_STOP=1 -1 -f file`; check the exit status (non-zero on failure).
5. For data movement, use `\copy` into staging tables, verify counts, then transform.
6. For generated SQL, review output with `;` before switching to `\gexec`.

## Red flags

- Scripts without `ON_ERROR_STOP`, or shell pipelines that ignore psql's exit code.
- Destructive statements typed at an autocommit prompt with no `BEGIN`.
- A prompt that does not show the host and database while working across environments.
- Passwords in `-c` strings, shell history, scripts or `PGPASSWORD` in committed files.
- Server-side `COPY` with client paths, or `COPY ... PROGRAM` run without approval.
- `\gexec` run on unreviewed output or on SQL built by concatenating unquoted names.
- Loading straight into production tables instead of a staging table.
- Relying on psqlrc settings in automation instead of `-X` plus explicit options.

## Related

- `../Basics/basics.md` — object types the describe commands list.
- `../DatabaseAdministration/databaseAdministration.md` — roles, privileges, pg_hba.conf, pg_dump and pg_restore used from psql.
- `../PgAdmin/pgAdmin.md` — the GUI alternative.
- `../SqlThePostgresWay/sqlThePostgresWay.md` — SQL features to run in psql.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — EXPLAIN ANALYZE and `\timing` for tuning.
- `../../Oracle/SqlAndSqlPlus/SqlPlusReports/sqlPlusReports.md` — Oracle counterpart (SQL*Plus); do not apply its syntax here.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — failing fast in scripts instead of continuing past errors.
