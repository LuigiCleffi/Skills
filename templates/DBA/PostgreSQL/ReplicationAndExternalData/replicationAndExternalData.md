---
name: postgres-replication-and-external-data
description: "How to replicate PostgreSQL (WAL streaming replicas, synchronous vs asynchronous, replication slots, cascading, promotion, logical replication with publications and subscriptions) and how to query external data through foreign data wrappers (postgres_fdw, file_fdw, ogr_fdw and others), based on Chapter 10 (Replication and External Data) of PostgreSQL: Up and Running, 3rd edition. Use when the user wants a standby or read replica, failover, pg_basebackup, wal_level, max_wal_senders, primary_conninfo, recovery.conf or standby.signal, synchronous_standby_names, replication lag or a slot filling the disk, CREATE PUBLICATION or CREATE SUBSCRIPTION, or wants to query another PostgreSQL server, a CSV file, a spreadsheet or another database with CREATE SERVER, USER MAPPING, CREATE FOREIGN TABLE or IMPORT FOREIGN SCHEMA."
---

# Replication and External Data

Pick the mechanism by the goal: physical (streaming) replication copies the whole cluster for availability and read scaling; logical replication copies chosen tables, across versions and platforms; foreign data wrappers leave data where it is and query it live. Every option here touches server configuration, `pg_hba.conf` or credentials, so confirm the environment and get approval before changing anything.

## Choose the mechanism

| Need | Use |
|---|---|
| Hot standby for failover, read-only replicas of everything | Streaming (physical) replication |
| Some tables or databases only, different major versions or OS, writable subscriber | Logical replication (10+) |
| Multimaster, or very old versions | Third-party (pglogical before 10, Bucardo, Slony); trigger-based, more manual DDL care |
| Query or join remote data without copying it | Foreign data wrapper |

## Replication concepts

- **Primary / standby** (the book says master / slave; publisher / subscriber for logical). Built-in physical replication has one writable primary; standbys are read-only.
- **WAL** is the transaction log; physical standbys replay it. Only WAL-logged changes replicate: DDL and `CREATE EXTENSION` do, unlogged tables do not.
- **Asynchronous** (default): commit does not wait for standbys; standbys can lag.
- **Synchronous**: commit waits for standbys named in `synchronous_standby_names`; 10 adds `FIRST n (...)` and `ANY n (...)`. A synchronous standby that goes down blocks commits on the primary.
- **Replication slots** (9.4+) make the primary keep WAL until the slot's consumer has it. An abandoned slot retains WAL forever and can fill the disk and stop the server. Check `pg_replication_slots`.
- **Cascading**: a standby can feed other standbys.
- Standbys need the same major version, OS and architecture as the primary, and the same extension binaries installed, or WAL replay fails at `CREATE EXTENSION`.

## Streaming replication: primary

```sql
CREATE ROLE replicator REPLICATION LOGIN;   -- set the password with \password, never in a script
ALTER SYSTEM SET listen_addresses = '*';
ALTER SYSTEM SET wal_level = replica;        -- 'logical' also works and enables logical replication
ALTER SYSTEM SET max_wal_senders = 5;
ALTER SYSTEM SET wal_keep_segments = 64;     -- or use a replication slot
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'cp %p /var/lib/pgsql/wal_archive/%f';
```

```
# pg_hba.conf: allow only the standby subnet
host  replication  replicator  10.0.0.0/24  md5
```

- `listen_addresses`, `wal_level`, `max_wal_senders` and `archive_mode` need a restart; `pg_hba.conf` needs a reload (`SELECT pg_reload_conf();`).
- Keep `pg_hba.conf` rules narrow (specific role, specific network, password or certificate auth). A broad rule here exposes a full copy of every database.
- `ALTER SYSTEM` writes `postgresql.auto.conf`; check effective values with `SHOW` or `pg_settings`.

Version note: `wal_keep_segments` was replaced by `wal_keep_size` (in MB) in PostgreSQL 13.

## Streaming replication: standby

1. Install the same major version (preferably the same minor) and the same extensions.
2. Stop the standby server and move aside its data directory.
3. Clone the primary, streaming WAL and writing standby settings:

