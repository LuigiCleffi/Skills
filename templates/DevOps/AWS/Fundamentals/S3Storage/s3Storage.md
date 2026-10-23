---
name: aws-s3-storage
description: How to create, secure, organize and automate Amazon S3 buckets - object versus file versus block storage, bucket naming standards, aws s3, s3api and s3control commands, cp and sync, S3 Inventory with Athena, storage classes (Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, Glacier Instant Retrieval, Glacier Flexible Retrieval, Glacier Deep Archive), lifecycle rules and expiration, gateway VPC endpoints, Block Public Access, Object Ownership and ACLs, bucket policies versus IAM policies, cross-account access, server access logs and CloudTrail data events, SSE-S3, SSE-KMS, bucket keys and client-side encryption, event notifications to Lambda, SQS, SNS and EventBridge, S3 Batch Operations with manifests, Cross-Region and Same-Region Replication, versioning, MFA delete and Object Lock, based on Chapter 4 (Amazon S3 Blob Storage) of AWS Certified DevOps Engineer - Professional (Adam Book). Use when creating or naming a bucket, a 403 AccessDenied on GetObject or PutObject, a bucket is accidentally public, choosing a storage class or writing a lifecycle policy, an S3 bill is growing, private subnets need S3 without NAT, enabling encryption or KMS for compliance, triggering a pipeline or Lambda on upload, re-tagging or copying millions of objects, setting up replication for DR, restoring a deleted or overwritten object, or querying an inventory report.
---

# S3 Storage

Every bucket is private, encrypted, versioned where data matters, owned by a named team, and governed by IAM and bucket policies (not ACLs). Pick the storage class from the access pattern and let lifecycle rules move and expire data automatically; route private traffic through VPC endpoints; and treat bucket policy, replication, lifecycle expiration and deletion changes as production changes that need a reviewed plan, approval and a way back.

## Concepts

- S3 is object storage: each object is a key, data and metadata in a flat namespace. "Folders" are just key prefixes. Not a file system (use EFS or FSx) and not a block device (use EBS).
- Durability is designed for 11 nines, objects stored across multiple AZs (except One Zone classes).
- Strong read-after-write consistency for PUTs, overwrites, deletes and LIST.
- Data ingestion helpers: `aws s3 cp/sync`, Transfer Family (SFTP/FTPS), DataSync, Amazon Data Firehose, Snowball devices for offline bulk moves.

Current note: the default bucket quota is now 10,000 per account (raised from 100 in late 2024) and can be increased further.

## Naming and ownership

- Rules: globally unique, 3-63 characters, lowercase letters, digits, hyphens and dots, starts and ends with a letter or digit, not shaped like an IP address. Avoid dots (they break virtual-hosted TLS) unless required.
- Adopt a convention so owner and purpose are obvious, for example `<org>-<env>-<team>-<purpose>-<region>` (`acme-prod-payments-invoices-use2`), plus mandatory tags (`Owner`, `CostCenter`, `DataClassification`, `Environment`).
- A deleted bucket name can be claimed by anyone; do not delete a bucket that DNS, CloudFront or other accounts still reference.

## CLI

```bash
aws s3 mb s3://acme-dev-platform-artifacts-use2 --region us-east-2
aws s3 sync ./logs s3://acme-dev-platform-logs-use2/host-a/ --exclude "*.tmp"
aws s3 sync ./site s3://bucket/ --delete --dryrun     # always dry-run --delete first
aws s3 presign s3://bucket/report.pdf --expires-in 900
aws s3api get-bucket-policy --bucket bucket            # low-level API calls
aws s3control ...                                      # account-level: Batch Operations, access points, public access block
```

`aws s3 rm --recursive` and `sync --delete` destroy data: show the dry run, confirm the bucket and account, and get approval.

## Storage classes

| Class | Access pattern | Minimum duration / notes |
|---|---|---|
| Standard | Frequent, latency-sensitive | None; default |
| Intelligent-Tiering | Unknown or changing | Moves objects between tiers automatically for a small monitoring fee; objects under 128 KB are not monitored or tiered |
| Standard-IA | Infrequent, needs milliseconds | 30 days, 128 KB minimum billable size, retrieval fee |
| One Zone-IA | Infrequent, re-creatable data | 30 days; lost if that AZ is lost |
| Glacier Instant Retrieval | Rare (quarterly), needs milliseconds | 90 days |
| Glacier Flexible Retrieval | Archive, minutes to hours | 90 days; expedited, standard, bulk restores |
| Glacier Deep Archive | Compliance archive, hours | 180 days; cheapest |

