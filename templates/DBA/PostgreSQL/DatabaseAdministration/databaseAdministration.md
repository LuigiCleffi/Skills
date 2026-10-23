---
name: postgres-database-administration
description: Core PostgreSQL server administration - postgresql.conf, postgresql.auto.conf and ALTER SYSTEM, reload versus restart, pg_hba.conf authentication rules, cancelling and terminating sessions and query timeouts, login and group roles with SET ROLE, creating databases from templates, schemas and search_path, GRANT, REVOKE and default privileges, installing extensions, backup and restore with pg_dump, pg_dumpall and pg_restore, tablespaces, and the mistakes that destroy clusters, based on Chapter 2 (Database Administration) of PostgreSQL: Up and Running, 3rd edition. Use when the agent edits postgresql.conf or pg_hba.conf, runs pg_reload_conf or pg_ctl, sees "no pg_hba.conf entry for host", "permission denied for schema" or "password authentication failed", must kill a runaway query (pg_cancel_backend, pg_terminate_backend), creates roles, databases or schemas, grants privileges, runs CREATE EXTENSION, takes or restores a backup, or the server will not start.
---

# Database Administration

Most administration is editing a small set of files and catalogs: configuration in `postgresql.conf`, access in `pg_hba.conf`, identity in roles, organization in databases and schemas, and safety in backups. For every change, know whether it needs a reload or a restart, verify it in a system view, and keep a way back.

## Safety rules for agents

- Confirm the server, database and environment (`SELECT inet_server_addr(), current_database();`) before any administrative change. Get explicit approval before touching production.
- Copy `pg_hba.conf` and `postgresql.conf` before editing; the back-out is restoring the copy and reloading.
- Restarts drop every connection. Schedule them and get approval.
- `pg_terminate_backend`, `DROP DATABASE`, `DROP ROLE`, `DROP SCHEMA ... CASCADE`, `pg_restore --clean`, superuser grants and `GRANT ... TO PUBLIC` all need explicit approval.
- Take (or confirm) a fresh backup before any restore over an existing database or any destructive DDL.
- Never write passwords into scripts, commands or chat. Use `~/.pgpass` (mode 0600), `PGPASSFILE` or a secrets manager; prompt with `\password` in psql.

## Configuration files

- `postgresql.conf`: memory, listening addresses, logging, everything server-wide.
- `postgresql.auto.conf`: written by `ALTER SYSTEM`; overrides `postgresql.conf`. Do not edit it by hand.
- `pg_hba.conf`: who may connect from where to what, and how they authenticate.
- `pg_ident.conf`: maps OS or certificate names to database roles.

```sql
SELECT name, setting FROM pg_settings WHERE category = 'File Locations';
```

### Reload or restart

- `context = 'postmaster'`: restart required. `sighup`: reload. `superuser`/`user`: can also be set with `ALTER DATABASE|ROLE|FUNCTION ... SET` or `SET` in a session.
- Reload: `SELECT pg_reload_conf();` or `pg_ctl reload -D <datadir>` or the service manager's reload.
- Restart: `pg_ctl restart -D <datadir>` or `systemctl restart <service>`. There is no SQL command to restart.
- After a change, check that it applied:

```sql
SELECT name, setting, unit, context, pending_restart FROM pg_settings WHERE name = 'shared_buffers';
SELECT name, sourcefile, setting, applied, error FROM pg_file_settings WHERE NOT applied OR error IS NOT NULL;
SHOW shared_buffers;   -- SHOW prints human units
```

- `pg_settings.unit` varies (8kB blocks, kB, ms). When setting, always write units: `'256MB'`, `'30s'`.
- `ALTER SYSTEM SET work_mem = '64MB';` then reload; `ALTER SYSTEM RESET work_mem;` to undo.

### Settings that matter first

