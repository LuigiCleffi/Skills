---
name: aws-policy-and-standards
description: How to detect threats and enforce security standards across AWS accounts with Amazon GuardDuty (foundational sources CloudTrail, VPC Flow Logs and DNS logs, protection plans for S3, EKS, runtime, malware, RDS and Lambda, finding types and severity, trusted IP and threat lists, suppression rules, delegated administrator), AWS Security Hub (aggregated findings in ASFF, security standards such as AWS Foundational Security Best Practices and CIS, cross-Region aggregation, automation rules), Amazon Macie (sensitive data discovery in S3, managed and custom data identifiers, policy and sensitive data findings), IAM Access Analyzer, preventive guardrails with Organizations service control policies, automated response through EventBridge, and migrating servers with AWS Application Migration Service, based on Chapter 22 (Other Policy and Standards Services to Know) of AWS Certified DevOps Engineer – Professional. Use when enabling GuardDuty, Security Hub or Macie in an organization, a GuardDuty finding such as CryptoCurrency:EC2/BitcoinTool, UnauthorizedAccess or Stealth:IAMUser/CloudTrailLoggingDisabled, responding to a compromised instance or leaked access key, someone disabled CloudTrail, building an EventBridge rule on findings, finding PII or credentials in S3 buckets, a Security Hub control failing, preventing anyone from turning off security services, checking for resources shared outside the account, or planning a lift-and-shift migration of VMware, Hyper-V or Azure VMs.
---

# Threat Detection, Data Discovery and Guardrails

Run three layers in every account and Region, managed centrally from a delegated security account: preventive guardrails (SCPs, permission boundaries) that stop dangerous actions, detective services (GuardDuty for threats, Macie for sensitive data, Config and Security Hub for posture) that find what got through, and automated response through EventBridge. Response actions (isolating instances, revoking credentials, changing SCPs) affect production directly: confirm account, Region and environment, preserve evidence before changing anything, and get explicit approval unless the action is a pre-approved runbook step.

## Organization setup

- Designate a security tooling account as **delegated administrator** for GuardDuty, Security Hub, Macie, Inspector and Config aggregation; turn on auto-enable for new member accounts.
- Enable in **every Region**, including unused ones (attackers launch resources where nobody looks), or block unused Regions with an SCP.
- Detection starts when you enable a service; nothing is reported retroactively for earlier events. Enable on day one of an account.

## Amazon GuardDuty

- Foundational sources need no setup on your side: CloudTrail management events, VPC Flow Logs and Route 53 Resolver DNS logs are read from AWS's own copies, so you do not have to enable flow logs for GuardDuty (you still want your own for investigation).
- **Protection plans** extend coverage: S3 Protection (S3 data events), EKS Protection, Runtime Monitoring (agent for EC2, ECS, EKS), Malware Protection (EBS scan on suspicious findings, and for new S3 objects), RDS Protection (login anomalies), Lambda Protection (network activity). Enable those that match workloads.
- Finding types read `ThreatPurpose:ResourceType/ThreatFamily`, for example `CryptoCurrency:EC2/BitcoinTool.B!DNS`, `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS`, `Stealth:IAMUser/CloudTrailLoggingDisabled`. Severity is numeric: 7.0 and above is high.
- **Trusted IP lists** stop findings for your own scanners; **threat lists** add your intel feeds; **suppression rules** archive known-benign patterns (for example an approved penetration test). Keep each scoped and documented.

```json
{
  "source": ["aws.guardduty"],
  "detail-type": ["GuardDuty Finding"],
  "detail": { "severity": [{ "numeric": [">=", 7] }] }
}
```

### Responding to a finding