Current note: the book's "S3 Glacier" is now Glacier Flexible Retrieval, Glacier Instant Retrieval was added in 2021, and Intelligent-Tiering no longer has a 30-day minimum and offers optional archive tiers.

Many tiny objects cost more in request fees and minimums than they save in IA or Glacier; aggregate them first.

## Lifecycle rules

Transition and expire by prefix or tag; clean up old versions and failed uploads too.

```json
{
  "Rules": [{
    "ID": "logs-tiering",
    "Filter": {"Prefix": "logs/"},
    "Status": "Enabled",
    "Transitions": [
      {"Days": 30, "StorageClass": "STANDARD_IA"},
      {"Days": 90, "StorageClass": "GLACIER"}
    ],
    "Expiration": {"Days": 400},
    "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
    "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
  }]
}
```

```bash
aws s3api put-bucket-lifecycle-configuration --bucket bucket --lifecycle-configuration file://lifecycle.json
```

`put-bucket-lifecycle-configuration` replaces all existing rules; fetch the current configuration first and merge. An expiration rule is a scheduled mass delete: confirm retention requirements with the data owner.

## Access control

- **Block Public Access** on at account and bucket level. Public content goes through CloudFront with origin access control, not a public bucket.
- **Object Ownership = Bucket owner enforced** disables ACLs; manage access only with policies.
- **IAM policies** say what a principal may do; **bucket policies** say who may touch this bucket, and are required for cross-account access (along with an IAM allow on the other side). Use one primary model per bucket and keep it consistent; mixing many layers makes `AccessDenied` hard to trace.
- Useful bucket policy conditions: `aws:SecureTransport` (deny non-TLS), `aws:SourceVpce` (only through an endpoint), `aws:PrincipalOrgID` (only your organization), `s3:x-amz-server-side-encryption-aws-kms-key-id`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Sid": "DenyInsecureTransport", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
     "Resource": ["arn:aws:s3:::acme-prod-reports", "arn:aws:s3:::acme-prod-reports/*"],
     "Condition": {"Bool": {"aws:SecureTransport": "false"}}},
    {"Sid": "OrgReadOnly", "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
     "Resource": "arn:aws:s3:::acme-prod-reports/*",
     "Condition": {"StringEquals": {"aws:PrincipalOrgID": "o-abc123"}}}
  ]
}
```

- A broad `Deny` can lock out administrators and pipelines; test with a non-admin role and keep a break-glass path before applying.
- Debug 403s: object owner and ACL state, bucket policy, IAM policy, SCPs, endpoint policy, and the KMS key policy for SSE-KMS objects.
- Access points simplify per-application access to shared buckets.

Current note: since April 2023 new buckets have Block Public Access enabled and ACLs disabled by default.

## VPC endpoints

A gateway endpoint for S3 adds routes to chosen route tables so instances in private subnets reach S3 without NAT or internet, at no hourly cost. Interface endpoints exist for on-premises or cross-region access. Restrict with an endpoint policy and pin buckets with `aws:SourceVpce`.

## Encryption

- **SSE-S3** (S3-managed keys): baseline, no key management.
- **SSE-KMS:** customer managed key, key policy controls who can decrypt, CloudTrail logs key use, rotation. Enable **S3 Bucket Keys** to cut KMS request costs. Watch KMS request quotas on high-throughput buckets.
- **DSSE-KMS** for dual-layer requirements; **SSE-C** (you supply the key per request) and **client-side encryption** when you must control keys and algorithms entirely, at the cost of managing them yourself.
- Set default bucket encryption and deny uploads with the wrong key when compliance requires a specific KMS key.

Current note: the book says objects are unencrypted by default; since January 2023 all new objects are encrypted with SSE-S3 by default.

## Logging and inventory

- **Server access logs** go to a separate bucket (never the same one, or logs log themselves), delivered best-effort in batches. **CloudTrail data events** give IAM identity per object API call, near real time, at a cost per event; enable for sensitive buckets.
- **S3 Inventory** delivers daily or weekly CSV/ORC/Parquet reports (size, class, encryption, replication status, Object Lock) to a bucket; query them with Athena to find unencrypted or untagged objects at scale. **Storage Lens** gives organization-wide usage dashboards.

## Event notifications

Trigger work on `s3:ObjectCreated:*`, `s3:ObjectRemoved:*`, restore and replication events, filtered by prefix and suffix, to Lambda, SQS, SNS, or EventBridge (for richer filtering and many targets).

```bash
aws s3api put-bucket-notification-configuration --bucket bucket \
  --notification-configuration '{"EventBridgeConfiguration": {}}'
