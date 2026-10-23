---
name: aws-log-sources
description: How to enable, secure and query the AWS logs that application logs do not cover - AWS CloudTrail (management and data events, multi-region and organization trails, S3 bucket policy, SSE-KMS, log file validation, CloudWatch Logs delivery, Event history, CloudTrail Lake, Logs Insights queries), Elastic Load Balancing access logs (ALB, NLB, Classic; S3 delivery, fields, latency and status analysis), and VPC Flow Logs (VPC, subnet and ENI scope, ACCEPT/REJECT/ALL, destinations, custom formats, traffic that is not captured), based on Chapter 16 (Various Logs Generated: VPC Flow Logs, Load Balancer Logs, CloudTrail Logs) of AWS Certified DevOps Engineer - Professional. Use when the user asks who deleted or changed a resource, wants an audit trail for compliance, runs aws cloudtrail create-trail, start-logging or lookup-events, sees CloudTrail failing to write to S3 (InsufficientS3BucketPolicyException), needs client IPs, request paths or 5xx and latency per target from a load balancer, enables access_logs.s3.enabled, investigates why traffic to an instance is blocked (security group vs NACL), detects port scans, SSH or RDP attempts or data exfiltration, runs aws ec2 create-flow-logs, or asks why some traffic is missing from flow logs.
---

# AWS Log Sources: CloudTrail, Load Balancer and VPC Flow Logs

Pick the log by the question: CloudTrail says who called which AWS API, when and from where; load balancer access logs say which client asked for which path and how long the target took; VPC Flow Logs say which IP talked to which IP on which port and whether it was accepted. Enable all three before an incident, not during one. Trails, bucket policies and flow logs change account-wide audit and network configuration, so confirm the account, region and environment, show the planned change, and get approval for production; never weaken or stop an existing trail without explicit sign-off.

## Which log answers what

| Question | Log |
|---|---|
| Who terminated the instance, changed the security group, deleted the bucket? | CloudTrail management events |
| Who read or wrote this S3 object, invoked this function? | CloudTrail data events (opt-in, extra cost) |
| Which client got 502s, which path is slow, which target served it? | ALB / CLB access logs |
| Why can the office not reach port 22? Is someone scanning us? | VPC Flow Logs |
| Is the application itself failing? | Application logs in CloudWatch Logs |

GuardDuty consumes CloudTrail, VPC Flow Logs and DNS logs on its own; enabling it does not replace keeping your own copies for investigation.

## CloudTrail

- Every console, CLI and SDK action is an API call. Each event records the identity, time, source IP, user agent, action, region, request parameters and response or error.
- Event history shows the last 90 days of management events in a region at no charge, without any trail. A **trail** is needed to keep events longer, deliver them to S3 and CloudWatch Logs, and capture data events.
- Default: one **multi-region** trail (or an **organization trail** from the management or delegated admin account) that includes global service events, delivered to a dedicated, locked-down S3 bucket in a log archive account. Single-region trails are rarely right.
- Events arrive in S3 in batches, typically within about 5 minutes; this is not a real-time feed. For near-real-time reactions, use EventBridge rules on CloudTrail events or the CloudWatch Logs delivery.

```bash
aws cloudtrail create-trail --name org-audit --s3-bucket-name example-org-cloudtrail \
  --is-multi-region-trail --is-organization-trail --enable-log-file-validation \
  --kms-key-id arn:aws:kms:us-east-1:111122223333:key/EXAMPLE
aws cloudtrail start-logging --name org-audit     # a new trail does not record until started
```