```
pg_basebackup -h 10.0.0.1 -p 5432 -U replicator \
  -D /var/lib/pgsql/data --checkpoint=fast -X stream -R
```

   Supply the password through `~/.pgpass` or `PGPASSFILE`, not on the command line. `-Ft -z` makes a compressed tar backup instead, for backup rather than a standby.
4. Set `hot_standby = on` and `max_connections` at least equal to the primary's.
5. Check the generated connection settings (`primary_conninfo` with an `application_name`), then start the standby.
6. Verify on the primary: `SELECT application_name, state, sync_state, replay_lsn FROM pg_stat_replication;` and on the standby `SELECT pg_is_in_recovery();`.

In 10, `-R` writes `recovery.conf` with `standby_mode = 'on'` and `primary_conninfo`; add `trigger_file` for file-based promotion and optionally `restore_command` to read archived WAL when the standby falls behind.

Version note: since PostgreSQL 12 `recovery.conf` is gone; standby settings live in `postgresql.conf`, an empty `standby.signal` file marks a standby (`-R` creates it), and promotion uses `pg_ctl promote` or `SELECT pg_promote();`.

For continuous WAL backup alongside base backups, run `pg_receivewal` (named `pg_receivexlog` before 10) as a service. In 10 the `pg_xlog` directory is `pg_wal`.

## Promotion (failover)

- Promoting a standby is one-way: the old primary cannot simply rejoin; it must be re-cloned (or rewound with `pg_rewind` where configured).
- Before promoting: confirm the primary is really down or fenced (two writable primaries split the data), check replay lag, and get explicit approval.
- After promoting: repoint applications and remaining standbys, recreate slots, and rebuild a new standby.

## Logical replication (10+)

DDL is not replicated: create the table structure on the subscriber first, and apply later schema changes to both sides yourself.

```sql
-- publisher (wal_level = logical, restart if changed)
CREATE PUBLICATION app_pub FOR TABLE orders, customers;   -- or FOR ALL TABLES

-- subscriber, after loading structure: pg_dump --schema-only ... | psql
CREATE SUBSCRIPTION app_sub
  CONNECTION 'host=10.0.0.1 dbname=app user=replicator'
  PUBLICATION app_pub;
```

- The subscription copies existing rows first, then streams changes. Monitor with `pg_stat_subscription` and `pg_publication_tables`.
- Each subscription creates a slot on the publisher; `DROP SUBSCRIPTION` removes it. Dropping a subscriber database without dropping the subscription leaves an orphan slot retaining WAL.
- Replicated tables need a primary key (or `REPLICA IDENTITY`) for UPDATE and DELETE. Sequences are not replicated.
- Subscriber tables stay writable; local writes can conflict with incoming changes and stop replication.
- Remove with `DROP SUBSCRIPTION` on the subscriber and `DROP PUBLICATION` on the publisher, after approval.

## Foreign data wrappers

Pattern for every FDW: extension, server, user mapping, foreign tables.

```sql
CREATE EXTENSION postgres_fdw;
CREATE SERVER sales_srv FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'sales-db', port '5432', dbname 'sales');
CREATE USER MAPPING FOR app_reader SERVER sales_srv
  OPTIONS (user 'report_ro');  -- add password via a secrets process, never in repo SQL
CREATE SCHEMA remote_sales;
IMPORT FOREIGN SCHEMA public LIMIT TO (invoices, payments)
  FROM SERVER sales_srv INTO remote_sales;
```

- Map specific roles, not `public`: a mapping for `public` lets every local user reach the remote server with those credentials. Use a read-only remote role unless writes are required.
- User mapping passwords are stored in the catalog; prefer remote auth that avoids them (for example certificate auth) when possible, and never commit them.
- Foreign tables are still subject to local `GRANT`s; a user mapping alone grants nothing.
- postgres_fdw tables are updatable by default; make one read-only with `ALTER FOREIGN TABLE remote_sales.invoices OPTIONS (ADD updatable 'false');` (table-level overrides server-level).
- `IMPORT FOREIGN SCHEMA` (9.5+): `LIMIT TO` silently skips missing tables, so verify with `\det remote_sales.*`. Options: `import_default` (off by default; remote sequence defaults can misbehave locally), `import_not_null` and `import_collate` (on).
- `ALTER SERVER ... OPTIONS (SET host '...')` takes effect only in new sessions, because connections are cached per session.
- Set `extensions 'pg_trgm, ...'` on a postgres_fdw server (9.6+) so WHERE clauses using those extensions' functions are pushed to the remote side instead of pulling all rows.
- Check pushdown with `EXPLAIN (VERBOSE)`: the `Remote SQL` line shows what is sent.

