---
name: aws-codedeploy-and-codepipeline
description: How to orchestrate releases with AWS CodePipeline (stages, actions and action categories Source, Build, Test, Deploy, Approval, Invoke; artifacts and artifact stores; V2 pipelines with triggers, variables and execution modes; manual approvals; cross-account and cross-region pipelines with KMS keys and roles; Jenkins and other third-party actions; EventBridge notifications) and how to deploy with AWS CodeDeploy (applications, compute platforms EC2/on-premises, Lambda and ECS; deployment groups and tags; in-place vs blue/green; deployment configurations such as AllAtOnce, HalfAtATime, OneAtATime, canary and linear; appspec.yml files and lifecycle hooks; the CodeDeploy agent; CloudWatch alarm stops and automatic rollbacks), based on Chapter 9 (Deploying Workloads with CodeDeploy and CodePipeline) of AWS Certified DevOps Engineer - Professional. Use when building or reviewing a CodePipeline definition, adding a manual approval before production, a pipeline fails on artifact permissions or KMS in another account, writing an appspec.yml, a deployment fails in a lifecycle hook (BeforeInstall, AfterInstall, ApplicationStart, ValidateService, BeforeAllowTraffic), the agent is not running or instances show "no instances found", setting up canary or linear traffic shifting for Lambda or ECS, configuring automatic rollback on alarms, deploying to multiple regions, wiring Jenkins into a pipeline, or mentions aws deploy create-deployment, CodeDeployDefault configurations, imagedefinitions.json or taskdef.json.
---

# CodeDeploy and CodePipeline

CodePipeline orchestrates; CodeDeploy (or CloudFormation, ECS, Elastic Beanstalk) performs the deployment. Design the pipeline so one immutable artifact flows from source to production, every production stage is gated by tests or an explicit approval, and every deployment has alarms that stop it and an automatic rollback path that has been exercised.

## CodePipeline structure

- A **pipeline** is a sequence of **stages**; each stage holds **actions** that run sequentially or in parallel (`runOrder`).
- Action categories: **Source** (CodeCommit, S3, ECR, GitHub/GitLab/Bitbucket via CodeConnections), **Build** (CodeBuild, Jenkins), **Test** (CodeBuild, third-party), **Deploy** (CodeDeploy, CloudFormation, ECS, Elastic Beanstalk, S3, Service Catalog), **Approval** (manual), **Invoke** (Lambda, Step Functions).
- Actions pass **artifacts** through an S3 artifact store; input artifact names must match an earlier action's output names exactly, and output artifact names are unique within the pipeline.
- Rules: at least two stages, source actions only in the first stage, unique stage and action names, action owners `AWS`, `ThirdParty` or `Custom`.
- Current note: use **V2** pipelines. They add trigger filters (branches, tags, file paths, pull requests), pipeline-level variables and execution modes (`SUPERSEDED`, `QUEUED`, `PARALLEL`); stage conditions and stage rollback are available too. Pipeline events go to Amazon EventBridge (formerly CloudWatch Events).

## A minimal pipeline as code

Define pipelines in CloudFormation, CDK or Terraform, never only in the console.

```yaml
  Pipeline:
    Type: AWS::CodePipeline::Pipeline
    Properties:
      PipelineType: V2
      ExecutionMode: QUEUED
      RoleArn: !GetAtt PipelineRole.Arn
      ArtifactStore: { Type: S3, Location: !Ref ArtifactBucket,
                       EncryptionKey: { Id: !Ref ArtifactKeyArn, Type: KMS } }
      Stages:
        - Name: Source
          Actions:
            - Name: App
              ActionTypeId: { Category: Source, Owner: AWS, Provider: CodeStarSourceConnection, Version: '1' }
              Configuration: { ConnectionArn: !Ref ConnectionArn, FullRepositoryId: acme/orders, BranchName: main }
              OutputArtifacts: [{ Name: Src }]
        - Name: Build
          Actions:
            - Name: BuildAndTest
              ActionTypeId: { Category: Build, Owner: AWS, Provider: CodeBuild, Version: '1' }
              Configuration: { ProjectName: !Ref BuildProject }
              InputArtifacts: [{ Name: Src }]
              OutputArtifacts: [{ Name: BuildOut }]
        - Name: Staging
          Actions:
            - Name: Deploy
              ActionTypeId: { Category: Deploy, Owner: AWS, Provider: CodeDeploy, Version: '1' }
              Configuration: { ApplicationName: orders, DeploymentGroupName: orders-staging }
              InputArtifacts: [{ Name: BuildOut }]
        - Name: Production
          Actions:
            - Name: Approve
              RunOrder: 1
              ActionTypeId: { Category: Approval, Owner: AWS, Provider: Manual, Version: '1' }
              Configuration: { NotificationArn: !Ref ApprovalTopic, CustomData: 'Check staging dashboard before approving' }
            - Name: Deploy
              RunOrder: 2
              ActionTypeId: { Category: Deploy, Owner: AWS, Provider: CodeDeploy, Version: '1' }
              Configuration: { ApplicationName: orders, DeploymentGroupName: orders-prod }
              InputArtifacts: [{ Name: BuildOut }]
```

