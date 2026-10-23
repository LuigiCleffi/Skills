---
name: aws-dynamodb
description: How to design, deploy and operate Amazon DynamoDB tables - NoSQL versus relational trade-offs, tables, items and attributes, partition keys and sort keys, hot partitions, access-pattern-first modeling, on-demand versus provisioned capacity, RCU and WCU arithmetic, adaptive and burst capacity, auto scaling, data types and the 400 KB item limit, put-item, batch-write-item, get-item, query versus scan, projection, key condition and filter expressions, pagination, local and global secondary indexes, DynamoDB Streams with Lambda, global tables, DAX caching, fine-grained IAM with dynamodb:LeadingKeys, web identity federation, CloudWatch throttling metrics, Contributor Insights, TTL, point-in-time recovery, backups, deletion protection and S3 export, based on Chapter 5 (Amazon DynamoDB) of AWS Certified DevOps Engineer - Professional (Adam Book). Use when creating a DynamoDB table in CloudFormation, CDK, Terraform or the CLI, choosing a partition key, ProvisionedThroughputExceededException or ThrottlingException errors, a scan that is slow or expensive, adding a GSI or regretting a missing LSI, wiring a Stream to Lambda, going multi-region with global tables, adding DAX, restricting users to their own items, or setting up backups and alarms for a table.
---

# DynamoDB

Design DynamoDB tables from the access patterns, not from an entity diagram: list every query the application must run, choose a high-cardinality partition key that spreads both reads and writes, add a sort key and indexes so each pattern is a `Query` or `GetItem`, and treat `Scan` as a maintenance tool. Then make the table safe to operate: on-demand or auto-scaled capacity, point-in-time recovery, deletion protection, throttling alarms, and least-privilege access.

Table deletion, capacity mode changes, index changes, restores and global table replica changes affect production data and cost: confirm account, region and environment, show the IaC diff or change set, get explicit approval, and know the restore path (PITR or backup) before you start.

## When DynamoDB fits

- Fits: known key-based access patterns at any scale, single-digit millisecond latency, serverless and event-driven apps, session stores, carts, device state, metadata catalogs.
- Poor fit: ad hoc analytics, many-way joins, queries not known in advance, strong relational integrity across entities. Use Aurora/RDS, or export to S3 and query with Athena.
- DynamoDB stores items redundantly across AZs before acknowledging a write; reads are eventually consistent by default, strongly consistent on request (table and LSI only).

## Core model

- **Table:** collection of items; no fixed schema beyond the key. One table per application is common in single-table design; one table per entity is simpler to start with. Either way, design from queries.
- **Primary key:** partition key alone, or partition key + sort key (composite). Key attributes must be string, number or binary. The partition key is hashed to choose a physical partition.
- **Attributes:** scalars (S, N, B, BOOL, NULL), sets (SS, NS, BS; single type, unordered, no duplicates), documents (L, M; nesting up to 32 levels). Maximum item size 400 KB including attribute names; store large blobs in S3 and keep a pointer.

## Choosing keys

- High cardinality and even traffic: `CustomerId`, `OrderId`, `DeviceId`, `TenantId#UserId`.
- Bad: a date, a status flag, a country, or the first letter of a name. All of today's writes land on one key and form a hot partition.
- Use the sort key for ranges and hierarchy: `PK = CUSTOMER#123`, `SK = ORDER#2026-10-23#9876` lets one `Query` fetch a customer's orders in a date range.
- For time series with heavy write rates, shard the key (`DATE#2026-10-23#7`, suffix 0-N) and fan out reads, or write to one table per period.
- Each physical partition serves up to about 3,000 RCU and 1,000 WCU. Adaptive capacity shifts unused table capacity to hot partitions and isolates very hot items, and burst capacity absorbs short spikes, but neither fixes a bad key.

Current note: the book says capacity must be specified at table creation. On-demand mode (pay per request, no capacity planning) has existed since 2018 and is the usual default for new or spiky workloads; use provisioned with auto scaling for steady, predictable traffic where it is cheaper.

## Capacity arithmetic (provisioned)

- 1 RCU = one strongly consistent read per second of an item up to 4 KB, or two eventually consistent reads. Transactional reads cost double.
- 1 WCU = one write per second of an item up to 1 KB. Transactional writes cost double. Each GSI consumes its own write capacity for every table write that touches it.
- Example: 200 reads/s of 6 KB items, eventually consistent = 200 x 2 / 2 = 200 RCU. 50 writes/s of 2.5 KB items = 50 x 3 = 150 WCU.
- Capacity mode can be switched, with limits on how often; decreases of provisioned capacity are limited per day.

