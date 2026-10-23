---
name: aws-fundamental-services
description: How to choose and operate the core AWS building blocks a DevOps engineer automates - AWS CLI v2 profiles and SSO login, EC2 purchase options (On-Demand, Reserved, Savings Plans, Spot), instance families, AMIs and image backups, cloud-init user data, ENIs, EBS volume types versus instance store, AWS Batch, VPC subnets, security groups versus network ACLs, internet, egress-only and NAT gateways, VPC endpoints, DHCP option sets, Site-to-Site and Client VPN, Transit Gateway, Direct Connect, Route 53 hosted zones, record types, alias records, health checks and routing policies (simple, failover, geolocation, geoproximity, latency, multivalue, weighted), RDS, Aurora, ElastiCache, DocumentDB, SNS, SQS, Amazon MQ, SES and Trusted Advisor, based on Chapter 2 (Fundamental AWS Services) of AWS Certified DevOps Engineer - Professional (Adam Book). Use when configuring the AWS CLI or a named profile, launching or imaging EC2 instances, writing user data, choosing gp3 or io2 volumes, designing a VPC with public and private subnets, a private instance cannot reach S3 or the internet, picking security group or NACL rules, connecting on-premises networks, setting up Route 53 failover or weighted canary records, choosing RDS Multi-AZ, read replicas or Aurora, deciding between SNS, SQS and Amazon MQ, or checking Trusted Advisor and service quota findings.
---

# Fundamental AWS Services

Most AWS workloads are assembled from the same few services: EC2 and EBS for compute, a VPC for the network, Route 53 for names and traffic steering, a managed database, and SNS/SQS to decouple tiers. Choose each by the workload's access pattern and failure model, define it in IaC rather than the console, and confirm the account, region and environment before running any command that creates, changes or deletes something.

## Access: console and CLI

- Never work as the root user. Use federated access (IAM Identity Center) and short-lived credentials; avoid IAM users with access keys, and never paste keys into chat, code or tickets.
- AWS CLI v2 with named profiles; always know which identity and region a command will hit.

```bash
aws configure sso --profile dev-admin          # one-time: start URL, account, permission set
aws sso login --profile dev-admin
aws sts get-caller-identity --profile dev-admin  # confirm account and role before any change
export AWS_PROFILE=dev-admin AWS_REGION=us-east-2
```

- Set an account alias so humans see "acme-prod" rather than a 12-digit number.
- Use multiple accounts under AWS Organizations (Control Tower for a governed landing zone) to separate environments.

## EC2

**Purchase options**

| Option | Use for | Watch out |
|---|---|---|
| On-Demand | Spiky, short-lived, unknown workloads | Highest unit price |
| Savings Plans / Reserved Instances (1 or 3 years) | Steady baseline load | Commitment; zonal RIs also reserve capacity |
| Spot | Fault-tolerant, stateless, batch, CI runners | Two-minute interruption notice; design for it |

Current note: Spot no longer involves bidding; you pay the current Spot price and an optional maximum defaults to the On-Demand price. Discounts reach up to 90%, and persistent EBS-backed Spot requests can stop or hibernate on interruption.

**Instance families:** general purpose (M, burstable T; T credits can run out under sustained CPU), compute optimized (C), memory optimized (R, X), accelerated (P, G, Inf), storage optimized (I, D, H). Start general purpose, measure, then right-size. Check enhanced networking and EBS-optimized support when throughput matters.

**AMIs:** build golden images (EC2 Image Builder or Packer) with approved OS and hardening; avoid community AMIs of unknown origin. Resolve the latest base image from public SSM parameters rather than hard-coding IDs:

```bash
AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)
aws ec2 create-image --instance-id i-0abc123 --name "app-$(date +%Y%m%d)" --no-reboot
```

`--no-reboot` is faster but the file system may not be consistent; stop the instance or flush application writes for a clean image. Copy AMIs to another region for DR, and deregister old AMIs together with their snapshots.

Current note: launch configurations are legacy; use launch templates for Auto Scaling groups. Amazon Linux 2023 succeeds Amazon Linux 2.

**User data** bootstraps instances at first boot with cloud-init. Keep it short and idempotent; secrets come from Secrets Manager or Parameter Store at runtime via the instance role, never inline.

