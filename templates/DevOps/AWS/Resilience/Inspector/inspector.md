---
name: aws-inspector
description: How to use Amazon Inspector for continuous vulnerability management: enabling it per account and Region or organization-wide with a delegated administrator, coverage for EC2 (SSM Agent-based and agentless snapshot scanning), ECR container images (enhanced scanning, on-push and continuous rescans) and Lambda functions and code, network reachability findings, CIS benchmark assessments, findings with severity, Inspector score and exploitability data, suppression rules, findings reports and SBOM export, EventBridge and Security Hub integration, and shifting left with the Inspector SBOM generator and inspector-scan API as a CI/CD gate before publishing a golden AMI or container image, based on Chapter 21 (Using Amazon Inspector to Check your Environment) of AWS Certified DevOps Engineer – Professional. Use when asked to scan instances, images or functions for CVEs, aws inspector2 enable, list-findings or list-coverage, an instance shows as unmanaged or not scanned, an ECR repository has no scan results, failing a build on critical vulnerabilities, generating an SBOM, building a golden AMI pipeline with EC2 Image Builder, suppressing accepted-risk findings, routing findings to tickets or Slack, meeting PCI DSS or HIPAA vulnerability scanning requirements, or migrating from Inspector Classic assessment templates and the Inspector agent.
---

# Amazon Inspector

Turn Inspector on for every account and Region you run workloads in, let it scan continuously, and act on findings by severity and exploitability through an automated path (EventBridge, Security Hub, tickets) rather than by reading reports. Then shift left: scan images and dependencies in the pipeline and fail builds on critical findings so vulnerable artifacts never reach production. Enabling Inspector is low risk, but remediation (patching, rebuilding, redeploying) changes production: confirm account, Region and environment, and follow the normal change and approval path.

Current note: the book describes Inspector Classic (Inspector agent, assessment targets, assessment templates, one-off runs of about an hour, EC2 only). That model is retired. Current Amazon Inspector needs no Inspector agent and no templates: it uses the SSM Agent or agentless snapshots for EC2, scans ECR images and Lambda functions, and rescans automatically when new CVEs are published. Move any Classic-era automation to the `inspector2` API.

## What it scans

| Resource | How | Prerequisites |
|---|---|---|
| EC2 instances | Agent-based (via SSM Agent inventory) or agentless (EBS snapshot analysis); hybrid mode uses agentless where the agent is missing | Managed node for agent-based; scan mode chosen at account level |
| ECR images | Enhanced scanning on push and continuously for a configured duration | ECR registry scanning set to enhanced |
| Lambda | Package dependencies (standard) and application code (code scanning) | Function in a supported runtime |
| Network reachability | Paths from the internet to open ports on EC2 | None beyond EC2 scanning |
| CIS benchmarks | OS configuration assessments on managed EC2 | SSM Agent, targeted by tags |

- Findings carry CVSS severity, an Inspector score adjusted for your environment (for example network reachability), and exploit availability information. Prioritise exploitable, internet-reachable, critical findings first.
- Coverage is the first thing to check: an instance not in coverage is not being scanned, and absence of findings proves nothing.

## Enable and check coverage

```bash
# organization: from the management account, delegate administration once
aws inspector2 enable-delegated-admin-account --delegated-admin-account-id 222233334444

# in the delegated admin (or a standalone account), per Region
aws inspector2 enable --resource-types EC2 ECR LAMBDA LAMBDA_CODE --region eu-west-1
aws inspector2 update-organization-configuration \
  --auto-enable ec2=true,ecr=true,lambda=true,lambdaCode=true --region eu-west-1

aws inspector2 list-coverage --region eu-west-1 \
  --filter-criteria '{"scanStatusCode":[{"comparison":"NOT_EQUALS","value":"ACTIVE"}]}'
```

- Unscanned EC2 usually means the node is not managed by Systems Manager (agent, `AmazonSSMManagedInstanceCore`, endpoints) or the OS is unsupported; agentless or hybrid mode closes gaps.
- Enable in every Region where you run anything, including DR Regions; Inspector is regional.

## Triage and suppression

```bash
aws inspector2 list-findings --region eu-west-1 --filter-criteria '{
  "severity":[{"comparison":"EQUALS","value":"CRITICAL"}],
  "findingStatus":[{"comparison":"EQUALS","value":"ACTIVE"}],
  "resourceTags":[{"comparison":"EQUALS","key":"Environment","value":"prod"}]}'

aws inspector2 create-filter --action SUPPRESS --name accepted-dev-sandbox \
  --reason "RISK-88: sandbox accounts, accepted until 2027-01-31" \
  --filter-criteria '{"resourceTags":[{"comparison":"EQUALS","key":"Environment","value":"sandbox"}]}'
```

