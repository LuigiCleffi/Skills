---
name: dba-flashback-tables-and-databases
description: Recovering from human or application error by rewinding a whole table (FLASHBACK TABLE to an SCN, a timestamp or before drop) or the whole database (FLASHBACK DATABASE), based on Chapter 30 (Flashback—Tables and Databases) of Oracle Database 11g: The Complete Reference. Use when a user says "I dropped a table by mistake", "an update without a where clause was committed", "undo this batch job", "restore the table to how it was an hour ago", asks about the recycle bin, BIN$ objects, PURGE, RECYCLEBIN, row movement, ORA-08189 (row movement not enabled), flashback logs, the flash recovery area, DB_FLASHBACK_RETENTION_TARGET, or a fast alternative to incomplete recovery.
---

# Flashback—Tables and Databases

Flashback table rewinds one or more tables using undo or the recycle bin. Flashback database rewinds the entire database using flashback logs. Both throw away every change made after the target point, so treat them as destructive operations: record the current SCN first, confirm the target, and get explicit approval.

## Choose the right tool

| Problem | Tool | Relies on |
|---|---|---|
| Need to see or copy old rows; table must stay as is | Flashback query (`as of`) | Undo |
| Table was dropped | `flashback table ... to before drop` | Recycle bin |
| Bad DML committed on a few tables | `flashback table ... to scn/timestamp` | Undo, row movement |
| Bad change spread across many tables or schemas | `flashback database` | Flashback logs + archived redo |

Flashback table cannot cross DDL that changed the table's structure. Flashback database cannot reverse dropping a tablespace or shrinking a datafile; its window restarts right after such operations.

## Recovering a dropped table

A dropped table stays in its tablespace, and keeps counting against quota, until it is purged. It and its indexes are renamed `BIN$<unique_id>$<version>`.

```sql
select object_name, original_name, type, droptime, dropscn
  from recyclebin;                          -- DBAs: DBA_RECYCLEBIN

flashback table orders to before drop;
flashback table orders to before drop rename to orders_restored;
```

- Rows, indexes and statistics come back. Referential (foreign key) constraints do not, so re-create them.
- Restored indexes keep their `BIN$` names. Rename them with `alter index "BIN$..." rename to orders_pk;`.
- If the same name was dropped several times, each drop has its own entry. Pick the one you want by `dropscn`/`droptime` and use its `BIN$` name.
- Required privilege: only what was needed to drop the table.

`PURGE` removes objects permanently. It can target a table, a tablespace, one user's objects in a tablespace, your recycle bin, or `dba_recyclebin`. Never purge without approval: after a purge, only a backup can bring the data back.

The `RECYCLEBIN` parameter (default `ON`) can be set for the whole system or one session. Turning it off makes later drops final, but it does not empty what is already in the bin.

## Rewinding a table to an SCN or timestamp

Prerequisites:
- Automatic Undo Management, with enough undo (`UNDO_RETENTION` and undo tablespace size).
- Row movement enabled on the table.
- `FLASHBACK` on the table (or `FLASHBACK ANY TABLE`), plus `SELECT`, `INSERT`, `DELETE` and `ALTER` on it.

```sql
variable scn_before number
execute :scn_before := DBMS_FLASHBACK.GET_SYSTEM_CHANGE_NUMBER;
print scn_before                            -- your way back

alter table orders enable row movement;
flashback table orders to timestamp systimestamp - interval '10' minute;
-- or: flashback table orders, order_lines to scn :target_scn;
```

- The statement cannot be rolled back. To undo it, flash back again to the SCN you recorded.
- All listed tables are processed in one transaction under exclusive DML locks, so either all succeed or none do. List parent and child tables together.
- ROWIDs are not preserved, so anything that stores ROWIDs becomes invalid.
- Statistics are not flashed back, so regather them. Existing indexes are updated to match the old data. Indexes dropped since then are not restored, and indexes created since then remain.
- Don't guess a time for the target point. Find it with flashback version queries or `ORA_ROWSCN` (see the flashback queries skill).