```

- The destination must allow S3 to deliver: a topic or queue policy (or Lambda resource policy) for principal `s3.amazonaws.com`, conditioned on `aws:SourceArn` of the bucket and `aws:SourceAccount`.
- Delivery is at-least-once and can be out of order; make handlers idempotent.
- Never have a function write back to the prefix that triggers it; that loops and runs up cost.
- Like lifecycle, notification configuration is replaced wholesale on put.

## Batch Operations

For millions of existing objects: copy, replace tags, replace ACLs, restore from Glacier, set Object Lock retention, invoke Lambda, or compute checksums. Provide a manifest (CSV or an Inventory report), an IAM role S3 can assume, and a completion report location. Jobs can require confirmation before running: review the operation, object count and role, test on a small manifest first, then run.

## Versioning, replication and protection

- **Versioning** keeps every version; a delete adds a delete marker that you can remove to restore. Once enabled it can be suspended but not removed. Pair with noncurrent-version expiration to control cost.
- **Replication:** Cross-Region (DR, latency, compliance) or Same-Region (aggregation, separate account copies). Requires versioning on both buckets and a replication role; only new objects replicate unless you use Batch Replication. Use Replication Time Control when you need an SLA, and replicate into a separate account to protect against account compromise.
- **MFA delete** and **Object Lock** (governance or compliance mode, legal holds) protect against deletion and ransomware; compliance mode cannot be shortened by anyone, including root, so set retention deliberately.

Current note: the book calls SRR "Single Region Replication"; AWS names it Same-Region Replication. Vault Lock applies to Glacier vaults; for S3 buckets use Object Lock.

## Workflow

1. Confirm account, region, environment and data owner; classify the data (public, internal, confidential, regulated).
2. Create the bucket through IaC with the naming convention, tags, Block Public Access, ACLs disabled, default encryption, versioning and access logging.
3. Write the bucket policy and IAM policies; validate with Access Analyzer; test from an allowed and a denied principal.
4. Add a VPC endpoint for private access; add lifecycle rules matching retention agreed with the owner.
5. Configure events, replication or Object Lock as required; check the target policies.
6. For changes to existing buckets (policy, lifecycle, replication, notifications, deletes): fetch current config, show the diff or dry run, get approval for production, and keep the previous config to restore.
7. Verify with Inventory, Storage Lens, CloudTrail and a test upload; set budget alerts on storage and request costs.

## Red flags

- Public bucket or `"Principal": "*"` allow without a restricting condition.
- ACLs used for access control on new buckets.
- No versioning on buckets holding data you cannot regenerate.
- Lifecycle expiration added without owner sign-off, or an existing rule set overwritten by a partial put.
- Many small objects moved to IA or Glacier, paying more in minimums than they save.
- Private workloads reaching S3 through NAT gateways.
- SSE-KMS on a hot bucket without Bucket Keys, hitting KMS throttling.
- Access logs written to the same bucket they describe.
- Event handlers that are not idempotent or that write into their own trigger prefix.
- `aws s3 sync --delete` or `rm --recursive` run without a dry run.
- Replication assumed to copy existing objects or to protect against deletes in the same account.

## Related

- `../IamAndSecrets/iamAndSecrets.md` - IAM, bucket policy evaluation, cross-account roles.
- `../FundamentalServices/fundamentalServices.md` - VPC endpoints, NAT and networking.
- `../WellArchitectedPillars/wellArchitectedPillars.md` - cost and data protection lenses.
- `../DynamoDb/dynamoDb.md` - export and import between DynamoDB and S3.
- `../../Resilience/DataProtection/dataProtection.md` - KMS keys and encryption in depth.
- `../../Monitoring/LogSources/logSources.md` - CloudTrail and log delivery to S3.
- `../../Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` - routing S3 events through EventBridge.
- `../../Delivery/CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` - S3 as a pipeline source and artifact store.
- `../../../Practices/DeliveryPipeline/deliveryPipeline.md` - platform-neutral artifact handling.
- `../../../Azure/TableStorage/tableStorage.md` - Azure storage counterpart; Blob storage APIs and syntax differ from S3.
- `../../../../DataSystems/DerivedData/BatchProcessing/batchProcessing.md` - processing large object datasets (when installed).
- `../../../../DataSystems/Foundations/StorageAndRetrieval/storageAndRetrieval.md` - storage engine concepts (when installed).
