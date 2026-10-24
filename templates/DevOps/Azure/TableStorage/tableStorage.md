---
name: azure-table-storage
description: "How to design, provision and operate Azure Table storage (storage accounts as the container for tables, queues and blobs, tables of schemaless entities, PartitionKey and RowKey as the only clustered index, the server-managed Timestamp, entity size and property limits, point queries vs partition scans vs table scans, insert, upsert, merge, replace and delete operations, ETag optimistic concurrency, entity group transactions within one partition, continuation tokens, hot partitions and sortable key design, redundancy options LRS/ZRS/GRS/GZRS, Entra ID RBAC, SAS and account keys, Azurite, the Azure.Data.Tables SDK and the Cosmos DB for Table alternative), based on Chapter 7 (Getting to know Azure Tables) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user wants cheap key/value or log storage on Azure, runs az storage account create or az storage table create, chooses a PartitionKey or RowKey, sees slow table queries or full scans, gets 409 EntityAlreadyExists, 412 Precondition Failed or UpdateConditionNotSatisfied, 503 ServerBusy or throttling on one partition, migrates from WindowsAzure.Storage or Microsoft.Azure.Cosmos.Table to Azure.Data.Tables, wants to remove AccountKey from a connection string, or compares Table storage with Cosmos DB, SQL Database or DynamoDB."
---

# Azure Table Storage

Table storage is a cheap, schemaless key/value store whose only index is (`PartitionKey`, `RowKey`): design both keys from the queries you must serve, because anything that filters on other properties scans the table. It has no joins, no secondary indexes and no cross-partition transactions; if you need those, pick Cosmos DB or Azure SQL instead. Provisioning, keys, redundancy and RBAC changes affect live data, so confirm the subscription, resource group and environment and get approval before changing them.

## When to use it

| Need | Choice |
|---|---|
| Large volumes of simple entities, lookups by known key, lowest cost | Table storage |
| Same table model plus global distribution, secondary indexes on every property, latency SLAs | Azure Cosmos DB for Table (same SDK, different endpoint and pricing) |
| Rich queries, joins, constraints, transactions across rows | Azure SQL Database (`../SqlDatabase/sqlDatabase.md`) |
| Nested JSON documents queried by many fields | Cosmos DB for NoSQL (`../DocumentDb/documentDb.md`) |
| Request or diagnostic logs you only search ad hoc | Usually Application Insights / Log Analytics rather than a hand-rolled table |

## Data model and limits

