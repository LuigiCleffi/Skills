## AI Skills

Before creating or changing AWS resources, building a pipeline or deployment
on AWS, or setting up monitoring, logging, scaling, or security controls on
AWS, find the skills that apply to the task in the tables below and read
them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of *AWS Certified DevOps Engineer –
Professional: Certification and Beyond* (Adam Book, Packt, 2021), grouped by
the book's sections. The skills keep the practice and leave out exam
material. Several services have changed since the book (OpsWorks reached
end of life, CodeCommit closed to new customers, Inspector Classic was
replaced, CloudWatch Events became EventBridge); the skills carry a short
"Current note" where that matters. Check current AWS documentation for
exact quotas and API options. For platform-neutral practice, also read
`../Practices/README.md`.

### Fundamentals (Section 1)

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./Fundamentals/WellArchitectedPillars/wellArchitectedPillars.md` | Reviewing a workload against the Well-Architected pillars, setting RTO/RPO, runbooks or post-mortems, tagging and cost control, cost vs reliability trade-offs. |
| 2 | `./Fundamentals/FundamentalServices/fundamentalServices.md` | Setting up CLI profiles, EC2, AMIs and EBS, VPC subnets, security groups, endpoints, Route 53 routing, RDS/Aurora, SNS/SQS, Trusted Advisor. |
| 3 | `./Fundamentals/IamAndSecrets/iamAndSecrets.md` | Writing IAM or SCP policies, debugging AccessDenied, cross-account roles, CI through OIDC, Identity Center, Secrets Manager vs Parameter Store, Cognito. |
| 4 | `./Fundamentals/S3Storage/s3Storage.md` | Creating or securing buckets, S3 403s, storage classes and lifecycle, encryption, events, Batch Operations, replication, versioning and Object Lock. |
| 5 | `./Fundamentals/DynamoDb/dynamoDb.md` | Designing DynamoDB keys and indexes, throttling, query vs scan, Streams to Lambda, global tables, DAX, per-user IAM, PITR and alarms. |

### Delivery (Section 2)

| Ch | Skill | Use when |
|---|---|---|
| 6 | `./Delivery/CiCdAndSdlc/ciCdAndSdlc.md` | Designing CI/CD on AWS: SDLC stages, continuous delivery vs deployment, branching, testing gates, and choosing among AWS developer tools. |
| 7 | `./Delivery/CloudFormation/cloudFormation.md` | Writing or deploying CloudFormation, SAM or CDK: change sets, drift, nested stacks, StackSets, parameters and exports, stack policies, rollbacks. |
| 8 | `./Delivery/CodeCommitAndCodeBuild/codeCommitAndCodeBuild.md` | Hosting source for AWS pipelines or writing `buildspec.yml`: CodeBuild environments, caching, artifacts, reports, secrets, and CodeCommit migration. |
| 9 | `./Delivery/CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` | Writing `appspec.yml`, CodeDeploy deployment configs and hooks, automatic rollback, or CodePipeline stages, approvals and cross-account deploys. |
| 10 | `./Delivery/OpsWorks/opsWorks.md` | Migrating legacy OpsWorks stacks, layers or Chef/Puppet setups to Systems Manager, CloudFormation/CDK, CodeDeploy, Beanstalk or ECS after end of life. |
| 11 | `./Delivery/ElasticBeanstalk/elasticBeanstalk.md` | Deploying or configuring Elastic Beanstalk: eb CLI, `.ebextensions`, deployment policies, worker tier, health, IAM roles, secrets. |
| 12 | `./Delivery/LambdaDeployments/lambdaDeployments.md` | Packaging, versioning or releasing Lambda with aliases and SAM canaries; invocation and retries; quotas; Step Functions orchestration. |
| 13 | `./Delivery/BlueGreenDeployments/blueGreenDeployments.md` | Zero-downtime blue/green or canary releases on AWS: Route 53, ALB weights, Auto Scaling, ECS, Beanstalk swap, Lambda, schema changes. |

### Monitoring and Logging (Section 3)

| Ch | Skill | Use when |
|---|---|---|
| 14 | `./Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` | Installing the CloudWatch agent, log retention or metric filters, building alarms, or tracing Lambda and microservices with X-Ray or OpenTelemetry. |
| 15 | `./Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` | Choosing service metrics, publishing custom or high-resolution KPIs, building or sharing dashboards, streaming metrics, or writing EventBridge rules. |
| 16 | `./Monitoring/LogSources/logSources.md` | Auditing who changed what with CloudTrail, analyzing load balancer access logs, or debugging blocked traffic and scans with VPC Flow Logs. |
| 17 | `./Monitoring/EnterpriseLogging/enterpriseLogging.md` | Centralizing logs across accounts with Firehose and Kinesis, OpenSearch search, Athena SQL over S3, or QuickSight dashboards for business users. |

### High Availability, Security and Compliance (Section 4)

| Ch | Skill | Use when |
|---|---|---|
| 18 | `./Resilience/AutoScaling/autoScaling.md` | Creating or tuning an EC2 Auto Scaling group: scaling policies, health checks, instance refresh, scale-in protection, lifecycle hooks, flapping. |
| 19 | `./Resilience/DataProtection/dataProtection.md` | Encrypting data at rest and in transit: KMS keys and key policies, rotation, S3/EBS/RDS encryption, ACM certificates, enforcing HTTPS. |
| 20 | `./Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` | Managing fleets with Systems Manager (Session Manager, Run Command, patching) and checking compliance with AWS Config rules and remediation. |
| 21 | `./Resilience/Inspector/inspector.md` | Scanning EC2, ECR images and Lambda for CVEs with Amazon Inspector, triaging findings, and failing CI builds on critical vulnerabilities. |
| 22 | `./Resilience/PolicyAndStandards/policyAndStandards.md` | Enabling GuardDuty, Security Hub and Macie across an organization, responding to findings, SCP guardrails, and server migration with MGN. |

The book's exam overview and practice exam chapters are not skills.

# Context for AI: Working on AWS

## 1. Know Which Account and Region You Are In

Run `aws sts get-caller-identity` and confirm the region before anything
else. Pass `--profile` and `--region` explicitly in scripts and pipelines;
never rely on the default profile pointing at the intended environment.

## 2. Infrastructure as Code, Through a Pipeline

Define resources in CloudFormation, SAM, CDK, or Terraform and deploy them
through a pipeline. Console changes cause drift; when one is unavoidable,
record it and reconcile the code afterward.

## 3. Preview Before You Deploy

Create and read a change set (`aws cloudformation deploy
--no-execute-changeset`, `cdk diff`, `terraform plan`) and look for
replacements and deletions before executing. Protect stateful resources
with `DeletionPolicy: Retain` or `Snapshot`, termination protection, and
stack policies.

## 4. Roles, Not Keys

Use IAM roles for compute and OIDC federation for CI; do not create
long-lived access keys. Keep secrets in Secrets Manager or Parameter Store
`SecureString`. Write least-privilege policies scoped to specific resource
ARNs, and use SCPs and permissions boundaries as guardrails.

## 5. Destructive and Hard-to-Reverse Operations

Deleting stacks, buckets, tables, databases, or KMS keys, changing IAM, SCPs,
security groups, routes, or DNS, production deployments, scaling changes,
and auto-remediation rules that stop or delete resources need explicit
approval for the specific target. Enable versioning, point-in-time recovery,
and backups on production data, and state how to verify and roll back.
