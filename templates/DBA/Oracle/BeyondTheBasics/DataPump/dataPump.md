---
name: dba-data-pump
description: "Exporting and importing Oracle schemas, tables and metadata with Data Pump (expdp/impdp), including filtering, remapping, job control and DDL generation, based on Chapter 24 (Using Data Pump Export and Import) of Oracle Database 11g: The Complete Reference. Use when the user wants to copy a schema between databases, refresh a test environment, back up metadata, run expdp or impdp, write a .par file, use REMAP_SCHEMA, INCLUDE/EXCLUDE/QUERY, TABLE_EXISTS_ACTION, SQLFILE, NETWORK_LINK, or attach to, stop or restart a running Data Pump job."
---

# Using Data Pump Export and Import

Data Pump is a server-side job that unloads data and metadata to dump files and loads them back, possibly into another schema, tablespace or database. Treat every import as a potentially destructive write to the target: decide filters, remaps and the table-exists policy before starting, and preview with SQLFILE when in doubt.

## Prerequisites: a directory object

Dump and log files are written on the database server through a directory object, never a client path.

```sql
create directory dp_dir as '/u01/exports';
grant read, write on directory dp_dir to app_owner;
```

- The OS directory must already exist and be writable by the Oracle software owner.
- Creating it needs CREATE ANY DIRECTORY.
- Full and transportable tablespace exports need EXP_FULL_DATABASE; importing into another schema (REMAP_SCHEMA) or full imports need IMP_FULL_DATABASE.

## Modes

- **Schema** (default): one or more schemas, `SCHEMAS=`.
- **Table**: `TABLES=` with optional partitions.
- **Tablespace**: `TABLESPACES=`.
- **Full**: `FULL=Y`, the whole database.
- **Transportable tablespace**: metadata only, `TRANSPORT_TABLESPACES=`, with `TRANSPORT_FULL_CHECK` to verify the set is self-contained.

## Export essentials

Put parameters in a parameter file to avoid shell quoting problems:

```
# exp_orders.par
DIRECTORY=dp_dir
DUMPFILE=orders_%U.dmp
LOGFILE=exp_orders.log
SCHEMAS=app_owner
INCLUDE=TABLE:"IN ('ORDERS','ORDER_ITEMS')"
QUERY=orders:"WHERE order_date >= DATE '2010-01-01'"
PARALLEL=2
JOB_NAME=exp_orders
```

```
expdp app_owner PARFILE=exp_orders.par
```

Useful export parameters:
- `CONTENT=ALL|DATA_ONLY|METADATA_ONLY`.
- `ESTIMATE_ONLY=Y` to size the dump without writing it.
- `FLASHBACK_SCN` / `FLASHBACK_TIME` for a consistent point-in-time export.
- `COMPRESSION`, `ENCRYPTION`, `ENCRYPTION_PASSWORD`, `ENCRYPTION_ALGORITHM` for the dump file set.
- `REMAP_DATA=table.column:pkg.func` to mask sensitive values on the way out, before a dump reaches non-production.
- `SAMPLE` to unload a percentage of blocks for a test data set.
- `FILESIZE` with `%U` in the file name to split output; `DUMPFILE=dir1:a.dmp,dir2:b.dmp` to spread across directories.
- `NETWORK_LINK` to export a remote database over a database link to the local directory.
- `VERSION` to produce a dump an older release can import.
- Existing dump files are not overwritten unless `REUSE_DUMPFILES=Y`.

## Filtering with INCLUDE, EXCLUDE, QUERY

- Syntax: `EXCLUDE=object_type[:"name_clause"]`, e.g. `EXCLUDE=TABLE:"LIKE 'TMP%'"`, `EXCLUDE=INDEX`, `EXCLUDE=SCHEMA:"='AUDIT_USER'"`.
- INCLUDE and EXCLUDE are mutually exclusive, and neither works with `CONTENT=DATA_ONLY`.
- Excluding an object excludes its dependents. `EXCLUDE=USER` keeps the schema's objects; use `SCHEMA` to drop both. NOT NULL constraints and constraints required to create a table are never excluded.
- `QUERY` without a table prefix applies to every exported table, so it breaks when columns differ; prefix it with the table name.
- List filterable types in `DATABASE_EXPORT_OBJECTS`, `SCHEMA_EXPORT_OBJECTS`, `TABLE_EXPORT_OBJECTS`.
- The same filters work on import, so you can export broadly and import selectively.

