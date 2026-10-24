---
name: azure-cosmos-db
description: "How to design, provision and operate document persistence on Azure Cosmos DB for NoSQL, formerly Azure DocumentDB (account, database, container and item hierarchy, aggregates as JSON documents, choosing a partition key, request units with provisioned, autoscale or serverless throughput, consistency levels from strong to eventual, SQL queries and parameterized QueryDefinition, indexing policy, JavaScript stored procedures, pre and post triggers and UDFs scoped to one logical partition, transactional batch, change feed, Direct vs Gateway connection mode, singleton CosmosClient, 429 throttling and retries, Entra ID data-plane RBAC, keys in Key Vault, backup modes and multi-region replication), based on Chapter 9 (Persisting documents with Microsoft Azure DocumentDB) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user stores JSON documents on Azure, runs az cosmosdb create or az cosmosdb sql container create, picks a partition key, sees 429 TooManyRequests, high RU charges, cross-partition query fan-out, 413 RequestEntityTooLarge, 409 Conflict, 412 precondition failures, a trigger that never fires, migrates from Microsoft.Azure.DocumentDB to Microsoft.Azure.Cosmos, or compares Cosmos DB with Table storage, SQL Database, MongoDB or DynamoDB."
---

# Azure Cosmos DB (formerly DocumentDB)

Model each document as an aggregate that is read and written together, choose a partition key that spreads both storage and traffic and appears in most queries, then size throughput in request units (RU/s) from measured query costs. Every query, sproc and transaction is cheapest and only atomic inside one logical partition, so the partition key decision comes before any code. Provisioning, throughput, consistency, keys, networking and deletions affect production data and cost: confirm subscription, account and environment, and get approval first.

