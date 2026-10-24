---
name: dba-data-dictionary
description: "How to answer questions about an Oracle database by querying its data dictionary (USER_/ALL_/DBA_ views, DICT, V$ views), based on Chapter 45 (The Hitchhiker's Guide to the Oracle Data Dictionary) of Oracle Database 11g: The Complete Reference. Use when the agent must find out which tables, columns, indexes, constraints, views, synonyms, sequences, source code, privileges, roles, quotas, segments, partitions, statistics, scheduler jobs or audit settings exist; when decoding an error that names only a constraint (ORA-00001, ORA-02291, ORA-02437); when a compile fails; or before any DDL, grant or tuning change."
---

# The Hitchhiker's Guide to the Oracle Data Dictionary

The data dictionary is the authoritative, queryable description of everything in the database. Before guessing about a schema, an error or a privilege, query the dictionary: it is read-only, cheap and always current. Start with the USER_ view, widen to ALL_ for objects you can access, and use DBA_ only when you have the privilege and need the whole database.

## Prefixes and scope

- **USER_** — objects owned by the current account (usually no Owner column).
- **ALL_** — USER_ plus objects granted to you or to PUBLIC; adds Owner.
- **DBA_** — every object in the database; needs DBA-level privileges.
- **V$** — dynamic performance views for monitoring; columns change between releases, so check the Reference for your version before interpreting them.
- Some views have no ALL_ version (recycle bin, quotas, segments, extents, system privileges); some have no USER_ version (ALL_DIRECTORIES).
- Short public synonyms exist: DICT, CAT, OBJ, TABS, COLS, IND, SYN, SEQ, CLU, RECYCLEBIN.

Version note: since 12c, multitenant databases add CDB_ views that span all containers above the DBA_ level.

## Don't know which view? Ask the road maps

```sql
select table_name, comments from dict
 where table_name like '%' || upper(:topic) || '%' order by table_name;

select table_name from dict_columns
 where column_name = upper(:col_name) and table_name like 'USER%';
```

DICTIONARY lists every view you can see with a comment; DICT_COLUMNS lets you search by column name (for example, every view with a BLOCKS column).

## Question-to-view map

### What objects exist?

| Question | View |
|---|---|
| Tables, views, synonyms, sequences I can select from | USER_CATALOG (CAT) |
| Every object of any type, created and last DDL time | USER_OBJECTS (OBJ) |
| Table attributes, storage, stats summary, partitioned, dropped, read-only | USER_TABLES (TABS) |
| External tables and their files | USER_EXTERNAL_TABLES, USER_EXTERNAL_LOCATIONS |
| View query text, typed-view details | USER_VIEWS |
| Synonym targets and the db link they use | USER_SYNONYMS (SYN) |
| Sequence min/max, increment, cycle, cache | USER_SEQUENCES (SEQ) |
| Dropped objects that can be recovered | USER_RECYCLEBIN / DBA_RECYCLEBIN |
| Invalid objects across the database | DBA_INVALID_OBJECTS |

USER_OBJECTS.Created resets whenever an object is re-created (for example by an import), so use it with care when reconciling environments; Last_DDL_Time shows the latest change. USER_SEQUENCES.Last_Number is not the last value handed out; it is usually ahead of it because of caching.

### What columns does a table or view have?

- USER_TAB_COLUMNS (COLS) — name, position, datatype, length, precision, scale, nullable, default. More than `describe` shows.
- USER_TAB_COL_STATISTICS — distinct values, nulls, low/high, density; prefer it over the legacy stats columns in COLS.
- USER_TAB_HISTOGRAMS — value distribution used by the optimizer.
- USER_UPDATABLE_COLUMNS — which columns of a join view accept insert, update, delete.
- USER_LOBS — LOB columns and segments (the datatype lives in COLS).

USER_VIEWS.Text is a LONG. In SQL*Plus, read Text_Length first and `set long` to at least that value, or the text is silently cut at 80 characters.

```sql
select text_length from user_views where view_name = 'ORDER_SUMMARY';
set long 5000
select text from user_views where view_name = 'ORDER_SUMMARY';
```

Put column aliases inside the view query rather than in the `create view (...)` header, so the names show up in USER_VIEWS.Text.

### What constraints exist, and which one did I just violate?

- USER_CONSTRAINTS — name, type, status, deferrable/deferred, validated, generated name, referenced constraint (R_Owner, R_Constraint_Name), supporting index.
- Constraint_Type: C check (includes NOT NULL), P primary key, R foreign key, U unique, V view WITH CHECK OPTION, O view WITH READ ONLY.
- USER_CONS_COLUMNS — the columns and their Position. A foreign key points at a constraint, not at columns, so look up R_Constraint_Name again to see the parent side.

