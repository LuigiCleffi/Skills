---
name: dba-database-administration
description: "Core production DBA tasks in Oracle: creating, starting and stopping a database, sizing SGA caches and the spfile, tablespace and extent standards, undo and temporary space, ASM disk groups, segment shrink, transportable tablespaces, ARCHIVELOG mode and backups (Data Pump, cold, hot, RMAN), based on Chapter 51 (The Hitchhiker's Guide to Database Administration) of Oracle Database 11g: The Complete Reference. Use when the user asks to start up, shut down or mount a database, resize DB_CACHE_SIZE, SHARED_POOL_SIZE or SGA_TARGET, create tablespaces or pick extent sizes, hits ORA-01555 or undo space errors, fills the archive destination, shrinks a table, transports tablespaces, enables ARCHIVELOG, or plans backup and recovery."
---

# The Hitchhiker's Guide to Database Administration

Production control is about predictability: start and stop cleanly, size memory deliberately, standardize space so it manages itself, keep undo and temp healthy, and make sure every database can be recovered to the point the business needs. Almost every command here affects all users of the database; confirm the target environment and get explicit approval before running it.

## Creating, starting and stopping

- Create databases with DBCA (from OUI or later); manually, `startup nomount` as SYSDBA, then `create database ...`.
- OEM gives a common console for many databases, RAC and grid, with scheduling and per-DBA task privileges. Put its repository in a small separate database and back it up often.

```sql
connect / as sysdba
startup                      -- nomount -> mount -> open
startup mount                -- manage files, change archiving mode
alter database rename file '/old/path/users01.dbf' to '/new/path/users01.dbf';
alter database open;
```

| Shutdown | Behavior |
|---|---|
| `normal` (default) | Waits for all users to disconnect |
| `transactional` | Waits for active transactions to finish |
| `immediate` | Rolls back open transactions, disconnects users |
| `abort` | Stops at once; recovery runs at next startup |

- No new logins are allowed while starting or stopping. Prefer `immediate`; keep `abort` for emergencies.

## Memory: SGA and parameter file

- The buffer cache (`DB_CACHE_SIZE`) holds data and index blocks; the shared pool (`SHARED_POOL_SIZE`) holds the dictionary cache and the library cache (parsed SQL and plans, reused by identical statements). Too small a shared pool means constant reparsing.
- Nondefault block sizes need their own cache (`DB_8K_CACHE_SIZE`, ...) **before** creating a tablespace with `blocksize 8K`. Do not set the cache parameter for the default block size.
- Caches resize online in granules (4M when the SGA is under 128M), only into free memory: check `V$SGA_DYNAMIC_FREE_MEMORY`. `SGA_MAX_SIZE` and `JAVA_POOL_SIZE` cannot change while open.
- Automatic Shared Memory Management: set `SGA_TARGET` and set the individual pools to 0 (any nonzero value becomes a minimum). Monitor with `V$SGASTAT`. KEEP and RECYCLE pools are not auto-resized. RAC instances should use fixed sizes.
- Use an spfile so `alter system ... scope=both` persists. `create pfile from spfile` gives a readable copy; take one before changing parameters.

```sql
create pfile = '/tmp/init_before_change.ora' from spfile;
alter system set db_8k_cache_size = 64m scope = both;
```

## Space: tablespaces, extents and segments

- Every database has `SYSTEM` and `SYSAUX`. Each datafile belongs to one tablespace; datafiles can autoextend with an increment and maximum size.
- Use **locally managed** tablespaces (the default) with uniform extents; storage clauses then barely matter. Defaults are visible in `DBA_TABLESPACES`.
- Golden rule: keep sizing simple, generic and consistent across databases. Detailed calculations are wasted; the same index can vary by about half in size depending on load order.
- Define a small set of extent sizes that are multiples of each other (1M, 4M, 16M, 64M ...), one tablespace per size, the same everywhere. Small static tables go to small-extent tablespaces, large ones to large; move a table when it outgrows its tier. Make extents large relative to the OS I/O size; extent count alone does not hurt performance.
- Account for the largest block size in use when choosing extent sizes.