```yaml
#cloud-config
package_update: true
packages: [amazon-cloudwatch-agent]
write_files:
  - path: /etc/app/env
    content: |
      APP_ENV=staging
runcmd:
  - systemctl enable --now amazon-cloudwatch-agent
```

- Require IMDSv2 (`HttpTokens=required`) in launch templates.
- Prefer Systems Manager Session Manager over SSH bastions: no inbound port 22, sessions logged.

**ENIs** carry the private IP, MAC and security groups. Security groups attach to ENIs, so a second ENI in a different subnet or security group can separate management from public traffic.

**EBS versus instance store**

- EBS is network storage bound to one AZ, persists independently of the instance; move it across AZs via snapshot.
- Instance store is physically attached, very fast, and lost on stop, termination or host failure: scratch data only.
- Volume types: gp3 (default general SSD, IOPS and throughput set independently of size), io2 Block Express (critical databases, provisioned IOPS), st1 (throughput HDD for logs, big data), sc1 (cold HDD). Magnetic `standard` is previous generation.
- Watch `VolumeReadOps`, `VolumeWriteOps`, `VolumeQueueLength` and burst balance in CloudWatch.

**AWS Batch** runs containerized jobs from job definitions (image, vCPU, memory, IAM role) submitted to job queues mapped to compute environments (Fargate, On-Demand, Spot). Put urgent queues on On-Demand and tolerant ones on Spot; ordering is roughly FIFO with dependencies, not strict.

## VPC networking

- **Subnets** live in exactly one AZ. Public subnets route `0.0.0.0/0` to an internet gateway; private subnets do not. Spread every tier across at least two AZs.
- **Security groups:** stateful, allow-only, attach to ENIs, can reference other security groups. **Network ACLs:** stateless, subnet level, numbered allow and deny rules evaluated lowest first; return traffic (ephemeral ports 1024-65535) must be allowed explicitly.
- **Internet gateway** for IPv4 public addresses; **egress-only internet gateway** for outbound-only IPv6.
- **NAT gateway** (managed, per AZ for resilience) gives private subnets outbound internet. Do not route AWS service traffic through NAT: use **VPC endpoints** (gateway endpoints for S3 and DynamoDB, interface endpoints via PrivateLink for most other services). Cheaper and keeps traffic on the AWS network.
- **DHCP option sets** point instances at custom DNS, domain name or NTP servers; changing one affects every instance in the VPC on lease renewal.
- **Connecting networks:** Site-to-Site VPN (IPsec, quick, over the internet), Client VPN (OpenVPN-based for users), Transit Gateway (hub for many VPCs and on-premises links, replaces peering meshes), Direct Connect (dedicated private links, consistent bandwidth; pair with VPN as backup).

Plan CIDR ranges centrally so VPCs and on-premises networks never overlap.

## Route 53

- A **domain** is registered; a **hosted zone** holds its records (public or private to VPCs). Record types include A, AAAA, CNAME, MX, TXT, CAA, NS, SOA, SRV, PTR, plus Route 53 **alias** records that point the zone apex at load balancers, CloudFront or S3 at no query cost.
- **Health checks:** endpoint checks (prefer a page that exercises real dependencies), calculated checks (healthy if at least N of M children are healthy) and CloudWatch alarm-based checks.
- **Routing policies:** simple; failover (primary/secondary with health check); geolocation (by continent, country, US state, for content or compliance); geoproximity (by distance with a bias); latency-based (lowest latency region); multivalue answer (up to eight healthy records, not a load balancer); weighted (0-255, share = weight / sum, 0 stops traffic) for canary and blue/green.

```bash
aws route53 change-resource-record-sets --hosted-zone-id Z123 --change-batch file://canary-10pct.json
```

DNS changes are production changes: lower TTLs ahead of a cutover, review the change batch, get approval, and keep the previous record set to restore.

## Databases

| Need | Service |
|---|---|
| Relational, standard engines (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server) | RDS |
| Relational, MySQL/PostgreSQL compatible, cloud-native storage, fast failover | Aurora (provisioned or Serverless v2) |
| Key-value at any scale | DynamoDB |
| In-memory cache or sessions | ElastiCache (Redis OSS or Valkey, Memcached) |
| MongoDB-compatible documents | DocumentDB |

