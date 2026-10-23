---
name: dba-remote-data
description: Querying and changing data in other Oracle databases through database links, synonyms and views, based on Chapter 25 (Accessing Remote Data) of Oracle Database 11g: The Complete Reference. Use when the user writes table@link SQL, creates or debugs a database link (CREATE DATABASE LINK, public, private, shared, CONNECT TO CURRENT_USER), hits link errors around tnsnames.ora, GLOBAL_NAMES or OPEN_LINKS, wants location transparency with synonyms, or needs to restrict what remote accounts can see.
---

# Accessing Remote Data

A database link lets one Oracle database log into another so remote tables can be queried and changed as if they were local. Hide the link behind synonyms or views, give the link account the least privilege possible, and be explicit about which side of the link every table in a statement lives on.

## How a link works

- Both hosts need Oracle Net; the remote side needs a listener, the local side a service name (usually in `tnsnames.ora`) that resolves to protocol, host, port and service.
- A link stores how to reach the remote database and, optionally, which account to use.
- When first used, the link opens a real session in the remote database that stays open until the local session ends or you run `alter session close database link link_name`.
- `OPEN_LINKS` limits how many links one session can have open at once.
- With `GLOBAL_NAMES=TRUE`, the link name must match the remote database's global name.

## Creating links

```sql
create [shared] [public] database link link_name
  connect to { current_user | remote_user identified by password }
  [authenticated by auth_user identified by auth_password]
  using 'service_name';
```

- **Private** (default): usable only by its owner; cannot be granted to others. Needs CREATE DATABASE LINK.
- **Public**: usable by every local user. Needs CREATE PUBLIC DATABASE LINK. Use sparingly.
- **Default login** (`connect to current_user`): connects as the same user name in the remote database. No password is stored locally, but accounts and passwords must be kept in step on both sides.
- **Explicit login** (`connect to app_reader identified by ...`): every local user of the link becomes the same remote account. Create a dedicated remote account with CREATE SESSION and only the SELECT grants it needs.
- **Shared** (`shared ... authenticated by`): for Shared Server setups with many concurrent link sessions; reduces remote connections. Use a dedicated authentication account with only CREATE SESSION. Changing its password means re-creating every shared link that uses it. Skip shared links when links are used rarely.

Check existing links in `USER_DB_LINKS`, `ALL_DB_LINKS`, `DBA_DB_LINKS`.

## Remote queries and DML

```sql
select order_id, status
  from orders@hq_link
 where customer_id = :cust_id;

update orders@hq_link
   set status = 'SHIPPED'
 where order_id = :order_id;
```

- A table name without `@link` always means the local database, even inside a subquery of a remote UPDATE. Forgetting the suffix silently mixes local data into the remote table.
- If the remote account does not own the object, use a remote synonym or prefix the owner: `app_owner.orders@hq_link`.
- Avoid tree queries (`CONNECT BY`, `START WITH`, `PRIOR`) over links; most forms fail.

## Location transparency with synonyms and views

Applications should not hard-code owners, hosts or links.

```sql
create synonym orders for orders@hq_link;

create view open_orders_v as
  select * from orders@hq_link where status = 'OPEN';
```

- If the table moves, only the synonym or link changes; application SQL stays the same.
- Pointing a local synonym at a remote synonym is easier to maintain than embedding the remote owner, which breaks if the remote object moves.
- Anyone using a view over a link also needs access to that link.

## Restricting what remote users see

On the database that owns the data, give each remote group its own account and filter with the `USER` pseudo-column:

```sql
create or replace view region_orders_v as
  select * from orders
   where region = USER
  with read only;
```

Each remote site's link connects as its region account (for example `SOUTH`), so it only sees its rows. The alternative is a filtered view on the remote side, which needs fewer accounts but is enforced by the caller rather than the owner. Either way, grant link accounts privileges through roles and expose data through views `with read only` or `with check option`.

## Workflow
1. Confirm the remote service name resolves (`tnsping` or a direct SQL*Plus connection) before creating the link.
2. Decide private versus public, and default versus explicit login, based on who needs it and where passwords may be stored.
3. Create a least-privilege remote account for explicit or shared links.
4. Create the link, then test with `select * from dual@link_name`.
5. Wrap remote objects in synonyms or views; point application code at those.
6. For remote DML, review every table reference for its `@link` suffix before running, and test inside a transaction you can roll back.

## Red flags
- Public links with an explicit login to a powerful remote account: every local user inherits that power.
- Remote UPDATE or DELETE run without confirming the target database and getting approval; treat it like any production write.
- Subqueries in remote DML missing `@link`, pulling local values.
- Passwords for link accounts typed into shared scripts or chat; link creation with explicit credentials should be run by the user or DBA.
- Hard-coded `owner.table@link` throughout application SQL instead of a synonym.
- Many idle sessions holding links open; close them or reduce `OPEN_LINKS` pressure.

## Related
- `../DataPump/dataPump.md` — NETWORK_LINK exports and imports over a database link.
- `../MaterializedViews/materializedViews.md` — local replicas of remote tables instead of querying across the link each time.
- `../VirtualPrivateDatabase/virtualPrivateDatabase.md` — stronger row-level restriction than USER-based views.
- `../../SqlAndSqlPlus/SchemaObjects/schemaObjects.md` — synonyms and views.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — roles and least-privilege grants for link accounts.
- `../../../../CleanCode/Boundaries/boundaries.md` — keep the location of external data behind one boundary.
