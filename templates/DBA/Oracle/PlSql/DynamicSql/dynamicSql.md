---
name: dba-dynamic-sql
description: "Running SQL built at run time from PL/SQL with native dynamic SQL (EXECUTE IMMEDIATE with USING and RETURNING INTO bind variables) and the DBMS_SQL package (OPEN_CURSOR, PARSE, BIND_VARIABLE/BIND_ARRAY, DEFINE_COLUMN, EXECUTE, FETCH_ROWS, COLUMN_VALUE, CLOSE_CURSOR), including DDL from stored code, based on Chapter 36 (Using Native Dynamic SQL and DBMS_SQL) of Oracle Database 11g: The Complete Reference. Use when a user needs DDL inside a procedure, a table or column name passed as a parameter, a generic \"run this statement\" utility, or a statement whose shape is unknown until run time, or when code concatenates literal values into SQL strings, the shared pool fills with near-identical statements in V$SQL, or ORA-01031 (insufficient privileges) appears only when DDL runs inside a procedure."
---

# Using Native Dynamic SQL and DBMS_SQL

Dynamic SQL lets PL/SQL run statements, including DDL, that are assembled at run time. Use `EXECUTE IMMEDIATE` by default. Always pass values as bind variables. Only object names that cannot be bound may be concatenated, and only after they have been validated.

## When you need it

- DDL from PL/SQL (`create`, `alter`, `drop`, `truncate`). Static PL/SQL cannot run DDL.
- Table, column or where-clause structure that is unknown until run time.
- Generic utilities that take a statement or object name as input.

If the statement's shape is fixed and only the values change, use static SQL. It is checked at compile time and tracked as a dependency.

## EXECUTE IMMEDIATE

```sql
begin
  execute immediate 'delete from orders where status = :st and created < :cutoff'
    using 'CANCELLED', add_months(sysdate, -24);
end;
/
```

- The string has no trailing semicolon. Inside a quoted literal, each single quote is written twice ('').
- `USING` supplies the values for the placeholders, which are matched by position, not by name.
- For a single-row query, use `execute immediate sql into v1, v2 using ...`.
- For DML with a `RETURNING` clause, use `RETURNING INTO`:

```sql
declare
  v_new_price products.price%TYPE;
begin
  execute immediate
    'update products set price = price * 1.05 where product_id = :1
      returning price into :2'
    using :product_id returning into v_new_price;
end;
/
```

- Anonymous PL/SQL blocks and procedure calls can also be run dynamically (`'begin pkg.proc(:a); end;'`).

## Bind variables: performance and safety

With binds, one shared cursor is reused, and V$SQL shows a single statement such as `... where status = :st`. With literals, each distinct value is parsed again and stored separately, which floods the shared pool and costs CPU. `CURSOR_SHARING` can paper over this at the instance level, but the fix belongs in the code.

```sql
select sql_text, executions from v$sql
 where sql_text like 'delete from orders where status%';
```

Concatenating user input into SQL is also an injection risk. Bind every value. Identifiers (table and column names) cannot be bound, so check them against the data dictionary before you concatenate them:

```sql
create or replace procedure purge_rows (p_table in VARCHAR2, p_cutoff in DATE) as
  v_table user_tables.table_name%TYPE;
begin
  select table_name into v_table from user_tables
   where table_name = upper(p_table);            -- NO_DATA_FOUND if not a real table
  execute immediate 'delete from "' || v_table || '" where created < :c' using p_cutoff;
end;
/
```

## Privileges for dynamic DDL

Stored code runs DDL with the owner's privileges, and those must be granted directly, not through a role. Otherwise the call fails with ORA-01031 even though the same command works in SQL*Plus. A generic "execute any string" procedure runs with its owner's full rights, so never grant `EXECUTE` on one widely.

DDL issues an implicit commit, both before and after it runs. Running it inside a transaction commits the pending work.

## DBMS_SQL

