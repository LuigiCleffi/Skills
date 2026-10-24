---
name: dba-procedures-functions-packages
description: "Creating, granting, calling, debugging, recompiling and dropping stored procedures, functions and packages (IN/OUT/IN OUT parameters, NOCOPY, definer vs invoker rights with AUTHID, functions called from SQL, package specification vs body, private members and initialization blocks, RAISE_APPLICATION_ERROR, USER_ERRORS, USER_SOURCE, DBMS_OUTPUT), based on Chapter 35 (Procedures, Functions, and Packages) of Oracle Database 11g: The Complete Reference. Use when a user asks to move business logic into the database, write or fix a stored procedure, function or package, call one remotely or from SQL, grant EXECUTE, or hits \"Warning: Procedure created with compilation errors\", PLS-xxxxx errors, ORA-04063 / ORA-06508 (invalid object), ORA-01031 or ORA-00942 inside definer-rights code, or ORA-14551 (DML in a function called from a query)."
---

# Procedures, Functions, and Packages

Store business rules once, in the database, as named PL/SQL units that every application calls. Group related units in packages: expose a small specification, hide the implementation in the body, and grant `EXECUTE` instead of table privileges.

## Choosing the unit

- **Procedure:** performs an action. It has no return value and passes results through `OUT` parameters. It cannot be called directly from SQL.
- **Function:** returns one value with `return`. It can be used in SQL like a built-in function, as long as it does not modify the database and has only `IN` parameters. It cannot be used in CHECK or DEFAULT constraints.
- **Package:** a specification (the public contract) plus a body (the implementation, private helpers, package state and an optional initialization block). This is the default for anything beyond a one-off.

Storing logic on the server reduces client-server round trips and reuses parsed SQL in the shared pool.

## Syntax shapes

```sql
create or replace procedure receive_order (
  p_order_id  in  orders.order_id%TYPE,
  p_status    out orders.status%TYPE)
authid definer            -- default; current_user = invoker rights
as
begin
  update orders set status = 'RECEIVED' where order_id = p_order_id
  returning status into p_status;
  delete from pending_orders where order_id = p_order_id;
end receive_order;
/
```

- The parameter mode defaults to `IN`. `OUT` returns a value, and `IN OUT` does both. `NOCOPY` asks the compiler to pass large `OUT`/`IN OUT` values by reference instead of copying them.
- Static PL/SQL can run any DML but not DDL. DDL needs dynamic SQL (see the dynamic SQL skill).
- `language java name '...'` or `language c ... library` publishes external code instead of a PL/SQL body. C needs the `extproc` agent configured with the DBA.

```sql
create or replace function overdue_fee (p_customer_id in NUMBER)
  return NUMBER
is
  v_fee NUMBER(10,2);
begin
  select nvl(sum((returned_date - due_date) * 0.25), 0) into v_fee
    from rentals
   where customer_id = p_customer_id and returned_date > due_date;
  return v_fee;
end overdue_fee;
/
```

Gotcha: `select sum(...) into` always returns one row (NULL when nothing matches), so a `NO_DATA_FOUND` handler on it never fires. Handle the empty case with `nvl` or an explicit count.

## Packages

```sql
create or replace package order_mgmt as
  function  overdue_fee (p_customer_id in NUMBER) return NUMBER;
  procedure receive_order (p_order_id in NUMBER);
end order_mgmt;
/
create or replace package body order_mgmt as
  g_loaded_at DATE;                                 -- private package state
  function overdue_fee (...) return NUMBER is ... end overdue_fee;
  procedure receive_order (...) is ... end receive_order;
begin
  g_loaded_at := sysdate;                           -- runs once per session
end order_mgmt;
/
```

- Anything declared only in the body is private. Units, variables, cursors, constants and exceptions in the spec are public to anyone with `EXECUTE` on the package.
- The initialization block at the end of the body runs the first time the session touches the package. It shares the body's `end`.
- Call members as `order_mgmt.receive_order(:id)`. Members cannot be recompiled with `alter procedure`; recompile the package instead.
- To hide source code, process it with the `wrap` utility (`$ORACLE_HOME/bin`). Wrapped code cannot be unwrapped, so keep the original source in version control.

## Privileges and calling

