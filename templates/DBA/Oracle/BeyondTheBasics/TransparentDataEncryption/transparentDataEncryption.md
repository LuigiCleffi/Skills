---
name: dba-transparent-data-encryption
description: Encrypting Oracle data at rest with Transparent Data Encryption (wallet setup, master key, opening and closing the wallet, column encryption with or without salt, encrypted tablespaces), based on Chapter 21 (Advanced Security: Transparent Data Encryption) of Oracle Database 11g: The Complete Reference. Use when sensitive columns must be encrypted for compliance, when configuring ENCRYPTION_WALLET_LOCATION or a wallet on single-instance or RAC, adding ENCRYPT to columns or tablespaces, after a restart when encrypted data fails with ORA-28365 (wallet is not open), or when an encrypted column's index stops being used for range queries.
---

# Advanced Security: Transparent Data Encryption

TDE encrypts chosen columns, or whole tablespaces, in datafiles, undo, redo and memory, without application changes. The wallet and its password are now part of the database: lose them and the encrypted data is gone, so plan their custody before encrypting anything.

## What TDE protects

- Data is stored encrypted on disk; SQL users with privileges read it in clear text as before.
- Anyone copying datafiles needs the wallet file and its password too. The wallet may sit on separate storage.
- If the wallet is closed, access to encrypted data fails with ORA-28365; other columns are unaffected.
- TDE is part of the Advanced Security option; confirm licensing.

## Wallet setup (single instance)

1. As the oracle OS user, point `TNS_ADMIN` at the directory of the `sqlnet.ora` in use.
2. Add the wallet location (use a literal path, not `$ORACLE_BASE`), then create that directory:

```text
ENCRYPTION_WALLET_LOCATION=
  (SOURCE=(METHOD=FILE)
    (METHOD_DATA=(DIRECTORY=/u01/app/oracle/admin/ORCL/wallet)))
```

3. As SYSDBA, create the wallet and master key; the password is supplied by the user, never invented or logged by the agent:

```sql
alter system set encryption key authenticated by "<wallet password>";
```

- Running this again re-keys the column master key (and creates the tablespace master key only if it does not exist). Treat it as a key rotation, not a retry.
- Record the wallet password securely and make it available at the disaster-recovery site. Back up the wallet with every backup, stored apart from the datafiles.

## RAC

Repeat the `TNS_ADMIN`, `sqlnet.ora` and directory steps on each node, copy the wallet file (`ewallet.p12`) from the first node instead of creating a new one, then open the wallet on each instance.

## Opening and closing

```sql
alter system set encryption wallet open authenticated by "<wallet password>";
alter system set encryption wallet close;
```

- Open the wallet at every startup (with the database mounted) and on every RAC instance; close it before shutdown.
- Wallet state is per instance, not per database. After a crash the wallet is closed and must be reopened everywhere.

## Column encryption

```sql
create table customers (
  customer_id number(12) primary key,
  full_name   varchar2(100),
  tax_id      varchar2(20) encrypt no salt,
  card_hint   varchar2(30) encrypt
);
alter table customers modify (full_name encrypt);
alter table customers add (phone varchar2(20) encrypt no salt);
alter table customers modify (card_hint decrypt);
```

- Default is salted (random value added before encryption): stronger, but the column cannot be indexed. Use `no salt` for columns you must index. `alter table ... modify` switches between salt and no salt.
- Encrypting an existing column rewrites every row: it grows each row by roughly 32 to 48 bytes per encrypted column, is slower with indexes present, and can migrate rows. Plan a window and possibly `alter table ... move` afterwards (then rebuild indexes).
- Indexes on encrypted columns help equality lookups only; range and `like 'abc%'` predicates will not use them.
- Check `DBA_ENCRYPTED_COLUMNS` (algorithm, salt).

## Tablespace encryption

Choose it when many columns need encryption, when you cannot identify them all, or when range scans on sensitive data must stay fast; index range scans work normally.

```sql
create tablespace secure_data
  datafile '/u01/oradata/ORCL/secure_data01.dbf' size 200m
  encryption using 'AES256'
  default storage (encrypt);
```

- Uses the same wallet; the tablespace master key is created by `alter system set encryption key`. If you will use an HSM, set the tablespace key before configuring it.
- Default algorithm is AES128. Data stays encrypted in undo, redo and temporary segments.
- An existing tablespace cannot be encrypted in 11g: move objects in (`alter table ... move tablespace secure_data`, rebuild indexes) or copy with CTAS, then retire the clear copies.
- Check `DBA_TABLESPACES.ENCRYPTED`.

Version note: since 12c, keystores are managed with `ADMINISTER KEY MANAGEMENT` instead of `alter system set encryption key/wallet`.

## Workflow

1. Confirm environment, licensing, which data must be encrypted and who holds the wallet password; get explicit approval for every key and wallet command.
2. Back up the database before the first key creation; plan wallet backup and DR copies.
3. Configure `sqlnet.ora`, create the wallet and master key, open it; on RAC copy and open on every node.
4. Choose column (`no salt` only where indexed) or tablespace encryption; schedule rewrites of large tables.
5. Verify: `V$ENCRYPTION_WALLET` status OPEN on all instances, `DBA_ENCRYPTED_COLUMNS`, `DBA_TABLESPACES.ENCRYPTED`, application queries and plans unchanged.
6. Back out: `decrypt` columns or move objects back to a clear tablespace; never delete the wallet while any encrypted data, backup or redo still depends on it.

## Red flags

- Wallet password unknown to anyone but one person, or stored with the datafiles.
- Re-running `set encryption key` as a fix, rotating keys unintentionally.
- Startup scripts that forget to open the wallet, or open it on only one RAC node.
- Salted columns expected to be indexable; range queries on encrypted indexed columns.
- Encrypting a huge column in place during business hours.
- Agent typing or echoing real wallet passwords.
- Assuming TDE hides data from privileged SQL users; it only protects data at rest.

## Related

- `../Tablespaces/tablespaces.md` — creating and planning tablespaces, including encrypted ones.
- `../VirtualPrivateDatabase/virtualPrivateDatabase.md` — limiting which rows users can query.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — privileges that control clear-text access.
- `../../HitchhikersGuides/RealApplicationClusters/realApplicationClusters.md` — per-instance operations on RAC.
- `../../HitchhikersGuides/DatabaseAdministration/databaseAdministration.md` — startup, backup and recovery routines.