- Connectivity (restart): `listen_addresses` (default `localhost`), `port` (5432), `max_connections`.
- Logging: `logging_collector = on`, `log_destination` (format: `stderr`, `csvlog`), `log_directory`.
- Memory: `shared_buffers` (restart; start near 25% of RAM, gains flatten past several GB), `effective_cache_size` (planner hint only, about half of RAM on a dedicated host), `work_mem` (per sort or hash operation per query, so keep it modest globally and raise per role or function), `maintenance_work_mem` (vacuum and index builds, about 1 GB max).
- Parallelism: `max_parallel_workers_per_gather` (default 2 since 10), bounded by `max_parallel_workers` and `max_worker_processes`.

If the server will not start after an edit: read the newest file in the log directory (`log` under the data directory since 10, `pg_log` before). Typical causes are a typo, `shared_buffers` too large, the port already in use, or a stale `postmaster.pid` after a crash (remove it only after confirming no postgres process is running).

## pg_hba.conf

```
# TYPE   DATABASE  USER       ADDRESS          METHOD
local    all       postgres                    peer
host     app_db    app_user   10.0.5.0/24      scram-sha-256
hostssl  all       all        0.0.0.0/0        scram-sha-256
host     all       all        0.0.0.0/0        reject
```

- Rules are read top to bottom; the first rule that matches type, database, user and address decides. No match means rejection. Order specific rules before broad ones.
- Methods: `trust` (no password, local single-user only), `peer` (local OS user name), `ident` (via `pg_ident.conf`), `md5`/`scram-sha-256` (hashed password), `password` (clear text, avoid), `cert` (client certificate), `reject`; also `ldap`, `gss`, `radius`, `pam`.
- `hostssl` needs `ssl = on` with `ssl_cert_file` and `ssl_key_file`. An IPv6 line on a host without IPv6 can stop the file loading.
- Reload after editing, then check: `SELECT * FROM pg_hba_file_rules WHERE error IS NOT NULL;` (10+).
- Passing pg_hba.conf only admits the connection; the role still needs `CONNECT` on the database and privileges on objects.

Version note: since 14, `password_encryption` defaults to `scram-sha-256`; prefer it over `md5` for new roles and rules.

## Managing connections

```sql
SELECT pid, usename, datname, state, wait_event_type, wait_event,
       now() - query_start AS running_for, left(query, 80) AS query
FROM pg_stat_activity
WHERE pid <> pg_backend_pid() AND state <> 'idle'
ORDER BY running_for DESC;
```

- `pg_cancel_backend(pid)` cancels the current query; the session stays.
- `pg_terminate_backend(pid)` ends the session and rolls back its transaction. Requires approval; prefer cancel first and notify the owner.
- Before a restore or `DROP DATABASE`, terminate sessions on that database and block reconnection (`ALTER DATABASE db ALLOW_CONNECTIONS false;` or a pg_hba rule), or clients reconnect immediately.
- Blocked queries: `wait_event IS NOT NULL` (9.6+); `pg_blocking_pids(pid)` names the blocker.
- Guards (0 disables): `statement_timeout`, `lock_timeout` (keep below `statement_timeout`), `idle_in_transaction_session_timeout` (9.6+), `deadlock_timeout` (wait before deadlock check). Set them per role, database or function rather than globally.
- In application SQL, `SELECT ... FOR UPDATE NOWAIT` fails fast and `FOR UPDATE SKIP LOCKED` (9.5+) skips locked rows (work queues).

## Roles

Users and groups are both roles. `CREATE USER` equals `CREATE ROLE ... LOGIN`; prefer `CREATE ROLE` for clarity.

```sql
CREATE ROLE app_readers NOLOGIN INHERIT;
CREATE ROLE report_user LOGIN VALID UNTIL '2027-01-01' IN ROLE app_readers;
\password report_user
```

- Login roles authenticate; group roles (`NOLOGIN`) carry privileges. Add members with `GRANT app_readers TO report_user;`.
- `INHERIT` (default) passes the group's object privileges to members. Attributes such as `SUPERUSER`, `CREATEDB`, `CREATEROLE` are never inherited; a member gets them only through `SET ROLE group;` for the session.
- `SET ROLE` changes `current_user` only and is allowed for roles you belong to. `SET SESSION AUTHORIZATION` changes `session_user` too and needs a superuser login. Check with `SELECT session_user, current_user;`.
- Grant `SUPERUSER` almost never; membership in a superuser group lets a member escalate. Inspect with `\du` and `pg_roles`.

