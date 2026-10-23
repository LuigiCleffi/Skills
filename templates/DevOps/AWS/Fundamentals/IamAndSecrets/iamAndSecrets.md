---
name: aws-iam-and-secrets
description: How to control access and handle secrets on AWS - shared responsibility, authentication versus authorization, principals, IAM users, groups, roles and instance profiles, identity-based and resource-based policies, permissions boundaries, session policies, service control policies, policy evaluation (explicit deny, implicit deny), RBAC versus ABAC with tags, cross-account AssumeRole and external IDs, STS temporary credentials, SAML and OIDC federation, IAM Identity Center (formerly AWS SSO), AWS Directory Service (Managed Microsoft AD, AD Connector, Simple AD), AWS Organizations OUs, Secrets Manager with rotation, SSM Parameter Store SecureString, and Amazon Cognito user pools and identity pools, based on Chapter 3 (Identity and Access Management and Working with Secrets in AWS) of AWS Certified DevOps Engineer - Professional (Adam Book). Use when writing or reviewing an IAM policy, an AccessDenied or "is not authorized to perform" error, setting up cross-account deployment roles, removing long-lived access keys from CI (GitHub Actions OIDC), choosing Secrets Manager or Parameter Store, rotating a database password, writing an SCP guardrail, onboarding users with Identity Center or Active Directory, scoping a permissions boundary for developers, or adding sign-in to an app with Cognito.
---

# IAM and Secrets

Every principal gets the least privilege it needs, through temporary credentials, and every secret lives in a managed store that code fetches at runtime. Humans federate in through a central identity provider and assume roles; workloads use roles (instance profiles, task roles, execution roles, OIDC); long-lived access keys are the exception you justify and rotate, not the default.

IAM, SCP and secret changes are security-sensitive production changes: confirm the account and environment, show the policy diff (and IAM Access Analyzer validation) before applying, get explicit approval, keep the previous policy version to roll back, and never paste secret values, access keys or tokens into code, logs, tickets or chat.

## Shared responsibility and terms

- AWS secures the cloud (facilities, hardware, hypervisor, managed service internals). You secure what you put in it: identities and permissions, data and its encryption, network rules, and the guest OS on EC2. With Fargate, Lambda and managed databases AWS takes the OS, but data and access remain yours.
- **Authentication** proves who you are (password + MFA, signed request with keys, session token). **Authorization** decides what you may do (policies evaluated per request).
- **Principal:** the root user, an IAM user, or an assumed role session (including federated users and AWS services) making a request. **Resource:** the thing acted on, identified by ARN.

## Identities

- **Root user:** MFA, no access keys, used only for the handful of tasks that require it; alarm on its use.
- **IAM users:** avoid for humans in multi-account setups; use Identity Center. Where unavoidable (legacy tool), enforce MFA, at most two keys, rotation, and alerts on key age.
- **Groups:** attach permissions to groups, not users. Groups cannot nest; users can be in several.
- **Roles:** no long-term credentials; assumed for a session through STS. Use for EC2 (via an **instance profile**, one role each), Lambda, ECS tasks, CodeBuild, cross-account access and third parties (with an `sts:ExternalId` condition to prevent the confused-deputy problem).

Current note: AWS SSO was renamed **IAM Identity Center** (2022). The default IAM user quota is 5,000 per account, not 500 as the book states; federation is still the better answer at scale.

## Policies and evaluation

Policy types: identity-based (on users, groups, roles), resource-based (bucket, key, queue, topic, secret policies; can grant cross-account), permissions boundaries (ceiling for an identity), SCPs and resource control policies (ceiling for accounts in an organization), session policies (ceiling for one session), and ACLs (legacy, avoid).

Evaluation, in order:
1. Everything is implicitly denied by default.
2. An explicit `Deny` in any applicable policy wins.
3. SCPs, permissions boundaries and session policies only **limit**; they never grant. The action must be allowed by each of them that applies.
4. Within those limits, an `Allow` in an identity-based or resource-based policy grants access.

Current note: the book says SCPs, boundaries and session policies can grant access; they cannot. They set the maximum, and a separate identity or resource policy must still allow the action. SCPs also do not restrict the organization's management account.

