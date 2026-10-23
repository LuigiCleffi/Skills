---
name: dba-large-objects
description: Storing and manipulating large data with BLOB, CLOB, NCLOB and BFILE columns: LOB storage clauses, empty locators, directories and BFILENAME, SQL string functions on CLOBs, the DBMS_LOB package (READ, SUBSTR, INSTR, GETLENGTH, COMPARE, WRITE, APPEND, ERASE, TRIM, COPY, file open/close and load), migrating LONG columns and deleting LOBs, based on Chapter 40 (Using Large Objects) of Oracle Database 11g: The Complete Reference. Use when the user creates a table with LOB columns, writes a LOB ... STORE AS clause, uses EMPTY_CLOB/EMPTY_BLOB/BFILENAME or CREATE DIRECTORY, calls DBMS_LOB, reads files from the database server, converts LONG or LONG RAW, or sees LOB output truncated in SQL*Plus.
---

# Using Large Objects

Use LOB datatypes, not LONG or LONG RAW, for large data. Internal LOBs (BLOB, CLOB, NCLOB) get full transactional integrity; BFILEs are read-only pointers to operating-system files that Oracle neither validates nor protects. The table row stores a locator; the data lives inline when small or out of line in its own segment.

## Datatypes

| Type | Holds | Integrity |
|---|---|---|
| BLOB | Binary data in the database | Transactional |
| CLOB | Character data in the database | Transactional |
| NCLOB | Character data in the national (multibyte) character set | Transactional |
| BFILE | Read-only binary file outside the database | None: file may be missing or changed |

- A table may have many LOB columns but only one LONG column.
- Internal LOBs up to about 4000 bytes are stored inline by default; larger values go out of line, so scans read only locators.

## Storage clause

```sql
create table documents
 (doc_id   number primary key,
  body     clob,
  scan     blob,
  original bfile)
tablespace app_data
lob (body, scan) store as
 (tablespace app_lobs chunk 16k pctversion 10 nocache logging);
```

- `chunk`: space allocated per LOB manipulation (book: default 1KB, maximum 32KB).
- `pctversion`: percentage of LOB space kept for old versions (default 10) before they are overwritten.
- `nocache` (default) or `cache`: whether LOB reads go through the buffer cache. `cache nologging` is not allowed; with neither logging option given, logging follows the tablespace.
- `nologging` skips redo; data loaded that way is not recoverable from redo. Confirm the recovery plan before using it.
- With a single LOB column you can name its segment right after `store as`.

## Initializing values

An empty locator is not NULL. An internal LOB must hold an empty locator before you can write into it with DBMS_LOB.

| Column | Initialize with |
|---|---|
| BLOB | `EMPTY_BLOB()` |
| CLOB, NCLOB | `EMPTY_CLOB()` |
| BFILE | `BFILENAME('DIR_NAME', 'file.pdf')` |

```sql
create directory doc_dir as '/u01/app/docs';   -- DBA or CREATE ANY DIRECTORY
grant read on directory doc_dir to app_user;

insert into documents (doc_id, body, scan, original)
values (:id, empty_clob(), empty_blob(), bfilename('DOC_DIR', :file_name));
```

- BFILENAME takes the directory object name, not the OS path. The file need not exist at insert time.
- `insert ... select` copies LOB columns (impossible with LONG); copied BFILEs point at the same file, so repoint them if each row needs its own.
- Creating directories and granting access to them exposes server files: confirm the path and grantees with the user first.

## SQL functions on CLOBs

`SUBSTR`, `INSTR`, `LENGTH`, `INITCAP`, `LTRIM` and the regular expression functions work on CLOBs. A plain `update ... set body = :text` replaces a value. In SQL*Plus, `set long 100000` to see more than the default 80 characters.

## DBMS_LOB essentials

Reads take a locator selected into a PL/SQL variable. Writes need the row locked with `select ... for update` and a commit afterwards (test first without the commit).

