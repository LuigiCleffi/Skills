---
name: aws-well-architected-pillars
description: How to use the AWS Well-Architected Framework pillars (operational excellence, security, reliability, performance efficiency, cost optimization, plus the later sustainability pillar) as a working review checklist for AWS workloads and pipelines - operations as code, small reversible changes, runbooks and game days, post-incident learning, identity foundation and traceability, defense in depth, encryption in transit and at rest, keeping people away from data, RTO and RPO, testing recovery, horizontal scaling, service quotas, drift, benchmarking and right-sizing, serverless and managed services, tagging, chargeback, budgets, idle-resource cleanup and snapshot retention, based on Chapter 1 (Amazon Web Services Pillars) of AWS Certified DevOps Engineer - Professional (Adam Book). Use when reviewing or designing an AWS architecture, running a Well-Architected review or the AWS Well-Architected Tool, writing a runbook or post-mortem, defining RTO/RPO or a DR plan, a bill spiked or nobody knows who owns resources, choosing instance types or compute (EC2, containers, Lambda), hitting a service quota or throttling, setting up patching with Systems Manager Patch Manager, deciding tagging and multi-account strategy, or trading off cost against reliability.
---

# Well-Architected Pillars

Treat the pillars as a review checklist, not a slogan: for any AWS workload or change, walk each pillar, write down the current state and the gap, and decide explicitly which trade-off you accept (most often cost versus reliability). Every finding should end as a concrete, owned change delivered through code and a pipeline, never as a console tweak.

Current note: the book lists five pillars. AWS added a sixth, **Sustainability**, in late 2021. The free **AWS Well-Architected Tool** in the console records reviews per workload, with lenses (serverless, SaaS, and others) and a tracked improvement plan.

## How to run a review

| Pillar | Ask | Evidence to look for |
|---|---|---|
| Operational excellence | Can anyone on the team deploy, roll back and diagnose this from code and runbooks? | IaC repo, pipeline, runbooks, dashboards, post-incident actions closed |
| Security | Who and what can touch this, how would we know, and what is encrypted? | Least-privilege roles, CloudTrail, GuardDuty, KMS keys, no long-lived keys |
| Reliability | What fails, how fast do we recover, and have we proven it? | Multi-AZ, backups restored in tests, RTO/RPO written down, quotas checked |
| Performance efficiency | Is the compute and storage choice backed by measurements? | Load-test results, CloudWatch utilization, right-sizing history |
| Cost optimization | Who pays for each resource, and what is idle? | Cost allocation tags, budgets and alerts, cleanup jobs, savings plans coverage |
| Sustainability | Are we using the least resources for the result? | Utilization targets, Graviton or managed services, data retention limits |

Pillars conflict. Adding a standby region improves reliability and costs money; name the conflict and let the business owner choose with numbers in front of them.

## Operational excellence

- **Operations as code.** Infrastructure, configuration and operational procedures live in version control: CloudFormation, CDK, Terraform, SSM Automation documents, scripts using the CLI or SDK. This spreads knowledge, enables peer review and lets you test changes outside production.
- **Small, frequent, reversible changes.** Decouple components so each change has a small blast radius. Tag every release in Git; use Lambda versions and aliases, immutable AMIs or container image digests so "roll back" means redeploying a known artifact.
- **Refine operations after every event.** After deployments, test cycles, incidents and game days ask what went well, what did not, and what to change. Update runbooks: remove dead steps, add missing ones.
- **Anticipate failure.** Managed services still fail. Plan for AZ and service impairment and test the plan; an untested plan is an assumption.
- **Learn from failure.** Blameless post-mortems with tracked actions. For every incident ask whether detection or remediation could be automated.

Example: automate OS patching with Systems Manager Patch Manager. Ensure the SSM Agent runs and the instance role has `AmazonSSMManagedInstanceCore`, define patch baselines with auto-approval delays, group instances with the `Patch Group` tag (databases might get only critical patches, app servers critical plus updates), and schedule through a maintenance window. Patch non-production first.

## Security

Principles to check, in order of how often they are missing:

1. **Strong identity foundation.** Least privilege for every user and role; central identity (IAM Identity Center or a corporate IdP) instead of per-account IAM users; MFA everywhere, root locked away.
2. **Traceability.** CloudTrail in every account and region, CloudWatch Logs, VPC Flow Logs. Test: after a compromise could you name the principal, source IP, start time, changed records and affected systems?
3. **Security at every layer.** Edge (CloudFront, WAF, Shield), network (security groups, NACLs, private subnets, VPC endpoints), OS (patching, hardening), application (dependency scanning, secure coding).
4. **Automate security.** GuardDuty, AWS Config rules with remediation, Security Hub, EventBridge rules that react to findings.
5. **Protect data in transit and at rest.** TLS certificates from ACM on load balancers and CloudFront; KMS keys for storage, with rotation.
6. **Keep people away from data.** Access data through reviewed automation (SSM runbooks, Lambda functions, pipelines) rather than bastion hosts and shared credentials.
7. **Prepare for incidents.** Playbooks for isolating an instance, snapshotting volumes for forensics into a separate security account, rotating credentials. Rehearse them.

Shared responsibility: AWS secures the cloud itself; you secure what you put in it (data, identities, network rules, OS on EC2). The more managed the service (Fargate, Lambda, DynamoDB), the less you patch, but data protection and access control stay yours.

