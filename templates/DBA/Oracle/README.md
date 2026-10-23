## AI Skills

Before writing SQL or PL/SQL for an Oracle database, changing an Oracle
schema, moving data, tuning, or administering Oracle, find the skills that
apply to the task in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of *Oracle Database 11g: The Complete
Reference*. Where a feature changed materially in later releases, the skill
carries a short version note. Check the target database's version
(`select banner from v$version`) before relying on version-specific syntax.

### Critical database concepts (Part I)

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./CriticalConcepts/ArchitectureOptions/architectureOptions.md` | Choosing Oracle table, index or storage features; database vs. instance; recycle bin space surprises. |
| 2 | `./CriticalConcepts/InstallingAndCreating/installingAndCreating.md` | Planning an install or a new database with OUI/DBCA; block size, character set and edition decisions. |
| 3 | `./CriticalConcepts/Upgrading/upgrading.md` | Planning or running an Oracle upgrade or migration: DBUA, manual scripts, export/import, post-upgrade checks. |
| 4 | `./CriticalConcepts/PlanningApplications/planningApplications.md` | Designing a schema: normalization, naming standards, codes and overloaded keys, task-driven analysis, test planning. |

### SQL and SQL*Plus (Part II)

| Ch | Skill | Use when |
|---|---|---|
| 5 | `./SqlAndSqlPlus/BasicSql/basicSql.md` | Writing or debugging basic queries: WHERE operators, NULL, LIKE, AND/OR precedence, simple subqueries, joins, views. |
| 6 | `./SqlAndSqlPlus/SqlPlusReports/sqlPlusReports.md` | Formatting SQL*Plus output, report scripts, break/compute subtotals, spooling, buffer editing, login.sql. |
| 7 | `./SqlAndSqlPlus/TextFunctions/textFunctions.md` | Cleaning, splitting, padding, trimming or recasing text; SUBSTR/INSTR parsing; SOUNDEX duplicates; CHAR vs. VARCHAR2. |
| 8 | `./SqlAndSqlPlus/RegularExpressions/regularExpressions.md` | Pattern matching beyond LIKE: validating, extracting, counting or reformatting text with REGEXP_ functions. |
| 9 | `./SqlAndSqlPlus/NumberFunctions/numberFunctions.md` | Rounding, NULL arithmetic, aggregates, GREATEST/LEAST, ORA-00937/00978, operator precedence in calculations. |
| 10 | `./SqlAndSqlPlus/Dates/dates.md` | Date arithmetic, TO_DATE/TO_CHAR formats, century bugs, MM vs. MI, time zones, TIMESTAMP and INTERVAL types. |
| 11 | `./SqlAndSqlPlus/ConversionFunctions/conversionFunctions.md` | Mixed datatypes in predicates, ORA-01722/ORA-00932, an index not used after implicit conversion, TRANSLATE. |
| 12 | `./SqlAndSqlPlus/Grouping/grouping.md` | Counts and averages per category, ORA-00937, HAVING vs. WHERE, views of groups, finding duplicate keys. |
| 13 | `./SqlAndSqlPlus/Subqueries/subqueries.md` | Rows with or without matches, correlated subqueries, EXISTS/NOT EXISTS, outer joins, UNION/INTERSECT/MINUS. |
| 14 | `./SqlAndSqlPlus/ComplexQueries/complexQueries.md` | Subtotals with ROLLUP/CUBE/GROUPING, hierarchies with CONNECT BY, hypothetical RANK, global temporary tables. |
| 15 | `./SqlAndSqlPlus/ChangingData/changingData.md` | Before any INSERT/UPDATE/DELETE/MERGE/TRUNCATE; upserts, multitable inserts, transactions, DML error logging. |
| 16 | `./SqlAndSqlPlus/DecodeAndCase/decodeAndCase.md` | Code-to-label mapping, tiered or threshold logic, NULL fallbacks, crosstabs with PIVOT/UNPIVOT or DECODE/CASE. |
| 17 | `./SqlAndSqlPlus/SchemaObjects/schemaObjects.md` | Creating, altering or dropping tables, constraints, views, indexes, IOTs, clusters or sequences; ORA-12899/01438/01758. |
| 18 | `./SqlAndSqlPlus/Partitioning/partitioning.md` | Partitioning large or time-based tables, local vs. global indexes, data aging, exchange-partition loads. |
| 19 | `./SqlAndSqlPlus/BasicSecurity/basicSecurity.md` | Creating users and roles, grants and revokes, password profiles; ORA-01031/00942/01720/28000/28001. |

### Beyond the basics (Part III)

| Ch | Skill | Use when |
|---|---|---|
| 20 | `./BeyondTheBasics/VirtualPrivateDatabase/virtualPrivateDatabase.md` | Row- or column-level security with application contexts and DBMS_RLS policies; per-tenant row isolation; ORA-28115. |
| 21 | `./BeyondTheBasics/TransparentDataEncryption/transparentDataEncryption.md` | Encrypting columns or tablespaces at rest, wallet setup/open/close, RAC wallets, ORA-28365. |
| 22 | `./BeyondTheBasics/Tablespaces/tablespaces.md` | Choosing or creating tablespaces, quotas, free space, temp/undo/bigfile/read-only/nologging, layout planning. |
| 23 | `./BeyondTheBasics/SqlLoader/sqlLoader.md` | Bulk-loading CSV or fixed-width files with sqlldr, control files, restarting partial loads, direct path tuning. |
| 24 | `./BeyondTheBasics/DataPump/dataPump.md` | Exporting or importing schemas or tables with expdp/impdp, remapping schemas, filtering, managing running jobs. |
| 25 | `./BeyondTheBasics/RemoteData/remoteData.md` | Querying or changing another database through database links; synonyms for location transparency. |
| 26 | `./BeyondTheBasics/MaterializedViews/materializedViews.md` | Replicas or summaries with materialized views, MV logs, fast/complete refresh, diagnosing query rewrite. |
| 27 | `./BeyondTheBasics/OracleText/oracleText.md` | Full-text search with CONTEXT/CTXCAT indexes, CONTAINS/CATSEARCH, scoring, keeping text indexes in sync. |
| 28 | `./BeyondTheBasics/ExternalTables/externalTables.md` | Querying flat files in place, staging loads via INSERT ... SELECT, unloading with ORACLE_DATAPUMP. |
| 29 | `./BeyondTheBasics/FlashbackQueries/flashbackQueries.md` | Recovering from bad commits or auditing changes with AS OF, VERSIONS BETWEEN, ORA_ROWSCN; undo limits, ORA-01555. |
| 30 | `./BeyondTheBasics/FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` | A table was dropped or bad DML committed: restore from the recycle bin, rewind a table, or flash back the database. |
| 31 | `./BeyondTheBasics/SqlReplay/sqlReplay.md` | Testing an upgrade or parameter change by capturing production workload and replaying it on an isolated test database. |

### PL/SQL (Part IV)

| Ch | Skill | Use when |
|---|---|---|
| 32 | `./PlSql/IntroductionToPlSql/introductionToPlSql.md` | Writing or fixing PL/SQL blocks: variables, %TYPE, cursors, IF/CASE, loops, exception handlers. |
| 33 | `./PlSql/OnlineApplicationUpgrades/onlineApplicationUpgrades.md` | Changing busy production tables with minimal downtime: DDL lock timeout, online redefinition, Data Guard switchover. |
| 34 | `./PlSql/Triggers/triggers.md` | Audit, validation, DDL or logon triggers; mutating-table errors; enabling or disabling triggers for loads. |
| 35 | `./PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` | Creating, granting, debugging or recompiling procedures, functions and packages; definer vs. invoker rights. |
| 36 | `./PlSql/DynamicSql/dynamicSql.md` | DDL or run-time-built SQL in PL/SQL; EXECUTE IMMEDIATE with binds, DBMS_SQL, avoiding literal SQL and injection. |
| 37 | `./PlSql/PlSqlTuning/plSqlTuning.md` | Slow PL/SQL, profiling with DBMS_PROFILER, converting row-by-row loops to FORALL/BULK COLLECT. |

### Object-relational databases (Part V)

| Ch | Skill | Use when |
|---|---|---|
| 38 | `./ObjectRelational/ObjectTypes/objectTypes.md` | Creating object types and methods, object views, INSTEAD OF triggers, or indexing type attributes. |
| 39 | `./ObjectRelational/Collectors/collectors.md` | VARRAYs or nested tables, TABLE() queries and DML, ORA-22909, or choosing a collection vs. a child table. |
| 40 | `./ObjectRelational/LargeObjects/largeObjects.md` | BLOB/CLOB/BFILE columns, LOB storage, DBMS_LOB calls, directories, or migrating LONG columns. |
| 41 | `./ObjectRelational/AdvancedObjectConcepts/advancedObjectConcepts.md` | Object tables, REF/DEREF/VALUE, MAKE_REF object views, dangling references, or object PL/SQL. |

### Java in Oracle (Part VI)

| Ch | Skill | Use when |
|---|---|---|
| 42 | `./JavaInOracle/IntroductionToJava/introductionToJava.md` | PL/SQL developers writing or translating logic into Java for Oracle work. |
| 43 | `./JavaInOracle/JdbcProgramming/jdbcProgramming.md` | Connecting Java to Oracle, choosing a driver, running queries and DML, autocommit and resource handling. |
| 44 | `./JavaInOracle/JavaStoredProcedures/javaStoredProcedures.md` | Running loadjava, LANGUAGE JAVA call specs, debugging in-database Java, or choosing between Java and PL/SQL. |

### Hitchhiker's guides (Part VII)

| Ch | Skill | Use when |
|---|---|---|
| 45 | `./HitchhikersGuides/DataDictionary/dataDictionary.md` | Finding which tables, columns, constraints, indexes, privileges, space, statistics, code errors or jobs exist. |
| 46 | `./HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md` | A query or screen is slow, an index is unused, a plan needs reading or hinting, or a plan changed. |
| 47 | `./HitchhikersGuides/ResultCache/resultCache.md` | Repeated read-mostly queries; RESULT_CACHE hint, DBMS_RESULT_CACHE, client result cache, stale or uncached results. |
| 48 | `./HitchhikersGuides/TuningCaseStudies/tuningCaseStudies.md` | I/O waits under load, wildcard/LOWER/literal queries, plan differences (10053 trace), batch loads overrunning windows. |
| 49 | `./HitchhikersGuides/AdvancedArchitectureOptions/advancedArchitectureOptions.md` | Blocking DBA access to data with Database Vault realms and command rules, separation of duties; Content/Records DB. |
| 50 | `./HitchhikersGuides/RealApplicationClusters/realApplicationClusters.md` | RAC setup and operation: srvctl, cluster parameters, interconnect, services, TAF, adding or removing nodes. |
| 51 | `./HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` | Startup/shutdown, SGA sizing, extents, undo and ORA-01555, ASM, shrink, transportable tablespaces, ARCHIVELOG, backups. |
| 52 | `./HitchhikersGuides/XmlInOracle/xmlInOracle.md` | Exporting rows as XML, loading or updating tables from XML, DTD/XSD design, XMLType columns and XPath queries. |

The book's Part VIII, the alphabetical command reference, is not a skill.
Use the Oracle documentation for the target release when you need full
syntax.

# Context for AI: Working on an Oracle Database

## 1. Know Where You Are

Before running anything, identify the database, its version, and whether it
is production. Check the connected user and privileges. Never assume a
schema, service name, or environment from a file or a previous session.

## 2. Read Before You Change

Inspect the data dictionary first (`USER_`, `ALL_`, `DBA_` views) to learn
what exists: tables, constraints, indexes, dependent code, grants. Prefer
queries that read over statements that change.

## 3. Destructive and Hard-to-Reverse Operations

DROP, TRUNCATE, PURGE, FLASHBACK DATABASE, ALTER SYSTEM, privilege grants,
encryption key operations, upgrades, and imports that overwrite data need
explicit approval for the specific target before they run. State what will
change, how to verify it, and how to back out. Never put real passwords or
keys into scripts, logs, or chat.

## 4. Write SQL That Survives Production

- Use bind variables, never concatenated user input.
- Make datatypes match in predicates so indexes stay usable.
- Commit deliberately; know what a DDL statement commits implicitly.
- Verify the result with a query, and read the execution plan before
  claiming a query is fast.

## 5. Report Honestly

Say which statements were run, against which database, and what was
observed. Distinguish what was executed from what was only written.