Current note: DocumentDB became Azure Cosmos DB in 2017. Collections are now containers, a partition key is mandatory, and the `Microsoft.Azure.DocumentDB` SDK is retired; use `Microsoft.Azure.Cosmos` (v3+) or the current SDK for your language. The DocumentDB SQL dialect lives on as the API for NoSQL. Other products reuse the "DocumentDB" name (for example Amazon DocumentDB and Microsoft's open-source MongoDB-compatible DocumentDB engine); they are different services.

## Choose the API and the store

| Need | Choice |
|---|---|
| JSON documents, SQL-like queries, global distribution | Cosmos DB for NoSQL (this skill) |
| Existing MongoDB application | Cosmos DB for MongoDB; check feature compatibility |
| Simple key/value at lowest cost | Table storage (`../TableStorage/tableStorage.md`) |
| Joins, constraints, ad hoc reporting | Azure SQL Database (`../SqlDatabase/sqlDatabase.md`) |
| Cache only | Azure Cache for Redis (`../RedisCache/redisCache.md`) |

## Data modeling

- Embed what is read together and bounded in size (an order with its lines, an event with a short attendee list). Reference what grows without bound or is shared and updated independently (millions of attendees: separate items with `eventId`).
- Item limit is 2 MB; a logical partition (all items with one key value) is limited to 20 GB. Unbounded embedded arrays break both.
- Store a `type` field when several entity types share a container, and keep `id` unique within the partition.
- Denormalize for reads and keep copies in sync with the change feed rather than by joining at query time; there are no cross-document joins (the SQL `JOIN` works only inside one document).

## Partition key

- High cardinality, evenly distributed writes, and present in the `WHERE` of most queries: `/tenantId`, `/customerId`, `/eventId`. Avoid `/type`, `/country`, a date or a boolean.
- A query without the partition key fans out to every physical partition and costs more RUs as data grows.
- The key cannot be changed on an existing container; changing it means creating a new container and migrating (change feed or a copy job). Decide before loading data.
- Hierarchical (multi-level) partition keys help when one tenant can exceed 20 GB.

## Provisioning

```bash
az account show --query "{sub:name, id:id}"
az cosmosdb create -g rg-events-dev -n cosmos-events-dev \
  --default-consistency-level Session \
  --locations regionName=brazilsouth failoverPriority=0 isZoneRedundant=true
az cosmosdb sql database create -g rg-events-dev -a cosmos-events-dev -n events
az cosmosdb sql container create -g rg-events-dev -a cosmos-events-dev -d events \
  -n registrations --partition-key-path /eventId --max-throughput 4000
```

- Throughput: manual RU/s for steady load, autoscale (`--max-throughput`, scales between 10% and 100%) for variable load, serverless for low or spiky dev/test traffic. Database-level shared throughput suits many small containers.
- Consistency: Session (default) gives read-your-writes per client and is right for most apps. Strong and Bounded Staleness cost more RUs and latency; Eventual and Consistent Prefix are cheaper but can serve stale data.
- Backups: periodic is the default; continuous backup enables point-in-time restore. Choose before you need a restore.
- Add regions for read latency and availability; multi-region writes need a conflict resolution policy.
- Set `disableLocalAuth: true` and `publicNetworkAccess: 'Disabled'` (with a private endpoint) in Bicep/ARM once clients use Entra ID and reach the account from inside the network; confirm first on an existing account or its clients will fail.

## Access and secrets

- Prefer Entra ID data-plane RBAC (`Cosmos DB Built-in Data Contributor` or `Data Reader`) for a managed identity, then disable key auth.
- Control-plane roles (creating containers, changing throughput) are separate; give applications data-plane roles only.
- If keys are unavoidable, store them in Key Vault, use read-only keys for read-only clients, and rotate primary and secondary in turn. Never put a key in code, appsettings in git, logs or chat (the book's example uses an empty placeholder; keep it that way in source).

## Code (Microsoft.Azure.Cosmos)

```csharp
// One CosmosClient per process, reused for its lifetime.
var client = new CosmosClient("https://cosmos-events-dev.documents.azure.com:443/",
    new DefaultAzureCredential(),
    new CosmosClientOptions { ApplicationName = "events-api" });   // Direct mode by default
var container = client.GetContainer("events", "registrations");

await container.CreateItemAsync(reg, new PartitionKey(reg.EventId));

var query = new QueryDefinition(
        "SELECT c.id, c.name FROM c WHERE c.eventId = @eventId AND c.email = @email")
    .WithParameter("@eventId", eventId).WithParameter("@email", email);
using var it = container.GetItemQueryIterator<Registration>(query,
    requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(eventId) });
while (it.HasMoreResults) { var page = await it.ReadNextAsync(); log(page.RequestCharge); }
```

- Always pass parameters with `QueryDefinition`; never concatenate input into SQL (the book's sproc does, which allows injection).
- Read by `id` plus partition key (`ReadItemAsync`) is the cheapest operation; use it instead of a query when you know both.
- Use `IfMatchEtag` in `ItemRequestOptions` for optimistic concurrency on updates; handle `412`.
- Use `TransactionalBatch` for atomic multi-item writes in one partition; it replaces most stored procedure use.
- Direct mode (TCP) is the default and fastest; use Gateway mode when firewalls allow only HTTPS 443.
- `429` means you exceeded RU/s: the SDK retries using the `x-ms-retry-after-ms` hint; persistent 429s mean raise throughput, fix a hot partition or make queries cheaper. Log `RequestCharge` to find expensive queries.
- Tune the indexing policy: exclude large paths you never filter on to cut write RUs; add composite indexes for multi-field `ORDER BY`.

## Server-side JavaScript

- Stored procedures, triggers and UDFs are JavaScript, run transactionally inside one logical partition, and are bounded in execution time; design them to return a continuation for large work.
- Triggers do not fire automatically: the caller must name them per request (`PreTriggers`/`PostTriggers` in `ItemRequestOptions`). Logic that must always run belongs in application code or the change feed.
- UDFs in queries prevent index use for that predicate and cost RUs; prefer built-in functions.
- Keep scripts in source control and deploy them from the pipeline, versioning their ids.

## Workflow

1. List access patterns and sizes; model aggregates; confirm Cosmos DB for NoSQL is the right store.
2. Choose the partition key and test it against the top queries and the 20 GB per logical partition limit.
3. Confirm subscription, region, environment, consistency, backup mode and throughput model; show the Bicep/Terraform plan or `what-if`; get approval for production and for cost.
4. Configure Entra ID RBAC and private networking; keep any key in Key Vault.
5. Implement with a singleton client, parameterized queries, ETags and transactional batch; measure `RequestCharge` with realistic data, using the emulator for local tests.
6. Load data with Azure Data Factory, the Cosmos DB desktop data migration tool, or the Spark connector, not ad hoc scripts on production keys.
7. Set Azure Monitor alerts on normalized RU consumption, 429 rate, storage per partition and availability.
8. Deleting databases, containers or accounts, or lowering consistency, requires explicit approval and a verified restore path.

## Red flags

- No partition key strategy, or keys like `/type` or a date; cross-partition queries on hot paths.
- Unbounded arrays inside a document.
- A new `CosmosClient` per request.
- String-concatenated SQL in code or stored procedures.
- Relying on triggers to enforce invariants.
- Primary keys in source, logs or chat; local auth left enabled with Entra ID available.
- Ignoring 429s, or "fixing" them only by raising RU/s without looking at query cost.
- Strong consistency chosen by default without a need.
- Retired `Microsoft.Azure.DocumentDB` SDK still in use.

## Related

- `../TableStorage/tableStorage.md` — simpler key/value store; Cosmos DB for Table uses the same SDK.
- `../SqlDatabase/sqlDatabase.md` — relational alternative and polyglot persistence.
- `../AzureSearch/azureSearch.md` — indexing Cosmos DB for full-text search with an indexer.
- `../AppService/appService.md` — managed identity for the app that calls Cosmos DB.
- `../../AWS/Fundamentals/DynamoDb/dynamoDb.md` — AWS counterpart (partition keys, capacity units); not interchangeable.
- `../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — provisioning accounts and containers from code.
- `../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — document vs relational modeling (when installed).
- `../../../DataSystems/DistributedData/Partitioning/partitioning.md` — partition key choice and hot spots (when installed).
- `../../../DataSystems/DistributedData/ConsistencyAndConsensus/consistencyAndConsensus.md` — what consistency levels promise (when installed).
- `../../../DataSystems/DistributedData/Replication/replication.md` — multi-region replication and conflicts (when installed).
