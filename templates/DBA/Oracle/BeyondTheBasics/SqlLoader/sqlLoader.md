---
name: dba-sql-loader
description: Loading flat files into Oracle tables with SQL*Loader (control files, load methods, error handling, restarts and Direct Path tuning), based on Chapter 23 (Using SQL*Loader to Load Data) of Oracle Database 11g: The Complete Reference. Use when the user needs to bulk-load CSV, fixed-width or multi-line text files, writes or debugs a .ctl control file, runs sqlldr, reads .log/.bad/.dsc output, restarts a partial load, or wants faster loads (DIRECT=TRUE, UNRECOVERABLE, parallel, disabling indexes or triggers).
---

# Using SQL*Loader to Load Data

SQL*Loader turns a text datafile plus a control file into inserts against Oracle tables. Treat a load as a batch job: make it repeatable, make failures cheap to diagnose from the log and bad files, and never trade away recoverability for speed without the DBA's agreement.

## The files involved

- **Control file (.ctl)**: where the data is, which table(s) to load, how fields are found, filters and transformations. Keep it separate from the data so it can be reused.
- **Datafile**: the input records. Defaults to the control file name with `.dat`.
- **Log file (.log)**: rows read, loaded, rejected, discarded, commit points and the Oracle error for each rejected record. Always read it.
- **Bad file (.bad)**: records rejected by data errors or Oracle (constraint violations, conversion errors). Fix and reload it as the new input.
- **Discard file (.dsc)**: records that failed a `WHEN` condition. Reload it later if those rows were wrongly filtered.

The loading user needs INSERT on the target table (and DELETE when using `REPLACE`).

## Control file shapes

Delimited data:

```
-- Load daily order extract
LOAD DATA
INFILE 'orders.csv'
BADFILE '/loads/bad/orders.bad'
APPEND
INTO TABLE orders
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
TRAILING NULLCOLS
(order_id, customer_id, status,
 order_date DATE "YYYY-MM-DD",
 loaded_at  SYSDATE)
```

Fixed-width data uses positions; no lengths are needed because start and end give the width:

```
(customer_id POSITION(01:10) INTEGER EXTERNAL,
 name        POSITION(11:60) CHAR NULLIF name=BLANKS "UPPER(:name)")
```

Pick a delimiter that never appears inside values, or enclose values in quotes.

## Table load modes

- `INSERT` (default): table must be empty, otherwise the load aborts.
- `APPEND`: add rows to existing data.
- `REPLACE`: delete existing rows, then load (needs DELETE privilege).
- `TRUNCATE`: truncate before loading. Cannot be rolled back.

## Field features worth knowing

- `WHEN col = 'X'` filters rows per `INTO TABLE`; failures go to the discard file. Combine conditions with `AND`.
- `TRAILING NULLCOLS` makes missing trailing fields NULL instead of rejecting the record.
- `NULLIF col=BLANKS` stores NULL for blank fields.
- A quoted SQL expression transforms the value, e.g. `"UPPER(:name)"`, `":amount/100"` for implied decimals.
- `DATE "mask"` parses dates; `SYSDATE`, `CONSTANT 'value'` and `RECNUM` fill columns without input.
- `SEQUENCE(MAX,1)` or `SEQUENCE(100,2)` generates numbers; values for rejected rows are skipped, not reused. Do not use it on numbers stored in VARCHAR2 columns, because the character maximum is wrong ('9' > '10').

## Logical versus physical records

- `CONCATENATE n` joins a fixed number of physical lines into one logical row.
- `CONTINUEIF NEXT (1:2) = '**'` (or `THIS`) joins lines based on a continuation marker, which is dropped from the merged record.
- Several `INTO TABLE` clauses read the same physical record, so one line can produce several rows or feed several tables (useful for denormalized input).

## Running a load

```
sqlldr userid=loader@dev control=orders.ctl log=orders.log \
       errors=0 discardmax=100 rows=5000
```

Options that matter:
- `errors` (default 50) and `discardmax` (default unlimited): abort early instead of half-loading bad data. Tight for clean, controlled sources; looser for third-party files.
- `rows`: commit interval for conventional loads (default 64), keeping transactions small.
- `skip`: skip logical records already loaded when restarting.
- `load`: load only the first N records (good for a trial run).
- `direct`, `parallel`, `parfile`, `silent=(HEADER,FEEDBACK)`.
- `resumable`, `resumable_name`, `resumable_timeout`: suspend instead of failing on space errors, fix the space, let it resume.
- Settings in the control file override the command line.

Do not put the password on the command line in shared environments; omit it to be prompted, or use `userid=/` for an externally identified account.

## Restarting a failed or partial load

A load often partly succeeds. To recover:
1. Read the log: commit points, the count loaded, and each rejection's error.
2. Choose one path: delete the loaded rows and rerun everything, rerun with `skip=N` past the committed records, or load only the corrected bad file.
3. If keys come from `SEQUENCE`, rerunning will not hit a primary key violation; rows will be inserted twice. Prefer `skip` or the bad file.
4. Reload wrongly discarded rows from the discard file.

## Direct Path and tuning

- `DIRECT=TRUE` writes formatted blocks above the high-water mark instead of running inserts. Much faster, but no SQL functions on fields, and triggers do not fire even if enabled.
- Indexes go into a DIRECT LOAD state and are rebuilt at the end; presort input by the index key and declare `SORTED INDEXES` to cut temp space. Check `USER_INDEXES.STATUS` is VALID afterwards.
- Direct Path never reuses free space below the high-water mark, so a deleted-then-reloaded table grows. Only truncate or re-creation lowers it.
- `UNRECOVERABLE` (Direct Path only) or NOLOGGING tables skip redo. The data then cannot be recovered from archived logs; keep the input files and take a backup afterwards.
- Parallel Direct Path, or concurrent loads into separate partitions, spread the work across CPUs.
- Other levers, all coordinated with the DBA: load off-peak to avoid read-consistency undo overhead, preallocate space, disable unneeded triggers and constraints, drop and rebuild indexes on clean data.

For querying a file in place without loading it, use an external table instead.

## Workflow
1. Inspect the file: delimiter, enclosure, date formats, header lines, multi-line records, character set.
2. Confirm the target table, its constraints and triggers, and the load mode (APPEND unless told otherwise).
3. Write a commented control file; run a trial with `load=100` against a non-production schema.
4. Read the log; fix the control file or data until rejections are understood.
5. Run the full load with `errors` and `discardmax` set to the tolerance agreed for this source.
6. Verify row counts against the log and the source, check index status, then archive the log, bad, discard and data files so the next run does not overwrite them.

## Red flags
- `TRUNCATE` or `REPLACE` in a control file pointed at a shared or production table: confirm the environment and get explicit approval first; there is no rollback.
- `UNRECOVERABLE`, NOLOGGING or switching to NOARCHIVELOG to speed a load without DBA approval and an immediate backup afterwards.
- Ignoring the bad file or reporting success from exit status alone.
- Rerunning a whole file after a partial load that used `SEQUENCE`, creating duplicates.
- Direct Path loads into tables whose triggers enforce business rules, silently skipping them.
- Large loads during peak hours on tables users are querying.

## Related
- `../ExternalTables/externalTables.md` — query or load files through SQL using the same ORACLE_LOADER driver.
- `../DataPump/dataPump.md` — moving data between Oracle databases rather than from flat files.
- `../Tablespaces/tablespaces.md` — space preallocation and NOLOGGING settings for load targets.
- `../../SqlAndSqlPlus/ChangingData/changingData.md` — INSERT, APPEND hint and multitable inserts as SQL alternatives.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md` — loading partitions concurrently.
