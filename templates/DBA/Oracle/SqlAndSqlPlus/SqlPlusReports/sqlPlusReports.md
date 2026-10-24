---
name: dba-sqlplus-reports
description: "Building repeatable formatted reports and working efficiently in SQL*Plus (start files, column/break/compute, titles, page layout, spool, buffer editing, login.sql), based on Chapter 6 (Basic SQL*Plus Reports and Commands) of Oracle Database 11g: The Complete Reference. Use when the user asks to format query output in SQL*Plus, write a .sql report script, add subtotals or averages per group, set headings or column widths, spool results to a file, fix wrapped or truncated columns, edit the SQL buffer, set up login.sql/glogin.sql, or mixes up SQL*Plus formatting commands with SQL."
---

# Basic SQL*Plus Reports and Commands

SQL*Plus is both a query tool and a lightweight report writer. Keep the SQL (what data) separate from the SQL*Plus commands (how it looks), put both in a start file so the report is repeatable, and remember that SQL*Plus forgets every setting when the session ends.

## SQL versus SQL*Plus commands

- The `select` is SQL and runs in the database. `column`, `break`, `compute`, `ttitle`, `set`, `spool` are SQL*Plus commands that only format what comes back.
- SQL*Plus commands only know columns by the names the query returns. Give expressions an alias in the SQL (`shipped_date - order_date as days_open`) and then refer to that alias in `column`, `break` and `compute`.
- SQL statements end with `;` on the last line or `/` alone on the next line. `select * from orders/` is wrong.
- SQL*Plus commands do not need a terminator and are not stored in the SQL buffer.

## Anatomy of a report start file

```sql
rem orders_by_customer.sql - open days per order, avg per customer
rem author / date / change history here
set headsep !
ttitle 'Orders by Customer'
btitle 'Sales Operations'
column customer_name format a25
column product       format a20 word_wrapped
column days_open     format 9990.99 heading 'Days!Open'
break on customer_name skip 1 on report
compute avg of days_open on customer_name
compute avg of days_open on report
set linesize 100 pagesize 60 newpage 0 feedback off
spool orders_by_customer.lst
select customer_name, product, order_date, shipped_date,
       shipped_date - order_date as days_open
  from order_lines order by customer_name, order_date;
spool off
```

Run it with `start orders_by_customer.sql` or `@orders_by_customer.sql`.

## Formatting commands that matter

- `column x format a20` sets display width for text, independent of the column's real size. Longer values wrap; add `word_wrapped` to break on word boundaries or `truncated` to cut.
- `column n format 999.99` formats numbers. SQL*Plus always reserves one extra position for a minus sign.
- `column x heading 'Two!Lines'` relabels; the `headsep` character (default `|`) splits headings over lines. Pick a character that never appears in real titles.
- `ttitle` / `btitle` put a title at the top / bottom of every page; `ttitle` is centred on `linesize` and shows date and page number. Use `repheader` / `repfooter` for whole-report headers.
- Embed an apostrophe in a quoted title or literal by doubling it: `'Customer''s view'`.

## Breaks and computes

- `break on col skip 1 on report` groups output visually and suppresses repeated values (add `duplicate` to keep them).
- All breaks must be declared in one `break` command; a second `break` replaces the first.
- Rules: every `break on` needs a matching `order by`; every `compute` needs a `break on` with the same `on` target.
- `compute sum|avg|count|max|min of col on break_col` prints the aggregate at each break; `on report` gives the grand total.

## Page layout

- `set linesize n`: max characters per line; extra columns wrap underneath.
- `set pagesize n`: total lines per page including titles and headings (default 14).
- `set newpage n`: blank lines before each page; `0` emits a form feed; `none` emits nothing.
- `set pause 'More...'` plus `set pause on` pages screen output; turn it off before spooling.
- `set feedback off` drops the "n rows selected" line from reports.

## Spooling output

- `spool file.lst` records everything shown until `spool off` or exit, including prompts and errors.
- Place `spool` immediately before the query to keep commands out of the file. To exclude the query text, type it without `;`, start spooling, then run it with `/`.
- `spool file.lst append` adds to an existing file; `replace` overwrites (the default creates).

## Editing the SQL buffer

| Command | Effect |
|---|---|
| `list` / `l`, `list 3 7` | show buffer or lines; `*` marks the current line |
| `change /old/new` / `c` | replace text on the current line (any delimiter) |
| `append text` / `a` | add text to end of current line (two spaces to insert one) |
| `input text` / `i` | add a line after the current line |
| `del`, `del 3 7`, `del 2 last` | delete lines (`del` must be spelled exactly) |
| `clear buffer` | empty the buffer |
| `/` | run the buffer |

- Do not type the word `delete` as a buffer command; it becomes SQL text.
- The buffer holds only SQL, not SQL*Plus commands. For larger edits use `save file.sql [rep|app]`, then `edit file.sql` after `define _editor = "vi"`.
- `host cmd` runs an OS command from SQL*Plus.
- `store set settings.sql create|replace|append` saves the current environment settings.

## Inspecting and resetting state

- `column`, `column x`, `ttitle`, `btitle`, `break`, `compute` with no arguments show current definitions; `show linesize` (or any `set` parameter) shows a setting.
- `ttitle off`, `btitle off`, `clear columns`, `clear breaks`, `clear computes` reset formatting between reports.

## login.sql and glogin.sql

- SQL*Plus runs `login.sql` from the start directory at startup: put personal defaults there (`define _editor`, `set pagesize`, `set sqlprompt`).
- `glogin.sql` sets site-wide defaults for all users.
- Predefined variables `_DATE`, `_USER`, `_PRIVILEGE` are useful in prompts and titles.

## Comments

- `rem` comments a whole line in a script but cannot appear inside a multi-line SQL statement.
- Inside SQL use `/* ... */` or `-- ...`.

## Workflow
1. Develop the query interactively until the data is right; `save` it as `name.sql`.
2. Edit the file: add a `rem` header, `column`, `break`/`compute`, titles, `set` layout and `spool name.lst`.
3. Make sure the `order by` matches every `break on`.
4. Run with `@name.sql`, inspect the `.lst` file, adjust, repeat.
5. End the script with `spool off` and `clear` commands so it does not leak settings into the next report.

## Red flags
- `break on` without a matching `order by`: groups and subtotals come out scattered and wrong.
- Two separate `break` commands; only the last survives.
- `compute` whose `on` does not match a break column, silently producing nothing.
- `column` commands naming an expression instead of its alias.
- `spool` started too early, so commands and noise end up in the deliverable file.
- A `headsep` character that appears in real titles, splitting them unexpectedly.
- A script that sets formats but never clears them, corrupting later output in the same session.
- Running a script that contains DML or `host` commands against an unconfirmed database: check `show user` and the connect string, and get approval first.

## Related
- `../BasicSql/basicSql.md` — the select statements these reports format.
- `../Grouping/grouping.md` — `group by` for aggregates computed in SQL rather than SQL*Plus.
- `../Dates/dates.md` — date arithmetic and `TO_CHAR` formats used in report columns.
- `../../../../CleanCode/Comments/comments.md` — what belongs in a script header comment.