DBMS_SQL is the older, more verbose interface. Use it when you need step-by-step control, for example a select list that is unknown at compile time, reusing one parsed cursor with array binds, or describing columns.

```sql
declare
  c  INTEGER := DBMS_SQL.OPEN_CURSOR;
  n  INTEGER;
  v_name customers.name%TYPE;
begin
  DBMS_SQL.PARSE(c, 'select name from customers where region = :r', DBMS_SQL.NATIVE);
  DBMS_SQL.BIND_VARIABLE(c, ':r', 'WEST');
  DBMS_SQL.DEFINE_COLUMN(c, 1, v_name, 100);
  n := DBMS_SQL.EXECUTE(c);
  while DBMS_SQL.FETCH_ROWS(c) > 0 loop
    DBMS_SQL.COLUMN_VALUE(c, 1, v_name);
  end loop;
  DBMS_SQL.CLOSE_CURSOR(c);
end;
/
```

- `OPEN_CURSOR` returns a cursor ID. `PARSE` checks the statement and attaches it to the cursor (`DBMS_SQL.NATIVE` means the current database version's behavior). DDL runs during `PARSE`.
- `BIND_VARIABLE` binds one value, and `BIND_ARRAY` binds a collection that is applied once per execution.
- For queries, call `DEFINE_COLUMN` once per select-list position before executing. Use `DEFINE_COLUMN_LONG` for LONG columns and `DEFINE_ARRAY` for array fetches.
- `EXECUTE` returns the number of rows processed for DML. `EXECUTE_AND_FETCH` combines execute and first fetch. `FETCH_ROWS` returns the number of rows fetched (0 at the end), and `COLUMN_VALUE` reads each column. `VARIABLE_VALUE` reads OUT binds from a dynamic PL/SQL block.
- `CLOSE_CURSOR` frees memory and an open cursor slot. Close it in the exception handler too, after checking `DBMS_SQL.IS_OPEN(c)`, or sessions leak cursors.

Version note: `CURSOR_SHARING = SIMILAR` was deprecated in 11g Release 2. Use `EXACT` with binds, or `FORCE` as a stopgap.

## Workflow
1. Confirm static SQL cannot do the job.
2. Write the statement with placeholders for every value and list them in `USING`.
3. Validate any identifier against the data dictionary before concatenating it, and quote it.
4. Choose `EXECUTE IMMEDIATE`. Fall back to DBMS_SQL only for an unknown select list, describe, or fine-grained cursor reuse.
5. Grant the owner direct privileges for any DDL. Remember the implicit commit.
6. Before running dynamic DDL or mass deletes against shared databases, print the generated statement, confirm the target, and get approval.
7. Verify with a query on the affected objects. Check V$SQL to confirm a single shared statement.

## Red flags
- Concatenating values (`'... where id = ' || p_id`) instead of binding them.
- Concatenating user-supplied table names or where clauses without validation, which allows SQL injection.
- Widely granted "run any string" or "delete rows from any table" procedures. A NULL condition can wipe a whole table.
- Dynamic DDL in the middle of a transaction, unaware of the implicit commit.
- DBMS_SQL cursors not closed on error paths.
- Dynamic SQL used where static SQL works, which loses compile-time checking and dependency tracking.
- Relying on `CURSOR_SHARING` instead of fixing literal SQL.

## Related
- `../ProceduresFunctionsPackages/proceduresFunctionsPackages.md`: definer rights and direct grants that dynamic DDL depends on.
- `../IntroductionToPlSql/introductionToPlSql.md`: block and exception structure around dynamic calls.
- `../PlSqlTuning/plSqlTuning.md`: bind variables, bulk binds and parsing costs.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md`: privileges and why roles do not apply in stored code.
- `../../HitchhikersGuides/TuningApplicationsAndSql/tuningApplicationsAndSql.md`: diagnosing shared pool pressure in V$SQL.
- `../../../../CleanCode/Boundaries/boundaries.md`: keeping generic SQL utilities behind a narrow, validated interface.