Write narrow policies: specific actions, specific ARNs, conditions.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "ReadWriteReportsPrefix",
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::acme-prod-reports/team-a/*",
    "Condition": {"StringEquals": {"aws:PrincipalTag/team": "team-a"}}
  }]
}
```

- AWS managed policies with `"Resource": "*"` are convenient starting points but usually too broad; pair them with a permissions boundary or replace them with customer managed policies.
- **ABAC:** grant by matching tags (`aws:PrincipalTag/team` equals `aws:ResourceTag/team`) so new resources do not need policy edits. Protect the tags themselves from being changed by the people they govern.
- Validate before applying: `aws accessanalyzer validate-policy --policy-type IDENTITY_POLICY --policy-document file://p.json`. Use Access Analyzer to find external access and unused permissions, and the policy simulator to debug.
- Debug `AccessDenied`: identify the exact principal (`aws sts get-caller-identity`), then check, in order, SCPs, permissions boundary, session policy, explicit denies, identity policy, resource policy (and KMS key policy if encryption is involved). CloudTrail shows the failing call and error code.

## Permissions boundaries

Use them to delegate safely: developers may create roles for their Lambda functions only if the new role carries the boundary, so nobody can mint a role more powerful than allowed.

```json
{"Effect": "Allow", "Action": ["iam:CreateRole", "iam:AttachRolePolicy", "iam:PutRolePolicy"],
 "Resource": "arn:aws:iam::111122223333:role/app/*",
 "Condition": {"StringEquals": {"iam:PermissionsBoundary": "arn:aws:iam::111122223333:policy/AppBoundary"}}}
```

Also deny deleting or changing the boundary policy itself.

## Cross-account roles

Pattern for pipelines and admins: a tooling or identity account assumes a role in each target account.

```json
{"Effect": "Allow",
 "Principal": {"AWS": "arn:aws:iam::444455556666:role/deploy-pipeline"},
 "Action": "sts:AssumeRole"}
```

```bash
aws sts assume-role --role-arn arn:aws:iam::111122223333:role/deployer --role-session-name release-42
# or in ~/.aws/config: [profile prod-deploy] role_arn=... source_profile=tooling
```

Trust specific role ARNs, not whole accounts, when you can; require MFA for human-assumed admin roles; keep session duration short.

## Federation

- **IAM Identity Center:** default for workforce access across an organization. Connect the corporate IdP (Entra ID, Okta, Google, AD via AD Connector), define permission sets, assign groups to accounts. CLI uses `aws sso login`.
- **SAML 2.0 direct to IAM:** `AssumeRoleWithSAML` for single-account or legacy setups.
- **OIDC for workloads:** CI systems and Kubernetes assume roles with `AssumeRoleWithWebIdentity`. Remove stored keys from CI:

```yaml
# GitHub Actions
permissions: { id-token: write, contents: read }
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::111122223333:role/gha-deploy
      aws-region: us-east-2
```

Restrict the role's trust policy on `token.actions.githubusercontent.com:sub` to the exact repository and branch or environment (for example `repo:acme/app:environment:production`).

- STS sessions return an access key, secret key, session token and expiry; configure role maximum session duration (1 to 12 hours) to your risk.
- **Directory Service:** AWS Managed Microsoft AD (real AD, trusts, multi-region in Enterprise edition), AD Connector (proxy to on-premises AD, no cached data, nothing to manage in the cloud), Simple AD (Samba-based, small, no trusts or MFA).

## Organizations and SCPs

- Group accounts into OUs (for example Security, Infrastructure, Workloads/Prod, Workloads/Dev, Sandbox) and attach SCPs at OU level. Consolidated billing comes with it.
- Typical guardrails: deny leaving the organization, deny disabling CloudTrail, GuardDuty or Config, deny regions you do not use, require MFA for destructive actions.

```json
{"Version": "2012-10-17", "Statement": [{
  "Sid": "DenyDestructiveWithoutMfa", "Effect": "Deny",
  "Action": ["ec2:TerminateInstances", "rds:DeleteDBInstance", "rds:DeleteDBCluster"],
  "Resource": "*",
  "Condition": {"BoolIfExists": {"aws:MultiFactorAuthPresent": "false"}}}]}
```

Test SCPs on a sandbox OU first; a bad deny can stop pipelines or break AWS service-linked roles across every account below it.

## Secrets

| Need | Use |
|---|---|
| Database credentials, API keys that must rotate, cross-account sharing, audit of each retrieval | Secrets Manager |
| Configuration values and simple secrets, per-environment hierarchy, low cost | Parameter Store (`SecureString` with KMS) |

- **Secrets Manager:** versioned (`AWSCURRENT`, `AWSPENDING`, `AWSPREVIOUS`), encrypted with KMS, managed rotation for RDS/Aurora/Redshift/DocumentDB or a Lambda rotation function for anything else. RDS can also manage the master password in Secrets Manager directly.
- **Parameter Store:** standard tier (free, up to 10,000 parameters per account and region, 4 KB) or advanced (larger values, policies such as expiration). No built-in rotation.
- Both are controlled by IAM and, for customer managed keys, the KMS key policy. Scope access by path (`arn:aws:ssm:...:parameter/app/prod/*`) or secret name prefix.
- Reference rather than copy: CloudFormation dynamic references (`{{resolve:secretsmanager:prod/db:SecretString:password}}`), ECS task definition `secrets`, CodeBuild `env.secrets-manager`, Lambda extension or SDK calls with caching.

```bash
aws secretsmanager create-secret --name prod/app/db --secret-string file://secret.json  # file outside the repo, deleted after
aws secretsmanager rotate-secret --secret-id prod/app/db
```

Never echo `get-secret-value` output into CI logs; mask values and fetch inside the process that needs them. If a secret leaks, rotate first, then investigate with CloudTrail.

## Cognito for applications

- **User pools** authenticate end users: sign-up, sign-in, hosted UI, MFA, social and SAML/OIDC IdPs, Lambda triggers; they issue JWTs (ID, access, refresh) that API Gateway or your app validates.
- **Identity pools** authorize: exchange a user pool or social token for temporary AWS credentials mapped to IAM roles, for direct access to services such as S3 or DynamoDB scoped per user (for example with `${cognito-identity.amazonaws.com:sub}` in the policy).
- Short version: user pools for who, identity pools for AWS credentials.

## Workflow

1. Identify the principal (human, workload, CI, third party) and the exact actions and resources it needs.
2. Choose the identity mechanism: Identity Center for people, roles for workloads, OIDC for CI, external ID for third parties.
3. Write a narrow policy (actions, ARNs, conditions); validate with Access Analyzer; add boundaries where people create roles.
4. Confirm account and environment, show the diff, get approval for production IAM or SCP changes, and record the current version for rollback.
5. Deploy through IaC; never through ad hoc console edits.
6. Move secrets into Secrets Manager or Parameter Store, wire runtime retrieval, enable rotation, and remove secrets from code, env files and pipeline variables.
7. Verify: allowed calls succeed, a denied call fails as expected, CloudTrail records the access, unused permissions are trimmed later with Access Analyzer.

## Red flags

- Root access keys, or root used for daily work.
- `"Action": "*"`, `"Resource": "*"` on custom policies; `iam:PassRole` on `*`.
- Long-lived access keys in CI variables, laptops, AMIs or repos; keys older than 90 days.
- Trust policies allowing a whole account or `"Principal": "*"` without conditions; third-party roles without external ID.
- OIDC trust policies that do not pin the repository and branch or environment.
- Believing an SCP or boundary grants access; troubleshooting `AccessDenied` without checking SCPs and KMS key policies.
- Secrets in user data, environment variables committed to Git, CloudFormation parameters with defaults, or printed in build logs.
- Secrets Manager secret with rotation configured but never tested.
- Cognito identity pool roles granting table-wide access instead of per-user conditions.

## Related

- `../WellArchitectedPillars/wellArchitectedPillars.md` - security pillar principles.
- `../FundamentalServices/fundamentalServices.md` - CLI profiles, instance roles, IMDSv2.
- `../S3Storage/s3Storage.md` - bucket policies and cross-account access.
- `../DynamoDb/dynamoDb.md` - fine-grained access and web identity federation to tables.
- `../../Resilience/DataProtection/dataProtection.md` - KMS keys and key policies.
- `../../Resilience/PolicyAndStandards/policyAndStandards.md` - Organizations guardrails, Config and Security Hub.
- `../../Delivery/CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` - cross-account deployment roles.
- `../../Monitoring/LogSources/logSources.md` - CloudTrail for auditing access.
- `../../../Practices/ContinuousIntegration/continuousIntegration.md` - platform-neutral CI practice, including secrets in pipelines.
- `../../../Azure/SetupAndSubscription/setupAndSubscription.md` - Azure subscriptions and access; Entra ID and RBAC syntax differ from IAM.
- `../../../../CleanCode/Boundaries/boundaries.md` - isolating third-party integrations (when installed).
- `../../../../actions/review.md` - review workflow for policy changes (when installed).