## Creating a table

Prefer IaC. Equivalent CLI for illustration:

```bash
aws dynamodb create-table --table-name orders \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
                          AttributeName=GSI1PK,AttributeType=S AttributeName=GSI1SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes '[{"IndexName":"GSI1",
      "KeySchema":[{"AttributeName":"GSI1PK","KeyType":"HASH"},{"AttributeName":"GSI1SK","KeyType":"RANGE"}],
      "Projection":{"ProjectionType":"KEYS_ONLY"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --deletion-protection-enabled \
  --sse-specification Enabled=true,SSEType=KMS \
  --tags Key=Owner,Value=orders-team
aws dynamodb update-continuous-backups --table-name orders \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

Only key attributes (table and index keys) go in `attribute-definitions`; everything else is schemaless.

## Reading and writing

```bash
aws dynamodb put-item --table-name orders --item file://item.json \
  --condition-expression "attribute_not_exists(PK)"            # no silent overwrite
aws dynamodb query --table-name orders \
  --key-condition-expression "PK = :pk AND begins_with(SK, :p)" \
  --expression-attribute-values '{":pk":{"S":"CUSTOMER#123"},":p":{"S":"ORDER#2026-10"}}' \
  --projection-expression "SK, #st, total" --expression-attribute-names '{"#st":"status"}' \
  --return-consumed-capacity TOTAL