## Import essentials

```
# imp_orders.par
DIRECTORY=dp_dir
DUMPFILE=orders_%U.dmp
LOGFILE=imp_orders.log
REMAP_SCHEMA=app_owner:app_test
REMAP_TABLESPACE=app_data:test_data
TABLE_EXISTS_ACTION=SKIP
TRANSFORM=SEGMENT_ATTRIBUTES:n
```

- `REMAP_SCHEMA`, `REMAP_TABLESPACE`, `REMAP_DATAFILE` retarget objects. Create the target user first.
- `TABLE_EXISTS_ACTION=SKIP|APPEND|TRUNCATE|REPLACE`. Default is SKIP, or APPEND when `CONTENT=DATA_ONLY`. TRUNCATE and REPLACE destroy existing target data.
- `TRANSFORM=STORAGE:n[:TABLE]` drops exported storage clauses; `SEGMENT_ATTRIBUTES:n` also drops tablespace and logging, so objects land in the user's default tablespace.
- `PARTITION_OPTIONS=DEPARTITION|MERGE` turns partitions into separate tables or one table.
- `DATA_OPTIONS=SKIP_CONSTRAINT_ERRORS` keeps loading when rows violate constraints.
- `REMAP_DATA` can regenerate keys consistently in parent and child columns.
- All dump files must be named when the job starts.

## Preview with SQLFILE

`SQLFILE=dp_dir:ddl.sql` writes the DDL the import would run, and loads nothing. Use it to review what an import will create, to extract schema DDL for version control, or to edit storage before running it in SQL*Plus.

## Job control

The job runs on the server; the client can leave and return.
- Ctrl-C in the client gives the `Export>` or `Import>` prompt.
- `EXIT_CLIENT` leaves the job running; `expdp user ATTACH=job_name` reattaches.
- `STATUS`, `CONTINUE_CLIENT` (resume log display), `STOP_JOB`, `START_JOB`, `PARALLEL=n`, `ADD_FILE` (export, e.g. when the dump area fills), `KILL_JOB`.
- Monitor with `DBA_DATAPUMP_JOBS`, `USER_DATAPUMP_JOBS` and `V$SESSION_LONGOPS`.
- Each job creates a master table named after `JOB_NAME` in the running schema, so the name must not clash with an existing table or view.

Version note: since 12c, imports into a multitenant database connect to a specific PDB service rather than the root.

## Workflow
1. Confirm source, target, and the exact environment names; write them down in the parameter file comments.
2. Ensure the directory object, privileges and free disk space (`ESTIMATE_ONLY=Y`).
3. Export with a named job, a log file and explicit filters; use `FLASHBACK_TIME` when consistency across tables matters.
4. Before importing, run the same import with `SQLFILE` and review it.
5. Get explicit approval for the target and the `TABLE_EXISTS_ACTION` value, then import.
6. Read the log for ORA- errors; compare object counts (`DBA_OBJECTS`, invalid objects) and row counts with the source; recompile invalid objects.

## Red flags
- Importing into production, or with `TABLE_EXISTS_ACTION=TRUNCATE|REPLACE`, without confirming the target and getting approval. Back-out is a fresh export of the target taken first, or a flashback/restore plan.
- `FULL=Y` imports where a schema or table import would do.
- Production dumps copied to test without REMAP_DATA or other masking of sensitive columns.
- Encryption passwords in shell history or shared par files.
- QUERY clauses with no table prefix in multi-table jobs.
- Killing a job when STOP_JOB plus ADD_FILE would let it finish.
- Expecting the original `imp` utility to read Data Pump dump files; it cannot.

## Related
- `../SqlLoader/sqlLoader.md` — loading from flat files rather than dump files.
- `../ExternalTables/externalTables.md` — the ORACLE_DATAPUMP driver unloads query results to dump files.
- `../RemoteData/remoteData.md` — database links used by NETWORK_LINK.
- `../FlashbackQueries/flashbackQueries.md` — SCN and timestamp concepts behind FLASHBACK_SCN/TIME.
- `../TransparentDataEncryption/transparentDataEncryption.md` — encrypted columns and dump encryption.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — creating target users and granting privileges.