### Files and other sources

- **file_fdw** (contrib): server-side files only, readable by the server process; `format 'csv'` with any `delimiter`, plus `header`, `null`, `encoding`. Reading arbitrary server files is a privileged operation; restrict who can create these tables.

```sql
CREATE EXTENSION file_fdw;
CREATE SERVER files FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN TABLE staging.vendors (name text, country text)
  SERVER files
  OPTIONS (filename '/srv/import/vendors.psv', format 'csv',
           header 'true', delimiter '|', null '');
```

- **file_textarray_fdw** (build from source): reads ragged files into one `text[]` column per line; filter header rows and pick elements (`x[1]`, `x[2]`).
- **ogr_fdw** (often packaged with PostGIS, depends on GDAL): one server per data source (a folder of CSVs, a spreadsheet, another database); `IMPORT FOREIGN SCHEMA ogr_all` imports everything, or a quoted name prefix imports matching tables. Names are lowercased unless `launder_table_names 'false'` and `launder_column_names 'false'`. Capabilities depend on how GDAL was built.
- Others exist for MySQL, MongoDB, Hadoop, web services (www_fdw) and Python-written wrappers (Multicorn); check maturity and your version before relying on one, and install only from trusted sources.
- Drop with `DROP FOREIGN TABLE`, `DROP USER MAPPING`, `DROP SERVER`; these remove only local definitions, never remote data.

## Workflow
1. State the goal (failover, read scaling, partial copy, live remote query) and choose physical, logical or FDW.
2. Confirm source and target hosts, versions and extensions; get approval for config, `pg_hba.conf` and role changes, and record current values to revert.
3. Create a dedicated least-privilege role; store its password in `.pgpass` or a secrets store.
4. Configure the primary or publisher, restart or reload as required, verify with `SHOW` and `pg_settings`.
5. Build the standby (`pg_basebackup -R`), subscription or foreign server and mappings.
6. Verify: `pg_stat_replication`, `pg_replication_slots`, `pg_stat_subscription`, `\des`, `\deu`, `\det`, a test query, and `EXPLAIN (VERBOSE)` for FDW pushdown.
7. Set up monitoring for replication lag, slot WAL retention and disk space before calling it done.

## Red flags
- Passwords in `primary_conninfo`, `CREATE ROLE`, user mappings or scripts committed to a repository.
- `host replication all 0.0.0.0/0 trust` or similar broad `pg_hba.conf` rules.
- Inactive replication slots on the primary; nobody watching WAL disk usage.
- A single synchronous standby with no fallback: its outage stops all commits.
- Promoting a standby while the old primary may still accept writes.
- Expecting logical replication to carry DDL, sequences or tables without a primary key.
- Standbys missing extension binaries that the primary installs.
- `CREATE USER MAPPING FOR public` with a writable remote account.
- Joining large foreign tables locally without checking what `Remote SQL` pushes down.
- Coming from Oracle: database links and Data Guard are not the model; PostgreSQL uses FDWs and WAL-based standbys, with different syntax and failure modes.

## Related
- `../DatabaseAdministration/databaseAdministration.md` — `postgresql.conf`, `pg_hba.conf`, roles, backup and restore with pg_dump.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — reading plans for foreign scans and replica queries.
- `../Psql/psql.md` — `\des`, `\deu`, `\det`, `\dRp`, `\dRs` and running setup scripts.
- `../Basics/basics.md` — extensions and server layout.
- `../../Oracle/BeyondTheBasics/RemoteData/remoteData.md` — Oracle counterpart (database links); do not apply its syntax here.
- `../../Oracle/BeyondTheBasics/ExternalTables/externalTables.md` — Oracle counterpart to file_fdw; do not apply its syntax here.
- `../../../CleanCode/Boundaries/boundaries.md` — isolating code from external systems you do not control.
