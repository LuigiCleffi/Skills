---
name: dba-virtual-private-database
description: "Enforcing row- and column-level security with Oracle Virtual Private Database (application contexts, logon triggers, DBMS_RLS policy functions, column masking, policy groups), based on Chapter 20 (Advanced Security—Virtual Private Databases) of Oracle Database 11g: The Complete Reference. Use when users of a shared table must see only their own rows regardless of tool, for multi-tenant row isolation, when writing DBMS_RLS.ADD_POLICY or SYS_CONTEXT-based predicates, masking sensitive columns, or when hitting ORA-28115 or \"no rows selected\" surprises caused by a policy."
---

# Advanced Security—Virtual Private Databases

VPD attaches a security policy to a table, view or synonym so Oracle appends a predicate to every statement against it, whatever tool the user connects with. Keep the pieces small and tested: a context that identifies the user, a fast policy function that returns a predicate, and a policy that binds them.

## How it works

- A policy function returns a predicate string; Oracle adds it as a where/and condition to SELECT, INSERT, UPDATE, DELETE or INDEX statements on the protected object.
- Different statement types can have different policies. Several policies on one object are all applied (combined with AND).
- Users connected `as sysdba` bypass VPD. Test as real application users.
- Requires `EXECUTE` on `DBMS_RLS` and `CREATE ANY CONTEXT` for the setup schema; PL/SQL packages and a logon trigger.

## 1. Application context

The context holds per-session security attributes, and only its trusted package can set them.

```sql
create context app_ctx using app.app_ctx_pkg;

create or replace package body app.app_ctx_pkg is
  procedure set_context is
    v_tenant number;
  begin
    select tenant_id into v_tenant from app.app_users
     where username = sys_context('USERENV', 'SESSION_USER');
    dbms_session.set_context('APP_CTX', 'TENANT_ID', v_tenant);
  exception
    when no_data_found then
      dbms_session.set_context('APP_CTX', 'TENANT_ID', 0);  -- sees nothing
  end set_context;
end app_ctx_pkg;
/
```

- Unknown users must map to a value that matches no rows.
- The lookup runs at every logon: index the mapping table.

## 2. Logon trigger

```sql
create or replace trigger app.set_app_ctx
after logon on database
begin
  app.app_ctx_pkg.set_context;
end;
/
```

Test before going further: connect as a mapped user and run `select sys_context('APP_CTX', 'TENANT_ID') from dual;`. A failing database logon trigger can block logins, so test it in a non-production database first.

## 3. Policy function

Signature `(schema varchar2, object varchar2) return varchar2`. Return `NULL` for no restriction (for example the owner), else a predicate referencing the context.

```sql
create or replace function app.tenant_predicate (
  p_schema varchar2, p_object varchar2) return varchar2 is
begin
  if sys_context('USERENV', 'SESSION_USER') = 'APP' then
    return null;
  end if;
  return 'tenant_id = sys_context(''APP_CTX'', ''TENANT_ID'')';
end;
/
```

Reference `SYS_CONTEXT` inside the predicate rather than concatenating values, so the text stays the same and shareable.

## 4. Attach the policy

```sql
begin
  dbms_rls.add_policy(
    object_schema   => 'APP',      object_name     => 'ORDERS',
    policy_name     => 'ORDERS_TENANT_SEL',
    function_schema => 'APP',      policy_function => 'TENANT_PREDICATE',
    statement_types => 'SELECT');
  dbms_rls.add_policy(
    object_schema   => 'APP',      object_name     => 'ORDERS',
    policy_name     => 'ORDERS_TENANT_INS',
    function_schema => 'APP',      policy_function => 'TENANT_PREDICATE',
    statement_types => 'INSERT',   update_check    => true);
end;
/
```

With `update_check => true`, inserting or updating a row the user could not then select fails with ORA-28115 (policy with check option violation).

## Column-level VPD and masking

- `sec_relevant_cols => 'SALARY'` applies the policy only when a statement references those columns.
- Add `sec_relevant_cols_opt => dbms_rls.all_rows` to return every row but show the sensitive column as NULL where the predicate fails. Masking applies to queries only, not DML; the application must handle NULLs.

## Policy groups

- Every policy belongs to `SYS_DEFAULT` (always applied, cannot be dropped) unless placed in a group.
- `CREATE_POLICY_GROUP`, `ADD_GROUPED_POLICY`, `ENABLE_GROUPED_POLICY`, `DISABLE_GROUPED_POLICY`, `DROP_GROUPED_POLICY`, `DELETE_POLICY_GROUP` manage groups when several applications share a table.
- A driving context (`ADD_POLICY_CONTEXT`) names which group applies; the context package sets that group name per application.

## Disabling or removing VPD

Reverse order: `dbms_rls.enable_policy(..., enable => false)` or `dbms_rls.drop_policy('APP', 'ORDERS', 'ORDERS_TENANT_SEL')`, then drop the logon trigger (find it in `DBA_TRIGGERS` where `TRIGGERING_EVENT like 'LOGON%'`), then optionally the packages and context. Dropping a policy exposes all rows to every grantee: confirm environment and get explicit approval first.

## Workflow

1. Confirm environment and the access rule (who sees which rows or columns, per statement type).
2. Build and test the context package and logon trigger in a non-production database; verify `SYS_CONTEXT` values for mapped and unmapped users.
3. Write the policy function; unit-test its returned predicate for owner, mapped and unmapped users.
4. Add policies per statement type, with `update_check` for INSERT/UPDATE.
5. Test as each kind of user: expected rows, zero rows for unknown users, ORA-28115 on out-of-scope inserts.
6. Verify in `DBA_POLICIES`, `DBA_POLICY_GROUPS`, `DBA_CONTEXT`; check plans for the injected predicate and that the mapping and filter columns are indexed.

## Red flags

- Policy functions that raise errors or return invalid SQL: every statement on the table fails.
- Unmapped users defaulting to "see everything" instead of nothing.
- Slow logon lookups; unindexed predicate columns.
- Testing as SYSDBA and concluding the policy does not work, or trusting SYSDBA access to be filtered.
- Insert/update policies without `update_check`.
- Column masking added without checking the application handles NULLs.
- Dropping policies or the logon trigger in production without approval; leaving the trigger behind after removing VPD.

## Related

- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — users, roles and view-based security VPD builds on.
- `../TransparentDataEncryption/transparentDataEncryption.md` — protecting the same data at rest.
- `../../PlSql/Triggers/triggers.md` — logon triggers.
- `../../PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` — the context and policy packages.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — failing safe in the policy function.
