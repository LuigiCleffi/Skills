---
name: dba-basic-security
description: "Managing Oracle users, passwords, profiles, roles, system and object privileges, view-based security, synonyms and quotas, based on Chapter 19 (Basic Oracle Security) of Oracle Database 11g: The Complete Reference. Use when creating or dropping users, granting or revoking privileges or roles, designing application roles, setting password policies (lock, expiry, reuse), granting via views or PUBLIC, or when hitting ORA-01031, ORA-00942, ORA-01720, ORA-28000, ORA-28001 or ORA-28007."
---

# Basic Oracle Security

Grant the least privilege that does the job, through roles you design, and expose data through views rather than base tables. Every grant, revoke, password change and user drop is a security change: confirm the target database and get explicit approval first.

## Users

```sql
create user app_reader identified by "<set by the user>"
  default tablespace users quota 100m on users
  profile app_user_profile
  password expire;
grant create session to app_reader;
```

- A new user can do nothing until granted `CREATE SESSION`.
- `identified externally` maps an OS account (single logon); `globally` uses an enterprise directory.
- Change passwords with `alter user ... identified by`, or the SQL*Plus `password` command, which hides input (a DBA can run `password <user>` for another user).
- Quotas: `alter user u quota 100m on users`. `UNLIMITED TABLESPACE` bypasses all quotas; avoid it.
- `drop user u` fails if the user owns objects; `drop user u cascade` drops them all and invalidates others' dependent views, synonyms and code. Never run it without approval and a backup or export.
- Revoking everything does not drop the user or its objects.

Never put real passwords in scripts, examples or chat; use placeholders and let the user supply them.

## Password profiles

```sql
create profile app_user_profile limit
  failed_login_attempts 5
  password_lock_time    1
  password_life_time    90
  password_grace_time   7
  password_reuse_max    5
  password_reuse_time   unlimited;
```

- `FAILED_LOGIN_ATTEMPTS n`: the nth consecutive failure locks the account (ORA-28000); a correct login resets the count.
- Locked accounts unlock after `PASSWORD_LOCK_TIME` days or with `alter user u account unlock`. `account lock` locks manually.
- Expired passwords (ORA-28001) force a change at next login; after the grace period the account needs DBA action. `alter user u password expire` forces a change.
- `PASSWORD_REUSE_MAX` and `PASSWORD_REUSE_TIME` are mutually exclusive: set one, the other `UNLIMITED`. Violations raise ORA-28007.
- Complexity and minimum length can also be enforced through profiles.
- Give application owner and connection-pool accounts a separate profile, or expiry will lock the application.
- Check `DBA_USERS` (`ACCOUNT_STATUS`, `EXPIRY_DATE`, `PROFILE`) and `DBA_PROFILES`.

## Privileges

- System privileges allow statement types (`CREATE TABLE`, `CREATE VIEW`). Object privileges act on one object (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `INDEX`, `ALTER`, `EXECUTE`, `READ`/`WRITE` on directories).
- `with admin option` (system privileges, roles) lets the grantee re-grant and alter or drop the role. `with grant option` (object privileges) lets the grantee pass the privilege on.
- Revoking an object privilege cascades to everyone who got it through that grantee's grant option. `cascade constraints` also drops FKs built on a revoked `REFERENCES`.
- Column-level update: `grant update (status, amount) on orders to clerk_role;`
- Grant `SELECT` along with `UPDATE`/`DELETE`; without it, feedback can leak data.
- Missing `SELECT` returns ORA-00942 ("does not exist"), not a privilege error, so the object stays hidden. Missing other rights: ORA-01031.
- Definer's rights: a procedure runs with its owner's privileges, so callers need only `EXECUTE`. Invoker's rights are available when callers' own privileges should apply.

## Roles

```sql
create role orders_reader;
create role orders_writer;
grant select on app.orders to orders_reader;
grant insert, update on app.orders to orders_writer;
grant orders_reader to orders_writer;        -- role hierarchy, no cycles
grant create session to app_reader;          -- direct, survives set role none
grant orders_reader to app_reader;
```

- Design application-specific roles. `CONNECT`, `RESOURCE` and `DBA` exist for compatibility only; `RESOURCE` silently includes `UNLIMITED TABLESPACE`, and `DBA` can revoke anything from anyone.
- Privileges received via roles do not count for creating views, procedures, packages or foreign keys; grant those directly to the owning schema.
- Default roles: `alter user u default role orders_reader;` (also `all`, `all except`, `none`). Others are enabled with `set role`.
- Password-protected roles: `alter role r identified by ...`; enable with `set role r identified by ...`. `identified externally` with `OS_ROLES = TRUE` maps OS groups. `not identified` removes it.
- Privilege grants and revokes take effect immediately; role grants and revokes apply at next `set role` or new session.
- Check `SESSION_ROLES`, `SESSION_PRIVS`, `DBA_ROLE_PRIVS`, `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`, `USER_TAB_PRIVS_MADE`.

## Views, synonyms and PUBLIC

- Grant on a restricting view instead of the base table; users see only what the view shows, and DML through it reaches the base table.
- A view built on another schema's object can be re-granted only if its owner holds the base privilege `with grant option`; otherwise ORA-01720.
- Row-per-user view:

```sql
create or replace view my_orders as
  select * from orders where sales_rep = user;
grant select on my_orders to orders_reader;
```

- `grant ... to public` reaches every current and future user; reserve it for truly public objects. A public synonym removes the schema prefix, but a user's own object of the same name takes precedence.
- Grants, logins and other access can be audited (`AUDIT`).

Version note: in a 12c+ multitenant database, users and roles are either common (`C##` prefix, all containers) or local to one PDB.

## Workflow

1. Confirm the database and container, and who is asking for which access and why.
2. Map the need to a role; create or extend application roles rather than granting to individuals.
3. Grant object privileges on views where rows or columns must be limited; grant directly to owner schemas that build objects.
4. Set a profile and quota for every new account; keep service accounts on their own profile.
5. Present the exact GRANT/REVOKE/DROP USER statements and get explicit approval; save the current state (`DBA_*_PRIVS` query output) as the back-out.
6. Verify by connecting as the grantee or querying `SESSION_PRIVS`/`SESSION_ROLES` and the `DBA_*_PRIVS` views.

## Red flags

- `GRANT DBA`, `RESOURCE` or `UNLIMITED TABLESPACE` to application users.
- `with grant option` or `with admin option` handed out by default.
- `grant ... to public` on business tables.
- Passwords in scripts, shell history or chat; `connect user/password` typed inline.
- Application objects relying on role privileges (fails at compile time).
- One profile for humans and service accounts; expiry locking a production pool.
- `drop user ... cascade` without approval and an export.
- Users granted base tables when a view would restrict the data.

## Related

- `../SchemaObjects/schemaObjects.md` — views and synonyms used for access control.
- `../../BeyondTheBasics/VirtualPrivateDatabase/virtualPrivateDatabase.md` — row-level security enforced on the table itself.
- `../../BeyondTheBasics/TransparentDataEncryption/transparentDataEncryption.md` — protecting data at rest.
- `../../BeyondTheBasics/Tablespaces/tablespaces.md` — default tablespaces and quotas.
- `../../HitchhikersGuides/DataDictionary/dataDictionary.md` — privilege and role views.
- `../../PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` — definer's and invoker's rights.
