---
name: dba-installing-and-creating
description: Planning and performing an Oracle software installation with the Oracle Universal Installer and creating a database with DBCA, including the decisions that cannot be changed later, based on Chapter 2 (Installing Oracle Database 11g and Creating a Database) of Oracle Database 11g: The Complete Reference. Use when the user plans a new Oracle install or database, runs runInstaller or dbca, chooses a block size or character set, picks an edition, asks which accounts are unlocked after creation, or a fresh install fails prerequisite checks.
---

# Installing Oracle Database 11g and Creating a Database

An install is easy to start and expensive to redo. Settle the irreversible choices (database name, block size, character set, file layout) with DBAs, developers, system administrators and users before launching the installer, and read the platform installation guide first.

## Decide before installing

- **Name and domain**: local database name and the network domain it belongs to.
- **Space**: estimate tables and indexes for the first project on top of `SYSTEM`, software and tools.
- **File placement**: spread datafiles over as many physical disks as practical for performance and recoverability; on RAID or shared storage use Oracle Managed Files, or ASM.
- **Initialization parameters**: review the basic ones before creation.
- **Character set**: choose the database character set (and an alternate one) for where users are and what languages they write. Later changes are only possible to a superset of the current set.
- **Block size**: `DB_BLOCK_SIZE` is fixed for the life of the database; changing it means recreating it. Additional block sizes can coexist for specific tablespaces.
- **Tablespaces**: user objects never go in `SYSTEM`; every non-administrative user gets a non-`SYSTEM` default tablespace.
- **Undo**: plan Automatic Undo Management.
- **Backup and recovery**: decide how and how often, and use more than one method.

## Editions and licensing

| Edition | Use |
|---|---|
| Enterprise | Full feature set (for example Flashback Database) plus separately licensed options such as Spatial, OLAP, Label Security, Data Mining |
| Standard | Subset aimed at smaller businesses |
| Personal | Development only; not for production |

Licensing is per named user or per CPU. Use `LICENSE_MAX_USERS` to cap the number of users that can be created. Confirm which options are licensed before enabling them.

## Installing with OUI

- Launch `runInstaller` (UNIX) after setting `DISPLAY` and allowing the X connection with `xhost`; on Windows use the setup program.
- Provide the Oracle base, the Oracle home and the installation type; optionally request a starter database with its name and administrative password.
- Let the prerequisite checks finish and fix every failure (OS settings, network, environment variables) instead of ignoring it.
- Create the starter database: it proves the server environment works and can host the OEM or RMAN repository.
- Do not run other heavy work on the server during installation.
- Install Oracle Management Server / OEM after the basic database install is complete.

## Creating the database

- DBCA runs after the software install (or launch `dbca` later) and creates the instance and database; the Net Configuration Assistant verifies Oracle Net. Retry any assistant that fails.
- Inexperienced administrators should use DBCA; experienced DBAs may script `create database` instead.
- Most supplied accounts are created locked. Only the administrative accounts (such as `SYS`, `SYSTEM`) are unlocked with the password given at install. Unlock other accounts only when needed and give each its own password.
- On Windows the Administration Assistant can tie instance startup and shutdown to the Windows service and set the shutdown mode.

## Verify the new database

```sql
select banner from v$version;
select instance_name, status from v$instance;
select parameter, value from nls_database_parameters
 where parameter in ('NLS_CHARACTERSET', 'NLS_NCHAR_CHARACTERSET');
select value from v$parameter where name = 'db_block_size';
select username, account_status, default_tablespace from dba_users order by username;
```

Check that no application user has `SYSTEM` as default tablespace and that only intended accounts are `OPEN`.

## Workflow
1. Read the installation guide for the exact OS and release; record the decisions listed above in writing.
2. Confirm the target host with the user; installing or creating a database changes the server and is hard to undo.
3. Prepare the OS (users, groups, kernel settings, `DISPLAY`) and run OUI; resolve every prerequisite failure.
4. Create the database with DBCA or a reviewed `create database` script.
5. Run the verification queries; keep unused accounts locked; create application tablespaces and users.
6. Take and test the first backup before handing the database over.

## Red flags
- Accepting the default character set or block size without considering users and workload.
- User or application objects in `SYSTEM`.
- Ignored prerequisite warnings that resurface as runtime failures.
- Using Personal Edition, or unlicensed Enterprise options, in production.
- Unlocking every sample account or sharing one password across them.
- No backup strategy, or a single backup method, at go-live.

Version note: Metalink, the support site for patches and service requests, is now called My Oracle Support.

## Related
- `../ArchitectureOptions/architectureOptions.md` — what the tablespace, undo and storage options are.
- `../Upgrading/upgrading.md` — when an older database exists instead of a fresh one.
- `../../BeyondTheBasics/Tablespaces/tablespaces.md` — creating application tablespaces after install.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — creating users and securing accounts.
- `../../HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` — ASM, backup and daily administration.