```

- **GetItem / BatchGetItem** by full key are cheapest. **Query** reads one partition key, optionally a sort key range. **Scan** reads the whole table or index and then filters: you pay for every item read, not just those returned (compare `Count` with `ScannedCount`).
- Filter expressions reduce data returned, not capacity consumed. If you need the filter often, it belongs in a key or index.
- Results are paged at 1 MB; loop on `LastEvaluatedKey`. Batch calls can return `UnprocessedItems`/`UnprocessedKeys`: retry those with exponential backoff (the SDKs do this for throttling).
- Use condition expressions for optimistic locking (`version = :expected`) and `TransactWriteItems` for multi-item atomic changes (up to 100 items).
- Use expression attribute names for reserved words (`status`, `name`, `date`).
- For maintenance scans, use parallel scan with a rate limit and run off-peak; never let a scan starve production traffic.

## Secondary indexes

| | LSI | GSI |
|---|---|---|
| Partition key | Same as table | Any attribute |
| Sort key | Different | Any attribute |
| When created | Only at table creation; cannot be removed without dropping the table | Any time (backfills online) |
| Capacity | Shares the table's | Its own (provisioned) or per request |
| Consistency | Strong or eventual | Eventual only |
| Limits | 5 per table; 10 GB per partition key value across table plus LSIs | 20 per table by default |

- Project only what the query needs (`KEYS_ONLY`, `INCLUDE`, `ALL`); projections cost storage and write capacity.
- Name the index in the query (`--index-name GSI1`); otherwise the query hits the base table.
- Sparse indexes (only items with the GSI key attribute) are an efficient way to index a subset, such as open orders.
- An under-provisioned GSI throttles writes to the base table.

## Streams and event processing

- DynamoDB Streams record item-level changes for 24 hours, in order per item, each record appearing once. View types: `KEYS_ONLY`, `NEW_IMAGE`, `OLD_IMAGE`, `NEW_AND_OLD_IMAGES`.
- Typical consumers: Lambda event source mapping for denormalization, search indexing, audit, notifications. Configure batch size, `bisect-batch-on-function-error`, a maximum retry count and an on-failure destination (SQS or SNS) so a poison record does not block the shard for 24 hours.
- Handlers must be idempotent; retries replay batches.
- Kinesis Data Streams for DynamoDB is an alternative with longer retention and more consumers.

## Global tables

- Multi-region, multi-active replicas of one table for regional resilience and local latency. Concurrent writes to the same item in different regions resolve by last writer wins, so route writes for a given item to one region where possible.
- Replicated writes consume capacity in every region; monitor `ReplicationLatency`.

Current note: the book describes building global tables by enabling streams and creating matching empty tables in each region. With the current version (2019.11.21) you add a replica to an existing table:

```bash
aws dynamodb update-table --table-name orders --replica-updates '[{"Create":{"RegionName":"eu-west-1"}}]'
```

## DAX

- In-VPC, write-through cache API-compatible with DynamoDB, for microsecond reads on read-heavy, repeated keys. Applications switch to the DAX client.
- Serves eventually consistent reads; strongly consistent reads pass through to the table. Not useful for write-heavy or rarely repeated reads.
- Run at least three nodes across AZs for production; size by working set. ElastiCache is the alternative when you need general caching logic.

## Access control

- IAM at table, index, item and attribute level. Grant specific actions on specific table and index ARNs (`arn:aws:dynamodb:us-east-2:111122223333:table/orders/index/*`).
- Restrict users to their own items with `dynamodb:LeadingKeys`, typically with Cognito identity pools or web identity federation so mobile and web users get temporary credentials, not IAM users:

```json
{"Effect": "Allow",
 "Action": ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"],
 "Resource": "arn:aws:dynamodb:us-east-2:111122223333:table/user-data",
 "Condition": {"ForAllValues:StringEquals":
   {"dynamodb:LeadingKeys": ["${cognito-identity.amazonaws.com:sub}"]}}}
```

- Use `dynamodb:Attributes` with `dynamodb:Select` to hide sensitive attributes. Use a gateway VPC endpoint for private access. Encryption at rest is always on; choose a customer managed KMS key when you need key policy control.

## Monitoring and protection

- CloudWatch: `ThrottledRequests`, `ReadThrottleEvents`, `WriteThrottleEvents`, `ConsumedReadCapacityUnits`/`ConsumedWriteCapacityUnits` versus provisioned, `SuccessfulRequestLatency`, `SystemErrors`, `UserErrors`, and per-GSI throttles. Alarm on sustained throttling and on consumption near provisioned capacity.
- **Contributor Insights** shows the most accessed and most throttled keys (partition, and partition plus sort key) to find hot keys.
- **PITR** restores to any second in the retention window (up to 35 days) into a new table; on-demand backups and AWS Backup for longer retention; export to S3 for analytics.
- **TTL** deletes expired items for free (typically within a few days, not instantly; filter expired items in reads); expired deletes appear in Streams.
- **Deletion protection** on every production table.

## Workflow

1. List access patterns (who reads what, by which key, how often, how fresh) and expected item sizes and rates.
2. Choose partition and sort keys and indexes so every pattern is a `GetItem` or `Query`; check for hot keys.
3. Pick capacity mode: on-demand by default, provisioned with auto scaling for steady load after measuring.
4. Define the table in IaC with encryption, PITR, deletion protection, tags and alarms; confirm account, region and environment; review the plan and get approval for production.
5. Grant least-privilege IAM per table and index; use federation and `LeadingKeys` for end users; keep connection details and any credentials out of code.
6. Add Streams, global tables or DAX only for a stated need; make consumers idempotent with failure destinations.
7. Load test, watch throttling and Contributor Insights, and rehearse a PITR restore into a new table before go-live.

## Red flags

- Partition key on a date, status, boolean or other low-cardinality value.
- Application paths that use `Scan` with filters for user requests.
- LSI needs discovered after launch (requires a new table and migration).
- Provisioned capacity with no auto scaling and no throttling alarms; GSIs provisioned lower than the table's write rate.
- `put-item` without condition expressions where overwrites would lose data.
- Batch writes that ignore `UnprocessedItems`.
- Stream consumers without retry limits or failure destinations; non-idempotent handlers.
- Global tables with the same item written in several regions and LWW silently dropping updates.
- Mobile clients with IAM user keys or table-wide access instead of per-user conditions.
- Production tables without PITR or deletion protection; blobs stored in items near the 400 KB limit.

## Related

- `../FundamentalServices/fundamentalServices.md` - other AWS database options and when to choose them.
- `../IamAndSecrets/iamAndSecrets.md` - IAM policies, Cognito identity pools, federation.
- `../S3Storage/s3Storage.md` - storing large objects and DynamoDB export to S3.
- `../../Delivery/LambdaDeployments/lambdaDeployments.md` - Lambda functions consuming Streams.
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` - alarms and tracing for DynamoDB calls.
- `../../Resilience/DataProtection/dataProtection.md` - KMS encryption choices.
- `../../../Azure/DocumentDb/documentDb.md` - Azure counterpart (Cosmos DB); APIs and syntax differ.
- `../../../Azure/TableStorage/tableStorage.md` - Azure key-value counterpart; not interchangeable.
- `../../../../DataSystems/DistributedData/Partitioning/partitioning.md` - hash partitioning, hot spots and secondary index partitioning (when installed).
- `../../../../DataSystems/DistributedData/Replication/replication.md` - multi-leader replication and last-write-wins behind global tables (when installed).
- `../../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` - document versus relational modeling (when installed).
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` - change data capture with Streams (when installed).