```sql
create tablespace data_4m
  datafile '/u02/oradata/prod/data_4m_01.dbf' size 4g
  autoextend on next 512m maxsize 32g
  extent management local uniform size 4m;
```

- Tables: deleting rows does not release extents. Tune `pctfree` for row growth from updates. `alter table ... move tablespace x` relocates (indexes then become unusable and need rebuilding).
- Indexes: store apart from their tables. `alter index ... rebuild tablespace x` needs room for old and new copies at once.
- Dropped objects go to the recycle bin and keep their space until purged; `flashback table ... to before drop` restores them. `purge` is irreversible; get approval.
- `alter tablespace ... coalesce` merges adjacent free extents in dictionary-managed tablespaces; locally managed ones rarely need it.

## Undo and temporary space

- Automatic undo: `create undo tablespace`, then `UNDO_MANAGEMENT=AUTO` and `UNDO_TABLESPACE=<name>`. Switch tablespaces online with `alter system set undo_tablespace`.
- `UNDO_RETENTION` (seconds) is best effort; make it longer than your longest query to avoid ORA-01555 "snapshot too old". `retention guarantee` on the tablespace enforces it at the cost of failing DML when space runs out.
- Monitor `V$UNDOSTAT` (10-minute rows, about a day kept): `UNDOBLKS`, `TXNCOUNT`, `MAXQUERYLEN` (retention must exceed it), `NOSPACEERRCNT` (add space if nonzero), `SSOLDERRCNT` (ORA-01555 count; raise retention).
- Temporary tablespaces hold sort segments only; space is reused, not freed. Set a database default and assign users; group several temp tablespaces for parallel sorts.

```sql
alter database default temporary tablespace temp;
select property_value from database_properties
 where property_name = 'DEFAULT_TEMP_TABLESPACE';
```

## Automatic Storage Management

- ASM spreads and rebalances I/O across disks, supports per-file-type striping and offers software mirroring. An ASM instance is mounted, never opened.

```sql
create diskgroup data normal redundancy
  failgroup fg1 disk '/dev/rdsk/d1', '/dev/rdsk/d2'
  failgroup fg2 disk '/dev/rdsk/d3', '/dev/rdsk/d4';
alter diskgroup data add disk '/dev/rdsk/d5';
create tablespace app_data datafile '+DATA' size 500m;
```

- Use `external redundancy` when hardware mirrors. Separate disk groups by file type (data, redo, archive, dump). Check members in `V$ASM_DISK`. `drop diskgroup` destroys every file in it; never run it without approval.

## Segment space management

```sql
alter table order_events enable row movement;
alter table order_events shrink space compact;   -- pack rows, keep HWM
alter table order_events shrink space cascade;   -- also lower HWM and shrink indexes
select * from table(dbms_space.object_growth_trend('APP','ORDER_EVENTS','TABLE'));
```

- Full scans read up to the high-water mark, so lower it after mass deletes. Run the final `shrink space` off-peak; it briefly locks the table.
- `OBJECT_GROWTH_TREND` projects growth from AWR history.

## Transportable tablespaces

Move tablespaces between databases by copying datafiles plus a metadata export; much faster than reloading.

1. Check the set is self-contained (`SYSTEM`, `SYSAUX` and temp cannot be transported); violations appear in `TRANSPORT_SET_VIOLATIONS`.
2. Make the tablespaces read only, export metadata, copy datafiles and dump.
3. Import into the target, then make them read write. Object owners must exist; ownership cannot change.