- Manual approvals expire after 7 days and fail the execution. Use them for QA sign-off, change management or content review; give approval permission (`codepipeline:PutApprovalResult`) only to the approver group.
- Separate roles: the pipeline role, each action's role, and the CloudFormation deployment role. Developers get read access to pipelines (see runs and errors) but not permission to edit them.

## Cross-account and cross-region

- Recommended layout: tooling account runs the pipeline; workload accounts (dev, staging, prod) hold the resources.
- Cross-account: encrypt the artifact bucket with a **customer-managed KMS key** (the AWS-managed S3 key cannot be shared), grant the target account's deploy role decrypt and bucket read, and set each action's `RoleArn` to a role in the target account that trusts the tooling account.
- Cross-region actions need an artifact store (bucket and key) in each region used (`ArtifactStores` per region).
- For multi-region releases, prefer cross-region actions in one pipeline over copying artifacts between buckets to trigger a second pipeline.

## Jenkins and other third-party tools

- Keep existing Jenkins jobs by adding a Jenkins build or test action (the AWS CodePipeline Jenkins plugin polls for jobs), or let Jenkins call AWS directly with an assumed role.
- Jenkins agents on EC2 need an instance profile, not stored access keys; CodeBuild can serve as on-demand Jenkins workers through its plugin.
- Load testing and other partner actions plug in as Test actions; one shared integration replaces per-team setups.

## CodeDeploy concepts

| Concept | Meaning |
|---|---|
| Application | Name grouping what you deploy and its compute platform: EC2/On-premises, Lambda or ECS |
| Deployment group | Targets: EC2 tags, Auto Scaling groups, on-premises tags, a Lambda function alias, or an ECS service with load balancer |
| Deployment configuration | How fast and what counts as success |
| Deployment type | In-place (EC2/on-premises only) or blue/green (EC2, Lambda, ECS; not on-premises) |
| Revision | EC2: archive with code and appspec in S3 or GitHub; Lambda/ECS: the appspec in YAML or JSON |

Built-in configurations:

- EC2/on-premises: `CodeDeployDefault.AllAtOnce`, `HalfAtATime`, `OneAtATime`, or a custom minimum-healthy-hosts value.
- Lambda: `CodeDeployDefault.LambdaCanary10Percent5Minutes`, `LambdaLinear10PercentEvery1Minute`, `LambdaAllAtOnce`, and similar.
- ECS: `CodeDeployDefault.ECSCanary10Percent5Minutes`, `ECSLinear10PercentEvery1Minutes`, `ECSAllAtOnce`, and similar.

Canary moves traffic in two steps; linear in equal steps at fixed intervals; all-at-once in one step.

## appspec.yml

EC2/on-premises (in the root of the revision archive):

```yaml
version: 0.0
os: linux
files:
  - source: app/
    destination: /opt/orders
permissions:
  - object: /opt/orders
    owner: orders
    group: orders
hooks:
  ApplicationStop:
    - location: scripts/stop.sh
      timeout: 60
  BeforeInstall:
    - location: scripts/prepare.sh
  AfterInstall:
    - location: scripts/configure.sh
      runas: orders
  ApplicationStart:
    - location: scripts/start.sh
  ValidateService:
    - location: scripts/healthcheck.sh     # must exit non-zero when the app is unhealthy
      timeout: 120
```

ECS blue/green (with a test listener for pre-traffic checks):

```yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: <TASK_DEFINITION>
        LoadBalancerInfo: { ContainerName: orders, ContainerPort: 8080 }
Hooks:
  - AfterAllowTestTraffic: orders-smoke-test     # Lambda that calls PutLifecycleEventHookExecutionStatus
  - BeforeAllowTraffic: orders-predeploy-check
```

