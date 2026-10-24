---
name: dba-triggers
description: "Designing, writing and managing Oracle triggers (row vs statement level, BEFORE/AFTER/INSTEAD OF, DML, schema DDL and database event triggers, compound triggers, :OLD/:NEW, WHEN clauses, INSERTING/UPDATING/DELETING, RAISE_APPLICATION_ERROR, event attributes such as ora_dict_obj_name, enabling, disabling and recompiling), based on Chapter 34 (Triggers) of Oracle Database 11g: The Complete Reference. Use when a user asks to audit changes, keep a derived column in sync, block certain DML or DDL, run code at logon or startup, update a join view, or hits ORA-04091 (mutating table), ORA-04088 (error during trigger execution), ORA-20xxx from a trigger, slow bulk loads caused by triggers, or an invalid trigger."
---

# Triggers

A trigger is PL/SQL the database runs automatically on DML, DDL or database events. It is invisible to the user, and the triggering statement fails if it fails. Use declarative constraints first. Use triggers only for rules that constraints cannot express, and keep them short.

## Picking the trigger type

| Need | Trigger |
|---|---|
| Set or correct a column value on the row being written | `BEFORE INSERT/UPDATE ... FOR EACH ROW` (assign to `:new.col`) |
| Audit a change after it passed constraints | `AFTER ... FOR EACH ROW` |
| Check once per statement (security, time windows) | Statement level (the default, no `for each row`) |
| Make a complex view updatable | `INSTEAD OF` on the view |
| Share state between row and statement phases, avoid mutating-table errors | `COMPOUND TRIGGER` (DML only) |
| React to create/alter/drop/grant in a schema | `BEFORE/AFTER <ddl_event> ON schema` |
| React to logon, logoff, startup, shutdown, servererror | `... ON DATABASE` (needs `ADMINISTER DATABASE TRIGGER`) |

There are no BEFORE triggers on logon or startup.

## Syntax shape

```sql
create or replace trigger orders_bef_upd_row
before update of status on orders
for each row
when (new.status = 'CANCELLED' and old.status <> 'CANCELLED')
begin
  insert into order_audit (order_id, old_status, new_status, changed_at, changed_by)
  values (:old.order_id, :old.status, :new.status, systimestamp, user);
end;
/
```

- Write `old`/`new` without a colon in the `WHEN` clause and with a colon (`:old`, `:new`) in the body. `REFERENCING` renames them.
- `update of col1, col2` limits firing to updates of those columns.
- Combine events in one trigger (`before insert or update or delete`) at the same level, and branch with `if INSERTING`, `UPDATING` or `DELETING`. This keeps all the logic for one table in one place.
- For a body that is just a procedure call, use `CALL` instead of a block: `... for each row call log_order_change(:new.order_id)`.

## Privileges

- Creating a trigger requires `CREATE TRIGGER` (or `CREATE ANY TRIGGER` for another schema) and the ability to alter the table: you own it, or have `ALTER` on it or `ALTER ANY TABLE`.
- Privileges used inside the body (for example, inserting into the audit table) must be granted to the trigger owner directly, not through a role.
- Altering a trigger requires ownership or `ALTER ANY TRIGGER`. Dropping one requires ownership or `DROP ANY TRIGGER`.

## Common uses

**Derived column sync.** `:new.email_upper := upper(:new.email);` in a BEFORE INSERT OR UPDATE OF email row trigger. A virtual column may now be the simpler choice (see the online application upgrades skill).

**Custom errors.** Raise them with `RAISE_APPLICATION_ERROR(-20001 .. -20999, 'message')`. The caller sees the error followed by ORA-06512 and ORA-04088. A statement-level check fires even when no rows match.

```sql
create or replace trigger orders_bef_del
before delete on orders
begin
  if to_char(sysdate, 'DY', 'NLS_DATE_LANGUAGE=ENGLISH') in ('SAT', 'SUN') then
    raise_application_error(-20001, 'Orders cannot be deleted on weekends');
  end if;
end;
/
```

**Copying audit rows to a remote database.** An AFTER INSERT trigger can insert over a database link, but if the remote insert fails, the local insert fails too. For asynchronous copies, prefer materialized views.

## DDL and database event triggers

Inside these triggers, event attribute functions describe what is happening: `ora_sysevent`, `ora_dict_obj_owner`, `ora_dict_obj_name`, `ora_dict_obj_type`, `ora_login_user`, `ora_client_ip_address`, `ora_database_name`, `ora_instance_num`, `ora_is_alter_column`, `ora_is_drop_column`, `ora_grantee`, `ora_privilege_list`, `ora_sql_txt`, `ora_server_error`/`ora_server_error_msg`, `space_error_info` and others.