- Storage account -> table -> entity -> properties. Tables are schemaless: entities in one table can have different properties.
- Every entity has `PartitionKey`, `RowKey` (strings, each up to 1 KiB) and `Timestamp` (set by the service on every write; do not use it as a business date).
- An entity is at most 1 MiB with up to 252 custom properties. Store large payloads in Blob storage and keep the blob name in the entity.
- Some characters are not allowed in keys (`/`, `\`, `#`, `?` and control characters); encode or replace them when keys come from URLs or user input.
- One partition is served by one server: roughly 2,000 entities per second per partition and about 20,000 requests per second per account are the scalability targets. Beyond that you get `503 ServerBusy`; spread load over more partitions.
- Queries return at most 1,000 entities per page; always follow continuation tokens (the SDKs' pageable results do this for you).

## Designing the keys

- Write down the queries first. Point query (both keys) is fastest; range within one partition is next; anything else is a scan.
- Keys sort lexically as strings. Use sortable formats: ISO 8601 (`yyyyMMddHHmmss`, 24-hour clock), zero-padded numbers, or inverted ticks (`DateTime.MaxValue.Ticks - t.Ticks`, zero-padded) for newest-first.
- Avoid a key that is only "now": every write lands on the latest partition (append-only hot spot). Prefix a bucket, tenant or hash (`tenant42`, `2026102314-03`) so writes spread.
- Pick partitions that keep data needed together in one partition: batch transactions and range queries work only inside one partition.
- For a second access path, write a second entity (or table) with the alternate key, accepting duplication; keep both in one batch when they share a partition, or make the writes idempotent when they do not.
- Example for access logs: `PartitionKey = "{yyyyMMddHH}-{hash % 8}"`, `RowKey = "{invertedTicks}-{requestId}"`. Queries by hour read eight partitions in parallel.

## Provisioning (Azure Resource Manager)

```bash
az account show --query "{sub:name, id:id}"            # confirm the subscription first
az storage account create -g rg-app-dev -n stappdev001 -l brazilsouth \
  --sku Standard_ZRS --kind StorageV2 --min-tls-version TLS1_2 \
  --https-only true --allow-blob-public-access false --allow-shared-key-access false
az storage table create --name accesslog --account-name stappdev001 --auth-mode login
az role assignment create --assignee <app-managed-identity-object-id> \
  --role "Storage Table Data Contributor" \
  --scope $(az storage account show -g rg-app-dev -n stappdev001 --query id -o tsv)
```

- Create tables at deploy time (Bicep, Terraform, the CLI above) or once at startup, not on every request.
- Redundancy: LRS (3 copies, one datacenter), ZRS (across zones), GRS/RA-GRS (plus asynchronous copy to the paired region), GZRS/RA-GZRS (both). Choose from your recovery objectives; geo-failover is asynchronous and can lose recent writes.
- Current note: the book's storage account limits and "always geo-replicated" claim are outdated; replication depends on the SKU you choose, and per-subscription account limits are much higher today. Classic portal steps are gone; use ARM, Bicep or the CLI.

## Access and secrets

- Prefer Microsoft Entra ID: a managed identity with `Storage Table Data Reader` or `Data Contributor`, scoped to the account or table. Then disable shared key access.
- If you must use keys or SAS, keep them in Key Vault or App Service/Container Apps settings that reference Key Vault, never in source, config files in git, logs or chat. Give SAS tokens a short expiry, HTTPS only and minimal permissions.
- A leaked account key grants full access to every service in the account: rotate it (`az storage account keys renew`) after moving clients to the other key.
- Never log connection strings; mask them in pipeline output.

## Code (Azure.Data.Tables)

```csharp
var client = new TableClient(
    new Uri("https://stappdev001.table.core.windows.net"), "accesslog",
    new DefaultAzureCredential());

var entity = new TableEntity(partitionKey, rowKey) { ["UserName"] = user, ["Path"] = path };
await client.AddEntityAsync(entity);                         // 409 if the keys exist

var current = (await client.GetEntityAsync<TableEntity>(pk, rk)).Value;
current["Status"] = "processed";
await client.UpdateEntityAsync(current, current.ETag, TableUpdateMode.Merge); // 412 if changed

await foreach (var e in client.QueryAsync<TableEntity>(
    x => x.PartitionKey == pk && x.RowKey.CompareTo(fromKey) >= 0)) { /* paged */ }
```

- `Add` fails on duplicates; `Upsert` (merge or replace) is idempotent; `Update` with an ETag gives optimistic concurrency, with `ETag.All` it overwrites blindly.
- Merge keeps properties you did not send; Replace removes them.
- `SubmitTransactionAsync` runs up to 100 operations atomically, all in the same partition.
- Write telemetry asynchronously or through a queue; a synchronous table insert inside every web request adds latency and couples availability.
- Current note: `WindowsAzure.Storage` and `Microsoft.Azure.Cosmos.Table` are deprecated; use `Azure.Data.Tables`, which also targets Cosmos DB for Table. Use Azurite locally instead of the old storage emulator.

## Workflow

1. List the queries and write volumes; confirm Table storage fits (no joins, no secondary indexes).
2. Design `PartitionKey` and `RowKey` for those queries, checking for hot partitions and lexical sort order.
3. Confirm subscription, region, environment and redundancy SKU; show the Bicep/Terraform plan or `what-if` before creating or changing the account.
4. Grant a managed identity the narrowest data role; disable shared key where possible; store any remaining secret in Key Vault.
5. Create tables in deployment, not per request.
6. Implement with `Azure.Data.Tables`, ETag concurrency for updates and pagination for queries; test against Azurite.
7. Monitor transactions, latency and `ServerBusy` in Azure Monitor; set an alert before going live.
8. For deletion of tables or accounts, get explicit approval and confirm backups or exports first: Table storage has no point-in-time restore.

## Red flags

- Account keys hard-coded in code or committed config (the book prints one in its example).
- `CreateIfNotExists` on every request.
- Filters on non-key properties over large tables; queries that ignore continuation tokens.
- Partition keys that are a bare timestamp or a non-sortable date string like `ddMMyyyyhhmmss` (12-hour clock, day first).
- Using `Timestamp` as the event time.
- Unconditional replace where concurrent writers exist.
- `http` in the connection string, public network access with shared keys enabled, no TLS minimum.
- Assuming geo-redundancy without having chosen a GRS/GZRS SKU.

## Related

- `../DocumentDb/documentDb.md` — Cosmos DB, including the Table API alternative.
- `../SqlDatabase/sqlDatabase.md` — relational alternative.
- `../RedisCache/redisCache.md` — in-memory key/value for caching, not durable storage.
- `../AppService/appService.md` — managed identity and Key Vault references for the app that writes the table.
- `../SetupAndSubscription/setupAndSubscription.md` — subscriptions, resource groups and CLI login.
- `../../AWS/Fundamentals/DynamoDb/dynamoDb.md` — AWS counterpart (partition and sort keys); syntax and limits are not interchangeable.
- `../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — provisioning storage from code.
- `../../../DataSystems/DistributedData/Partitioning/partitioning.md` — key-range vs hash partitioning and hot spots (when installed).
- `../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — choosing a data model (when installed).
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping the SDK behind your own interface (when installed).