```sql
declare
  l_body  clob;
  l_chunk varchar2(32767);
  l_amt   integer := 32767;
  l_pos   integer := 1;
begin
  select body into l_body from documents where doc_id = :id;
  dbms_lob.read(l_body, l_amt, l_pos, l_chunk);       -- loop for larger LOBs
  dbms_output.put_line(dbms_lob.getlength(l_body));
end;
/
```

| Need | Call |
|---|---|
| Read a piece (often in a loop) | `READ(lob, amount, offset, buffer)` |
| Return a piece | `SUBSTR(lob, amount, offset)` |
| Find a pattern | `INSTR(lob, pattern, offset, nth)` (0 if absent) |
| Length | `GETLENGTH(lob)` (NULL for a NULL LOB) |
| Compare same-type LOBs | `COMPARE(lob1, lob2, amount, off1, off2)` (0 if equal) |
| Overwrite at an offset | `WRITE(lob, amount, offset, buffer)` |
| Append a buffer / another LOB | `WRITEAPPEND`, `APPEND(dest, src)` |
| Blank out a range (spaces or zero bytes; positions unchanged) | `ERASE(lob, amount, offset)` |
| Shorten | `TRIM(lob, new_length)` |
| Copy part of one LOB into another | `COPY(dest, src, amount, dest_off, src_off)` |
| Temporary LOBs | `CREATETEMPORARY`, `FREETEMPORARY` |

- PL/SQL VARCHAR2 and RAW buffers max out at 32767; use RAW buffers for BLOBs. READ past the end raises an error.
- Many CLOB edits can be rewritten as a plain `update` with `SUBSTR` and concatenation, which is often clearer.

## BFILEs

```sql
declare
  l_file bfile := bfilename('DOC_DIR', :file_name);
  l_blob blob;
begin
  select scan into l_blob from documents where doc_id = :id for update;
  if dbms_lob.fileexists(l_file) = 1 then
    dbms_lob.open(l_file, dbms_lob.lob_readonly);
    dbms_lob.loadfromfile(l_blob, l_file, dbms_lob.getlength(l_file));
    dbms_lob.close(l_file);
  end if;
  commit;
end;
/
```

- Open before reading, close afterwards, and close in exception handlers too (`FILECLOSE`/`FILECLOSEALL`).
- `SESSION_MAX_OPEN_FILES` caps concurrently open BFILEs per session (default 10).
- `LOADBLOBFROMFILE` and `LOADCLOBFROMFILE` load into BLOBs and CLOBs.

## Migrating LONG and deleting

- `alter table t modify (long_col clob);` converts LONG to CLOB/NCLOB and LONG RAW to BLOB; `TO_LOB` converts during `insert ... select`. Back up and get approval before altering production tables.
- Deleting a row removes internal LOB data with it; for a BFILE only the locator goes, and the OS file must be removed separately.

## Workflow

1. Pick the type: CLOB/NCLOB for text, BLOB for binary, BFILE only for read-only external files you manage yourself.
2. Define the `lob ... store as` clause: tablespace, chunk, pctversion, cache and logging.
3. Insert with empty locators or BFILENAME; create directory objects and grants as needed.
4. Use SQL functions for simple CLOB work, DBMS_LOB for large or piecewise work; lock rows before writes.
5. Verify with `DBMS_LOB.GETLENGTH`, `USER_LOBS` and, for BFILEs, `FILEEXISTS`.

## Red flags

- New LONG or LONG RAW columns.
- Writing through DBMS_LOB without `select ... for update`, or into a NULL (not empty) LOB.
- Trusting BFILE data to be present, unchanged or backed up with the database.
- BFILEs left open on error paths.
- `nologging` LOBs in a database that depends on redo for recovery or standby.
- Deleting BFILE rows and assuming the files are gone.

## Related

- `../Collectors/collectors.md` — the other out-of-line storage model.
- `../../BeyondTheBasics/OracleText/oracleText.md` — text search over CLOBs.
- `../../BeyondTheBasics/ExternalTables/externalTables.md` — directory objects for reading server files.
- `../../BeyondTheBasics/Tablespaces/tablespaces.md` — placing LOB segments.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — releasing resources on every path.
