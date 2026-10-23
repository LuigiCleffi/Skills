---
name: aws-data-protection
description: How to protect data at rest and in transit on AWS: KMS key types (AWS owned, AWS managed, customer managed), symmetric and asymmetric keys, envelope encryption with data keys, key policies, grants and the split between key administrators and key users, encryption context, automatic and on-demand rotation, imported key material, multi-Region keys, scheduled deletion; default encryption for S3 (SSE-S3, SSE-KMS, bucket keys, S3 Inventory and Batch Operations to find and re-encrypt objects), EBS encryption by default, RDS and snapshot encryption; TLS with AWS Certificate Manager (public certificates, DNS vs email validation, auto-renewal, wildcard and SAN names, us-east-1 for CloudFront, AWS Private CA), HTTPS listeners and TLS security policies on load balancers, CloudFront viewer protocol policy and origin access control, and site-to-site VPN (IPsec) for network links, based on Chapter 19 (Protecting Data in Flight and at Rest) of AWS Certified DevOps Engineer – Professional. Use when creating a KMS key or key policy, AccessDeniedException or KMS.NotFoundException on decrypt, a compliance rule requires key rotation or encryption at rest, aws kms create-key, put-bucket-encryption, enable-ebs-encryption-by-default, encrypting an existing RDS database or S3 bucket, sharing encrypted snapshots across accounts, requesting an ACM certificate, a certificate stuck in Pending validation or failing renewal, the certificate not showing in CloudFront, enforcing HTTPS or aws:SecureTransport, choosing an ELB SSL policy, or scheduling a key for deletion.
---

# Data Protection in Flight and at Rest

Encrypt everything at rest with KMS and everything in transit with TLS, and make it the default rather than a per-resource choice: account- and bucket-level defaults, policies that deny unencrypted access, and Config rules that detect drift. The hard parts are key access control and key lifecycle, not the encryption itself: a deleted or locked-out key makes data unrecoverable. Confirm account, region and environment before touching keys, key policies, certificates or DNS, show the change first, and get explicit approval for anything in production or irreversible (key deletion, disabling a key, replacing a certificate on a live listener).

## KMS keys

| Type | Who manages | Use |
|---|---|---|
| AWS owned | AWS, not visible in your account | Default for some services; no audit or control |
| AWS managed (`aws/s3`, `aws/ebs`, ...) | AWS, visible, policy fixed | Quick start; cannot share across accounts or control the policy |
| Customer managed | You: key policy, rotation, deletion | Production data, cross-account access, separation of duties, audit |

- **Envelope encryption**: KMS keys never leave KMS. Services call `GenerateDataKey`, encrypt data locally with the plaintext data key, store the encrypted data key next to the data, and discard the plaintext. Re-keying only re-encrypts data keys. Use the AWS Encryption SDK or service integrations rather than rolling your own.
- **Symmetric** (AES-256) for almost everything; **asymmetric** (RSA, ECC) when a party outside AWS must encrypt or verify signatures with the public key; **HMAC** keys for message authentication.
- **Encryption context**: non-secret key-value pairs bound to the ciphertext and logged in CloudTrail; require them in key policy conditions to limit what a principal can decrypt.
- **Imported key material** and **custom key stores** (CloudHSM, external) only when a regulation requires you to control the material; you then own its availability and rotation.
- **Multi-Region keys** for data that must be decrypted in another Region (DR, global tables); otherwise keep keys single-Region.

## Key policy and access

