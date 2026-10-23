---
name: dba-upgrading
description: Choosing and executing an upgrade path to Oracle Database 11g (DBUA, manual direct upgrade, Data Pump or original Export/Import, data copy over database links), with pre-upgrade checks, backups, fallback and post-upgrade verification, based on Chapter 3 (Upgrading to Oracle Database 11g) of Oracle Database 11g: The Complete Reference. Use when the user plans or runs a database upgrade or migration, mentions dbua, utlu111i.sql, catupgrd.sql, utlrp.sql or startup upgrade, asks which exp/imp version to use between releases, or sees invalid objects or lost CONNECT privileges after an upgrade.
---

# Upgrading to Oracle Database 11g

An upgrade is a production change with a defined fallback. Pick the path from the source version, database size, team skill and allowed downtime; rehearse it on a test copy; back up database and software first; and prove the result with tests prepared before you started.

## Choosing the path

| Path | Kind | When |
|---|---|---|
| DBUA (Database Upgrade Assistant) | Direct, in place | Default choice, including very large databases; guided, recommends fixes |
| Manual upgrade with scripts | Direct, in place | Need full control of each step; higher risk of doing steps out of order |
| Data Pump / original Export-Import | Indirect, new database | Want to move only some schemas, tablespaces, tables or rows; smaller databases |
| Copy over database links (`create table as select`, `insert ... select`) | Indirect, new database | Few, small tables; need to restructure data during migration |

- Direct upgrade to 11.1 is supported only from 9.2.0.4+ (9.2.0.8 preferred), 10.1.0.2+ or 10.2.0.1+. Older releases first need intermediate upgrades or an indirect path; budget time for them.
- Direct paths are faster and need less disk. Indirect paths keep the old database intact (easy fallback, parallel running) but re-insert every row and need space for several copies.

## Before upgrading (any path)

- Read the installation and upgrade guides for the OS; fix OS patches and kernel parameters first.
- Back up the database and the Oracle software.
- Write functional and performance test scripts to run before and after.
- Rehearse on a test copy to find missing components and measure duration.
- Gather dictionary statistics ahead of time to shorten the upgrade window:

```sql
exec dbms_stats.gather_dictionary_stats;
```

- Run the Pre-Upgrade Information Tool from the new home against the old database (mandatory for manual upgrades):

```sql
-- copy $NEW_HOME/rdbms/admin/utlu111i.sql outside the Oracle home first
connect / as sysdba
spool upgrade_info.log
@utlu111i.sql
spool off
```

- After the upgrade the `CONNECT` role keeps only `CREATE SESSION`. Find users relying on it and grant the needed privileges explicitly.

## DBUA

`dbua` (UNIX) or the Configuration and Migration Tools menu (Windows). Upgrades one database at a time; can move files, set a flash recovery area, run pre-checks (obsolete parameters, undersized files), recompile invalid PL/SQL, and take an offline backup with a restore script. If results are unacceptable its Restore option restores automatically only when DBUA took the backup. On exit it updates and reloads the listener configuration.

## Manual direct upgrade

Follow the Oracle Database Upgrade Guide for the exact release. Outline:
1. Shut down the database and every service using it; take an offline backup.
2. Prepare the new Oracle home and its configuration files.
3. `startup upgrade` from the new home.
4. From 9.2 only: create the `SYSAUX` tablespace.
5. Run `catupgrd.sql`, restart the instance.
6. Run `utlu111s.sql` (Post-Upgrade Status Tool), then `catuppst.sql`, then `utlrp.sql` to recompile.

Recompile right away; otherwise the first users pay for run-time recompilation.

## Export/Import path

- Always export with the **source** release's utility and import with the **target** release's utility. Dump files are not backward compatible.
- From 10.1 or 10.2: Data Pump Export (source version) and Data Pump Import 11.1. From 9.2 and earlier: original `exp` (source version) and original `imp` 11.1.
- Make the export consistent, or block updates during and after it.
- In the target, pre-create users and tablespaces with the correct datafile names. Never use Import's `DESTROY` option when old and new databases share a server: it can overwrite the other database's datafiles.
- Review the import log for objects that failed.
- Keep source and target running concurrently if space allows.

## Data-copy path

Pre-create tablespaces, users and tables; create database links to the source; copy with `insert ... select`. Freeze source transactions during the copy and preserve relationships between tables. To speed it up: disable indexes and constraints until loaded, run jobs in parallel, use parallel query, and the `APPEND` hint.

```sql
insert /*+ APPEND */ into orders select * from orders@old_db where order_date >= :cutoff;
commit;
```

## After upgrading

- Update `tnsnames.ora`, `listener.ora` (reload the listener manually if DBUA was not used), environment variables (`ORACLE_HOME`, `PATH`) and programs with hard-coded instance names.
- Remove deprecated and obsolete initialization parameters; upgrade the RMAN recovery catalog; relink or recompile programs that use the Oracle libraries.
- Run the prepared functional and performance tests; if problems cannot be fixed, revert to the prior release from backup.

```sql
select comp_name, version, status from dba_registry;
select owner, object_type, count(*) from dba_objects where status = 'INVALID' group by owner, object_type;
```

## Workflow
1. Identify source version, size, downtime window and fallback requirement; choose the path from the table.
2. Get explicit approval for the target environment and window; an in-place upgrade cannot be undone without restoring the backup.
3. Back up database and software; rehearse on a copy; gather dictionary stats; run `utlu111i.sql` and fix every finding.
4. Execute the chosen path, logging every step.
5. Run post-upgrade checks, recompile, fix configuration files, then run the test scripts.
6. Decide go or revert; keep the backup (or the old database) until the users sign off.

## Red flags
- Upgrading production without a rehearsal or a restorable backup.
- Skipping the pre-upgrade tool, or ignoring its warnings.
- Importing a newer dump with an older `imp`, or using a target-version `exp` against the source.
- Import `DESTROY=Y` on a shared server.
- Users suddenly lacking privileges because they depended on the old `CONNECT` role.
- Invalid objects left for users to trigger recompilation.
- Applications still pointing at the old instance name or listener.

Version note: `utlu111i.sql`, `catupgrd.sql` and friends are 11g-specific; later releases ship different pre-upgrade and upgrade tools (AutoUpgrade from 19c), so always follow the target release's Upgrade Guide.

## Related
- `../InstallingAndCreating/installingAndCreating.md` — install the new software home first.
- `../../BeyondTheBasics/DataPump/dataPump.md` — Data Pump Export and Import details.
- `../../BeyondTheBasics/RemoteData/remoteData.md` — database links for the data-copy path.
- `../../HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` — backups, RMAN and recovery catalog.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` — performance checks after the upgrade.