## Databases and templates

```sql
CREATE ROLE app_owner LOGIN;
CREATE DATABASE app_db OWNER app_owner TEMPLATE template0 ENCODING 'UTF8';
```

- `CREATE DATABASE` copies `template1` by default. Never modify `template0`; customize `template1` or your own template.
- To choose a different encoding or collation, copy from `template0`.
- Any database can serve as a template (it must have no active connections); `ALTER DATABASE db IS_TEMPLATE true;` marks one.

## Schemas and search_path

```sql
CREATE SCHEMA billing AUTHORIZATION app_owner;
ALTER DATABASE app_db SET search_path = "$user", public, ext;
```

- Group objects by domain (billing, hr) or by tenant; names are unique only within a schema.
- `search_path` decides where unqualified names resolve and where new objects land. The default `"$user", public` lets a schema named after each role shadow `public`, so per-tenant schemas can share identical SQL.
- `ALTER DATABASE/ROLE ... SET search_path` affects new sessions only; reconnect to see it.
- Schema-qualify names in DDL, migrations and security-definer functions.

## Privileges

```sql
GRANT CONNECT ON DATABASE app_db TO app_readers;
GRANT USAGE ON SCHEMA billing TO app_readers;
GRANT SELECT ON ALL TABLES IN SCHEMA billing TO app_readers;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA billing
  GRANT SELECT ON TABLES TO app_readers;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA billing FROM PUBLIC;
```

- Object access needs `USAGE` on the schema as well as the object privilege; missing `USAGE` gives "permission denied for schema".
- `ALL TABLES IN SCHEMA` covers existing tables, views and foreign tables only. Default privileges cover future objects created by the named role, and do not change existing ones.
- `PUBLIC` by default has `CONNECT` and `TEMP` on databases and `EXECUTE` on functions. Revoke where needed.
- Owners keep all rights, and `ALTER`/`DROP` cannot be granted away; owning a database does not give access to objects other roles create in it.
- Inspect: `\dp`, `\ddp`, `\dn+`, `information_schema.role_table_grants`.

Version note: since 15, `PUBLIC` no longer has `CREATE` on the `public` schema in new databases; grant it explicitly if needed.

## Extensions

- Two steps: install the package on the server (OS packages such as `postgresql-contrib`, or files in `share/extension`), then `CREATE EXTENSION name SCHEMA ext;` in each database that needs it.
- C extensions require a superuser (or a trusted-extension setup).
- List: `SELECT name, default_version, installed_version FROM pg_available_extensions ORDER BY name;`; contents: `\dx+ name`.
- Update with `ALTER EXTENSION name UPDATE;`. Drop unused ones (with approval; `CASCADE` drops dependents): each installed extension must exist on the target of a major upgrade.
- Common: `pg_trgm` (indexable `LIKE '%x%'`, `ILIKE`, regex), `fuzzystrmatch`, `hstore`, `pgcrypto`, `btree_gist`, `btree_gin`, `postgis`, `dblink`, `postgres_fdw`.

## Backup and restore

- `pg_dump`: one database, selectable objects, formats plain (`-Fp`), custom (`-Fc`), tar (`-Ft`), directory (`-Fd`, allows parallel `-j`).
- `pg_dumpall`: all databases as plain SQL, plus globals (roles, tablespaces). Use `--globals-only` daily, because `pg_dump` does not include roles.
- `pg_basebackup`: physical copy of the whole cluster, basis for replication and point-in-time recovery; prefer it for large clusters.

```bash
pg_dump -h db-host -U backup_user -Fc -f app_db.dump app_db
pg_dump -h db-host -U backup_user -Fd -j 4 -f app_db.dir app_db
pg_dump -h db-host -U backup_user -Fc -n billing -t 'billing.pay*' -f billing.dump app_db
pg_dumpall -h db-host -U postgres --globals-only -f globals.sql
```

