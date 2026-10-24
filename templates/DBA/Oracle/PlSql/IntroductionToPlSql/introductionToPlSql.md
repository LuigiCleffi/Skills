---
name: dba-introduction-to-plsql
description: "Writing basic PL/SQL blocks: the declare/begin/exception/end structure, variables, constants, %TYPE and %ROWTYPE anchoring, explicit cursors and cursor attributes, IF/ELSIF, CASE, simple, WHILE, FOR and cursor FOR loops, CONTINUE, and exception handlers, based on Chapter 32 (An Introduction to PL/SQL) of Oracle Database 11g: The Complete Reference. Use when a user asks to write or fix an anonymous block or PL/SQL logic, loop over query results, add error handling, or hits ORA-06550 (compile error in block), ORA-01476 (divisor is zero), ORA-06592 / CASE_NOT_FOUND, ORA-01403 (no data found), ORA-06512 stack lines, or an infinite loop."
---

# An Introduction to PL/SQL

PL/SQL wraps SQL in procedural logic. Each unit is a block with optional declarations, a required executable part and an optional exception part. Anchor types to the data, let cursor FOR loops manage cursors, and handle only the errors you can actually deal with.

## Block structure

```sql
declare
  c_rate    constant NUMBER(5,4) := 0.0825;   -- cannot be reassigned
  v_total   orders.total%TYPE;                -- anchored to a column
begin
  select total into v_total from orders where order_id = :order_id;
  update orders set tax = v_total * c_rate where order_id = :order_id;
exception
  when NO_DATA_FOUND then
    DBMS_OUTPUT.PUT_LINE('Order not found: ' || :order_id);
end;
/
```

- `declare` defines variables, constants and cursors. `begin` starts the executable commands. `exception` holds the handlers. `end;` closes the block. In SQL*Plus, a `/` on its own line runs it.
- Initialize with `:=` or `DEFAULT`. `constant` requires an initial value and forbids reassignment.
- A block without a name is anonymous. Named blocks (procedures, functions, packages, triggers) are covered in the following chapters.

## Datatypes and anchoring

PL/SQL supports every SQL type plus `BOOLEAN`, `PLS_INTEGER`/`BINARY_INTEGER`, composite types (`RECORD`, `TABLE`, `VARRAY`), references (`REF CURSOR`) and LOBs.

- `v_col table.column%TYPE` copies one column's type.
- `v_row cursor_or_table%ROWTYPE` copies a whole row. Fields are accessed as `v_row.column`.
- `%TYPE` can also anchor to a field of a `%ROWTYPE` variable.

Anchoring means a column type change (say `NUMBER(5)` to `NUMBER(7,2)`) does not require editing the code. Prefer it over hard-coded lengths.

## Cursors

An explicit cursor names a query. `open` runs it, `fetch` reads one row, and `close` releases it. Its attributes are `%FOUND`, `%NOTFOUND`, `%ISOPEN` and `%ROWCOUNT` (rows fetched so far).

```sql
declare
  cursor c_late is select order_id, due_date from orders where status = 'LATE';
  r_late c_late%ROWTYPE;
begin
  open c_late;
  loop
    fetch c_late into r_late;
    exit when c_late%NOTFOUND;     -- test right after fetch
    -- process r_late
  end loop;
  close c_late;
end;
/
```

Prefer the cursor FOR loop. It opens, fetches and closes implicitly, and declares the record for you:

```sql
for r in (select order_id from orders where status = 'LATE') loop
  -- process r.order_id
end loop;
```

## Conditional logic

- `if ... then ... elsif ... then ... else ... end if;`. Note the spelling `elsif`. Flatten nested IFs by combining conditions where you can.
- The searched `case when cond then ... end case;` statement evaluates its branches in order. Without an `else`, a non-matching value raises `CASE_NOT_FOUND`. Add an explicit `else` when "no match" is legitimate.
- A `case` expression (`case status when 'N' then 'New' else status end`) translates codes inside an assignment or SQL statement.

## Loops

| Loop | Ends when | Use for |
|---|---|---|
| `loop ... exit when cond; end loop;` | Exit condition inside | Body must run at least once |
| `while cond loop ... end loop;` | Condition false at top | Condition known before each pass |
| `for i in 1..n loop` | Range exhausted | Fixed count. `i` is implicit and read-only |
| `for r in cursor loop` | No more rows | Processing query results |

- `continue;` or `continue when cond;` skips to the next iteration. Update the loop variable before the `continue`, or the loop never ends.
- In simple and WHILE loops, check that the starting values and the increment actually reach the exit condition.

## Exception handling

When an error is raised, control leaves the executable section at once and jumps to the matching `when` handler. It never returns to the statement that failed.

- Predefined exceptions include `NO_DATA_FOUND`, `TOO_MANY_ROWS`, `ZERO_DIVIDE`, `VALUE_ERROR`, `DUP_VAL_ON_INDEX` and `CASE_NOT_FOUND`. Declare your own with `e_name EXCEPTION;` and `raise e_name;`.
- `when others` catches everything else. Use it only to log and re-raise (`raise;`), never to hide errors.
- An unhandled error in an anonymous block rolls back that block's work and returns the error stack (`ORA-xxxxx` followed by `ORA-06512: at line n`).
- To keep going after an expected error, either test for it first with IF, or wrap the risky statement in a nested `begin ... exception ... end;` block with its own handler.

```sql
for r in (select id, qty, amount from order_lines) loop
  begin
    update order_lines set unit_price = r.amount / r.qty where id = r.id;
  exception
    when ZERO_DIVIDE then
      insert into load_errors(line_id, msg) values (r.id, 'qty = 0');
  end;
end loop;
```

PL/SQL accepts the full SQL language, including regular expression functions and flashback queries.

## Workflow
1. Write the SQL first and test it alone.
2. Declare variables anchored with `%TYPE`/`%ROWTYPE`. Use constants for fixed values and bind variables for inputs.
3. Choose the loop by its exit rule. Default to a cursor FOR loop for row processing, and to a single set-based SQL statement when no per-row logic is needed.
4. Add handlers only for errors you can resolve. Let the rest propagate, or log and re-raise.
5. Run with `set serveroutput on`, check `show errors` for compile failures (ORA-06550), and query the affected tables to verify the result before you commit.

## Red flags
- Hard-coded `VARCHAR2(30)` or `NUMBER(5)` types copied from a table instead of `%TYPE`.
- Testing `%NOTFOUND` before the first fetch, or processing the row before testing it.
- Explicit open/fetch/close where a cursor FOR loop would do, or a cursor left open on error paths.
- `CONTINUE` or `EXIT` placed so the loop counter is never advanced.
- `CASE` without `else` on data that can hold unexpected values.
- `when others then null;`, which swallows every error, including ones that leave data half-changed.
- Row-by-row loops doing what one `insert ... select` or `update` could do.
- Assuming execution resumes after a handler. It does not.

## Related
- `../ProceduresFunctionsPackages/proceduresFunctionsPackages.md`: turning blocks into named, reusable units.
- `../Triggers/triggers.md`: blocks that fire on DML, DDL and database events.
- `../DynamicSql/dynamicSql.md`: running SQL built at run time.
- `../PlSqlTuning/plSqlTuning.md`: making PL/SQL fast.
- `../../SqlAndSqlPlus/DecodeAndCase/decodeAndCase.md`: CASE in SQL.
- `../../../../CleanCode/ErrorHandling/errorHandling.md`: general error handling principles behind the exception rules.