- **RDS Multi-AZ** keeps a synchronous standby in another AZ and fails over by switching the DNS endpoint; a Multi-AZ instance standby serves no reads. **Read replicas** are asynchronous, readable, can be cross-region, and become independent when promoted.
- Use M or R classes for production, T only for dev. Enable automated backups, deletion protection and encryption at creation (encryption cannot be added in place).

Current note: the book describes Multi-AZ replication as asynchronous; RDS Multi-AZ standbys are synchronous. Multi-AZ DB clusters (MySQL, PostgreSQL) add two readable standbys.

## Messaging

- **SNS:** pub/sub fan-out to many subscribers (SQS, Lambda, HTTPS, email, SMS). Retries per protocol; add dead-letter queues for subscriptions.
- **SQS:** durable buffer between producers and one consumer group. Standard = at-least-once, best-effort order; FIFO = ordered within a message group with deduplication. Consumers delete after processing; set the visibility timeout above processing time; use long polling and a dead-letter queue with `maxReceiveCount`; make consumers idempotent.
- Common pattern: SNS topic fanning out to several SQS queues.
- **Amazon MQ:** managed ActiveMQ or RabbitMQ when migrating apps that speak JMS, AMQP, MQTT, STOMP or OpenWire. Prefer SQS/SNS for new designs.
- **SES:** outbound email; verify domains with DKIM, SPF and DMARC; new accounts start in the sandbox.

Current note: SES is available in many regions, not only the three named in the book.

## Trusted Advisor

Checks across cost optimization, performance, security, fault tolerance, service limits and operational excellence. Basic and Developer support get core checks; Business and above get the full set and API access (`aws support describe-trusted-advisor-checks`, from us-east-1). Feed findings and quota warnings into tickets or EventBridge, and use **Service Quotas** to request increases before launches.

## Workflow

1. Confirm the account, region, profile and environment (`aws sts get-caller-identity`).
2. Choose compute, storage, network, database and messaging options from the access pattern, availability target and budget; write the choice down.
3. Define everything in IaC; avoid console-created resources that drift.
4. Review the plan or change set; get explicit approval for production, DNS, security group, database and deletion changes; record current state for rollback.
5. Apply through the pipeline; keep credentials in Secrets Manager or Parameter Store and roles, never in user data or repos.
6. Verify: reachability from the intended sources only, health checks green, failover tested, alarms in place.
7. Clean up test instances, AMIs, snapshots and Elastic IPs.

## Red flags

- `0.0.0.0/0` on SSH, RDP or database ports; bastions with shared keys instead of Session Manager.
- Private subnets reaching S3 or DynamoDB through NAT instead of endpoints.
- A single NAT gateway serving all AZs in production.
- Production data on instance store or burstable T instances.
- Hard-coded AMI IDs, secrets in user data, IMDSv1 allowed.
- Spot used for stateful work with no interruption handling.
- RDS without backups, encryption or deletion protection; expecting a Multi-AZ instance standby to serve reads.
- SQS consumers that are not idempotent, no DLQ, visibility timeout shorter than processing.
- DNS cutovers with long TTLs and no rollback record set.
- Overlapping CIDRs between VPCs and on-premises networks.

## Related

- `../WellArchitectedPillars/wellArchitectedPillars.md` - review lens for these choices.
- `../IamAndSecrets/iamAndSecrets.md` - roles, instance profiles, Organizations and secrets.
- `../S3Storage/s3Storage.md` - object storage, endpoints and events.
- `../DynamoDb/dynamoDb.md` - key-value database in depth.
- `../../Resilience/AutoScaling/autoScaling.md` - launch templates and Auto Scaling groups.
- `../../Delivery/BlueGreenDeployments/blueGreenDeployments.md` - Route 53 weighted and failover cutovers.
- `../../Monitoring/LogSources/logSources.md` - VPC Flow Logs and load balancer logs.
- `../../../Practices/InfrastructureAsCode/infrastructureAsCode.md` - platform-neutral IaC practice.
- `../../../Azure/VirtualMachines/virtualMachines.md` - Azure counterpart for VMs; syntax is not interchangeable.
- `../../../../DBA/PostgreSQL/DatabaseAdministration/databaseAdministration.md` - PostgreSQL administration for RDS or Aurora PostgreSQL (when installed).
- `../../../../DataSystems/DistributedData/Replication/replication.md` - replica lag and failover theory (when installed).
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` - message queues and delivery semantics (when installed).
