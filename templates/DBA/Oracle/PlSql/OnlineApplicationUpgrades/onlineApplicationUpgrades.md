---
name: dba-online-application-upgrades
description: Changing schemas and applications with minimal downtime: Data Guard standby databases (physical vs logical, protection modes, real-time apply, switchover), virtual columns, DDL_LOCK_TIMEOUT, adding NOT NULL columns with defaults, online index/IOT rebuilds, DBMS_REDEFINITION, and SET UNUSED / DROP UNUSED COLUMNS, based on Chapter 33 (Online Application Upgrades) of Oracle Database 11g: The Complete Reference. Use when a user must alter a large or busy table in production, hits ORA-00054 (resource busy) on DDL, needs to move or partition a table online, add a derived or mandatory column, drop a column without an outage, plan a rolling upgrade, or asks about Data Guard switchover, Switchover_Status or logical standby restrictions.
---

# Online Application Upgrades

Every DDL change needs an exclusive DDL lock and invalidates dependent code. Plan each change so that its lock is short and can be retried, and so that the heavy data movement happens outside it. For larger changes, use a standby database or online redefinition to make the change while users keep working.

## Architecture choices for availability

- **RAC:** one shared database, so a DDL lock affects every instance.
- **Replication:** replicas must receive the same change, and outages usually happen in both.
- **Data Guard standby:** the primary ships redo to standbys. A logical standby can have different objects, which allows rolling upgrades: change one side, switch roles, then change the other.

Data Guard is DBA-owned, but developers need to know its limits.

## Data Guard essentials

- **Physical standby:** a block-for-block copy that applies redo. It can serve backups, can open read-only, and is the preferred switchover target.
- **Logical standby:** applies the redo as SQL, so it can have extra reporting indexes. It skips BFILE, ROWID/UROWID, user-defined and object types, REFs, varrays, nested tables, XMLType, encrypted columns, compressed tables and Oracle-supplied schemas. Check `DBA_LOGSTDBY_UNSUPPORTED` and `DBA_LOGSTDBY_SKIP`. Every table needs a primary or unique key, and `DBA_LOGSTDBY_NOT_UNIQUE` lists the ones that don't have one.
- Primary and standby need the same OS and platform architecture. If both are on one host, they need different directories, a distinct `DB_UNIQUE_NAME`, `DB_FILE_NAME_CONVERT`/`LOG_FILE_NAME_CONVERT` and unique `SERVICE_NAMES`, and must not share an archive log directory. Create standby redo logs on each standby.

Protection modes are set through the `LOG_ARCHIVE_DEST_n` attributes (`SYNC`/`ASYNC`, `LGWR`/`ARCH`, `AFFIRM`/`NOAFFIRM`):

| Mode | Commit waits for standby | If standby unreachable |
|---|---|---|
| Maximum protection | Yes | Primary shuts down |
| Maximum availability | Yes | Primary continues, catches up later |
| Maximum performance (default) | No | Primary continues |

Real-time apply applies redo as it arrives instead of waiting for the archive:

```sql
alter database recover managed standby database using current logfile;  -- physical
alter database start logical standby apply immediate;                   -- logical
-- stop: ... recover managed standby database cancel; / stop logical standby apply;
```

`V$ARCHIVE_DEST_STATUS.Recovery_Mode` shows `MANAGED REAL-TIME APPLY` when it is active.

## Switchover (planned role change)

A switchover is initiated on the primary and completed on the standby. Both databases must be in ARCHIVELOG mode, and the standby should already be applying redo.

Physical standby:
1. On the primary, `select switchover_status from v$database;` must show `TO STANDBY`. `SESSIONS ACTIVE` means users must disconnect first.
2. Run `alter database commit to switchover to physical standby;`, then `shutdown immediate` and `startup mount`.
3. On the standby, the status must be `TO PRIMARY`. Run `alter database commit to switchover to primary;`, then restart it.
4. Run `alter system switch logfile;` on the new primary and start redo apply on the standbys.

Logical standby:
1. Run `prepare to switchover to logical standby` on the primary, then `prepare to switchover to primary` on the standby.
2. Wait for the primary to show `TO LOGICAL STANDBY`, then run `commit to switchover to logical standby` there.
3. Run `commit to switchover to primary` on the standby.
4. Run `alter system archive log current` on the new primary, and `start logical standby apply` on the old one.

A failover after losing the primary may lose data, depending on the protection mode. Switchovers and failovers are manual DBA actions. Get explicit approval and a maintenance window before running them.

## Low-impact DDL on a single database

**Retry the lock instead of failing.** Without this, DDL on a busy table fails at once with ORA-00054:

```sql
alter session set ddl_lock_timeout = 60;   -- seconds to keep retrying
alter table orders add (region_code VARCHAR2(10));
```

