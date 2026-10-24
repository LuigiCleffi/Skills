---
name: postgres-pgadmin
description: "Using pgAdmin as a graphical front end to PostgreSQL for connecting, browsing catalogs, generating SQL, granting privileges, importing and exporting files, running pg_dump/pg_restore through wizards, reading graphical explain plans and scheduling jobs with pgAgent, based on Chapter 4 (Using pgAdmin) of PostgreSQL: Up and Running, 3rd edition. Use when the user works in pgAdmin 3 or 4, registers a server connection, asks where a pgAdmin menu or tab is, uses the Grant Wizard or Default Privileges tab, the Backup/Restore/Backup Globals dialogs, the Import/Export dialog, graphical explain, the adminpack extension, or creates, debugs or reports on pgAgent jobs (pgagent schema, pga_job, pga_jobsteplog)."
---

# Using pgAdmin

pgAdmin is a GUI that only ever sends SQL or calls the standard client tools (`pg_dump`, `pg_restore`, `pg_dumpall`, `\copy`) on your behalf. Treat it as a generator: read the SQL pane or the Messages tab, and when the job must be repeatable, scripted or large, run that same SQL or command from `psql` or the shell instead.

## Versions and modes

- pgAdmin 4 is the current line; it runs as a desktop app or as a web (WSGI) server application. pgAdmin 3 is desktop-only and no longer maintained.
- Some pgAdmin 3 features were never ported: pgScript, the configuration file editor, the PSQL Console plugin, HTML/XML quick reports, the Objects tab for selective backup.
- pgAdmin tracks new server releases; use a pgAdmin version at least as new as the server you manage.
- Version note: pgAdmin 3 is retired; use pgAdmin 4. Recent pgAdmin 4 releases add a PSQL Tool that opens `psql` against the selected database.

## Connecting and navigating

- Register a server with host, port, maintenance database (usually `postgres`), user and SSL settings. Do not save a production superuser password in the dialog on a shared machine; prefer `.pgpass`, a service file or a non-superuser role.
- Declutter the tree: File > Preferences > Browser > Nodes hides object types you never use.
- "Show System Objects" exposes `pg_catalog`, `information_schema`, system columns and internal functions. Turn it on only when inspecting the catalog, then off again.
- Most menus are grayed out until you are connected to a database, and many are context-sensitive to the selected tree node.

## Letting pgAdmin write SQL

- Every create/alter dialog has an SQL tab showing the exact DDL it will run. Review it before clicking Save; copy it into a migration file rather than leaving schema changes as undocumented clicks.
- Right-click a table > Scripts produces SELECT, INSERT and UPDATE templates listing every column. Trim the column list instead of typing it.
- Ctrl+Space triggers autocomplete in the query tool.
- Creating a database: right-click Databases > Create; the Definition tab picks the template database.

## Privileges

- Tools > Grant Wizard grants on many objects at once. Start it from a schema node to filter the list to that schema.
- Default privileges (Properties > Default Privileges on a schema or database) cover objects created later; the Grant Wizard covers only objects that exist now.
- Granting table privileges is useless without `USAGE` on the schema. Equivalent SQL, which you can review and script:

```sql
GRANT USAGE ON SCHEMA sales TO report_readers;
GRANT SELECT ON ALL TABLES IN SCHEMA sales TO report_readers;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales
  GRANT SELECT ON TABLES TO report_readers;
```

- Privilege changes are security changes: confirm the server, database and role with the user and get explicit approval first. Back out with the matching `REVOKE` (and `ALTER DEFAULT PRIVILEGES ... REVOKE`).

## Import and export

- Right-click a table > Import/Export is a wrapper around `\copy`. The target table must already exist with compatible columns; the file is read on the client machine running pgAdmin.
- Query results can be downloaded as CSV from the query tool (download icon in pgAdmin 4, File > Export in pgAdmin 3).
- For big or recurring loads use `\copy` or `COPY` from `psql` so the step is scripted and logged.

## Backup and restore wizards

- Right-click a database, schema or table > Backup runs `pg_dump`; choose Custom format for a restorable archive. Tools > Backup Globals runs `pg_dumpall` for roles and tablespaces (all of them, no filtering); Tools > Backup Server dumps the whole cluster.
- The Messages tab shows the exact command line used. Copy it for scripting.
- Check File > Preferences > Paths (binary path) so pgAdmin calls the `pg_dump`/`pg_restore` matching the newest server you back up. A custom, tar or directory archive needs a `pg_restore` of the same or later version than the `pg_dump` that wrote it.
- For remote servers or large databases, use the command-line tools directly; the GUI adds a layer that is hard to monitor and resume.
- Restore is destructive when it drops or overwrites objects (the "Clean before restore" option is `pg_restore --clean`). Confirm the target server and database, get explicit approval, and take a fresh backup of the target first.