- Useful switches: `-n/-N` include or exclude schemas, `-t/-T` tables, `-s` schema only, `-a` data only, `-C` include `CREATE DATABASE`, `--column-inserts` for portable inserts.
- Plain SQL dumps restore with psql: `psql -v ON_ERROR_STOP=1 -d target_db -f dump.sql`. Without `ON_ERROR_STOP`, psql continues past errors.
- Other formats restore with `pg_restore`:

```bash
pg_restore -l app_db.dump > toc.list            # inspect contents
pg_restore -d app_db_restore -j 4 app_db.dump   # into an existing empty database
pg_restore -d postgres --create -j 4 app_db.dump   # recreates the original database name
pg_restore -d app_db_new --section=pre-data app_db.dump   # structure only
```

- `-L toc.list` (an edited `-l` listing), `-t` or `-n` restore selected objects only.
- `--clean` drops existing objects before recreating them: destructive. Confirm the file and the target database, get approval, and back up the target first.
- Restore into a new database and swap names when possible, so the back-out is keeping the old one.
- Test restores regularly. For upgrades, dump with the newer version's `pg_dump`. Consider pgBackRest or Barman for scheduling and PITR.

## Tablespaces

```sql
CREATE TABLESPACE fast_ssd LOCATION '/mnt/ssd/pgdata';
ALTER TABLE billing.invoices SET TABLESPACE fast_ssd;
ALTER TABLESPACE pg_default MOVE ALL TO fast_ssd;
```

- The directory must exist, be empty and be owned by the postgres OS account. Moves rewrite and lock the objects: maintenance window and approval.

## Workflow

1. Confirm environment and target; get approval for production or destructive steps.
2. Back up the file or data you are about to change (`cp pg_hba.conf pg_hba.conf.bak`, `pg_dump`, `pg_dumpall --globals-only`).
3. Make the change with the narrowest scope (session, role, database before server).
4. Reload or restart according to `pg_settings.context`.
5. Verify: `pg_settings`, `pg_file_settings`, `pg_hba_file_rules`, `\du`, `\dp`, `\dx`, a test login with the intended role.
6. If verification fails, restore the backup copy, reload, and read the server log.

## Red flags

- `trust` on anything other than a local, single-user machine; `0.0.0.0/0` with a password method and no SSL.
- Broad allow rules above specific reject rules in `pg_hba.conf`.
- `GRANT ALL ... TO PUBLIC`, or application roles with `SUPERUSER`.
- Granting table privileges but forgetting `USAGE` on the schema, or expecting default privileges to fix existing tables.
- Terminating sessions or restoring with `--clean` without confirming the target.
- Only `pg_dump` backups, with no globals and no restore test.
- Plain-SQL restores without `ON_ERROR_STOP`.
- Deleting files in the data directory to free space: server logs are safe to purge, `pg_wal` (`pg_xlog` before 10) and `pg_xact` (`pg_clog` before 10) never are; archived WAL may be needed for PITR or replicas.
- The postgres OS account given administrator rights, `shared_buffers` near physical RAM, or antivirus scanning the data directory.
- Passwords in `PGPASSWORD` inside committed scripts or in `CREATE ROLE ... PASSWORD` lines in migrations.

## Related

- `../Basics/basics.md` — object hierarchy and terminology.
- `../Psql/psql.md` — running these commands and scripts from psql.
- `../PgAdmin/pgAdmin.md` — managing roles, privileges and backups from the GUI.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — using the memory settings to fix slow queries.
- `../ReplicationAndExternalData/replicationAndExternalData.md` — pg_basebackup, replication, FDWs.
- `../../Oracle/HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` — Oracle counterpart; do not apply its syntax here.
- `../../Oracle/SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — Oracle counterpart for users and grants; do not apply its syntax here.
- `../../Oracle/BeyondTheBasics/DataPump/dataPump.md` — Oracle counterpart for export and import; do not apply its syntax here.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — treating failed restores and config errors as first-class outcomes.