**Virtual columns instead of stored derived data.** No data is rewritten, the column can be indexed and used as a partition key, and inserting a value into it raises an error:

```sql
alter table customers add (
  name_upper VARCHAR2(100) generated always as (upper(last_name)) virtual);
```

**Mandatory columns.** Adding a `NOT NULL` column to a populated table requires a `DEFAULT`. In 11g, existing rows are not rewritten: the default is returned for them when they are read.

```sql
alter table orders add (channel VARCHAR2(10) default 'WEB' not null);
```

**Online reorganizations:**
- Indexes: `alter index orders_ix1 rebuild online;`, which also works per partition.
- Index-organized tables: `alter table ... move online`.
- Partitioned tables: the partition maintenance clauses of `alter table`.

**Dropping columns.** `alter table orders set unused (legacy_flag);` is instant, and the column is gone for users. Later, in a window, `alter table orders drop unused columns;` reclaims the space. To drop several columns at once, list them in parentheses without the word `column`. Add `cascade constraints` when a column is part of a key. Check pending drops in `USER_UNUSED_COL_TABS` (or the `ALL_`/`DBA_` versions). Set unused is irreversible, so get approval.

## Online redefinition (DBMS_REDEFINITION)

Use it to move, partition, or change the columns of an active table. It builds a replica, keeps it in sync, and swaps the two with a brief lock.

```sql
exec DBMS_REDEFINITION.CAN_REDEF_TABLE('APP', 'ORDERS');
-- create ORDERS_INT with the new structure (partitioning, tablespace, columns)
exec DBMS_REDEFINITION.START_REDEF_TABLE('APP', 'ORDERS', 'ORDERS_INT');
declare n PLS_INTEGER;
begin
  DBMS_REDEFINITION.COPY_TABLE_DEPENDENTS('APP', 'ORDERS', 'ORDERS_INT',
                                          num_errors => n);
end;
/
exec DBMS_REDEFINITION.SYNC_INTERIM_TABLE('APP', 'ORDERS', 'ORDERS_INT');
exec DBMS_REDEFINITION.FINISH_REDEF_TABLE('APP', 'ORDERS', 'ORDERS_INT');
```

- If `CAN_REDEF_TABLE` reports errors, the first error in the stack is the real cause.
- `START_REDEF_TABLE` copies all committed data, so size undo and time for it. Pass a column mapping as the fourth argument when the column lists differ.
- Only the dependents on the interim table survive the swap. Copy them with `COPY_TABLE_DEPENDENTS` (indexes, triggers, constraints, grants, and optionally statistics and MV logs) or create them up front, before any DDL locks are needed.
- Sync right before finishing to shorten the final step. Use `ABORT_REDEF_TABLE` to back out, then truncate the interim table.
- After the swap, the interim table holds the old version. Keep it until verification passes, and drop it only with approval.

Version note: 11g Release 2 added edition-based redefinition, which lets you upgrade PL/SQL and views online in a separate edition.

## Workflow
1. Classify the change: a metadata-only change (virtual column, default plus NOT NULL, set unused), a rebuild (index or partition online), or a structural change (redefinition or standby rolling upgrade).
2. List dependent objects and invalidations, and plan when to recompile them.
3. Confirm the target database and get approval for production DDL, switchovers and irreversible steps.
4. Set `ddl_lock_timeout` for the session. Rehearse on a copy and time the heavy steps.
5. Run the change. For redefinition, sync, then finish.
6. Verify: `DBA_TAB_PARTITIONS`/`DBA_TABLES` placement, enabled constraints and triggers, grants, valid indexes, and no invalid objects.
7. Recompile invalid objects and regather statistics if needed.

## Red flags
- Running `alter table` in a retry loop on a busy table instead of using `ddl_lock_timeout`.
- Adding a physical column and backfilling millions of rows when a virtual column or a default would do.
- Forgetting that only the interim table's indexes, triggers, constraints and grants survive `FINISH_REDEF_TABLE`.
- Dropping the old table after redefinition before verification is complete.
- Choosing a logical standby without checking its unsupported types and the tables without keys.
- Starting a switchover while `switchover_status` is not `TO STANDBY`/`TO PRIMARY`.
- Using `SET UNUSED` as if it were reversible.

## Related
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md`: base DDL for tables, indexes and columns.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md`: partitioning the interim table and online partition moves.
- `../ProceduresFunctionsPackages/proceduresFunctionsPackages.md`: recompiling code invalidated by DDL.
- `../../HitchhikersGuides/RealApplicationClusters/realApplicationClusters.md`: how DDL locks behave across instances.
- `../../HitchhikersGuides/DatabaseAdministration/databaseAdministration.md`: ARCHIVELOG and redo configuration that Data Guard relies on.