The key policy is the primary control: IAM policies only work if the key policy allows the account to delegate. Separate **key administrators** (manage, rotate, schedule deletion, but cannot use the key) from **key users** (encrypt, decrypt, generate data keys).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "AccountRootCanDelegateToIam", "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
      "Action": "kms:*", "Resource": "*" },
    { "Sid": "KeyAdmins", "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:role/KeyAdmin" },
      "Action": ["kms:Describe*", "kms:List*", "kms:Get*", "kms:Put*", "kms:Update*",
                 "kms:Enable*", "kms:Disable*", "kms:TagResource", "kms:UntagResource",
                 "kms:RotateKeyOnDemand", "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion"],
      "Resource": "*" },
    { "Sid": "OrdersServiceUsesKey", "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:role/orders-service" },
      "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey*", "kms:DescribeKey"],
      "Resource": "*",
      "Condition": { "StringEquals": { "kms:ViaService": "s3.eu-west-1.amazonaws.com" } } }
  ]
}
```

- Keep the root/delegation statement (or an equivalent admin path); a policy that names only a role that is later deleted leaves the key unmanageable without an AWS Support case.
- Use `kms:ViaService` and encryption context conditions to restrict use to the intended service and data.
- Grants (`create-grant`) suit temporary, programmatic delegation (services like EBS use them); retire them when done.
- Cross-account: the key policy must allow the other account and that account's IAM must allow the principal. AWS managed keys cannot do this, so encrypted snapshots shared across accounts need a customer managed key.

## Rotation and deletion

- Enable automatic rotation on customer managed symmetric keys (`enable-key-rotation`, period configurable, default one year); old key material is kept so existing ciphertext still decrypts. Use `rotate-key-on-demand` after a suspected exposure.
- Asymmetric, HMAC and imported-material keys do not rotate automatically; rotate by creating a new key and moving the alias.
- Reference keys by **alias** in code and IaC so rotation-by-replacement is an alias update.
- Deletion is scheduled (7–30 days) and irreversible once it completes: everything encrypted only under that key is lost. Disable the key first, watch CloudTrail and a CloudWatch alarm for attempted use during the waiting period, and cancel if anything still needs it.

Current note: the book says AWS managed keys rotate every three years; since 2022 they rotate every year, and customer managed rotation periods are now configurable with on-demand rotation available. The book's "CMK" term is now just "KMS key".

## Encryption at rest by service

```bash
# S3: SSE-KMS default with a bucket key (fewer KMS calls, lower cost)
aws s3api put-bucket-encryption --bucket orders-prod-data \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":
    {"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"alias/orders-data"},"BucketKeyEnabled":true}]}'

# EBS: encrypt every new volume in this Region by default
aws ec2 enable-ebs-encryption-by-default --region eu-west-1
aws ec2 modify-ebs-default-kms-key-id --kms-key-id alias/ebs-default --region eu-west-1
```

- **S3**: all new objects are encrypted (SSE-S3 at minimum); choose SSE-KMS with a customer managed key when you need access control or audit on decrypt. Find older unencrypted or wrongly keyed objects with S3 Inventory (encryption status field) and re-encrypt with S3 Batch Operations (copy in place); test on a prefix first.
- **EBS**: default encryption is per Region; existing unencrypted volumes are fixed by snapshot, encrypted copy, new volume, and swap during a maintenance window.
- **RDS / Aurora**: encryption is chosen at creation. To encrypt an existing database: snapshot, `copy-db-snapshot --kms-key-id`, restore, cut over. Plan downtime or use replication to shorten it.
- **DynamoDB** is always encrypted at rest; choose AWS owned, AWS managed or customer managed key per table.
- Keep the key in the same Region as the data; Region-specific keys mean cross-Region copies must be re-encrypted with a destination key.

Current note: S3 has applied SSE-S3 to all new objects by default since January 2023, so a bucket without a default encryption setting is no longer unencrypted; the decision now is SSE-S3 vs SSE-KMS.

## Encryption in transit

- **ACM public certificates** are free on integrated services (ELB, CloudFront, API Gateway, App Runner, Elastic Beanstalk via ELB) and renew automatically. Use **DNS validation** (CNAME in Route 53, which ACM can create for you) and leave the record in place so renewal stays automatic; email validation needs a human every renewal.
- Names cannot be added after issuance; request a new certificate with the needed SANs or a wildcard (`*.example.com` covers one level only).
- Certificates are regional. CloudFront only sees certificates in **us-east-1**; a load balancer needs one in its own Region.
- By default the private key of an ACM-issued public certificate cannot be exported, so TLS that terminates on your own instances needs a certificate you manage or one from **AWS Private CA** for internal services and mTLS.

```bash
aws acm request-certificate --region us-east-1 \
  --domain-name example.com --subject-alternative-names "*.example.com" \
  --validation-method DNS
aws acm describe-certificate --certificate-arn <arn> --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord'
```

- **Load balancers**: HTTPS listener with a current TLS policy (for example `ELBSecurityPolicy-TLS13-1-2-2021-06`) and an HTTP listener that only redirects to 443. Re-encrypt to targets when the data or regulation requires end-to-end TLS.
- **CloudFront**: viewer protocol policy `redirect-to-https` or `https-only`, minimum protocol TLS 1.2, private S3 origin reached only through **origin access control** with a bucket policy limited to that distribution.
- **S3 and other APIs**: deny plaintext requests in the bucket policy:

```json
{ "Sid": "DenyInsecureTransport", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
  "Resource": ["arn:aws:s3:::orders-prod-data", "arn:aws:s3:::orders-prod-data/*"],
  "Condition": { "Bool": { "aws:SecureTransport": "false" } } }
```

- **Network links**: site-to-site VPN (IPsec, two tunnels per connection, about 1.25 Gbps per tunnel) for encrypted on-premises links; Direct Connect is not encrypted by itself, so add MACsec or a VPN over it when required.
- Databases: require TLS on the server side (for example `rds.force_ssl` for PostgreSQL) and verify certificates in clients.

Current note: CloudFront origin access identity (OAI) is legacy; use origin access control (OAC), which also supports SSE-KMS-encrypted objects.

## Workflow
1. Confirm account, Region and environment; inventory what holds data and how it is encrypted today (Config rules, S3 Inventory, `describe-volumes`, RDS `StorageEncrypted`).
2. Choose key type per data class; create customer managed keys in IaC with a reviewed key policy separating admins and users, aliases and rotation on.
3. Turn on defaults (S3 default encryption, EBS by default) and add deny policies for plaintext transport.
4. Plan migrations for existing unencrypted data (snapshot-copy-restore, Batch Operations) with a tested rollback and approved window.
5. Issue ACM certificates with DNS validation in the right Region; attach with a current TLS policy and HTTP-to-HTTPS redirect.
6. Verify: decrypt as an allowed and a denied principal, `curl -v` the endpoint for protocol and chain, check CloudTrail for KMS calls.
7. Monitor: Config rules (encrypted volumes, S3 SSE and SSL-only), ACM expiry events, alarms on KMS use of keys pending deletion.

## Red flags
- Key policy with no working admin path, or one where admins can also decrypt everything.
- `kms:*` or `kms:Decrypt` on `Resource: "*"` granted broadly in IAM.
- Scheduling key deletion without checking what still uses the key.
- Customer data under AWS managed keys when cross-account sharing or audit is required.
- Certificates validated by email, or DNS validation records deleted (renewal fails silently until expiry).
- CloudFront certificate requested outside us-east-1.
- HTTP listeners that serve content instead of redirecting; TLS 1.0/1.1 policies.
- Private keys, data keys or plaintext secrets in repos, AMIs, user data, logs or chat.
- Public S3 origin behind CloudFront (bypassable) instead of OAC.

## Related
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — IAM policies, Secrets Manager and Parameter Store, which use KMS.
- `../../Fundamentals/S3Storage/s3Storage.md` — bucket policies, versioning, replication of encrypted objects.
- `../../Fundamentals/DynamoDb/dynamoDb.md` — table encryption options.
- `../SystemsManagerAndConfig/systemsManagerAndConfig.md` — Config rules to detect unencrypted resources.
- `../PolicyAndStandards/policyAndStandards.md` — Macie for sensitive data, Security Hub controls.
- `../../Monitoring/LogSources/logSources.md` — CloudTrail records of KMS and ACM calls.
- `../../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — keeping secrets out of code; platform-neutral.
- `../../../Azure/SqlDatabase/sqlDatabase.md` — Azure counterpart for database encryption; Key Vault syntax is not interchangeable with KMS.
- `../../../../DBA/PostgreSQL/DatabaseAdministration/databaseAdministration.md` — server-side TLS and `pg_hba.conf` (when installed).
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — handling decrypt and access failures without leaking data (when installed).