## Flashback database

Flashback database rewinds every datafile to a past SCN or time. It is a fast alternative to incomplete recovery. It requires `SYSDBA`, ARCHIVELOG mode, and flashback mode enabled beforehand.

```sql
-- One-time setup (mounted, not open)
startup mount exclusive;
alter database archivelog;
alter database flashback on;
alter database open;

select current_scn, flashback_on from v$database;
select oldest_flashback_scn, oldest_flashback_time, retention_target,
       flashback_size, estimated_flashback_size
  from v$flashback_database_log;            -- how far back you can go
```

- `DB_FLASHBACK_RETENTION_TARGET` sets the target window in minutes. `DB_RECOVERY_FILE_DEST` (location) and `DB_RECOVERY_FILE_DEST_SIZE` (quota) define the flash recovery area where flashback logs live.
- Flashback table uses undo. Flashback database uses flashback logs plus archived and online redo.

Performing it:

```sql
shutdown immediate;
startup mount exclusive;
flashback database to timestamp sysdate - 1/24;   -- or: to scn n / to before scn n
alter database open resetlogs;                    -- required for write access
```

- Every transaction after the target is lost for the whole database, not just one schema.
- Mounting in exclusive mode affects RAC participation, so coordinate with the cluster.
- If the logs do not reach back far enough, the flashback cannot be done and you must use a traditional restore and roll-forward recovery.
- To disable flashback: mount, run `alter database flashback off;`, then open.

## Flash recovery area files

Permanent files are critical: multiplexed control file copies and online redo logs. If the area is unreachable and no copy exists elsewhere, the instance fails.

Transient files are archived logs, image copies, backup pieces and flashback logs. Oracle deletes them once they are obsolete under the retention policy. If flashback logs cannot be written, Oracle disables flashback database, writes to the alert log and keeps running.

Watch the area's free space. A full area can halt archiving and stop the database.

Version note: since 11g Release 2, flashback database can be turned on while the database is open, and the area is called the fast recovery area.

## Workflow
1. Identify the scope of damage: one dropped table, a few tables, or the whole database.
2. Confirm the environment (instance name, host, `v$database`) and get explicit approval. Tell the user what will be lost.
3. Record the current SCN.
4. Find the exact target SCN or time from flashback queries, `ORA_ROWSCN` or the recycle bin `dropscn`.
5. Check feasibility: undo retention for tables, `v$flashback_database_log` for the database, recycle bin contents for drops.
6. Prefer the smallest tool: a flashback query with a selective repair before flashback table, and flashback table before flashback database.
7. Run the flashback. Then re-create foreign keys, rename `BIN$` indexes, regather statistics, and reapply legitimate later changes.
8. Verify row counts and sample data. For flashback database, confirm `open resetlogs` succeeded and take a new backup.

## Red flags
- Flashing back without recording the current SCN first.
- Rewinding a whole table when only a few rows were wrong and a flashback query plus an update would do.
- Using flashback database for a single-table mistake, which discards everyone's work.
- Purging or disabling the recycle bin "to save space" on production without approval.
- Forgetting that foreign keys are not restored after `to before drop`.
- Relying on flashback table after a DDL change to the table, or on stored ROWIDs after a flashback.
- Assuming flashback database is available without checking `flashback_on` and the oldest flashback SCN.
- Letting the flash recovery area fill up unmonitored.

## Related
- `../FlashbackQueries/flashbackQueries.md`: finding the target SCN and reading old rows without rewriting tables.
- `../Tablespaces/tablespaces.md`: undo tablespace sizing and recycle bin space in tablespaces.
- `../../HitchhikersGuides/DatabaseAdministration/databaseAdministration.md`: ARCHIVELOG, backups and recovery when flashback is not enough.
- `../../HitchhikersGuides/RealApplicationClusters/realApplicationClusters.md`: impact of an exclusive mount on clustered databases.