## Configuration files (pgAdmin 3 only)

- The Server Configuration editor for `postgresql.conf` and `pg_hba.conf` needs a superuser connection and the `adminpack` extension (`CREATE EXTENSION adminpack;` in the maintenance database), then reconnect.
- Editing either file changes who can connect and how the server runs. Get explicit approval, keep a copy of the original, reload (`SELECT pg_reload_conf();`) and verify a new connection works before closing the session. Settings marked as needing restart need a planned restart.
- Version note: `adminpack` was removed in PostgreSQL 17; edit the files on the host or use `ALTER SYSTEM` instead.

## pgScript (pgAdmin 3 only)

- A T-SQL-like script language (`DECLARE @x`, `SET`, `WHILE`, `IF`, `PRINT`) that commits each statement as it runs, so long loops do not hold one huge transaction.
- It runs only inside pgAdmin 3. For new work, use a `psql` script, a client program, or a procedure with transaction control.

## Graphical explain

- In the query tool, use the Explain button (or Explain Analyze) to get a plan diagram; thicker arrows mark steps carrying more rows or cost. The text plan is shown alongside.
- In older pgAdmin versions graphical explain is disabled while the Buffers option is on; uncheck it.
- Explain Analyze executes the statement. Wrap data-changing statements in `BEGIN; ... ROLLBACK;` or explain without Analyze.

## pgAgent job scheduling

- pgAgent is a separate service plus a `pgagent` schema (`CREATE EXTENSION pgagent;`, normally in `postgres`). If installed elsewhere, point both the service and pgAdmin's maintenance database at that database. A Jobs node then appears in the tree.
- A job has steps and one or more schedules. Steps run in alphabetical order; each is SQL (local or remote connection string) or an OS batch/shell script in the syntax of the host running the agent. Steps can be disabled instead of deleted; on-error actions are set per step.
- Several agents can read the same pgAgent database; all of them run every job unless the job's host agent field names one host.
- Jobs run as the pgAgent service account. Most "works in my shell, fails in pgAgent" problems are that account's file permissions, network paths or authentication. Use `.pgpass` for that account instead of passwords inside remote connection strings or scripts.
- Do not trust the success flag for shell steps; read the output:

```sql
SELECT j.jobname, s.jstname, l.jslstart, l.jslduration, l.jslstatus, l.jsloutput
FROM pgagent.pga_jobsteplog l
JOIN pgagent.pga_jobstep s ON s.jstid = l.jsljstid
JOIN pgagent.pga_job j     ON j.jobid = s.jstjobid
WHERE l.jslstart > current_date
ORDER BY j.jobname, s.jstname, l.jslstart DESC;
```

- Key tables: `pga_job`, `pga_jobstep`, `pga_schedule`, `pga_jobagent`, `pga_joblog`, `pga_jobsteplog`. You can clone jobs by inserting rows, but edits there bypass validation: back up the `pgagent` schema first and get approval before changing or deleting job rows.

## Workflow

1. Confirm which server, database and role the pgAdmin connection uses, and that the pgAdmin and binary-path versions fit the server.
2. Build the change in the dialog, then read the SQL tab (or the Messages tab for backup/restore) before executing.
3. For anything destructive or security-related (drop, restore with clean, grants, config edits, pgAgent job changes), stop and get explicit approval with the exact target named.
4. Save the generated SQL or command line into the project's scripts so it can be reviewed and rerun from `psql`.
5. Verify the result: refresh the tree node, query the catalog (`\dp`, `\ddp`, `pg_roles`) or, for jobs, the `pga_jobsteplog` output.

## Red flags

- Schema or privilege changes made by clicking with no saved SQL.
- Grants on tables without schema `USAGE`, or no default privileges for future objects.
- Backups of large or remote databases through the GUI with nobody watching the job.
- pgAdmin calling an older `pg_dump` than the server version.
- Restore with "clean" pointed at a database nobody confirmed.
- Superuser passwords saved in pgAdmin or embedded in pgAgent connection strings.
- pgAgent shell steps reported as successful without checking `jsloutput`.
- Explain Analyze run on an UPDATE or DELETE outside a rolled-back transaction.

## Related

- `../Psql/psql.md` — the command-line client pgAdmin wraps; better for large scripts and automation.
- `../DatabaseAdministration/databaseAdministration.md` — roles, privileges, configuration files, pg_dump and pg_restore in depth.
- `../QueryPerformanceTuning/queryPerformanceTuning.md` — reading the plans pgAdmin draws.
- `../../Oracle/HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` — Oracle counterpart; do not apply its syntax here.
- `../../Oracle/SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — Oracle counterpart for grants; do not apply its syntax here.
