---
name: dba-architecture-options
description: Map of the Oracle architecture building blocks (database vs instance, table and index types, tablespaces, ASM, undo, recycle bin, security, programmatic interfaces) and how to pick the right one for a requirement, based on Chapter 1 (Oracle Database 11g Architecture Options) of Oracle Database 11g: The Complete Reference. Use when the user asks "which Oracle feature should I use for X", needs to explain database vs instance or SGA, chooses a table or index type, wonders why dropped tables still use space, or reviews an existing schema for features it could adopt after an upgrade.
---

# Oracle Database 11g Architecture Options

Before writing DDL or code, pick the Oracle structure that matches the problem: Oracle usually ships a dedicated feature (a table type, an index type, a utility) for what an application would otherwise hand-roll. Name the feature, check it fits the workload, then go to the chapter skill that covers it in depth.

## Database vs instance

- **Database**: the files on disk (datafiles and other files) holding physical and logical structures.
- **Instance**: the memory area (System Global Area, SGA) plus the background processes that move data between the SGA and the files.
- One instance normally opens one database. In Real Application Clusters (RAC) several instances, usually on separate servers joined by a fast interconnect, open the same database.

```sql
select instance_name, host_name, status from v$instance;
select name, open_mode, log_mode from v$database;
```

## Choosing a table type

| Need | Use |
|---|---|
| Ordinary application rows | Relational table (`create table`) |
| User-defined types, inheritance | Object-relational tables, nested tables, varrays |
| Rows always fetched by primary key, data kept sorted | Index-organized table |
| Query a flat file without loading it | External table (needs `create directory` first) |
| Manage huge tables in pieces (range, list, hash, composite) | Partitioned table |
| Precomputed join or aggregate, transparent query rewrite | Materialized view with a refresh schedule |
| Per-session scratch rows visible only to their inserter | Global temporary table |
| Two tables almost always queried together | Cluster |

A BFILE column points to an external binary file; like external tables it requires a directory object.

## Choosing an index type

- **B*-tree**: the default; equality and range predicates.
- **Bitmap**: low-cardinality columns, and only where data is batch loaded (warehouse, reporting). Avoid on OLTP tables with concurrent DML.
- **Reverse key**: relieves I/O contention when many sessions insert sequential key values.
- **Function-based**: index an expression such as `upper(last_name)` so predicates on that expression can use an index.
- **Partitioned**: local (aligned with table partitions) or global (spans all rows).
- **Text (Oracle Text)**: word stems, phrase and fuzzy search over text.

```sql
select index_name, index_type, partitioned from user_indexes where table_name = 'ORDERS';
```

## Storage

- A tablespace has one or more datafiles; a datafile belongs to exactly one tablespace. Every database has at least `SYSTEM` and `SYSAUX`.
- Prefer **locally managed** tablespaces (the default): space is tracked by bitmaps in the datafiles instead of dictionary tables, which removes dictionary contention.
- **Bigfile** tablespaces plus Oracle Managed Files (OMF) let you manage a tablespace as one unit without tracking individual files.
- A **temporary** tablespace is permanent; only its segments (sorts, index builds, joins) are temporary. Keep temporary segments out of permanent tablespaces.
- **ASM** spreads and mirrors database files across a disk group and rebalances automatically when disks are added.
- **Automatic Undo Management** keeps prior row images for read consistency and powers flashback queries; let Oracle manage undo segments.

```sql
select tablespace_name, contents, extent_management, bigfile from dba_tablespaces;
select name, value from v$parameter where name in ('undo_management', 'undo_tablespace');
```

## Dropped data and the recycle bin

Dropping a table keeps its space by default: it moves to the recycle bin and can be restored with `flashback table ... to before drop`. Dropping and recreating the same table repeatedly leaves several copies. Check usage before blaming a full tablespace on live data.

```sql
select object_name, original_name, droptime, space from user_recyclebin;
```

`purge` removes entries permanently and cannot be undone. Confirm the environment and the exact objects with the user, and get explicit approval, before running any `purge` (especially `purge dba_recyclebin`).

## Guarding the data

- Object privileges (`select`, `insert`, ...) granted to users or, better, to roles.
- Virtual Private Database restricts rows no matter how the table is reached; column masking and on-disk encryption protect sensitive values.
- Auditing can record privileged actions, structure changes and access to specific tables or rows.

## Programmatic interfaces

SQL first; then PL/SQL (procedures, functions, packages, triggers on row, DDL or database events), dynamic SQL, SQL*Plus for scripting and dictionary queries, Java and JDBC (including Java stored procedures), XML types, object types and LOBs, Data Pump for moving data between databases, SQL*Loader for flat-file loads, external procedures, and `UTL_MAIL` for sending e-mail from PL/SQL without coding SMTP.

## Workflow

1. Restate the requirement in workload terms: OLTP or batch, read or write heavy, volume, retention, who may see what.
2. Pick the matching structure from the tables above; prefer a built-in feature over custom code.
3. Check the database already supports it: edition and options, tablespace type, undo mode, directory objects, privileges.
4. When reviewing an existing or upgraded system, list features it could adopt (for example faster materialized view refresh, invisible indexes, editions) and evaluate each against the workload.
5. Verify with the dictionary views shown above, then continue in the detailed skill.

## Red flags

- Bitmap indexes on tables with heavy concurrent inserts or updates.
- User objects or temporary segments in `SYSTEM`; temporary segments in permanent tablespaces.
- Dictionary-managed tablespaces in a new design.
- Hand-written file parsers where an external table or SQL*Loader would do.
- Row-filtering logic duplicated in every application instead of a view or VPD policy.
- Running `purge` or `flashback` commands without confirming the target database.
- A tablespace "mysteriously" full while the recycle bin holds many dropped copies.

Version note: since 12c a database can be a multitenant container (CDB) with pluggable databases (PDBs); check `v$database.cdb` before assuming the 11g single-database layout.

## Related
- `../InstallingAndCreating/installingAndCreating.md` — decisions made at install time (block size, character set, tablespaces).
- `../PlanningApplications/planningApplications.md` — design the application before choosing structures.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — creating tables, views, indexes, clusters, sequences.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md` — partitioned tables and indexes.
- `../../BeyondTheBasics/Tablespaces/tablespaces.md` — tablespace management in depth.
- `../../BeyondTheBasics/FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` — recycle bin and flashback recovery.
- `../../BeyondTheBasics/MaterializedViews/materializedViews.md` — materialized views and query rewrite.
- `../../HitchhikersGuides/RealApplicationClusters/realApplicationClusters.md` — multiple instances on one database.
