---
name: aws-systems-manager-and-config
description: How to operate fleets and enforce standards with AWS Systems Manager (SSM Agent, managed nodes, AmazonSSMManagedInstanceCore, Default Host Management Configuration, hybrid activations, Fleet Manager, Inventory, Session Manager instead of SSH keys, Run Command with rate controls, SSM documents, State Manager associations, Patch Manager baselines and maintenance windows, Automation runbooks) and how to record and evaluate configuration with AWS Config (configuration recorder, delivery channel, configuration items, history, snapshots, relationships, managed and custom rules, change-triggered and periodic evaluation, proactive mode, conformance packs, aggregators, advanced queries, automatic remediation with SSM Automation), based on Chapter 20 (Enforcing Standards and Compliance with Systems Manager's Role and AWS Config) of AWS Certified DevOps Engineer – Professional. Use when an instance does not appear as a managed node or in Session Manager, replacing bastions and port 22 with aws ssm start-session, running a command on many instances by tag with aws ssm send-command, writing an SSM document or runbook, patching a fleet within a compliance deadline, AWS-RunPatchBaseline, inventory reports of installed software or OS versions, enabling AWS Config, put-configuration-recorder, a Config rule showing NON_COMPLIANT, detecting unencrypted EBS volumes or security groups open to 0.0.0.0/0, auto-remediating drift, conformance packs, multi-account compliance views, or migrating off OpsWorks.
---

# Systems Manager and AWS Config

Use Systems Manager to act on machines (access, commands, patching, inventory) through IAM instead of SSH keys, and AWS Config to record what every resource looks like over time and evaluate it against rules. Together they detect drift and fix it, but every Run Command, patch run, association and auto-remediation changes live systems: confirm account, Region and environment, target by explicit tags, test on non-production first, use rate controls, and get approval before running against production or enabling automatic remediation.

## Making nodes manageable

A node shows up in Fleet Manager and Session Manager only when all three hold:

1. **SSM Agent** installed and running (preinstalled on Amazon Linux, recent Ubuntu, Windows Server AMIs; install it in custom golden images).
2. **Permissions**: an instance profile with the `AmazonSSMManagedInstanceCore` managed policy, or Default Host Management Configuration enabled for the account and Region.
3. **Network path** to the `ssm`, `ssmmessages` and `ec2messages` endpoints: a NAT route, or interface VPC endpoints for private subnets.

```bash
aws ssm describe-instance-information \
  --query 'InstanceInformationList[].[InstanceId,PingStatus,PlatformName,AgentVersion]' --output table
```

- On-premises or other-cloud servers: create a **hybrid activation** (`aws ssm create-activation` with a service role), register the agent with the activation code and ID, and treat the code as a secret.
- Tag nodes consistently (`Environment`, `Role`, `PatchGroup`); every targeting decision below depends on tags.

Current note: the `AmazonEC2RoleforSSM` policy used in the book is deprecated and overly broad; use `AmazonSSMManagedInstanceCore`, plus separate scoped policies for S3 output buckets or CloudWatch logs. New images should use Amazon Linux 2023 rather than Amazon Linux 2 (check the current AL2 end-of-support date); AL2023, which has no `amazon-linux-extras` (use `dnf`).

## Access without SSH

Session Manager gives an audited shell through IAM, with no inbound port 22, no bastion and no key pairs to rotate.

```bash
aws ssm start-session --target i-0abc123
aws ssm start-session --target i-0abc123 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["orders-db.internal"],"portNumber":["5432"],"localPortNumber":["15432"]}'
```

- Restrict `ssm:StartSession` by resource tag (for example only `Environment=staging` for developers) and grant `ssm:TerminateSession` only on the caller's own sessions.
- Turn on session logging to CloudWatch Logs or S3 with KMS encryption, and set the run-as user instead of the shared `ssm-user` where accountability matters.
- Remove security group rules for port 22 once Session Manager works.

## Run Command, documents and State Manager

```bash
aws ssm send-command --document-name AWS-RunShellScript \
  --targets Key=tag:Role,Values=web Key=tag:Environment,Values=staging \
  --parameters 'commands=["systemctl restart nginx","systemctl is-active nginx"]' \
  --max-concurrency 10% --max-errors 1 \
  --output-s3-bucket-name ops-command-output --comment "CHG-1234 nginx restart"
aws ssm list-command-invocations --command-id <id> --details
```

- Always set `--max-concurrency` and `--max-errors`; target by tags, never "all instances", and run the same command on staging first.
- Put recurring scripts in a versioned custom **document** (command schema 2.2) stored in IaC, not pasted into the console:

```yaml
schemaVersion: "2.2"
description: Rotate application logs and report disk usage
parameters:
  LogDir: { type: String, default: /var/log/orders }
mainSteps:
  - action: aws:runShellScript
    name: rotateLogs
    inputs:
      runCommand:
        - "find {{ LogDir }} -name '*.log' -mtime +7 -exec gzip {} \\;"
        - "df -h /"
```

- **State Manager associations** apply a document on a schedule to keep nodes in a desired state (agents installed, config files present); they are continuous drift correction, so review them like code.
- Never put secrets in command parameters (they are visible in history and CloudTrail); have the script read `{{ssm:...}}` parameters or fetch from Secrets Manager.

## Patching

- **Patch Manager** with patch baselines (auto-approval delay, severity classification, rejected patches) and `AWS-RunPatchBaseline` (`Operation=Scan` to report, `Install` to apply).
- Schedule installs in **maintenance windows** per patch group, staging before production, with rate controls and a reboot option chosen deliberately.
- Patch policies in Quick Setup can manage this across accounts and Regions in an organization.
- Prefer immutable infrastructure where possible: rebuild AMIs (EC2 Image Builder) and roll the Auto Scaling group instead of patching long-lived instances in place.

## Automation runbooks

Automation documents (`AWS-StopEC2Instance`, `AWS-CreateSnapshot`, your own) run multi-step operational tasks with an assume role, approvals (`aws:approve` step) and rate control. They are the standard target for Config remediation, EventBridge rules and incident response.

## AWS Config

| Concept | Meaning |
|---|---|
| Configuration recorder | What to record (all supported types or a list) and how often (continuous or daily) |
| Delivery channel | S3 bucket for history and snapshots, optional SNS topic |
| Configuration item | Point-in-time attributes, relationships and related events of one resource |
| History / timeline | Sequence of items for a resource; answers "who changed this and when" with CloudTrail |
| Rule | Desired state; evaluated on change, periodically, or proactively before deployment |
| Conformance pack | Versioned bundle of rules and remediations deployed as one unit |
| Aggregator | Multi-account, multi-Region compliance view |

- Enable the recorder in every account and Region you use, ideally via IaC or organization-wide tooling, so it can be torn down or audited cleanly. Recording costs per item: exclude noisy types or use daily recording where continuous history is not needed.
- **Managed rules** cover common controls (`ENCRYPTED_VOLUMES`, `INCOMING_SSH_DISABLED`, `S3_BUCKET_SSL_REQUESTS_ONLY`, `ROOT_ACCOUNT_MFA_ENABLED`, `RESTRICTED_INCOMING_TRAFFIC`). **Custom rules** use Lambda or Guard policy syntax for organization-specific checks.
- **Proactive** evaluation checks a resource definition before it is created (for example from CloudFormation hooks); detective evaluation checks what exists.
- Use advanced queries (SQL over current configuration) for inventory questions across accounts.

```yaml
EncryptedVolumesRule:
  Type: AWS::Config::ConfigRule
  Properties:
    ConfigRuleName: encrypted-volumes
    Source: { Owner: AWS, SourceIdentifier: ENCRYPTED_VOLUMES }
    Scope: { ComplianceResourceTypes: ["AWS::EC2::Volume"] }

OpenSshRemediation:          # attaches to a restricted-ssh rule (INCOMING_SSH_DISABLED)
  Type: AWS::Config::RemediationConfiguration
  Properties:
    ConfigRuleName: restricted-ssh
    TargetType: SSM_DOCUMENT
    TargetId: AWS-DisablePublicAccessForSecurityGroup
    Parameters:
      AutomationAssumeRole: { StaticValue: { Values: [!GetAtt RemediationRole.Arn] } }
      GroupId: { ResourceValue: { Value: RESOURCE_ID } }
    Automatic: false
    MaximumAutomaticAttempts: 3
    RetryAttemptSeconds: 60
```

- Start remediations as manual (`Automatic: false`), review what they would change, and switch to automatic only for reversible, well-scoped fixes. Never auto-delete or terminate resources (for example an unencrypted volume) from a rule; notify, tag, isolate or snapshot instead.
- Route compliance changes (`Config Rules Compliance Change` events) through EventBridge to SNS, a ticket queue or Security Hub.

Current note: AWS OpsWorks reached end of life in May 2024; Systems Manager (State Manager, Automation, Distributor) with CloudFormation or CDK is the usual replacement for OpsWorks configuration management.

## Workflow
1. Confirm account, Region and environment; check which nodes are managed and whether Config is already recording (`describe-configuration-recorder-status`).
2. Fix prerequisites: agent in images, `AmazonSSMManagedInstanceCore` or Default Host Management Configuration, VPC endpoints, consistent tags.
3. Replace SSH with Session Manager, with logging and tag-scoped IAM; then close port 22.
4. Define documents, associations, patch baselines, maintenance windows and Config rules in IaC; review the change set or plan and get approval for production.
5. Run commands and patches on staging, then production in waves with rate controls and output to S3 or CloudWatch.
6. Enable rules in detective mode, review findings, then add manual remediations; promote to automatic only for safe, reversible fixes.
7. Aggregate compliance across accounts and alert on NON_COMPLIANT changes and failed remediation.

## Red flags
- Bastion hosts and port 22 open to the internet while Session Manager is available.
- Run Command targeting all instances, without rate controls, straight in production.
- Secrets in command parameters, document text or session transcripts.
- Instance profiles with `AmazonEC2RoleforSSM` or admin policies.
- Config recorder off in some Regions, or turned off to save cost without a decision.
- Automatic remediation that terminates or deletes resources.
- Patch baselines that auto-approve immediately for production with forced reboots.
- Console-created associations and rules that no one tracks in code.

## Related
- `../Inspector/inspector.md` — vulnerability findings on the same managed nodes (Inspector uses the SSM Agent).
- `../PolicyAndStandards/policyAndStandards.md` — Security Hub controls built on Config, GuardDuty, guardrails.
- `../DataProtection/dataProtection.md` — encryption controls these rules check.
- `../AutoScaling/autoScaling.md` — immutable replacement instead of in-place patching.
- `../../Delivery/OpsWorks/opsWorks.md` — legacy service these capabilities replace.
- `../../Delivery/CloudFormation/cloudFormation.md` — deploying rules, conformance packs and documents as stacks.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — Parameter Store, Secrets Manager, scoped roles.
- `../../Monitoring/EnterpriseLogging/enterpriseLogging.md` — central storage for session logs and Config history.
- `../../../Practices/ConfigurationManagement/configurationManagement.md` — platform-neutral configuration management (Puppet era); AWS syntax does not carry over.
- `../../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — desired state and drift as general practice.
- `../../../Azure/VirtualMachines/virtualMachines.md` — Azure counterpart; not interchangeable.
- `../../../../actions/review.md` — reviewing runbooks and rules like code (when installed).