- Lambda appspecs name the function, alias, current and target versions, with `BeforeAllowTraffic` and `AfterAllowTraffic` validation functions.
- Hook scripts must be idempotent, time-bounded and return a correct exit code; `ApplicationStop` runs from the *previous* revision, so a broken stop script blocks the next deployment.
- Never put secrets in hook scripts or the revision; read them at runtime from Secrets Manager or Parameter Store using the instance or task role.
- Current note: Amazon ECS now offers built-in blue/green deployments in the service itself; CodeDeploy remains valid, but compare both before building new ECS pipelines.

## The CodeDeploy agent (EC2 and on-premises)

- Install and keep it updated with Systems Manager (Distributor package `AWSCodeDeployAgent`) rather than ad hoc scripts.
- The instance profile must read the revision bucket (and decrypt with its KMS key); the CodeDeploy service role needs permissions for the deployment group's resources.
- On-premises servers register with an IAM role (preferred) or an IAM user, plus tags for targeting.
- "No instances found" usually means tag mismatch, wrong region or the agent not running: `systemctl status codedeploy-agent` and `/var/log/aws/codedeploy-agent/`.

## Alarms and rollback

```bash
aws deploy update-deployment-group --application-name orders --current-deployment-group-name orders-prod \
  --alarm-configuration 'enabled=true,alarms=[{name=orders-5xx},{name=orders-p99-latency}]' \
  --auto-rollback-configuration 'enabled=true,events=[DEPLOYMENT_FAILURE,DEPLOYMENT_STOP_ON_ALARM]'
```

- Up to 10 CloudWatch alarms per deployment group; any alarm in ALARM stops the deployment.
- A rollback is a *new* deployment of the last good revision, with a new deployment ID. On EC2 the agent removes files it installed, using its cleanup record, before redeploying.
- Manual rollback: redeploy a known-good revision (`aws deploy create-deployment` with that S3 key or commit).
- React to failures with EventBridge rules on CodeDeploy and CodePipeline state changes (SNS, chat, Lambda); test the rollback path in staging, not first in production.

## Workflow
1. Confirm accounts (tooling and workload), regions and the environment each stage targets.
2. Define stages: source, build and test, staging deploy with automated checks, approval, production deploy.
3. Pick the CodeDeploy platform, deployment type and configuration per environment (all-at-once in dev; canary, linear or blue/green with alarms in production).
4. Write the appspec and hook scripts; make health validation real, not `exit 0`.
5. Create roles and KMS keys with least privilege; set up cross-account trust where needed.
6. Deploy the pipeline itself from code; review the change set and get approval before changing production pipelines, roles or deployment groups.
7. Attach alarms and automatic rollback to production deployment groups; add failure and approval notifications.
8. Run the pipeline end to end, trigger a deliberate failure in staging to confirm stop and rollback, then report what ran where.

## Red flags
- Production deploy with no approval or automated quality gate before it.
- Different artifacts built for staging and production.
- Cross-account pipelines using the default AWS-managed S3 key (artifacts unreadable in the target account) or overly broad bucket policies.
- `ValidateService` or `AfterAllowTestTraffic` hooks that always succeed.
- No alarms on production deployment groups; automatic rollback disabled.
- `AllAtOnce` in production for user-facing services.
- Agents installed by hand, never updated; instance profiles with wide S3 access.
- Pipelines edited in the console and diverging from the code that defines them.
- Approvers who are also the authors of every change they approve.

## Related
- `../CiCdAndSdlc/ciCdAndSdlc.md` — choosing delivery vs deployment and the deployment strategy.
- `../CodeCommitAndCodeBuild/codeCommitAndCodeBuild.md` — source and build stages, buildspec, imagedefinitions.json.
- `../CloudFormation/cloudFormation.md` — CloudFormation deploy actions, change sets and defining the pipeline as code.
- `../BlueGreenDeployments/blueGreenDeployments.md` — blue/green patterns in depth.
- `../LambdaDeployments/lambdaDeployments.md` — Lambda versions, aliases and SAM traffic shifting.
- `../ElasticBeanstalk/elasticBeanstalk.md` — Beanstalk as a pipeline deploy target.
- `../OpsWorks/opsWorks.md` — legacy deploy target; migrate away (end of life May 2024).
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` — alarms used to stop deployments.
- `../../Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — EventBridge rules for pipeline and deployment events.
- `../../Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` — installing and updating the CodeDeploy agent.
- `../../../Practices/DeliveryPipeline/deliveryPipeline.md` — platform-neutral pipeline design; CodePipeline and appspec syntax do not apply to Azure Pipelines or Jenkins.
- `../../../Practices/AdvancedTopics/advancedTopics.md` — deployment strategies beyond the basics.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — failing loudly in hook scripts and validation functions (when installed).
