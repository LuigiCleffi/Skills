---
name: dba-sql-replay
description: Capturing a production database workload and replaying it on an isolated test database (Database Replay with DBMS_WORKLOAD_CAPTURE, DBMS_WORKLOAD_REPLAY and the wrc replay client) to measure the impact of changes, based on Chapter 31 (SQL Replay) of Oracle Database 11g: The Complete Reference. Use when a user wants to "test an upgrade/parameter change/patch with real production load", "replay production traffic", compare AWR before and after a change, evaluate a packaged application whose code they cannot see, or asks about workload capture filters, PROCESS_CAPTURE, wrc calibrate, REMAP_CONNECTION, think time or connect time scaling.
---

# SQL Replay

Database Replay records everything executed in a source database, wherever it came from, and re-executes it with the original timing and concurrency on a target database. The replay is only meaningful, and only safe, when the target starts from the same data as the source and is cut off from everything the source can reach.

## Components

- **Source:** the workload capture writes the executed SQL to files in a directory object.
- **Target:** preprocessing turns the capture into replay files, replay clients (`wrc`) open the sessions, and the replay drives the SQL through those clients.
- **Analysis:** AWR data from the capture and from each replay is exported and compared.

Use the target only as a test system. Never replay into production.

## Isolate before you capture

Replayed transactions do everything the originals did. If the target can reach the same remote systems, the replay repeats real side effects.

- Inventory database links, remote materialized view refreshes, directory objects, `UTL_FILE`, URLs and e-mail-sending code in the source. On the target, remove them or point them to harmless stand-ins.
- Redirect the production service name on the target host (for example `PROD` in the target's network config) to the target database, because captured sessions will try to connect to it.
- Time-dependent behavior (`SYSDATE`, scheduled jobs) differs unless the target's system clock is reset to the capture start before each replay.

## Preparing the source

1. Start with no in-flight transactions: end active sessions or restart the instance. Restricted mode gives tighter control, but check that it still reflects normal usage.
2. Take a consistent copy of the data at the capture start (RMAN or Data Pump) so the target can be built from it.
3. Create a directory object on a file system with monitored free space:

```sql
create directory capture_dir as '/u01/app/capture';
```

## Capturing

By default everything is captured. Filters (`ADD_FILTER`) restrict by `INSTANCE_NUMBER`, `USER`, `MODULE`, `ACTION`, `PROGRAM` or `SERVICE`.

```sql
begin
  DBMS_WORKLOAD_CAPTURE.ADD_FILTER(fname => 'batch_user',
                                   fattribute => 'USER', fvalue => 'BATCH');
  DBMS_WORKLOAD_CAPTURE.START_CAPTURE(name => 'peak_monday',
                                      dir  => 'CAPTURE_DIR',
                                      duration => 3600,       -- seconds; NULL = until finished
                                      default_action => 'INCLUDE');
end;
/
```

- `default_action => 'INCLUDE'` captures everything except what matches the filters. `'EXCLUDE'` captures only what matches.
- `auto_unrestrict` (default TRUE) takes the instance out of restricted mode once the capture starts.
- Stop the capture with `DBMS_WORKLOAD_CAPTURE.FINISH_CAPTURE`, unless a duration was set.
- Get the capture ID with `GET_CAPTURE_INFO(dir)` or from `DBA_WORKLOAD_CAPTURES`, then run `EXPORT_AWR(capture_id)` so the target can compare against it. `REPORT` summarizes the capture, and `DELETE_FILTER` and `DELETE_CAPTURE_INFO` clean up.

## Preprocessing and replay on the target

The target should be a clone of the source as of the capture start, on the same Oracle version. Copy the capture files to it and create a directory object for them.

```sql
exec DBMS_WORKLOAD_REPLAY.PROCESS_CAPTURE(capture_dir => 'REPLAY_DIR');  -- once per capture
exec DBMS_WORKLOAD_REPLAY.INITIALIZE_REPLAY(replay_name => 'upgrade_test', replay_dir => 'REPLAY_DIR');
-- optional: DBMS_WORKLOAD_REPLAY.REMAP_CONNECTION(...) for captured connect strings
exec DBMS_WORKLOAD_REPLAY.PREPARE_REPLAY(synchronization => TRUE);
```

On a RAC target, one instance can do the preprocessing.

`PREPARE_REPLAY` options:
- `synchronization` (TRUE) keeps the original commit order.
- `connect_time_scale` and `think_time_scale` are percentages. 100 keeps the original timing, smaller values compress the gaps (more concurrency), and 200 doubles them.
- `think_time_auto_correct` (TRUE) shortens think time when calls run slower than they did during capture.

Start the replay clients from `$ORACLE_HOME/bin`. They connect with a DBA account other than SYS and need read access to the processed files:

```sh
wrc mode=calibrate replaydir=/u01/app/replay          # recommends client count
wrc replay_admin@testdb mode=replay replaydir=/u01/app/replay   # prompts for password
```

One client runs many sessions. Run `wrc` with no arguments to list its options. Then start the replay:

```sql
exec DBMS_WORKLOAD_REPLAY.START_REPLAY;
-- abort if needed: exec DBMS_WORKLOAD_REPLAY.CANCEL_REPLAY;
exec DBMS_WORKLOAD_REPLAY.EXPORT_AWR(replay_id => :replay_id);
```

Look up replay IDs and history in `DBA_WORKLOAD_REPLAYS` or with `GET_REPLAY_INFO`, and use `REPORT` for the replay report. Compare the replay's AWR data with the capture's.

To replay again (for example, after changing one parameter), restore the target data to the capture start and reset the clock first.

## Workflow
1. Define the question: which single change (upgrade, parameter, index, hardware) is being evaluated?
2. Audit the source for links, external files, e-mail and remote refreshes, and plan how the target will neutralize each one.
3. Get approval for the capture window. Quiesce the source and take the baseline copy.
4. Create the directory object, add filters, start the capture, finish it, and export AWR.
5. Build the isolated target from the baseline, on the same version. Redirect service names and reset the clock.
6. Process the capture, initialize, remap connections, prepare, calibrate and start `wrc`, then start the replay.
7. Export the replay's AWR data and compare it with the capture's. Change one thing at a time, restoring the data before each run.

## Red flags
- Replaying on a target that still has working database links, mail, `UTL_FILE` paths or remote materialized view sources.
- Replaying a test capture into production.
- Starting the capture with active transactions, or without a matching data baseline.
- Capture directory on an unmonitored file system that can fill up.
- Running a second replay without restoring the data and resetting the clock.
- Changing several variables between replays, so the AWR differences can't be attributed to any one of them.
- Using SYS for replay clients, or putting passwords on shared command lines.

## Related
- `../DataPump/dataPump.md`: building the target baseline from the source data.
- `../RemoteData/remoteData.md`: database links that must be neutralized on the target.
- `../FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md`: rewinding the target database between replays.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md`: reading the AWR comparisons.
- `../../CriticalConcepts/Upgrading/upgrading.md`: using replay to validate an upgrade.