```sql
select c.constraint_type, c.table_name, cc.column_name, cc.position,
       c.r_constraint_name
  from user_constraints c
  join user_cons_columns cc on cc.constraint_name = c.constraint_name
 where c.constraint_name = upper(:name_from_error)
 order by cc.position;
```

To find the rows blocking `alter table ... enable constraint`, create the EXCEPTIONS table (utlexcpt.sql), enable with `exceptions into exceptions`, then select from the table `where rowid in (select row_id from exceptions)`.

### What comments document the schema?

- USER_TAB_COMMENTS and USER_COL_COMMENTS; add with `comment on table|column ... is '...'`, clear with `is ''`. These comments are what DICT shows for the dictionary itself.

### What indexes and clusters exist?

- USER_INDEXES (IND) — type, uniqueness, status, visibility, BLevel, Leaf_Blocks, Distinct_Keys, Clustering_Factor, Last_Analyzed.
- USER_IND_COLUMNS — columns in Column_Position order and Descend flag. The leading column matters for access paths.
- USER_IND_EXPRESSIONS (function-based), USER_JOIN_IND_COLUMNS (bitmap join), USER_IND_STATISTICS.
- USER_CLUSTERS (CLU), USER_CLU_COLUMNS (table-to-cluster key mapping).

Clustering_Factor measures how ordered the table rows are relative to the index; the more ordered, the cheaper range scans.

### What object types, collections and directories exist?

- USER_TYPES, USER_TYPE_ATTRS, USER_TYPE_METHODS, USER_METHOD_PARAMS (shows the implicit SELF parameter), USER_METHOD_RESULTS.
- USER_REFS, USER_COLL_TYPES, USER_NESTED_TABLES, USER_VARRAYS.
- ALL_DIRECTORIES — directory name and OS path for BFILEs and external tables.

### What remote links and materialized views exist?

- USER_DB_LINKS — link, username, host. Host keeps the case it was created with, so compare with `upper(host)`. ALL_/DBA_ versions show Owner instead of the password column.
- USER_MVIEWS — container table, refresh mode/method, last refresh, staleness, Master_Link (join to USER_DB_LINKS).
- USER_MVIEW_ANALYSIS (rewrite support), USER_MVIEW_AGGREGATES, USER_MVIEW_JOINS, USER_MVIEW_REFRESH_TIMES, USER_REFRESH, USER_MVIEW_LOGS, USER_BASE_TABLE_MVIEWS.

### What code exists, and why won't it compile?

- USER_SOURCE — one row per line; always `order by line`.
- USER_ERRORS — name, type, line, position, text, ERROR vs WARNING; `order by sequence`. Query it directly when `show errors` hides package body or multi-object errors.
- USER_TRIGGERS, USER_TRIGGER_COLS, USER_TRIGGER_ORDERING (follows/precedes).
- USER_OBJECT_SIZE — source, code, parsed and error size of stored code.
- USER_STORED_SETTINGS — persistent PL/SQL compiler settings.
- USER_DEPENDENCIES — one level only; run utldtree.sql and query IDEPTREE for the full indented tree before changing a widely used object.

```sql
select line, position, attribute, text
  from user_errors
 where name = upper(:unit) and type = 'PACKAGE BODY'
 order by sequence;
```

### Who has which privileges and roles?

- USER_USERS — own account status, lock/expiry date, default and temporary tablespace. ALL_USERS lists all usernames; DBA_USERS adds profile.
- USER_RESOURCE_LIMITS, USER_PASSWORD_LIMITS (current session); DBA_PROFILES for all profiles.
- USER_TAB_PRIVS (and _MADE, _RECD), USER_COL_PRIVS — object and column grants, Grantable flag.
- USER_SYS_PRIVS — direct system privileges only; privileges received via roles do not appear.
- USER_ROLE_PRIVS — roles granted, admin option, default role.
- ROLE_TAB_PRIVS, ROLE_SYS_PRIVS, ROLE_ROLE_PRIVS — what each role contains.
- SESSION_PRIVS, SESSION_ROLES — what is actually enabled right now. Check these first when "it works for me but not for them".

### How much space is used, and where?

- USER_TABLESPACES — accessible tablespaces and their defaults (extent management, segment space management, bigfile, encrypted).
- USER_TS_QUOTAS — bytes used versus Max_Bytes; DBA_TS_QUOTAS across users.
- USER_SEGMENTS, USER_EXTENTS — allocated bytes, blocks and extents per segment.
- USER_FREE_SPACE / DBA_FREE_SPACE — free extents and fragmentation; DBA_TEMP_FREE_SPACE for temp.
- USER_PART_TABLES, USER_TAB_PARTITIONS, USER_TAB_SUBPARTITIONS, USER_PART_KEY_COLUMNS, USER_SUBPART_KEY_COLUMNS, USER_IND_PARTITIONS, USER_IND_SUBPARTITIONS.