- Bucket policy must let `cloudtrail.amazonaws.com` call `s3:GetBucketAcl` on the bucket and `s3:PutObject` on the `AWSLogs/<account-id>/*` prefix, scoped with `aws:SourceArn` (the trail ARN) or `aws:SourceAccount` so other accounts' trails cannot write into it. Generate the exact policy from the current CloudTrail documentation for your trail type; an incorrect one causes `InsufficientS3BucketPolicyException`.
- Encryption: S3 server-side encryption is on by default; use a customer-managed KMS key when you need to control and audit decrypt access. The key policy must allow CloudTrail to encrypt and your investigators to decrypt.
- Enable log file validation and verify with `aws cloudtrail validate-logs` when integrity matters.
- Protect the bucket: block public access, versioning, MFA delete or S3 Object Lock for compliance, lifecycle rules to cheaper storage classes, and deny `cloudtrail:StopLogging`, `DeleteTrail` and `UpdateTrail` to everyone except a break-glass role (via SCP in Organizations).
- Data events (S3 object level, Lambda invoke, DynamoDB item level) can be very high volume; select specific buckets or use advanced event selectors.
- Deliver to CloudWatch Logs for metric filters and alarms (root login, console login without MFA, IAM policy changes, security group changes) and for Logs Insights:

```
filter eventSource = "ec2.amazonaws.com" and eventName like /AuthorizeSecurityGroup|RevokeSecurityGroup/
| fields eventTime, userIdentity.arn, sourceIPAddress, requestParameters.groupId
| sort eventTime desc
```

- Quick lookups without a trail query: `aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=TerminateInstances`.
- For SQL over long retention, use CloudTrail Lake event data stores or Athena over the S3 trail (see `../EnterpriseLogging/enterpriseLogging.md`).

Current note: the console now creates multi-region trails by default; single-region trails can only be created through the CLI or API, and there are few good reasons to.

## Elastic Load Balancing access logs

- Off by default; no charge for generating them, you pay for S3 storage. They capture what application logs often lose behind the balancer: real client IP and port, request line, target, request/target/response processing times, ELB and target status codes, TLS details, user agent.
- ALB writes every 5 minutes; Classic Load Balancer every 5 or 60 minutes. NLB access logs exist only for TLS listeners. Delivery is best effort.
- Enable in code:

```yaml
AppLoadBalancer:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    LoadBalancerAttributes:
      - { Key: access_logs.s3.enabled, Value: "true" }
      - { Key: access_logs.s3.bucket, Value: !Ref AlbLogsBucket }
      - { Key: access_logs.s3.prefix, Value: prod/orders }
```

- The bucket must be in the same region, use SSE-S3 for ALB and Classic access logs (they do not support SSE-KMS), and grant the log delivery principal for that region write access to the prefix; take the exact bucket policy from the current Elastic Load Balancing documentation, because older regions use a regional ELB account ID and newer ones a service principal.
- Objects land under `prefix/AWSLogs/<account>/elasticloadbalancing/<region>/yyyy/mm/dd/`. Query them with Athena rather than downloading files.
- Use them for: latency breakdown (balancer vs target time), 5xx from the ELB (`elb_status_code`) vs from the target (`target_status_code`), which clients or paths drive load, and evidence during abuse investigations.
- Add a lifecycle rule; access logs grow quickly and often contain IPs and URLs with query strings that count as personal data.

Current note: the book builds a Classic Load Balancer; use an ALB or NLB for new workloads.

## VPC Flow Logs

- Capture IP flow metadata (not payloads) for a VPC, a subnet, or a single network interface, including interfaces owned by ELB, RDS, ElastiCache, Redshift, WorkSpaces, NAT gateways and Transit Gateway attachments.
- Choose traffic type `ACCEPT`, `REJECT` or `ALL`; destination CloudWatch Logs, S3 (cheapest for volume, Parquet and hourly partitions available), or Amazon Data Firehose; aggregation interval 1 or 10 minutes. Records appear after a delay of several minutes.

```bash
aws ec2 create-flow-logs --resource-type VPC --resource-ids vpc-0abc1234 \
  --traffic-type ALL --log-destination-type s3 \
  --log-destination arn:aws:s3:::example-flow-logs/prod/ \
  --max-aggregation-interval 60 \
  --log-format '${version} ${account-id} ${interface-id} ${srcaddr} ${dstaddr} ${srcport} ${dstport} ${protocol} ${packets} ${bytes} ${start} ${end} ${action} ${log-status} ${vpc-id} ${subnet-id} ${pkt-srcaddr} ${pkt-dstaddr} ${tcp-flags}'
```

