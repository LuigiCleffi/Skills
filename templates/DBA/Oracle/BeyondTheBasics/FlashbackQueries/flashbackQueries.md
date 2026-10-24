---
name: dba-flashback-queries
description: "Reading data as it was in the past with flashback queries (AS OF TIMESTAMP / AS OF SCN), version queries (VERSIONS BETWEEN), ORA_ROWSCN and FLASHBACK_TRANSACTION_QUERY to recover from bad commits, based on Chapter 29 (Using Flashback Queries) of Oracle Database 11g: The Complete Reference. Use when the user accidentally committed a wrong UPDATE or DELETE, asks what a row looked like earlier, who changed it or when, needs to restore rows without a full recovery, uses DBMS_FLASHBACK or SCN_TO_TIMESTAMP, or hits ORA-30052 or ORA-01555 during a flashback query."
---

# Using Flashback Queries

A flashback query reads committed data as of an earlier time or SCN, using the undo that Oracle keeps for read consistency. Use it as a fast repair and investigation tool after an errant commit: act quickly, save the old data to a table first, then repair. Do not build application logic on it, because how far back you can go depends on undo space and workload, not on the application.

## Prerequisites

- Automatic undo management with an undo tablespace and a nonzero `UNDO_RETENTION`, set by the DBA. The retention target and the undo space together decide how far back queries can reach.
- EXECUTE on `DBMS_FLASHBACK` only for features such as `GET_SYSTEM_CHANGE_NUMBER`; plain `AS OF` queries need only normal SELECT access.
- Flashback queries also work against remote tables over database links.

## Querying the past

```sql
-- As of a time (here: 15 minutes ago)
select count(*)
  from orders as of timestamp (systimestamp - interval '15' minute);

-- As of an exact SCN captured earlier
select * from orders as of scn :before_scn
 where customer_id = :cust_id;
```

- Time-based flashback is really SCN-based; Oracle maps the time to a nearby SCN. Use an SCN when precision matters.
- Only the data is historical. The current data dictionary is used, so if the table's structure changed since then (DDL), the query fails. Space-only changes such as PCTFREE do not invalidate undo.
- Relative expressions like `sysdate - 5/1440` move as time passes; each statement sees a different point. Fix one absolute timestamp or SCN and reuse it.

Capture an SCN before risky work:

```sql
variable before_scn number
execute :before_scn := dbms_flashback.get_system_change_number
print before_scn
```

## Saving and restoring data

Copy the old data into a table first; undo may age out while you are working.

```sql
create table orders_before_fix as
select * from orders as of scn :before_scn;

insert into orders
select * from orders_before_fix b
 where not exists (select 1 from orders o where o.order_id = b.order_id);
```

- The saved copy has no indexes or constraints. If related tables were also changed, save each of them as of the same SCN to keep them consistent.
- Compare current and old data with MINUS, NOT EXISTS or correlated subqueries before repairing.

## Finding when rows changed

- `ORA_ROWSCN` gives the SCN of the last committed change for a row. It is tracked per block by default, so other rows in the same block can share or move the value; treat it as approximate.
- `SCN_TO_TIMESTAMP(scn)` converts an SCN to the approximate time of that change.

```sql
select order_id, scn_to_timestamp(ora_rowscn) as last_changed
  from orders
 where customer_id = :cust_id;
```

## Version queries

`VERSIONS BETWEEN` returns one row per committed version in an interval:

```sql
select order_id, status,
       versions_starttime, versions_endtime,
       versions_operation, versions_xid
  from orders
       versions between timestamp
         to_timestamp(:from_ts, 'YYYY-MM-DD HH24:MI:SS')
     and to_timestamp(:to_ts,   'YYYY-MM-DD HH24:MI:SS')
 where order_id = :order_id
 order by versions_startscn nulls first;
```

- `VERSIONS_STARTSCN` / `STARTTIME` NULL: the version existed before the lower bound.
- `VERSIONS_ENDSCN` / `ENDTIME` NULL: the version is current, or was deleted.
- `VERSIONS_OPERATION`: I, U or D. `VERSIONS_XID`: the transaction id.
- Use `VERSIONS BETWEEN SCN a AND b` for SCN bounds. Version queries can appear in subqueries of DML and DDL.
- Too low an `UNDO_RETENTION` raises ORA-30052.

`FLASHBACK_TRANSACTION_QUERY` shows, per transaction id, the user, operation, table, start and end SCN and time, and the SQL that would undo each change. Join on `XID = VERSIONS_XID` to find who changed a row and how to reverse it.

## When the flashback fails

- Not enough undo (space reused by later transactions) makes the query fail; details go to the alert log.
- Probe with several flashback queries to find the oldest reachable point, then save both the oldest data and the data closest to the incident.
- Beyond undo, recovery needs other tools: flashback table or database, Data Pump import from an export, or point-in-time recovery. The flashback queries still help pin down the exact time to recover to.
- If this happens often, ask the DBA to review undo retention and undo tablespace size, and find out why bad transactions keep occurring.

## Workflow
1. Stop further changes to the affected rows if possible; time matters because undo ages out.
2. Establish the point before the bad change: a captured SCN, a known time, or a version query on a sample row.
3. Save the old state into a new table with `CREATE TABLE ... AS SELECT ... AS OF SCN`, for every related table at the same SCN.
4. Compare saved and current data; write the repair (insert missing rows, update changed columns) and show it to the user.
5. Get explicit approval before running the repair against shared or production data; run it in one transaction and verify counts before committing.
6. Drop the scratch copies only after the user confirms the repair.

## Red flags
- Repairing directly from `AS OF` subqueries in a long operation instead of saving a copy first; the undo may vanish mid-repair.
- Mixing relative timestamps across statements and getting inconsistent snapshots.
- Treating ORA_ROWSCN as exact per-row change time.
- Application features (audit history, "undo" buttons) built on flashback queries instead of designed history tables.
- Asking the DBA to change `UNDO_RETENTION` or undo sizing via ALTER SYSTEM without approval; it is an instance-wide setting.
- Expecting flashback across DDL that changed the table structure.

## Related
- `../FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` — FLASHBACK TABLE and FLASHBACK DATABASE when row-level repair is not enough.
- `../DataPump/dataPump.md` — FLASHBACK_SCN/TIME for consistent exports, and import-based recovery.
- `../Tablespaces/tablespaces.md` — undo tablespaces.
- `../../SqlAndSqlPlus/Subqueries/subqueries.md` — EXISTS, NOT EXISTS and MINUS comparisons of old and new data.
- `../../SqlAndSqlPlus/ChangingData/changingData.md` — the INSERT, UPDATE and MERGE statements used for the repair.
- `../../HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` — undo management and recovery planning.