## Reliability

- Define **RTO** (maximum acceptable time to restore service) and **RPO** (maximum acceptable data loss, measured as time since the last recoverable point) with the business per workload. They drive backup frequency, replication and the DR pattern (backup and restore, pilot light, warm standby, multi-site active/active).
- **Test recovery.** Rebuild an environment from IaC and backups, time it, compare with RTO, and automate the slow steps. A backup that has never been restored is not a backup.
- **Scale horizontally.** Many small instances behind a load balancer or consuming a queue, across AZs, instead of one ever-larger machine with a hard ceiling.
- **Stop guessing capacity.** Use Auto Scaling and managed scaling. Know your **service quotas**: most are adjustable through Service Quotas, some are hard. Alarm on quota usage before a launch or a scaling event hits one.
- **Manage change through automation.** Manual changes cause drift and cannot be repeated or reviewed. Detect drift (CloudFormation drift detection, `terraform plan`, AWS Config) and fix it in code.

## Performance efficiency

- Choose the compute model by workload: instances (EC2), containers (ECS, EKS, Fargate) or functions (Lambda). Prefer managed services so the team spends time on the product rather than operating databases and queues.
- **Benchmark before committing.** Build the stack with IaC, drive load (for example from CodeBuild or a load-testing tool), collect CloudWatch metrics, swap instance types and compare utilization and cost. Keep the results with the decision.
- **Go global when needed:** parameterize templates by region so the same pattern deploys elsewhere; use CloudFront to serve a global audience from one origin.
- **Experiment cheaply:** temporary environments from IaC, torn down after the test.
- Pick technology for the workload's goals, not for familiarity or novelty.

## Cost optimization

- **Ownership first.** A mandatory tag set (for example `CostCenter`, `Owner`, `Application`, `Environment`), activated as cost allocation tags and enforced with tag policies or SCPs. Separate accounts per workload or environment under AWS Organizations attribute spend even without tags.
- **Visibility.** Cost Explorer, Cost and Usage Reports, AWS Budgets with alerts to the owning team, Cost Anomaly Detection.
- **Consumption model.** Stop non-production environments out of hours with a scheduler that respects an opt-out tag, and start them before the workday. Instance store data is lost on stop; snapshot databases before stopping.
- **Measure efficiency and decommission.** Unattached EBS volumes, idle Elastic IPs, old AMIs and snapshots, forgotten log groups without retention. Apply retention with Data Lifecycle Manager, AWS Backup plans and lifecycle rules. Delete with a scalpel: confirm owner and compliance retention first, because deleted data is gone.
- **Commitments for steady load.** Savings Plans or Reserved Instances for baseline, Spot for interruptible work.
- **Stop undifferentiated heavy lifting:** managed services cost more per hour but less in people time.

## Workflow

1. Identify the workload, its accounts, regions and owner; confirm you are looking at the right environment before reading or changing anything.
2. Walk each pillar with the table above and record evidence, not opinions; use the Well-Architected Tool to keep the review and improvement plan.
3. Agree RTO, RPO, availability and budget targets with the business owner.
4. Rank gaps by risk (security and data-loss first), and turn each into a ticket with an owner and a code change.
5. Implement through IaC and the pipeline; show the plan or change set and get approval before production or destructive changes (deleting snapshots, changing IAM, stopping instances), with a rollback path.
6. Verify: restore a backup, run a game day, re-run the load test, check the next bill.
7. Repeat the review after major changes or on a regular cadence.

## Red flags

- Root user with access keys or without MFA; IAM users with long-lived keys in CI.
- No CloudTrail, or trail logs in the same account the attacker could control.
- RTO/RPO never written down, or backups never restored.
- Production changes made in the console; drift nobody detects.
- Single-AZ production, or one large instance as the scaling plan.
- Resources without owner tags; a bill that grows with no budget alert.
- Snapshots copied to a DR region every hour with no expiry.
- Instance type chosen from habit, no load test or utilization data.
- Cost-cutting that removes the standby or backups without the business accepting the new RTO/RPO.

## Related

- `../FundamentalServices/fundamentalServices.md` - EC2, VPC, Route 53, databases, queues and Trusted Advisor that these reviews cover.
- `../IamAndSecrets/iamAndSecrets.md` - identity foundation, Organizations and secrets.
- `../S3Storage/s3Storage.md` - lifecycle, encryption and replication for data protection and cost.
- `../../Resilience/AutoScaling/autoScaling.md` - horizontal scaling and capacity.
- `../../Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` - Patch Manager, maintenance windows, Config rules.
- `../../Resilience/DataProtection/dataProtection.md` - KMS, ACM and encryption in depth.
- `../../Delivery/CloudFormation/cloudFormation.md` - operations as code and drift detection.
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` - metrics and traceability.
- `../../../Practices/WhatIsDevOps/whatIsDevOps.md` - platform-neutral DevOps principles behind these pillars.
- `../../../Practices/Monitoring/monitoring.md` - platform-neutral monitoring practice.
- `../../../Azure/AzurePlatform/azurePlatform.md` - Azure counterpart; service names and syntax are not interchangeable.
- `../../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` - reliability, scalability and maintainability in general terms (when installed).
- `../../../../CleanCode/Systems/systems.md` - separating construction from use at system scale (when installed).
- `../../../../actions/review.md` - review workflow (when installed).
