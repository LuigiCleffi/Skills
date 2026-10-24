---
name: dba-tablespaces
description: "Understanding and planning Oracle tablespaces, datafiles, segments, quotas, recycle bin space, read-only, nologging, temporary, undo, bigfile, encrypted and transportable tablespaces, based on Chapter 22 (Working with Tablespaces) of Oracle Database 11g: The Complete Reference. Use when deciding where tables and indexes are stored, creating or altering tablespaces, checking quota or free space, running out of space (e.g. ORA-01536 quota exceeded, unable to extend), choosing nologging or read-only, sizing temp or undo, or planning a tablespace layout for an application."
---

# Working with Tablespaces

A tablespace is the logical home for segments, backed by one or more datafiles. Decide the layout early: separate application objects from Oracle's, indexes from tables, and active data from static data, so each group can be sized, moved, backed up and tuned on its own.

## Structure

- Datafile: an OS file belonging to one tablespace; fixed size or `autoextend` up to a limit. Add space by resizing or adding datafiles.
- Segment: the space of one table, index or partition; grows in extents until the tablespace is full.
- Built-in: `SYSTEM` (data dictionary), `SYSAUX` (auxiliary internals), undo, temporary, usually `USERS`. Never create application objects in Oracle's tablespaces or schemas.
- Prefer locally managed tablespaces (space map in datafile headers) over dictionary managed.
- Tablespaces can be renamed with `alter tablespace`.

```sql
create tablespace app_data
  datafile '/u01/oradata/ORCL/app_data01.dbf' size 1g
  autoextend on next 100m maxsize 20g;
```

## What a developer should check

```sql
select tablespace_name, contents, extent_management, status, logging, block_size
  from user_tablespaces;
select default_tablespace, temporary_tablespace from user_users;
select tablespace_name, bytes, max_bytes from user_ts_quotas;   -- max -1 = unlimited
select tablespace_name, sum(bytes) from user_free_space group by tablespace_name;
```

- Objects without a `tablespace` clause go to the user's default tablespace, with the tablespace's default storage. Having a default tablespace does not mean having quota there.
- Rely on the tablespace defaults agreed with the DBA; set a `storage` clause only for objects with exceptional size.
- DBAs see datafiles in `DBA_DATA_FILES`; there is no user-level equivalent.

## Recycle bin space

Dropped objects keep their space until purged, so they can be restored with `flashback table ... to before drop`. Check `RECYCLEBIN` (`DBA_RECYCLEBIN` for DBAs), e.g. `select space from recyclebin where ts_name = 'USERS'`. `purge` reclaims the space permanently; get approval first.

## Tablespace options

- Read-only: `alter tablespace hist_data read only;` / `read write`. Data cannot change, backups simplify; objects can still be dropped. Check `USER_TABLESPACES.STATUS`. Move unchanging history into its own tablespace to use this.
- Nologging: affects only object creation, direct-path loads (`APPEND` hint) and similar bulk operations; normal DML is always logged. Use only when the load can be redone, then back up. Check the `LOGGING` column.
- Temporary: holds sort and grouping segments; statements fail when it is full and cannot extend. A database default temp tablespace applies to new users; tablespace groups (`tablespace group` clause) spread sort work, and a group can be a user's temporary tablespace.
- Undo (automatic undo management): Oracle tries to keep committed undo for `UNDO_RETENTION` seconds (changeable with `alter system`). `retention guarantee` keeps it even if active transactions must fail; use with care.
- Bigfile: one very large datafile per tablespace, locally managed only, intended for striped storage or ASM:

```sql
create bigfile tablespace big_data
  datafile '/u01/oradata/ORCL/big_data01.dbf' size 50g;
```

- Encrypted: add `encryption` and `default storage (encrypt)` at creation; needs TDE and an open wallet. Existing tablespaces cannot be encrypted in 11g.
- Flashback Database: `alter tablespace t flashback off` excludes a tablespace from flashback logging.
- Transportable: a self-contained tablespace set (indexes travel with their tables) can be unplugged and plugged into another database, even across platforms, much faster than export/import.

Version note: since 12.2, existing tablespaces can be encrypted in place with `alter tablespace ... encryption`.

## Planning the layout

- Separate active transaction tables from static lookup tables; isolate the most performance-critical active tables further, down to active vs static partitions.
- Separate indexes from tables, so indexes can be rebuilt without squeezing table space.
- Separate large from small objects; their tuning differs (e.g. caching small tables).
- Separate enterprise-wide shared objects from application-specific ones, and both from Oracle's core tablespaces.
- Group related partitions (e.g. the current month of several tables) together.

## Workflow

1. Confirm environment and whether the change is a DBA-privileged operation; get explicit approval for create, drop, resize, read only, flashback off, purge or `retention guarantee`.
2. Inspect the current state: `USER_TABLESPACES`/`DBA_TABLESPACES`, `DBA_DATA_FILES`, quotas, free space, recycle bin.
3. Map each application object to a tablespace category from the plan above; specify `tablespace` (and `using index tablespace`) explicitly in DDL.
4. Size datafiles with `autoextend` and a `maxsize`; for nologging loads schedule a backup.
5. Verify placement with `USER_SEGMENTS` (`tablespace_name`, `bytes`) and space with `USER_FREE_SPACE`.
6. Back out: tablespace drops are irreversible without backup (`drop tablespace ... including contents and datafiles` deletes files); move objects out rather than dropping.

## Red flags

- Application objects in `SYSTEM`, `SYSAUX` or owned by Oracle schemas.
- Tables and their indexes mixed in one tablespace by default; DDL with no tablespace clause.
- Per-object custom storage clauses everywhere.
- Autoextend with no `maxsize`, or no autoextend and no monitoring.
- Assuming nologging applies to ordinary DML, or skipping the backup after a nologging load.
- `retention guarantee` set without sizing undo.
- Space "leaking" to an unpurged recycle bin; purging without approval.
- Dropping a tablespace, or its datafiles at OS level, on an unconfirmed environment.

## Related

- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — tablespace and `using index` clauses in DDL.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md` — one tablespace per partition.
- `../TransparentDataEncryption/transparentDataEncryption.md` — wallet setup for encrypted tablespaces.
- `../FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` — recycle bin and flashback database.
- `../DataPump/dataPump.md` — moving data between databases.
- `../../HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` — tablespace creation, ASM and transport in depth.
