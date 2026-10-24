---
name: aws-cloudformation
description: "How to write, validate, deploy and operate AWS CloudFormation templates and stacks (template sections Parameters, Rules, Mappings, Conditions, Transform, Resources, Outputs; intrinsic functions Ref, GetAtt, Sub, FindInMap, GetAZs, Select, ImportValue, If, Equals; AWS-specific parameter types and constraints; dynamic references to Secrets Manager and SSM Parameter Store; change sets; rollback triggers; DeletionPolicy, UpdateReplacePolicy, stack policies and termination protection; nested stacks with aws cloudformation package; cross-stack exports; DependsOn, CreationPolicy, WaitCondition, cfn-init, cfn-signal, cfn-hup; drift detection; Service Catalog products, portfolios and constraints; the AWS CDK apps, stacks and constructs), based on Chapter 7 (Using CloudFormation Templates to Deploy Workloads) of AWS Certified DevOps Engineer - Professional. Use when writing or reviewing a template.yaml with AWS:: resources, running aws cloudformation deploy, create-change-set or execute-change-set, a stack is stuck in UPDATE_ROLLBACK_FAILED or ROLLBACK_COMPLETE, an update would replace a database, the user sees \"Requires capabilities: [CAPABILITY_IAM]\", \"Export cannot be updated as it is in use\", \"Circular dependency between resources\", a resource timed out waiting for a signal, wants to split a large template, detect drift, pass secrets safely, run cfn-lint or validate-template, offer self-service stacks through Service Catalog, or use cdk synth, cdk diff, cdk deploy or cdk bootstrap."
---

# CloudFormation

Treat every template as production code: lint it, review it, deploy it from a pipeline, and never update a live stack without reading a change set first. The dangerous moment is an update that *replaces* or *deletes* a stateful resource, so protect stateful resources with DeletionPolicy and stack policies before the first deploy, not after the first incident.

## Template anatomy

Only `Resources` is required. A typical layout, top to bottom:

| Section | Use for |
|---|---|
| `AWSTemplateFormatVersion` | `'2010-09-09'`, the only valid value |
| `Description` | What the stack creates and who owns it |
| `Metadata` | Console parameter grouping, `AWS::CloudFormation::Init` config |
| `Parameters` | Inputs per environment; use AWS-specific types and constraints |
| `Rules` | Cross-parameter validation (for example prod requires a larger instance class) |
| `Mappings` | Static lookup tables (per-environment sizes, per-region values) |
| `Conditions` | Create or configure resources only in some environments |
| `Transform` | Macros such as `AWS::Serverless-2016-10-31` (SAM) or `AWS::LanguageExtensions` |
| `Resources` | The resources and their properties |
| `Outputs` | Values for people and other stacks (ARNs, URLs, exports) |

Write YAML: it allows comments and short-form functions (`!Ref`, `!Sub`, `!GetAtt`). Avoid hardcoded account IDs, regions and AMI IDs so one template serves every account and region.

```yaml
Parameters:
  Env:
    Type: String
    AllowedValues: [dev, staging, prod]
  VpcId:
    Type: AWS::EC2::VPC::Id                      # console shows a picker, input is validated
  LatestAmi:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64
  QueueName:
    Type: String
    AllowedPattern: '^[a-z0-9-]{3,60}$'
    ConstraintDescription: lowercase letters, digits and hyphens, 3-60 characters
Conditions:
  IsProd: !Equals [!Ref Env, prod]
Resources:
  Queue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: !Sub '${QueueName}-${Env}'
      MessageRetentionPeriod: !If [IsProd, 1209600, 86400]
Outputs:
  QueueArn:
    Value: !GetAtt Queue.Arn
    Export:
      Name: !Sub '${AWS::StackName}-QueueArn'
```

Current note: the book uses a `Mappings` table of AMI IDs per region; prefer the SSM public parameter type shown above so the AMI stays current without template edits (pin a specific AMI where reproducibility matters more).

## Intrinsic and condition functions

- `Ref` returns a parameter value or a resource's primary identifier; `Fn::GetAtt` returns other attributes (ARN, DNS name).
- `Fn::Sub` builds strings with `${Param}` and `${AWS::Region}`; prefer it to `Fn::Join`.
- `Fn::FindInMap` reads `Mappings`; `Fn::GetAZs` plus `Fn::Select` picks Availability Zones without hardcoding them.
- `Fn::ImportValue` consumes another stack's export.
- Condition functions: `Fn::Equals`, `Fn::And`, `Fn::Or`, `Fn::Not` in `Conditions`; `Fn::If` in properties, with `AWS::NoValue` to omit a property.
- Functions work in resource properties, outputs, metadata and update policies, not in arbitrary places such as parameter defaults.

## Secrets

Never put secrets in templates, parameter defaults, `UserData` or outputs.