```sql
exec dbms_tts.transport_set_check('SALES_DATA,SALES_IDX', true)
select * from transport_set_violations;
alter tablespace sales_data read only;
-- expdp system directory=dp_dir dumpfile=sales_tts.dmp transport_tablespaces=sales_data,sales_idx
-- impdp system directory=dp_dir dumpfile=sales_tts.dmp transport_datafiles='/u01/oradata/tgt/sales_data01.dbf','/u01/oradata/tgt/sales_idx01.dbf'
```

- Cross-platform moves need endian conversion with RMAN `convert tablespace ... to platform`. In 11g a single partition can be transported and imported as a table (`partition_options=departition`).

## Backups and ARCHIVELOG

| Method | Gives you |
|---|---|
| Data Pump export | Logical snapshot at export time; cannot roll forward |
| Offline (cold) | Consistent copy of all datafiles, control files, online redo logs (plus parameter file) after a clean shutdown |
| Online (hot) | File backups while open; requires ARCHIVELOG; point-in-time recovery |
| RMAN | Automated online backups without backup mode, incremental backups, catalog in control file or recovery catalog |

```sql
shutdown immediate
startup mount
alter database archivelog;
alter database open;
archive log list
```

- Set `LOG_ARCHIVE_DEST_n` and `LOG_ARCHIVE_FORMAT` (`%s` sequence, `%t` thread, `%r` resetlogs ID). The archive destination is separate from the flash recovery area.
- A full archive destination **hangs the database**. Monitor free space and configure an alternate destination. Never delete archived logs until they are backed up and the restore is verified.
- Manual hot backups: `alter tablespace ... begin backup`, copy files, `end backup`, back up archived logs, then `alter database backup controlfile to '...'`. Backup mode generates extra redo; prefer RMAN.
- RMAN incrementals: level 0 is the full base; level 1 copies blocks changed since the last level 1 (differential) or since level 0 (`cumulative`). Back up the recovery catalog database too.
- Test restores regularly; a backup that has never been restored is not a backup. Never overwrite current online redo logs during a restore.

## Workflow

1. Confirm instance, host and environment (`select name, open_mode from v$database`, `v$instance`) before any change.
2. Save a pfile copy and note current values before changing parameters.
3. Make the change in the smallest scope (`scope=memory` first if unsure), verify in `V$PARAMETER`, `V$SGASTAT`, `DBA_TABLESPACES` or `V$UNDOSTAT`.
4. For space, apply the standard extent tiers and autoextend limits; watch growth with `DBMS_SPACE`.
5. Ensure ARCHIVELOG and RMAN backups match the recovery-point objective; monitor the archive destination.
6. Rehearse restore and recovery on a non-production copy.

## Red flags

- Running startup/shutdown, `alter system`, `drop diskgroup`, `purge` or `noarchivelog` without confirming the target and getting approval.
- `shutdown abort` as routine practice.
- Production in NOARCHIVELOG mode, or archive destinations with no space monitoring.
- Deleting archived logs that were never backed up or test-restored.
- File-system copies of an open database outside backup mode.
- Hand-tuned storage clauses per object instead of standard uniform extent tiers.
- `UNDO_RETENTION` shorter than the longest query; ignoring `NOSPACEERRCNT`.
- Creating a nondefault-block tablespace before its cache exists.

## Related

- `../../CriticalConcepts/InstallingAndCreating/installingAndCreating.md` — OUI, DBCA and database creation.
- `../../BeyondTheBasics/Tablespaces/tablespaces.md` — tablespace design for applications.
- `../../BeyondTheBasics/DataPump/dataPump.md` — logical backups and transport metadata.
- `../../BeyondTheBasics/FlashbackQueries/flashbackQueries.md` — what undo retention enables.
- `../../BeyondTheBasics/FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` — recycle bin and flash recovery area.
- `../RealApplicationClusters/realApplicationClusters.md` — ASM and instance management in clusters.
- `../TuningApplicationsAndSql/tuningApplicationsAndSql.md` — AWR, used for growth and tuning.

Version note: from 12c databases can be multitenant (CDB with PDBs), and many of these tasks are run per container.
