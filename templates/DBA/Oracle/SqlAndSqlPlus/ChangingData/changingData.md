---
name: dba-changing-data
description: Changing data safely in Oracle with INSERT (single-row, INSERT ... SELECT, APPEND, multitable INSERT ALL/FIRST), UPDATE (including subquery-driven updates), DELETE, TRUNCATE and MERGE, controlling transactions with COMMIT, ROLLBACK and SAVEPOINT, and logging bad rows with DBMS_ERRLOG and LOG ERRORS, based on Chapter 15 (Changing Data: insert, update, merge, and delete) of Oracle Database 11g: The Complete Reference. Use when the agent is about to modify table data, write an upsert, bulk-load with insert as select, split one source into several tables, sees ORA-01427 (single-row subquery returns more than one row), ORA-12899 (value too large for column) or ORA-38104 (columns in the ON clause cannot be updated), or must decide between DELETE and TRUNCATE.
---

# Changing Data: insert, update, merge, and delete

Data changes use the same SQL you already know, but mistakes persist. The where clause decides what changes; the transaction decides whether the change is final. Preview with a select, change inside an open transaction, check the row count, and only then commit.

## Safety rules for agents

- Confirm the target database, schema and environment before any DML. Never run data changes against production without explicit approval from the user.
- Run the where clause as a `select count(*)` first; the DML must affect the same number of rows.
- Keep SQL*Plus `autocommit` OFF (the default) and keep `feedback` on so you see "n rows updated".
- `delete` or `update` without a where clause touches every row.
- `truncate` removes all rows, cannot be rolled back and cannot be seen by flashback query. Treat it like DDL: require explicit approval and a backup or export of the data first.
- Back-out plan: before commit, `rollback`; after commit, flashback query or table (if undo is still available) or restore from backup.

## insert

```sql
insert into orders (order_id, customer_id, order_date, status)
values (:order_id, :customer_id,
        TO_DATE(:order_date, 'YYYY-MM-DD HH24:MI'), 'NEW');
```

- Always list the columns; then the value order is yours, not the table's.
- Use `TO_DATE` with a mask for dates. A date without a time is stored at midnight; use TIMESTAMP types for fractional seconds.
- `NULL` in the values list leaves the column empty.
- Values must fit the column's length and precision, or the insert fails ("value too large" or datatype mismatch).
- `insert into t (cols) select ...` inserts one row per selected row; the select may use any functions. LONG columns need `TO_LOB` in this form.

### APPEND for large loads

`insert /*+ APPEND */ into ... select ...` writes above the high-water mark, directly to the datafiles, bypassing the buffer cache. It is faster for big loads but does not reuse free space, so the table grows. Use it for large volumes into tables with little reusable space. Only `truncate` resets the high-water mark.

## Transactions

- Changes are visible only to your session until `commit`; others keep seeing the old data.
- `rollback` undoes everything since the last commit. "Rollback complete" means nothing if the work was already committed.
- `savepoint name` marks a point; `rollback to savepoint name` undoes only the work after it.
- Implicit commit: any DDL statement, and `exit` or `quit` in SQL*Plus. Do not mix DDL into a data-fix script you may need to roll back.
- After a crash, uncommitted work is rolled back automatically when the database restarts.

## Multitable insert

```sql
insert first
  when total_amount >= 10000 then into large_orders  values (order_id, total_amount)
  when total_amount >= 1000  then into medium_orders values (order_id, total_amount)
  else                            into small_orders  values (order_id, total_amount)
select order_id, total_amount from orders where order_date >= :since;
```

- `insert all` evaluates every `when` (a row may go to several targets); without `when` clauses, every `into` runs for every row (useful for unpivoting columns into rows).
- `insert first` stops at the first true `when`; it requires `when` clauses. `else` catches rows that match none.
- Feedback reports the total across all targets, not per table; count each target afterward.

## update and delete

```sql
update orders o
   set (o.ship_city, o.ship_country) =
       (select c.city, c.country from customers c where c.customer_id = o.customer_id)
 where o.status = 'NEW';
```

- The subquery must return at most one row per updated row, or the statement fails (ORA-01427).
- `set col = NULL` is the one place `=` is used with NULL.
- Expressions are allowed: `set price = price * 1.05`.
- Updates and deletes that violate column definitions or constraints fail as a whole.
- `delete from t where ...` can be rolled back until commit; the where clause may contain any subquery logic.

## merge (upsert)

```sql
merge into customers t
using (select customer_id, email, status from customer_staging) s
   on (t.customer_id = s.customer_id)
 when matched then
      update set t.email = s.email, t.status = s.status
      delete where (t.status = 'CLOSED')
 when not matched then
      insert (customer_id, email, status)
      values (s.customer_id, s.email, s.status);
```

- Columns in the `on` condition cannot be updated (ORA-38104).
- You may supply only the update branch, only the insert branch, or both.
- `delete where` inside the matched branch evaluates the updated values and only affects rows the merge matched.
- `on (0 = 1)` makes every source row an unconditional insert with no join.
- Feedback reports rows merged, not how many were inserted versus updated. Filter the source in `using`.

## DML error logging

By default one bad row fails the whole statement. To keep good rows and capture bad ones:

```sql
exec DBMS_ERRLOG.CREATE_ERROR_LOG('ORDERS', 'ERR$_ORDERS');

insert into orders (order_id, customer_id, status)
select order_id, customer_id, status from orders_staging
log errors into err$_orders ('load_' || TO_CHAR(SYSDATE, 'YYYYMMDD'))
reject limit unlimited;
```

- The log table gets the row values plus `ORA_ERR_MESG$` (error) and `ORA_ERR_TAG$` (your tag). The default name is `ERR$_` plus the table name.
- The default reject limit is 0. When errors are logged and the statement completes, no error is returned: always query the log table afterward.
- Not captured (the statement still fails): deferred constraint violations, unique violations in direct-path insert or merge, and unique violations in update or merge. LONG, LOB and object columns are not logged.

## Workflow

1. Confirm environment and get approval for any change outside a disposable dev database.
2. Write the select that identifies the target rows; record the count.
3. Run the DML with autocommit off and feedback on; compare the reported count to the recorded one.
4. Query the changed rows (and error log table, if used) to verify the result.
5. Commit only when the result is correct; otherwise roll back to the last good savepoint or fully.

## Red flags

- `update` or `delete` with no where clause, or one never tested as a select.
- `truncate` proposed as a faster delete without approval or backup.
- DDL in the middle of a data-fix transaction (silent commit).
- Subquery updates without a one-row guarantee per target row.
- `log errors` used without checking the log table afterward.
- `APPEND` hints on small, frequent inserts.
- Date values inserted as bare strings that depend on NLS settings.

## Related

- `../Subqueries/subqueries.md` — writing the subqueries used in where, set and using clauses.
- `../ConversionFunctions/conversionFunctions.md` — explicit TO_DATE and TO_NUMBER in inserted values.
- `../Dates/dates.md` — date and time components of inserted values.
- `../../BeyondTheBasics/FlashbackQueries/flashbackQueries.md` — recovering committed mistakes.
- `../../BeyondTheBasics/FlashbackTablesAndDatabases/flashbackTablesAndDatabases.md` — rewinding a table after a bad change.
- `../../BeyondTheBasics/SqlLoader/sqlLoader.md` — bulk loading from files.
- `../../BeyondTheBasics/RemoteData/remoteData.md` — DML against remote databases.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — treating failure paths, such as logged rejects, as first-class.
