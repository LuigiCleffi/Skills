---
name: dba-advanced-architecture-options
description: How Oracle Database Vault restricts even privileged users through realms, command rules, factors and separation of duties, and what Content Database, Records Database and Universal Records Manager add for document and retention management, based on Chapter 49 (Advanced Architecture Options—DB Vault, Content DB, and Records DB) of Oracle Database 11g: The Complete Reference. Use when the user must stop DBAs or SYSDBA from reading application data, mentions SOX/HIPAA internal controls, DV_OWNER, DV_ADMIN, DVSYS.DBMS_MACADM, realms or command rules, a patch or install fails with Database Vault enabled, or asks about Content DB, Records DB or record retention.
---

# Advanced Architecture Options: Database Vault, Content DB, Records DB

Auditing tells you what a privileged user did; Database Vault prevents it. Use realms to fence application data off from `ANY` privileges, command rules and factors to control who may run which statement, from where and when, and separation of duties so no single administrator controls accounts, security and the database at once. Treat every Vault change as a security change that needs explicit approval.

## Database Vault concepts

- **Realm** — a protection zone around one table, a schema, an application or several applications. Users holding system privileges such as `SELECT ANY TABLE` cannot touch realm objects unless authorized in the realm.
- **Command rule** — governs execution of almost any statement (`SELECT`, DDL, DML, `ALTER SYSTEM`, `CONNECT`) for any user, including the application owner and SYSDBA.
- **Rule set / factors** — conditions evaluated by command rules: IP address, host name, time of day, authentication method and other session attributes. Combining several is multifactor authorization.
- **Separation of duties** — out of the box:
  - Account management: `CREATE USER` by ordinary DBAs is blocked unless granted the Vault account-management responsibility.
  - Database administration: tablespaces, tuning and similar work continue as before; ad hoc grants of `DBA` and access to packages such as `DBMS_RLS` are blocked.
  - Security administration: only Vault administrators (`DV_OWNER`, `DV_ADMIN`) change realms and command rules. A Vault administrator cannot see realm data or authorize themself into a realm.
- Applies to existing applications without code changes; Oracle ships default realms at install.

## Configuring with DBMS_MACADM

Administer through the Database Vault Administration web console (`http://host:port/dva`) or the `DVSYS.DBMS_MACADM` API, available to `DV_OWNER` / `DV_ADMIN`.

```sql
begin
  dvsys.dbms_macadm.create_realm(
    realm_name    => 'HR Realm',
    description   => 'Protects HR data from privileged users',
    enabled       => 'Y',
    audit_options => 1);            -- audit realm violations
  dvsys.dbms_macadm.add_object_to_realm(
    realm_name => 'HR Realm', object_owner => 'HR',
    object_name => '%', object_type => '%');
  dvsys.dbms_macadm.add_auth_to_realm(
    realm_name => 'HR Realm', grantee => 'HR');
end;
/
commit;
```

- Oracle's best practice is command rules for destructive or structural DDL: create/drop cluster, create/drop database link, drop index, drop sequence, create/drop synonym, create/alter/drop/truncate table, drop tablespace, create/drop view.
- A `CONNECT` command rule limited to known IP ranges creates a trusted path and stops users bypassing the application.

## Installation and patching

- Install Oracle and third-party applications **before** enabling Vault; some installers and patch scripts fail under its separation of duties.
- Choose to create the separate account-management responsibility during installation.
- To patch, disable Vault, patch, then re-enable. On 11g this is a relink with the database down:

```sh
# all RAC instances and dbconsole stopped first
cd $ORACLE_HOME/rdbms/lib
make -f ins_rdbms.mk dv_off      # dv_on to re-enable
cd $ORACLE_HOME/bin && relink oracle
# start the database, then:
dvca -action disable -oh $ORACLE_HOME -service svc -instance inst \
     -dbname db -owner_account dv_owner_acct -logfile dvca.log
```

- Re-enabling runs `dvca -action enable`, then a shutdown, `dv_on` relink and startup. On RAC repeat the relink on every node.
- Disabling Vault removes the protection for that period. Agree the window with security owners, get explicit approval, and re-enable and verify immediately after.

## Hardening around Vault

- Limit SYSDBA connections to what truly requires them (RMAN, mandatory patching); use named DBA accounts for daily work so actions are attributable.
- Do not use `SYSTEM` for general administration. If legacy apps keep tables in `SYSTEM`, authorize it in the realm and restrict it, for example by IP rule set.
- Vault does not stop OS users reading datafiles; use Transparent Data Encryption for that, and personal OS accounts with `sudo` limited to specific commands. Exclude `make` and `relink` except for brief, approved patch windows.
- DBAs needing AWR/ADDM access to protected schemas should get extra realms that are enabled only when needed and fully audited.

## Content DB, Records DB and URM

- **Content Database Suite** (Enterprise Edition option): document management. Content Server (web server plus JVM) stores metadata and revisions in the database, using fine-grained access control and auditing. Tools include portlets, dynamic converters, desktop/Outlook integration, a WebDAV drive and scanning import.
- Users are consumers (read), contributors (add/revise), administrators and sub-administrators. Every file belongs to a security group (default `public` and `secure`); permissions are read, write, delete, admin. Can authenticate against Active Directory or LDAP.
- Change the predefined `sysadmin` password immediately; change or delete `user1`. Do not share the server's data and config directories on the network; they contain credentials.
- **Records Database** adds retention: declare, classify, retain unchanged and dispose of records on schedule, with hierarchies (series, categories, folders), roles, auditing, web services and WORM storage integration. **Universal Records Manager** (URM) replaced it in 2007, covering electronic and physical records, notifications and adapter services.
- Content DB creates schemas (`CONTENT`, `CONTENT$CM`, `CONTENT$DR`, `CONTENT$ID`, `OWF_MGR`) and queues for BPEL and Workflow. Protect them with Vault realms and rules that admit only the known middle tiers and directory servers.

## Workflow

1. Identify the sensitive schemas and who legitimately needs them; get the security owner's sign-off.
2. Install applications and patches before enabling Vault.
3. Create realms per application, add objects, authorize only the owning and application accounts, enable auditing.
4. Add command rules for destructive DDL and a `CONNECT` rule with IP/time factors.
5. Assign account management and Vault administration to different people than the DBA.
6. Verify: as a DBA with `ANY` privileges, try to select from a realm table and confirm it is blocked and audited.
7. For patching, schedule an approved disable/enable window and re-test protection afterward.

## Red flags

- Relying on auditing alone to control SYSDBA access to regulated data.
- Shared use of `SYS`/`SYSTEM` for daily administration.
- One person holding DBA, DV_OWNER and account management.
- Enabling Vault before installing applications, then disabling it ad hoc to fix failures.
- Leaving Vault disabled after a patch, or granting `make`/`relink` via sudo permanently.
- Assuming Vault protects datafiles from OS root.
- Default Content Server passwords left unchanged.

## Related

- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — users, roles and privileges Vault constrains.
- `../../BeyondTheBasics/VirtualPrivateDatabase/virtualPrivateDatabase.md` — row-level policies (DBMS_RLS) Vault protects.
- `../../BeyondTheBasics/TransparentDataEncryption/transparentDataEncryption.md` — protection against OS-level file access.
- `../RealApplicationClusters/realApplicationClusters.md` — stopping all instances for relink.
- `../DatabaseAdministration/databaseAdministration.md` — startup and shutdown procedures.

Version note: from 12c, Database Vault is enabled and disabled with `DBMS_MACADM.ENABLE_DV` / `DISABLE_DV` and a restart instead of relinking.