1. Confirm the finding, account, Region and resource; check it is not a known test or trusted source.
2. **Preserve evidence first**: snapshot EBS volumes, capture instance metadata and memory if your process requires it, export relevant CloudTrail and flow logs.
3. **Contain**: move a compromised instance to an isolation security group with no inbound and restricted outbound, detach it from the load balancer or Auto Scaling group (`enter-standby` or `detach-instances`) rather than terminating it.
4. **Credentials**: for an exposed access key, deactivate it, review CloudTrail for its use, and remove anything it created; for an instance role, revoke active sessions (the IAM console's revoke sessions adds a deny on tokens issued before now).
5. Eradicate and recover through the pipeline (rebuild from a clean image), then record what happened and tune guardrails.

Automate steps 2–3 with an SSM Automation runbook triggered from EventBridge only after it has been tested and approved; keep a human approval step for anything destructive.

## AWS Security Hub

- Aggregates findings from GuardDuty, Inspector, Macie, IAM Access Analyzer, Config, Firewall Manager and partner tools in one format (ASFF), across accounts and, with a home aggregation Region, across Regions.
- Runs **security standards** as automated controls: AWS Foundational Security Best Practices, CIS AWS Foundations Benchmark, PCI DSS, NIST SP 800-53. Most controls rely on AWS Config, so Config recording must be on.
- Use central configuration to apply standards and disable irrelevant controls consistently; use **automation rules** to set severity, suppress or assign findings by criteria.
- Track the security score per standard; treat a falling score as a signal to review recent changes.

## Amazon Macie

- Discovers sensitive data in S3 (PII, financial data, credentials) with managed data identifiers, plus custom identifiers (regex with keywords) for your own formats and allow lists for known test data.
- Evaluates bucket inventory and posture continuously: public buckets, buckets shared with other accounts, unencrypted buckets (**policy findings**).
- **Automated sensitive data discovery** samples across the estate at low cost; **classification jobs** scan chosen buckets fully, one-off or scheduled. Start with automated discovery, then target jobs at buckets it flags.
- Macie is regional; findings go to EventBridge and Security Hub. Store discovery results in an S3 bucket encrypted with a KMS key that Macie can use.
- The Macie service role reads object contents: scope jobs deliberately and protect its results, which themselves point to sensitive data.

Current note: the book's "basic and predictive alerts" belong to Macie Classic, which was replaced by the current Macie in 2020 and has since been retired.

## Access Analyzer and preventive guardrails

- **IAM Access Analyzer** is its own service (not part of GuardDuty): external access findings show resources (S3, KMS keys, IAM roles, Lambda, SQS, Secrets Manager and more) shared outside your account or organization; unused access findings show stale roles, keys and permissions. Policy validation checks policies before deployment.
- **Service control policies** stop even administrators in member accounts from disabling security services:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "ProtectSecurityServices",
    "Effect": "Deny",
    "Action": [
      "cloudtrail:StopLogging", "cloudtrail:DeleteTrail", "cloudtrail:UpdateTrail",
      "guardduty:DeleteDetector", "guardduty:DisassociateFromAdministratorAccount",
      "config:StopConfigurationRecorder", "config:DeleteConfigurationRecorder",
      "securityhub:DisableSecurityHub", "macie2:DisableMacie"
    ],
    "Resource": "*",
    "Condition": { "ArnNotLike": { "aws:PrincipalArn": "arn:aws:iam::*:role/SecurityBreakGlass" } }
  }]
}
```

- Test SCPs on a sandbox OU first; a wrong deny can lock out deployments organization-wide. Attach to production OUs only after approval, and keep a break-glass path.
- Combine with permission boundaries for delegated role creation and Config rules that detect what SCPs cannot prevent.

## Migration tooling

- **AWS Application Migration Service (MGN)** replicates servers (physical, VMware, Hyper-V, other clouds) continuously at block level into a staging area, then launches test and cutover instances; it supports an agentless option for vCenter. You still design the target VPC, IAM, security groups and scaling; migrated servers need the same Systems Manager, Inspector and encryption baseline as everything else.
- **AWS DMS** for databases, **DataSync** for online file transfer, Snowball devices for offline bulk data.

Current note: AWS Server Migration Service (SMS) was discontinued in 2022 and CloudEndure Migration was replaced by Application Migration Service; use MGN for new lift-and-shift work.

## Workflow
1. Confirm the organization structure, the security tooling account and Regions in use; check which services are already enabled per account.
2. Delegate administration; enable GuardDuty (with relevant protection plans), Security Hub with chosen standards, Macie automated discovery, Access Analyzer, and Config everywhere, with auto-enable.
3. Apply SCPs protecting these services, tested on a sandbox OU and approved for production.
4. Route high-severity findings through EventBridge to on-call, tickets and tested response runbooks.
5. Triage the initial backlog: real issues first (public data, exposed keys, exploitable findings), then tune suppression and trusted lists with documented reasons.
6. Rehearse incident response (a simulated GuardDuty finding via `create-sample-findings`) and fix gaps.
7. Review security scores, suppressions and SCP exceptions on a schedule.

## Red flags
- Security services enabled in only some accounts or Regions.
- Member account admins able to stop CloudTrail, GuardDuty or Config.
- Findings with no owner, or only visible in a console nobody watches.
- Terminating a compromised instance before capturing evidence.
- Broad suppression rules or trusted IP lists covering whole networks.
- Macie results bucket unencrypted or readable by many principals.
- Leaked access keys rotated without reviewing what they did.
- Credentials or finding details containing secrets pasted into chat or tickets.
- New migrations planned on SMS or CloudEndure.

## Related
- `../Inspector/inspector.md` — vulnerability findings that feed Security Hub.
- `../SystemsManagerAndConfig/systemsManagerAndConfig.md` — Config rules behind Security Hub controls, Automation runbooks for response.
- `../DataProtection/dataProtection.md` — encryption controls Macie and Security Hub check.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — IAM policies, permission boundaries, key rotation.
- `../../Monitoring/LogSources/logSources.md` — CloudTrail and VPC Flow Logs for investigation.
- `../../Monitoring/EnterpriseLogging/enterpriseLogging.md` — central log archive for evidence.
- `../../Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — EventBridge rules for findings.
- `../../Fundamentals/WellArchitectedPillars/wellArchitectedPillars.md` — security pillar.
- `../../../Practices/AdvancedTopics/advancedTopics.md` — platform-neutral security practice; AWS service syntax does not carry over to Azure.
- `../../../../CleanCode/Boundaries/boundaries.md` — treating third-party integrations as boundaries (when installed).