```yaml
  Database:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    UpdateReplacePolicy: Snapshot
    Properties:
      Engine: postgres
      DBInstanceClass: db.t4g.medium
      AllocatedStorage: '50'
      StorageEncrypted: true
      MasterUsername: app_admin
      ManageMasterUserPassword: true            # RDS creates and rotates the password in Secrets Manager
```

- For application secrets, pass the secret's name or ARN (not its value) and let the workload read it at runtime with its own role.

- Dynamic references: `{{resolve:ssm:/path}}` (plain parameters), `{{resolve:ssm-secure:/path}}` (SecureString, only for supported properties), `{{resolve:secretsmanager:id:SecretString:key}}`.
- If a sensitive value must be a parameter, mark it `NoEcho: true`; it is still visible to anyone who can read the resource itself.
- Current note: for RDS and Aurora, `ManageMasterUserPassword` is simpler than resolving a password you manage yourself.

## Deploying and updating safely

```bash
aws sts get-caller-identity && aws configure get region     # confirm account and region first
cfn-lint template.yaml && aws cloudformation validate-template --template-body file://template.yaml

aws cloudformation deploy --stack-name orders-prod --template-file template.yaml \
  --parameter-overrides Env=prod QueueName=orders \
  --capabilities CAPABILITY_NAMED_IAM --no-execute-changeset
aws cloudformation describe-change-set --stack-name orders-prod --change-set-name <name-from-output> \
  --query 'Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType,Replacement]' --output table
# only after review and approval:
aws cloudformation execute-change-set --stack-name orders-prod --change-set-name <name>
```

- Read every `Replacement: True` or `Conditional` and every `Remove`: a replaced database, bucket or queue is a new, empty resource.
- Change sets show intent, not success: they do not check quotas, IAM permissions or naming collisions.
- Unexecuted change sets can be executed later by anyone with permission; delete stale ones.
- `CAPABILITY_IAM` / `CAPABILITY_NAMED_IAM` acknowledge IAM creation; `CAPABILITY_AUTO_EXPAND` acknowledges macros and nested expansion. Review the IAM resources before granting them.
- Rollback triggers (`--rollback-configuration` on `create-change-set`, `create-stack` or `update-stack`) watch up to five CloudWatch alarms for 0-180 minutes and roll the stack back if one fires, for example `RollbackTriggers=[{Arn=<alarm-arn>,Type=AWS::CloudWatch::Alarm}],MonitoringTimeInMinutes=15`.

## Protecting resources

- `DeletionPolicy: Retain` or `Snapshot` (and `UpdateReplacePolicy`) on databases, buckets, file systems, KMS keys and log groups that must outlive the stack.
- Stack policies deny `Update:Replace` and `Update:Delete` on critical logical IDs; termination protection blocks accidental stack deletion:

```bash
aws cloudformation update-termination-protection --enable-termination-protection --stack-name orders-prod
```

- A failed create leaves `ROLLBACK_COMPLETE`, which can only be deleted; `UPDATE_ROLLBACK_FAILED` needs `continue-update-rollback` (optionally skipping resources) after fixing the cause. Investigate events (`describe-stack-events`) before retrying.

## Ordering and signals

- CloudFormation infers order from `Ref`/`GetAtt`; add `DependsOn` only for hidden dependencies (for example a route to an internet gateway that needs the gateway attachment).
- `DependsOn` controls order only. To wait until an instance has actually finished configuring, use `CreationPolicy` with `cfn-signal` (preferred for EC2 and Auto Scaling groups) or a `WaitCondition` with a handle for external processes.

```yaml
  AppServer:
    Type: AWS::EC2::Instance
    CreationPolicy:
      ResourceSignal: { Count: 1, Timeout: PT15M }
    Metadata:
      AWS::CloudFormation::Init:
        config:
          packages: { dnf: { nginx: [] } }
          services: { systemd: { nginx: { enabled: true, ensureRunning: true } } }
    Properties:
      ImageId: !Ref LatestAmi
      InstanceType: t3.small
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          /opt/aws/bin/cfn-init -v --stack ${AWS::StackName} --resource AppServer --region ${AWS::Region}
          /opt/aws/bin/cfn-signal -e $? --stack ${AWS::StackName} --resource AppServer --region ${AWS::Region}
```

- Helper scripts: `cfn-init` applies `AWS::CloudFormation::Init`, `cfn-signal` reports success or failure, `cfn-get-metadata` reads metadata, `cfn-hup` re-applies configuration when metadata changes.
- For anything beyond a few packages, bake an AMI or use containers; long boot-time configuration slows scaling and fails unpredictably.

## Splitting templates: nested and cross-stack

- **Nested stacks** (`AWS::CloudFormation::Stack`) deploy and roll back as one unit under a root stack; good for reusable building blocks (network, IAM roles, database). `aws cloudformation package` uploads local child templates and Lambda code to S3 and rewrites the paths:

```bash
aws cloudformation package --template-file root.yaml --s3-bucket acme-cfn-artifacts-eu-west-1 \
  --output-template-file packaged.yaml
aws cloudformation deploy --template-file packaged.yaml --stack-name platform-dev --capabilities CAPABILITY_IAM
```

- **Cross-stack references** (`Export` / `Fn::ImportValue`) link independently owned stacks (network team, app team). An export cannot change or be deleted while imported, which couples release cycles; use them for stable identifiers only, or pass values through SSM parameters.
- Troubleshoot a failing nested stack by deploying that child template alone.
- Current note: the per-template resource limit is 500 (it was 200 when the book was written); hitting it is a design smell, split by ownership and lifecycle.
- For the same stack across many accounts and regions use StackSets, with service-managed permissions from AWS Organizations.

## Drift

Manual console changes make stacks drift from their templates, and the next update may silently revert or fail.

```bash
id=$(aws cloudformation detect-stack-drift --stack-name orders-prod --query StackDriftDetectionId --output text)
aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "$id"
aws cloudformation describe-stack-resource-drifts --stack-name orders-prod \
  --stack-resource-drift-status-filters MODIFIED DELETED
```

Resolve drift by updating the template to match an intended change, or by redeploying to restore the template's state, after approval. Prevent it with IAM that limits console writes in production and with AWS Config rules.

## Service Catalog

Publish vetted templates as **products** grouped in **portfolios** shared with specific IAM principals, so non-specialists launch approved patterns (QA environments, data science stacks) without broad permissions.

- **Launch constraints** run the product with a defined IAM role, so users need no direct rights to the underlying services.
- **Template constraints** narrow parameter choices (instance sizes, runtimes); **tag update constraints** and TagOptions enforce tagging; **notification constraints** send stack events to SNS.
- Version products; users can stay on a known version or move to a newer one.

## AWS CDK

The CDK synthesizes CloudFormation from TypeScript, Python, Java, C# or Go: an **app** contains **stacks** (each one CloudFormation stack, with the same limits), built from **constructs** (L1 raw resources, L2 resources with sensible defaults, L3 patterns).

```bash
cdk bootstrap aws://111122223333/eu-west-1   # once per account and region; creates deployment roles and assets bucket
cdk synth                                     # inspect the generated template
cdk diff OrdersProdStack                      # review before deploying
cdk deploy OrdersProdStack --require-approval broadening
```

- Use it when loops, abstractions and unit tests on infrastructure pay off; keep plain templates when the team reads YAML better than code. Current note: CDK v1 reached end of support in June 2023; use v2 (`aws-cdk-lib`).

## Workflow
1. Confirm account, region and target environment; check whether the stack exists and its current status.
2. Write or change the template; parameterize environment differences; add DeletionPolicy and UpdateReplacePolicy on stateful resources.
3. Run `cfn-lint`, `validate-template` and policy checks (cfn-guard or Checkov) locally and in the pipeline.
4. Create a change set (or `cdk diff`) and review actions, replacements, removals and IAM changes.
5. For production or destructive changes, present the change set and get explicit approval; set rollback triggers on key alarms.
6. Execute, watch `describe-stack-events`, and verify the application, not just `UPDATE_COMPLETE`.
7. Run drift detection periodically and before major updates; fix drift in code.
8. Record what changed and how to roll back (previous template version, retained snapshots).

## Red flags
- Updating production with `deploy` and no reviewed change set.
- Stateful resources without DeletionPolicy, or renaming a logical ID (which replaces the resource).
- Passwords as parameter defaults, in `UserData`, outputs or committed parameter files.
- Hardcoded AMI IDs, account IDs, ARNs or Availability Zones.
- `DependsOn` used to "wait for configuration"; missing `CreationPolicy` signals.
- One giant template owned by several teams; exports used for values that change often.
- Granting `CAPABILITY_NAMED_IAM` without reading the IAM resources created.
- Fixing production by hand in the console and leaving the stack drifted.
- Retrying a failed stack repeatedly without reading the first failure event.

## Related
- `../CiCdAndSdlc/ciCdAndSdlc.md` — where infrastructure stages sit in the pipeline.
- `../CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — CloudFormation deploy actions and approvals in CodePipeline.
- `../CodeCommitAndCodeBuild/codeCommitAndCodeBuild.md` — linting and packaging templates in CodeBuild.
- `../ElasticBeanstalk/elasticBeanstalk.md` and `../OpsWorks/opsWorks.md` — higher-level services that generate stacks.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — IAM roles, Secrets Manager, Parameter Store.
- `../../Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` — AWS Config rules for drift and compliance.
- `../../Resilience/PolicyAndStandards/policyAndStandards.md` — organization-wide guardrails.
- `../../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — platform-neutral IaC practice.
- `../../../Azure/VirtualMachines/virtualMachines.md` — Azure counterpart (ARM/Bicep); template syntax is not interchangeable.
- `../../../../CleanCode/Systems/systems.md` — separating construction from use, applied to infrastructure modules (when installed).
