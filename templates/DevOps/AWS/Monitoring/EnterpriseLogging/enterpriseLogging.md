---
name: aws-enterprise-logging
description: How to build enterprise-scale log pipelines on AWS beyond CloudWatch Logs - central log archive accounts, CloudWatch Logs subscription filters, Kinesis Data Streams and Amazon Data Firehose (buffering, Lambda transformation, S3 backup of failed records), Amazon OpenSearch Service (formerly Elasticsearch, with OpenSearch Dashboards / Kibana, fine-grained access control, index lifecycle, OpenSearch Ingestion), Amazon Athena with the AWS Glue Data Catalog for SQL over logs in S3 (partitioning, Parquet, partition projection, cost per data scanned), Amazon QuickSight dashboards (SPICE, namespaces, Redshift and Athena datasets), and tagging and metadata so logs can be attributed, based on Chapter 17 (Advanced and Enterprise Logging Scenarios) of AWS Certified DevOps Engineer - Professional. Use when the user wants to centralize logs from many accounts, stream CloudWatch Logs to OpenSearch or S3, put-subscription-filter, create a Firehose delivery stream or debug records landing in the error prefix, size or secure an OpenSearch domain, a cluster turning red or read-only from full disks, query ALB, VPC Flow Log or CloudTrail files in S3 with Athena or Glue crawlers, cut Athena cost, build a SIEM or log analytics dashboard, choose QuickSight vs CloudWatch dashboards for business users, or tag resources so logs carry environment, team and cost center.
---

# Enterprise Logging on AWS

CloudWatch Logs is the collection point, not the whole system: at scale, route logs through subscription filters into a stream (Kinesis Data Streams or Firehose), land the raw copy in S3 as the system of record, and put search (OpenSearch), SQL (Athena) and dashboards (QuickSight, OpenSearch Dashboards) on top. Pick the cheapest store that answers the question, and keep raw logs immutable. These pipelines create clusters, cross-account roles and data stores holding sensitive data, so confirm the accounts, regions and environment, review the plan, and get approval before creating or deleting anything in production.

## Choose the tool

| Need | Use |
|---|---|
| Recent logs, ad hoc search, alarms, per-team | CloudWatch Logs + Logs Insights |
| Long-term, cheap, immutable copy of everything | S3 in a log archive account, lifecycle to colder classes |
| SQL over months of logs, occasional investigations | Athena + Glue Data Catalog over S3 |
| Full-text search, near-real-time exploration, SIEM-style correlation | Amazon OpenSearch Service |
| Real-time custom consumers, multiple readers, replay | Kinesis Data Streams |
| Managed delivery to S3, OpenSearch, Redshift, HTTP endpoints, with light transforms | Amazon Data Firehose |
| Business-facing dashboards joining logs with Redshift, RDS or files | Amazon QuickSight |
| Operational dashboards for engineers | CloudWatch dashboards |

## Central log architecture

- Use a dedicated log archive account (AWS Organizations, Control Tower) that workload accounts write to but cannot delete from. Put the organization CloudTrail, Config, VPC Flow Logs and ELB logs there (see `../LogSources/logSources.md`).
- Cross-account CloudWatch Logs streaming: create a **destination** in the central account (backed by a Kinesis stream or Firehose) with a destination policy naming the source accounts or organization, then add subscription filters in source accounts.

```bash
aws logs put-subscription-filter --log-group-name /app/prod/orders-api \
  --filter-name to-central --filter-pattern '' \
  --destination-arn arn:aws:logs:us-east-1:999999999999:destination:central-logs
```

- A log group allows a small number of subscription filters (currently two); plan one fan-out stream rather than one filter per consumer.
- Raw logs to S3 first, then derive indexes and tables from S3. If OpenSearch fails or is rebuilt, you replay from S3 instead of losing data.
- Apply S3 Object Lock or at least versioning plus a deny-delete bucket policy on the archive, and lifecycle rules (for example Standard 30 days, then Glacier tiers, then expire per retention policy).

## Kinesis Data Streams and Firehose