- Creating units in your own schema needs `CREATE PROCEDURE`, which also covers functions and packages. Another schema needs `CREATE ANY PROCEDURE`.
- `grant execute on order_mgmt to app_user;` lets a user run the code. Without it, they need `EXECUTE ANY PROCEDURE`.
- **Definer rights** (the default): the code runs with the owner's privileges, so callers need no table grants. The owner's table privileges must be granted directly, not through roles, or compilation fails with ORA-00942/ORA-01031.
- **Invoker rights** (`authid current_user`): the caller needs privileges on every object the code touches.
- Calling: `execute proc(args)` in SQL*Plus, a plain `proc(args);` inside PL/SQL, `owner.proc` or a synonym for another schema, and `proc@db_link(args)` for a remote unit. A synonym on a remote unit or table hides its location, so a move only changes the synonym.

```sql
variable fee number
execute :fee := order_mgmt.overdue_fee(:customer_id);
print fee
select customer_id, order_mgmt.overdue_fee(customer_id) from customers;
```

## Errors and debugging

- Report business errors with `raise_application_error(-20001 .. -20999, 'message')`. Declare custom exceptions (`e_credit_limit EXCEPTION;`) in the declaration section. Predefined ones need no declaration, and `when others` catches the rest.
- After a compile warning, run `show errors`, or query:

```sql
select line, position, text from user_errors
 where name = 'ORDER_MGMT' and type = 'PACKAGE BODY' order by sequence;
```

- Use `set serveroutput on` with `DBMS_OUTPUT.PUT_LINE` (or `PUT`/`NEW_LINE`) for tracing.
- Interactive debugging with `DBMS_DEBUG` needs `DEBUG CONNECT SESSION`. `DBMS_HPROF` (the hierarchical profiler, 11g) reports time per subprogram call.
- View the stored source with `select text from user_source where name = 'ORDER_MGMT' and type = 'PACKAGE BODY' order by line;` (or `ALL_`/`DBA_SOURCE`).

## Compiling, replacing, dropping

- When a referenced object changes, dependent units become invalid and recompile automatically on their next call. Recompile ahead of time to avoid the run-time cost and to catch errors early:

```sql
alter procedure receive_order compile;
alter function overdue_fee compile;
alter package order_mgmt compile;          -- spec and body (default)
alter package order_mgmt compile body;     -- body only, if the spec did not change
select object_name, object_type from user_objects where status = 'INVALID';
```

- `create or replace` keeps existing `EXECUTE` grants. Dropping and re-creating loses them.
- `drop procedure`, `drop function`, `drop package` (spec and body) and `drop package body` are permanent and invalidate callers. Confirm the schema and get approval first, and keep the source so the unit can be re-created.

## Naming

Name procedures with a verb plus the business object they act on (`receive_order`, not `new_book_proc`). Name functions after the value they return (`overdue_fee`). Name the package after its domain. Append the unit name to `end` for readability.

## Workflow
1. Decide the unit type: a function if it is used in SQL or returns one value, otherwise a procedure, and a package for anything related to other units.
2. Write the specification first: parameter names, modes and anchored types.
3. Choose the rights model. For definer rights, grant the owner direct table privileges.
4. Implement, compile, and fix everything `show errors`/`USER_ERRORS` reports.
5. Test from SQL*Plus with bind variables, including empty and error cases.
6. Grant `EXECUTE` to roles or users that need it. Never grant the underlying tables "just in case".
7. After schema changes, recompile and check `USER_OBJECTS` for invalid objects.

## Red flags
- Business rules duplicated in each application instead of one stored unit.
- Functions used in SQL that perform DML (ORA-14551) or have `OUT` parameters.
- A `NO_DATA_FOUND` handler on an aggregate `select ... into` that can never fire.
- Drop and re-create instead of `create or replace`, which silently loses grants.
- Hard-coded `@dblink` names inside code instead of synonyms.
- Relying on role-granted privileges in definer-rights code.
- Everything in the package spec, so there is no encapsulation, or giant packages that mix unrelated domains.
- `when others then null` or `DBMS_OUTPUT` used as error handling in production code.
- Wrapped code with no unwrapped source in version control.

## Related
- `../IntroductionToPlSql/introductionToPlSql.md`: block structure, cursors, loops and exceptions.
- `../Triggers/triggers.md`: calling procedures from triggers.
- `../DynamicSql/dynamicSql.md`: DDL and run-time SQL inside procedures.
- `../PlSqlTuning/plSqlTuning.md`: performance of stored code.
- `../../BeyondTheBasics/RemoteData/remoteData.md`: database links and synonyms for remote units.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md`: EXECUTE grants, roles and direct privileges.
- `../../../../CleanCode/Functions/functions.md`: small, single-purpose units with clear names.