```sql
create or replace trigger protect_core_tables
before drop on app.schema
begin
  if ora_dict_obj_type = 'TABLE' and ora_dict_obj_name like 'CORE\_%' escape '\' then
    raise_application_error(-20010, 'Dropping core tables is not permitted');
  end if;
end;
/
```

- If the goal is only security monitoring of DDL, consider `AUDIT` first.
- Startup and shutdown triggers can only use `ora_instance_num`, `ora_database_name`, `ora_login_user` and `ora_sysevent`. An `after startup on database` trigger is a common place to pin packages with `DBMS_SHARED_POOL.KEEP`.
- Database-level triggers affect every session. Create them only after confirming the target database and getting approval.

## Compound triggers (11g)

A compound trigger has up to four sections (`BEFORE STATEMENT`, `BEFORE EACH ROW`, `AFTER EACH ROW`, `AFTER STATEMENT`) that share declared variables for the duration of one statement. A typical use is to collect keys per row and act on the table once in `AFTER STATEMENT`, which avoids ORA-04091.

```sql
create or replace trigger order_lines_cmp
for insert or update on order_lines
compound trigger
  type t_ids is table of order_lines.order_id%TYPE index by pls_integer;
  g_ids t_ids;
  after each row is begin
    g_ids(g_ids.count + 1) := :new.order_id;
  end after each row;
  after statement is begin
    forall i in 1 .. g_ids.count
      update orders o set line_total = (select sum(amount) from order_lines l
                                        where l.order_id = o.order_id)
       where o.order_id = g_ids(i);
  end after statement;
end;
/
```

Restrictions:
- DML only, on a table or view.
- No `AUTONOMOUS_TRANSACTION` and no initialization or exception section at trigger level. Handle exceptions inside each section; `GOTO` must also stay within one section.
- `:old`/`:new` are not allowed in the declaration or statement sections, and only `BEFORE EACH ROW` may assign `:new`.
- If the triggering statement rolls back, the shared state is reset but side effects are not undone.
- Firing order relative to other triggers is not guaranteed.

## Managing triggers

```sql
alter trigger orders_bef_upd_row disable;      -- or enable / compile / compile debug
alter table orders disable all triggers;       -- or enable all triggers
select trigger_name, status from user_triggers where table_name = 'ORDERS';
```

- Triggers are enabled when created and affect only future operations, never existing rows.
- Disabling triggers speeds up bulk loads and avoids firing twice on a reload after a failed load. Afterwards you must apply by hand whatever the trigger would have done. Re-enable them, and get approval before disabling triggers on shared systems, especially audit triggers.
- To change the body, use `create or replace` (only the status can be altered). A trigger becomes invalid when an object it depends on changes; recompile it with `alter trigger ... compile`.
- Naming: table name plus timing, event and level, for example `ORDERS_BEF_UPD_ROW` or `ORDER_LINES_AFT_INS_STMT`, within the 30-character limit.

## Workflow
1. Confirm a constraint, default or virtual column cannot do the job.
2. Pick the timing and level from the table above. Narrow firing with `update of` and `WHEN`.
3. Grant direct privileges on every object the body touches.
4. Keep the body small and move logic into a package procedure. Raise domain errors with `RAISE_APPLICATION_ERROR`.
5. Test single-row and multi-row statements, failing cases and the rollback behavior. Check `user_triggers.status` and `user_errors`.
6. Document disable and enable steps for load procedures.

## Red flags
- Triggers replacing foreign keys or check constraints.
- A row-level trigger querying or modifying its own table, which raises ORA-04091. Use a compound trigger or redesign.
- Long or remote operations in a row trigger, so that every row of a bulk statement pays for them and remote failures block local DML.
- `when others then null` in a trigger, which silently skips audit or validation.
- Relying on role-granted privileges inside the body.
- Assuming a defined firing order among several triggers on the same event.
- Triggers left disabled after a load, or disabled without reapplying their effects.
- Database-wide logon or DDL triggers created without approval or an escape plan (a failing logon trigger can block connections).

## Related
- `../IntroductionToPlSql/introductionToPlSql.md`: block, exception and loop syntax used in trigger bodies.
- `../ProceduresFunctionsPackages/proceduresFunctionsPackages.md`: moving trigger logic into callable procedures.
- `../OnlineApplicationUpgrades/onlineApplicationUpgrades.md`: virtual columns as an alternative to sync triggers.
- `../../BeyondTheBasics/MaterializedViews/materializedViews.md`: asynchronous replication instead of remote-insert triggers.
- `../../BeyondTheBasics/VirtualPrivateDatabase/virtualPrivateDatabase.md`: logon triggers that set application context.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md`: AUDIT and privilege grants.