- Suppress only with a recorded reason, owner and review date; suppression hides findings from every downstream consumer.
- Export reports and SBOMs to S3 (`create-findings-report`, `create-sbom-export`) with a KMS key for audit evidence (PCI DSS, HIPAA): they show what was found and when it was closed.
- Findings close automatically when a rescan no longer detects the issue; verify closure that way rather than marking things fixed by hand.

## Route findings to action

```json
{
  "source": ["aws.inspector2"],
  "detail-type": ["Inspector2 Finding"],
  "detail": {
    "severity": ["CRITICAL", "HIGH"],
    "status": ["ACTIVE"]
  }
}
```

- An EventBridge rule with this pattern can open tickets, notify on-call, or start an SSM Automation runbook (for example run `AWS-RunPatchBaseline` on staging first).
- Send findings to Security Hub for a single prioritised view next to GuardDuty, Macie and Config.
- Patch by rebuilding: fix the base image or dependency, rebuild, redeploy through the pipeline; in-place patching is for long-lived hosts only.

## Shift left in CI/CD

Scan the artifact before it is published, using the SBOM generator and the `inspector-scan` API (or the AWS-provided CI plugins and GitHub Action that wrap them):

```bash
inspector-sbomgen container --image orders-api:1.14.0 -o sbom.json
aws inspector-scan scan-sbom --sbom file://sbom.json \
  --output-format CYCLONE_DX_1_5 > scan.json

critical=$(jq '[.vulnerabilities[]?.ratings[]? | select(.severity=="critical")] | length' scan.json)
if [ "$critical" -gt 0 ]; then echo "Blocking: $critical critical vulnerabilities"; exit 1; fi
```

- Gate on CRITICAL (and usually HIGH with a known exploit); report the rest so the threshold can tighten over time.
- For golden AMIs, use EC2 Image Builder with Inspector scanning in the test stage; only distribute images that pass, and version every image.
- The CI role needs only `inspector-scan:ScanSbom`; use OIDC federation from the CI system rather than long-lived access keys.
- Keep scanning after release: production images and instances need continuous scanning because new CVEs appear for unchanged code.

## Workflow
1. Confirm accounts, Regions and environments in scope; check current status with `aws inspector2 batch-get-account-status`.
2. Delegate administration in the organization and enable EC2, ECR and Lambda scanning with auto-enable for new accounts.
3. Close coverage gaps: SSM prerequisites, scan mode (hybrid), ECR enhanced scanning.
4. Wire EventBridge rules and Security Hub so critical and high findings reach owners automatically.
5. Add SBOM-based scanning as a pipeline gate before images and AMIs are published.
6. Remediate by rebuilding and redeploying through the normal approved pipeline; confirm closure by rescan.
7. Review suppression rules and accepted risks on a schedule; export reports for audits.

## Red flags
- Inspector enabled in one Region while workloads run in others.
- No one checks coverage; unmanaged instances silently unscanned.
- Suppression rules without reason, owner or expiry.
- Findings only in the console, with no routing to owners.
- Pipelines that publish images before scanning, or ignore scan failures.
- Long-lived CI access keys used to call Inspector.
- Treating "zero findings" from a single one-off scan as proof of safety.
- Automation still built on Inspector Classic assessment templates and the old agent.

## Related
- `../SystemsManagerAndConfig/systemsManagerAndConfig.md` — managed nodes, Run Command and Patch Manager used for EC2 scanning and remediation.
- `../PolicyAndStandards/policyAndStandards.md` — Security Hub aggregation, GuardDuty and Macie.
- `../AutoScaling/autoScaling.md` — rolling patched AMIs through Auto Scaling groups.
- `../../Delivery/CiCdAndSdlc/ciCdAndSdlc.md` — where the scan gate sits in the pipeline.
- `../../Delivery/CodeCommitAndCodeBuild/codeCommitAndCodeBuild.md` — running the scan in a build stage.
- `../../Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — EventBridge rules for findings.
- `../../../Practices/DeliveryPipeline/deliveryPipeline.md` — platform-neutral pipeline gates; AWS syntax does not carry over to Azure tooling.
- `../../../Practices/ContinuousIntegration/continuousIntegration.md` — failing the build fast.
- `../../../../actions/dev.md` — development workflow these gates protect (when installed).