```sql
select segment_name, segment_type, round(sum(bytes)/1024/1024) mb
  from user_segments
 group by segment_name, segment_type
 order by mb desc;
```

### Are optimizer statistics present and current?

- USER_TABLES / USER_TAB_STATISTICS — Num_Rows, Blocks, Avg_Row_Len, Chain_Cnt, Last_Analyzed.
- USER_TAB_COL_STATISTICS, USER_TAB_HISTOGRAMS, USER_PART_COL_STATISTICS, USER_PART_HISTOGRAMS and the USER_SUBPART_ equivalents.
- USER_TAB_PENDING_STATS, USER_COL_PENDING_STATS, USER_IND_PENDING_STATS — collected but not yet published (11g).
- USER_TAB_STAT_PREFS (gathering preferences), USER_STAT_EXTENSIONS (column groups and expressions).
- Chained or migrated rows: create CHAINED_ROWS (utlchain.sql), run `analyze table orders list chained rows into chained_rows`, then select by Head_RowID.

### What jobs, advisors, outlines and audit settings exist?

- USER_SCHEDULER_JOBS, _PROGRAMS, _PROGRAM_ARGS, _SCHEDULES; run history in USER_SCHEDULER_JOB_LOG, _JOB_RUN_DETAILS, _RUNNING_JOBS.
- USER_ADVISOR_RECOMMENDATIONS, _ACTIONS, _RATIONALE, _LOG, _PARAMETERS; DBA_ADDM_* and DBA_ADVISOR_* in 11g.
- USER_OUTLINES, USER_OUTLINE_HINTS; DBA_SQL_PLAN_BASELINES for plan baselines.
- USER_AUDIT_TRAIL (and _OBJECT, _SESSION, _STATEMENT); USER_OBJ_AUDIT_OPTS (S/U flags per command), ALL_DEF_AUDIT_OPTS, AUDIT_ACTIONS code table.
- NLS_SESSION_PARAMETERS, NLS_INSTANCE_PARAMETERS, NLS_DATABASE_PARAMETERS for globalization settings.
- PLAN_TABLE (utlxplan.sql) holds `explain plan` output; see the tuning skill.

## Workflow
1. Restate the question as "which object type, which attribute?".
2. If unsure of the view, search DICT by name and DICT_COLUMNS by column.
3. Query the USER_ view; widen to ALL_ (filter by Owner) or DBA_ only if needed and permitted.
4. Filter on names in uppercase unless the object was created with quoted mixed case.
5. Join the summary view to its detail view (CONSTRAINTS to CONS_COLUMNS, INDEXES to IND_COLUMNS, PART_TABLES to TAB_PARTITIONS) for the full picture.
6. Order multi-row text by its sequence column (Line, Sequence, Position).
7. Report what the dictionary shows, and say when statistics-based columns may be stale (check Last_Analyzed).

## Red flags
- Guessing table or column names instead of reading COLS or OBJ.
- Using USER_SYS_PRIVS to decide that a user lacks a privilege; role-based grants live elsewhere (check SESSION_PRIVS and the ROLE_ views).
- Trusting Num_Rows, Clustering_Factor or histograms without checking Last_Analyzed.
- Reading USER_VIEWS.Text without `set long` and concluding a view is short.
- Comparing db link Host or quoted object names case-sensitively by accident.
- Interpreting V$ columns from memory across versions.
- Deleting and reinserting chained rows, purging the recycle bin, enabling constraints with exceptions, or adding comments: these change data or metadata. Confirm the target environment and get explicit approval first. A purge cannot be undone; an object purged from the recycle bin needs a backup or flashback database to recover.
- Requesting extra grants just to query DBA_ views; ask the user or DBA instead.

## Related
- `../TuningApplicationsAndSql/tuningApplicationsAndSql.md` — use PLAN_TABLE, index and statistics views to tune SQL.
- `../DatabaseAdministration/databaseAdministration.md` — DBA-only views and space management.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — creating the objects these views describe.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — users, roles and grants behind the privilege views.
- `../../SqlAndSqlPlus/Partitioning/partitioning.md` — partition views in context.
- `../../BeyondTheBasics/FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` — recovering objects listed in the recycle bin.
- `../../PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` — compiling code reported in USER_ERRORS.
