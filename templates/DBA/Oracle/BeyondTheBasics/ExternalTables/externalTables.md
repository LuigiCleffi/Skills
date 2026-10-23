---
name: dba-external-tables
description: Querying flat files in place and unloading query results to dump files with Oracle external tables (ORGANIZATION EXTERNAL, ORACLE_LOADER and ORACLE_DATAPUMP drivers), based on Chapter 28 (Using External Tables) of Oracle Database 11g: The Complete Reference. Use when the user wants to read a CSV or delimited file with SQL without loading it, stage files for INSERT /*+ APPEND */ ... SELECT loads, writes ACCESS PARAMETERS, sets REJECT LIMIT, sees errors only at query time, hits ORA-30657 on constraints or indexes, or needs to unload a table to a portable dump file.
---

# Using External Tables

An external table is a table definition whose rows live in operating system files read (or written once) by an access driver. Use it to query or stage file data with plain SQL; expect read-only, unindexed, full-scan behavior, and remember the files are now part of what must be backed up.

## Prerequisites

- A directory object pointing to the file location, created by a user with CREATE ANY DIRECTORY.
- READ on the directory for every user who queries the table; WRITE if the driver must create log, bad or discard files there.
- The files must be readable by the Oracle software owner at the OS level; the driver runs on the database server, not the client.

```sql
create directory ext_dir as '/data/incoming';
grant read, write on directory ext_dir to app_owner;
```

## Creating a reader table (ORACLE_LOADER)

```sql
create table orders_ext (
  order_id    number,
  customer_id number,
  status      varchar2(20),
  order_date  date
)
organization external (
  type oracle_loader
  default directory ext_dir
  access parameters (
    records delimited by newline
    skip 1
    badfile ext_dir:'orders.bad'
    logfile ext_dir:'orders.log'
    fields terminated by ',' optionally enclosed by '"'
    (order_id, customer_id, status,
     order_date char(10) date_format date mask "YYYY-MM-DD")
  )
  location ('orders_2010.csv')
)
reject limit 0;
```

The four subclauses:
- **type**: `ORACLE_LOADER` (default, reads text) or `ORACLE_DATAPUMP` (reads and writes dump files).
- **default directory**: used for any file not given its own directory.
- **access parameters**: SQL*Loader-like record and field rules: `records delimited by`, `skip n`, `load when (cond)`, field delimiters, datatypes, `badfile` / `discardfile` / `logfile` (or `nobadfile`, `nodiscardfile`, `nologfile`), `missing field values are null`.
- **location**: one or more files, as `'file'` or `dir_obj:'file'`. Always directory object names, never OS paths.

`REJECT LIMIT n | UNLIMITED` sets how many bad rows a query tolerates; the default is 0, so any bad row fails the query.

## Behavior to expect

- Creation does only cursory checks. Syntax and data errors appear when you first query, so always run a test query right away.
- Clause order in access parameters matters; a misplaced clause can make every row fail.
- `skip` applies only to the first file in `location`; list files in the order you mean.
- Rows failing `load when` go to the discard file; rows failing parsing go to the bad file.
- `missing field values are null` can silently turn junk lines (headers, trailers) into rows. Prefer letting bad rows fail and inspecting the bad file.
- The table reflects the files at query time; replacing a file changes the data immediately.
- `PROJECT COLUMN REFERENCED` (default) parses only selected columns, so different column lists can reject different rows. Use `alter table ... project column all` for consistent results.

## Limits

- No UPDATE, DELETE or INSERT through SQL.
- No indexes and no constraints (ORA-30657, even for NOT NULL).
- Every query is a full scan of the files.
- Gather statistics with `DBMS_STATS`, not `ANALYZE`.

## Loading from an external table

The common pattern is a direct-path, parallel insert:

```sql
alter session enable parallel dml;

insert /*+ append parallel(o, 4) */ into orders o
select order_id, customer_id, upper(status), order_date
  from orders_ext
 where order_date >= date '2010-01-01';
commit;
```

- Transformations live in SQL or in the table definition, visible in `USER_EXTERNAL_TABLES`, instead of in control files.
- For speed: fixed-format fields, no character set or datatype conversions, no NULLIF/DEFAULTIF, and `nobadfile` when bad rows are impossible.

## Unloading with ORACLE_DATAPUMP

```sql
create table orders_unload
organization external (
  type oracle_datapump
  default directory ext_dir
  access parameters (compression enabled)
  location ('orders_2010.dmp')
)
as select * from orders where order_date < date '2011-01-01';
```

- Writes the query result to a dump file once; no further DML on it.
- The dump file can back another external table in this or another database.
- 11g adds `compression enabled` and `encryption enabled` (both off by default).

## Altering

`alter table` on an external table can change `access parameters`, `location`, `default directory`, `reject limit`, `parallel`, `project column`, add, modify or drop columns, and rename. Changing the definition keeps grants; the files are not modified.

## Inspecting

```sql
select table_name, default_directory_name, reject_limit, access_parameters
  from user_external_tables;

select table_name, location, directory_name
  from user_external_locations;
```

## Uses worth considering

- Staging files for warehouse loads without separate loader jobs.
- Swapping data by replacing files, e.g. several external tables combined in a UNION ALL view.
- Keeping sensitive or rarely used data outside the database, readable only by users with READ on its directory.

## Workflow
1. Inspect the file: delimiter, enclosures, header and trailer lines, date formats, character set.
2. Create or confirm the directory object and grants.
3. Create the external table with explicit bad and log files and `reject limit 0`.
4. Query immediately: `select count(*)` and a sample; read the log and bad files.
5. Adjust access parameters with `alter table` until rejections are understood; raise the reject limit only deliberately.
6. Load with `insert /*+ append */ ... select` if the data must live in the database; verify counts.
7. Add the external files to the backup plan.

## Red flags
- Creating directory objects on broad paths (for example a root or home directory) or granting WRITE widely; confirm the path and grantees with the user or DBA first.
- `reject limit unlimited` hiding data problems.
- Assuming creation succeeded means the definition works.
- Expecting indexes, constraints or DML on the table.
- Overwriting a referenced file with a different layout while queries or loads depend on it.
- External files missing from backups.

## Related
- `../SqlLoader/sqlLoader.md` — same access-parameter vocabulary; batch loads from files.
- `../DataPump/dataPump.md` — dump files and directory objects shared with ORACLE_DATAPUMP.
- `../../SqlAndSqlPlus/ChangingData/changingData.md` — INSERT ... SELECT and the APPEND hint.
- `../../SqlAndSqlPlus/SqlPlusReports/sqlPlusReports.md` — spooling query output to flat files.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — directory privileges.