- **Data Streams**: shards (or on-demand capacity), ordered per partition key, retention 24 hours by default and extendable up to 365 days, multiple consumers, replay. You write the consumers. Watch `IteratorAgeMilliseconds` and write throttling.
- **Firehose**: no consumers to run; buffers by size or time and delivers to S3, OpenSearch, Redshift, Splunk or HTTP endpoints. Optional Lambda transformation (parse, enrich, drop fields, mask PII) acts like Logstash in an ELK stack. Can convert JSON to Parquet for S3 using a Glue table schema.
- Firehose delivery to OpenSearch retries for a configured duration, then writes failed records to an S3 backup prefix; alarm on `DeliveryToOpenSearch.Success` dropping and on objects appearing in the error prefix. Full or read-only OpenSearch disks are the usual cause.
- CloudWatch Logs subscription payloads are gzip-compressed, base64-encoded batches; a Firehose transform Lambda must decompress, split `logEvents`, and return each record with `recordId`, `result` and `data`.
- Encrypt streams with KMS; give producers only `PutRecord(s)` on the specific stream.

Current note: Kinesis Data Firehose is now Amazon Data Firehose, and Kinesis Data Analytics is now Amazon Managed Service for Apache Flink (its legacy SQL applications are being retired; use Flink).

## Amazon OpenSearch Service

- Use cases: application log search, SIEM and security analytics, infrastructure monitoring across cloud and on-premises, and general full-text search behind an application through its REST API.
- Ingestion options: Firehose, OpenSearch Ingestion pipelines (managed Data Prepper, the Logstash replacement), the CloudWatch Logs subscription that creates a forwarding Lambda, or Fluent Bit from containers.
- Production domain: three dedicated master nodes, data nodes across three Availability Zones, EBS gp3 sized with headroom (keep disk usage well below the flood-stage watermark at which indexes turn read-only), UltraWarm or cold storage for older indexes.
- Manage index lifecycle with Index State Management: daily or size-based rollover, move to warm, delete after the retention period. Without it the cluster fills up and rejects writes.
- Security: deploy inside a VPC, enable fine-grained access control mapped to IAM roles or SAML/IAM Identity Center, encryption at rest and node-to-node, HTTPS only. Store any internal master user password in Secrets Manager; never in templates, tickets or chat.
- Alarm on `ClusterStatus.red`, `ClusterStatus.yellow`, `FreeStorageSpace`, `JVMMemoryPressure`, `ClusterIndexWritesBlocked` and `AutomatedSnapshotFailure`.
- OpenSearch Serverless (collections for time series) removes cluster sizing for spiky or small workloads; compare cost before choosing.

Current note: Amazon Elasticsearch Service was renamed Amazon OpenSearch Service and Kibana became OpenSearch Dashboards. The book's walkthrough uses a public domain with a master password typed into the console; for real work use a VPC domain, IAM-based access and a secret store.

## Athena and the Glue Data Catalog

- Serverless SQL over S3; you pay per data scanned, so layout determines cost. Store logs in Parquet, partition by date (and account, region), and compress.
- Define tables explicitly or with a Glue crawler; prefer explicit DDL with partition projection for log prefixes so no crawler or `MSCK REPAIR` is needed:

```sql
CREATE EXTERNAL TABLE app_logs (
  ts string, level string, service string, message string, request_id string
)
PARTITIONED BY (day string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://example-log-archive/app/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.day.type' = 'date',
  'projection.day.format' = 'yyyy/MM/dd',
  'projection.day.range' = '2024/01/01,NOW',
  'storage.location.template' = 's3://example-log-archive/app/${day}/'
);

SELECT service, count(*) AS errors
FROM app_logs
WHERE day BETWEEN '2026/10/01' AND '2026/10/07' AND level = 'ERROR'
GROUP BY service ORDER BY errors DESC;
```

- AWS publishes ready-made table definitions for ALB access logs, VPC Flow Logs and CloudTrail; start from those.
- Always filter on the partition column; set workgroup per-query data scan limits and a dedicated, encrypted results bucket.
- Access is governed by IAM, S3 bucket policies, and Lake Formation permissions if enabled; analysts need read on the data, not write.
- Federated queries reach other sources (RDS, DynamoDB, CloudWatch Logs) through connectors.