- CloudWatch Logs destinations need an IAM role that `vpc-flow-logs.amazonaws.com` can assume, scoped to the target log group; give that log group a retention period.
- Custom formats add fields like `vpc-id`, `subnet-id`, `pkt-srcaddr` (the original source behind a NAT or load balancer) and `tcp-flags`.
- Not captured: traffic to the Amazon DNS resolver, Windows license activation, instance metadata (169.254.169.254), Time Sync (169.254.169.123), DHCP, traffic to the reserved VPC router address, and traffic between an endpoint interface and a Network Load Balancer interface. Use Route 53 Resolver query logs for DNS.
- You cannot create flow logs for a peered VPC in another account from your side; the owner must enable them.
- Reading results: security groups are stateful, NACLs are not. An inbound `ACCEPT` followed by an outbound `REJECT` for the same flow points at a NACL blocking return traffic on ephemeral ports.
- Use cases: verifying who reaches SSH/RDP and from where, spotting port and network scans, unexpected egress to unknown destinations, auditing ports open to the world, and tracing an intruder's path after an incident.

## Workflow
1. Confirm account (`aws sts get-caller-identity`), region, environment and whether an organization trail or central log archive already exists; do not create duplicates.
2. State the questions to answer and pick the sources; estimate volume and cost (data events, flow logs on busy VPCs).
3. Create the destination buckets or log groups in code: block public access, encryption, least-privilege bucket policy with source conditions, retention or lifecycle.
4. Review the change set or plan, get approval for production and for any change to an existing trail, then apply.
5. Start logging (`start-logging` for trails) and generate a known event; confirm it arrives in S3 or CloudWatch Logs.
6. Add alarms on critical CloudTrail events, Athena tables or Insights saved queries for investigations.
7. Rollback is disabling the new logging resource; never roll back by deleting existing audit data.

## Red flags
- No trail at all, or a single-region trail in a multi-region account.
- The trail's bucket in the same account the trail audits, writable or deletable by workload admins.
- Bucket policies without `aws:SourceArn` or `aws:SourceAccount`, or with public access.
- Anyone besides a break-glass role able to stop or delete the trail.
- Load balancer access logs disabled on production, or kept forever with no lifecycle.
- Flow logs only on `REJECT`, hiding successful exfiltration; or on `ALL` into CloudWatch Logs with no retention, costing more than the workload.
- Expecting flow logs to show DNS queries, metadata calls or packet contents.
- Credentials, tokens or PII in URL query strings, now copied into access logs.
- Treating CloudTrail S3 delivery as real time for alerting.

## Related
- `../CloudWatchAndXRay/cloudWatchAndXRay.md` — log groups, metric filters, alarms, Logs Insights.
- `../MetricsAndEventBridge/metricsAndEventBridge.md` — EventBridge rules on CloudTrail events.
- `../EnterpriseLogging/enterpriseLogging.md` — Athena, OpenSearch and Firehose for analyzing these logs at scale.
- `../../Fundamentals/S3Storage/s3Storage.md` — bucket policies, encryption, lifecycle, Object Lock.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — roles for log delivery and least privilege.
- `../../Resilience/PolicyAndStandards/policyAndStandards.md` — GuardDuty, SCPs and organization-wide guardrails.
- `../../Resilience/DataProtection/dataProtection.md` — KMS keys and encryption at rest.
- `../../../Practices/Monitoring/monitoring.md` — platform-neutral logging practice; Azure Activity Log and NSG flow logs are the Azure counterparts with different syntax.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` (when installed) — what applications should log alongside these sources.
- `../../../../actions/review.md` (when installed) — reviewing infrastructure changes.