Current note: Athena engine version 3 is based on Trino rather than Presto; old queries mostly work but check for function differences when upgrading workgroups.

## QuickSight

- BI dashboards for people who do not use the AWS console. Datasets from Athena, Redshift, RDS, S3 manifests or uploaded files; the SPICE in-memory engine caches imported data so many users can query quickly (schedule refreshes).
- Namespaces isolate groups of users (teams, customers) and their assets.
- Users can be IAM, IAM Identity Center or SAML federated, or QuickSight-managed users invited by email; prefer federation so access is removed when people leave.
- Row-level security on datasets when one dashboard serves several teams or customers.
- Choose QuickSight over CloudWatch dashboards when the audience is business stakeholders or the data must be joined with warehouse tables; choose CloudWatch for operational, near-real-time metrics.
- QuickSight is billed per user or session; confirm edition and pricing before enabling it in an account, and remove unused subscriptions.

## Tags and metadata

- Tag every resource from the pipeline with a consistent set (`environment`, `service`, `team`, `cost-center`, `data-classification`) and enforce it with tag policies or SCPs.
- Carry the same identifiers into log records (structured fields or log group names) and let Firehose transforms enrich records with account, region and tags, so central searches can filter by owner and environment.
- Activate cost allocation tags so the logging platform's own cost can be charged back.

## Workflow
1. Confirm the organization layout, source and central accounts, regions and environment (`aws sts get-caller-identity` in each); check for an existing log archive before building a new one.
2. Define the questions, retention and compliance requirements, data classification, and expected volume; estimate cost for each store.
3. Build the archive bucket, streams, OpenSearch domain or Athena workgroup in code with encryption, least-privilege policies, VPC placement and lifecycle rules. Review the plan or change set; get approval for production.
4. Connect one non-production log group first; verify records in S3, the index, or an Athena query, including error and backup prefixes.
5. Add alarms for delivery failures, cluster health, stream lag and Athena scan limits.
6. Roll out source accounts incrementally. Rollback is removing subscription filters or disabling delivery; never delete archived logs to undo a change.
7. Document how to query (saved queries, dashboards) and who has access.

## Red flags
- Logs only in CloudWatch Logs with no S3 copy, or the archive deletable by workload accounts.
- OpenSearch domain with public access, no fine-grained access control, or a master password in a template or chat.
- No index lifecycle policy; cluster disk creeping toward full and turning indexes read-only.
- Firehose backup prefix silently filling with failed records nobody alarms on.
- Athena tables over unpartitioned JSON scanning terabytes per query; no workgroup scan limit.
- Glue crawlers run on every log prefix hourly when partition projection would do.
- QuickSight-managed users invited by email for internal staff instead of federation; dashboards without row-level security serving multiple customers.
- Untagged resources, so nobody can tell which team or environment a log came from.
- PII and secrets flowing unmasked into a search cluster many people can read.

## Related
- `../CloudWatchAndXRay/cloudWatchAndXRay.md` — log groups, retention, Logs Insights and subscription basics.
- `../LogSources/logSources.md` — CloudTrail, ELB access logs, VPC Flow Logs feeding this pipeline.
- `../MetricsAndEventBridge/metricsAndEventBridge.md` — metric streams through Firehose, operational dashboards.
- `../../Fundamentals/S3Storage/s3Storage.md` — bucket policies, lifecycle, Object Lock for the archive.
- `../../Resilience/DataProtection/dataProtection.md` — KMS encryption for streams, domains and buckets.
- `../../Resilience/PolicyAndStandards/policyAndStandards.md` — tag policies, SCPs, GuardDuty and Security Hub.
- `../../../Practices/Monitoring/monitoring.md` — platform-neutral logging practice; Azure Log Analytics and Event Hubs are the Azure counterparts with different syntax.
- `../../../../DataSystems/DerivedData/BatchProcessing/batchProcessing.md` (when installed) — batch analysis over immutable logs.
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` (when installed) — log-based streams, consumers and replay.
- `../../../../DBA/PostgreSQL/QueryPerformanceTuning/queryPerformanceTuning.md` (when installed) — query plan reasoning that also applies to partition pruning in Athena.
- `../../../../actions/dev.md` (when installed) — implementation workflow.
