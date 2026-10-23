---
name: aws-elastic-beanstalk
description: How to build, configure and release applications on AWS Elastic Beanstalk (applications, application versions in S3, environments, web server vs worker tiers with SQS and the sqsd daemon, platforms and platform branches, saved configurations, option settings precedence, .ebextensions and .platform hooks, Procfile, service role and instance profile, enhanced health, managed platform updates, log streaming, deployment policies all at once, rolling, rolling with additional batch, immutable and traffic splitting, URL swap, and the EB CLI), based on Chapter 11 (Using Elastic Beanstalk to Deploy your Application) of AWS Certified DevOps Engineer - Professional. Use when the user runs eb init, eb create, eb deploy, eb setenv, eb config, eb swap, eb logs, eb health or eb terminate, writes .ebextensions/*.config, option_settings, container_commands, leader_only or .platform/hooks, sets DeploymentPolicy, BatchSize, NewVersionPercent or WSGIPath, sees environment health Degraded or Severe, "Instance deployment failed", "Environment variables exceed 4096 bytes", a source bundle that is too large, a missing aws-elasticbeanstalk-ec2-role instance profile, a launch configuration error on create, or must choose between Elastic Beanstalk, ECS and Lambda for a web app or background worker.
---

# AWS Elastic Beanstalk

Elastic Beanstalk is a managed platform that provisions and operates a load balancer, Auto Scaling group, EC2 instances, alarms and logging around your code, using CloudFormation underneath. Choose it for conventional web apps and queue workers on a supported runtime when the team wants AWS to own the plumbing; choose ECS, EKS or Lambda when you need fine control, many services, or event-driven scale to zero. Every environment change rebuilds or reconfigures live instances, so confirm the account, region and environment before any `eb` or `aws elasticbeanstalk` command.

## Concepts

- **Application**: folder-like container for versions, environments and saved configurations.
- **Application version**: an immutable labelled source bundle stored in S3. Each environment runs exactly one version; the same version can be promoted from test to production.
- **Environment**: the running resources for one version, with its own CNAME (`name.region.elasticbeanstalk.com`).
- **Tier**: *web server* (load balancer + ASG + CNAME) or *worker* (ASG + SQS queue; the `sqsd` daemon on each instance POSTs each message to a local HTTP path; a `cron.yaml` schedules periodic jobs). Workers have no public CNAME.
- **Platform**: OS + runtime + web server (Python, Node.js, Java, .NET, PHP, Ruby, Go, Docker). Platform branches are retired on a schedule; plan upgrades as normal work.
- **Saved configuration**: YAML in S3 capturing platform, tier, option settings and tags; reusable to create or restore environments.

Option settings precedence (highest first): settings applied directly to the environment (console, `eb config`, API, `eb create` flags), saved configurations, `.ebextensions` in the bundle, service defaults. A value set in the console silently overrides the same key in `.ebextensions`; when a bundle change "does nothing", check this first.

## Choosing a deployment policy

| Policy | Capacity during deploy | Speed | Rollback | Use for |
|---|---|---|---|---|
| All at once | Drops to zero briefly | Fastest | Redeploy previous version (downtime) | Dev/test only |
| Rolling | Reduced by one batch | Medium | Redeploy; mixed versions meanwhile | Cost-sensitive, tolerant apps |
| Rolling with additional batch | Full | Medium | Redeploy | Production on a budget |
| Immutable | Full, new ASG temporarily | Slow | Terminate new instances; old untouched | Production default |
| Traffic splitting | Full, new instances get a percentage | Slow | Automatic if new instances fail health | Canary on production |
| Blue/green (clone + swap URLs) | Two environments | Slowest | Swap back | Platform upgrades, risky changes |

```yaml
# .ebextensions/01-deploy.config
option_settings:
  aws:elasticbeanstalk:command:
    DeploymentPolicy: TrafficSplitting
    Timeout: 900
  aws:elasticbeanstalk:trafficsplitting:
    NewVersionPercent: 10
    EvaluationTime: 10          # minutes before shifting the rest
  aws:autoscaling:updatepolicy:rollingupdate:
    RollingUpdateEnabled: true
    RollingUpdateType: Immutable   # how configuration changes that replace instances roll out
```

- Deployment policy governs code deploys; `aws:autoscaling:updatepolicy:rollingupdate` governs configuration changes that replace instances (instance type, AMI, VPC settings). Set both.
- Immutable and traffic splitting need enough account quota for double capacity.
- A deployment is only as safe as the health check. Point it at an endpoint that exercises dependencies lightly:

```yaml
option_settings:
  aws:elasticbeanstalk:environment:process:default:
    HealthCheckPath: /healthz
    MatcherHTTPCode: 200
  aws:elasticbeanstalk:healthreporting:system:
    SystemType: enhanced
```

## Customizing environments

- `.ebextensions/*.config` (YAML or JSON, applied alphabetically): `option_settings`, `packages`, `files`, `commands` (before the app is extracted), `container_commands` (after extraction, before going live; `leader_only: true` runs on one instance, useful for migrations), and `Resources` (raw CloudFormation for extra resources such as alarms or queues).
- On Amazon Linux 2 and later platforms, prefer `.platform/hooks/{prebuild,predeploy,postdeploy}/*.sh` (executable) and `.platform/nginx/conf.d/*.conf` for proxy config; `.platform/confighooks/` runs on configuration-only changes.
- `Procfile` defines the process command (for example `web: gunicorn app:application --bind :8000`).
- Python: `WSGIPath` uses `module:callable` (`application:application` by default) on current platforms, not a file path; a mismatch shows as 502 errors after deploy.

```yaml
# .ebextensions/10-db-migrate.config
container_commands:
  01_migrate:
    command: "source /var/app/venv/*/bin/activate && python manage.py migrate --noinput"
    leader_only: true
```

Database migrations run against the live database before the new code takes traffic, so they must be backward compatible with the running version (expand first, contract in a later release).

## Configuration and secrets

- All environment properties together are limited to 4 KB; do not use them as a config store.
- Never put passwords or keys in `option_settings`, `eb setenv` or the bundle: they are visible in the console, `describe-configuration-settings` and saved configurations.

Current note: Elastic Beanstalk can now inject values from Secrets Manager and Parameter Store as environment variables on recent platform versions, referencing ARNs rather than values; check the platform documentation for the exact option settings. Grant the instance profile `secretsmanager:GetSecretValue` / `ssm:GetParameter` on those ARNs only. Otherwise, have the app read secrets at startup with the SDK.

- Do not create the production database inside the environment: an RDS instance launched by Beanstalk is deleted with the environment and blocks blue/green swaps. Create RDS separately and pass its endpoint by reference.
- Keep static assets and large data out of the bundle (S3/CloudFront, RDS, DynamoDB); source bundles are capped at 500 MB.

## IAM

- **Service role** (`aws-elasticbeanstalk-service-role`) lets Beanstalk manage resources, health and managed updates (`AWSElasticBeanstalkEnhancedHealth`, `AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy`).
- **Instance profile** (`aws-elasticbeanstalk-ec2-role`) is what the app runs as: start from `AWSElasticBeanstalkWebTier` or `AWSElasticBeanstalkWorkerTier`, then add narrowly scoped permissions for the app's own resources.

Current note: the book creates the service-linked role and calls it the service role; they are different. New accounts no longer get a default instance profile automatically, so creating an environment without one fails. Create both explicitly (CloudFormation or the console wizard) and keep them least privilege.

Current note: Auto Scaling launch configurations are deprecated and unavailable in newer accounts. Current platform versions use launch templates; if creation fails with a launch configuration error, set an option that requires a launch template, such as `aws:autoscaling:launchconfiguration: DisableIMDSv1: true` (which you want anyway).

## EB CLI and CI usage

```bash
eb init my-app -p python-3.12 --region eu-west-1 # writes .elasticbeanstalk/config.yml
eb create my-app-staging --elb-type application --instance_profile aws-elasticbeanstalk-ec2-role
eb deploy my-app-staging --label "$(git rev-parse --short HEAD)"
eb status && eb health && eb events -f
eb logs --all              # or: eb logs --cloudwatch-logs enable
```

- `eb create` creates real AWS resources (and cost) in the selected account; it is not a local scaffold.
- `eb deploy` packages the last Git commit; use `--staged` to include staged changes. Uncommitted work is not deployed.
- `eb ssh` can open port 22 to the world if the security group is not restricted; prefer Session Manager.
- `eb terminate` deletes the environment and every resource it created, including any coupled RDS instance. Production terminations need explicit approval.

In pipelines, prefer the plain AWS CLI so steps are explicit and reviewable:

```bash
aws s3 cp app-"$SHA".zip s3://"$ARTIFACT_BUCKET"/my-app/
aws elasticbeanstalk create-application-version --application-name my-app \
  --version-label "$SHA" --source-bundle S3Bucket="$ARTIFACT_BUCKET",S3Key=my-app/app-"$SHA".zip \
  --process
aws elasticbeanstalk update-environment --environment-name my-app-prod --version-label "$SHA"
aws elasticbeanstalk wait environment-updated --environment-names my-app-prod
```

Authenticate CI with OIDC role assumption, never long-lived access keys. CodePipeline also has a native Elastic Beanstalk deploy action.

## Operations

- Enable managed platform updates (`aws:elasticbeanstalk:managedactions` `ManagedActionsEnabled: true`, `PreferredStartTime`, and `aws:elasticbeanstalk:managedactions:platformupdate` `UpdateLevel: minor`) with an immutable rolling update.
- Stream logs: `aws:elasticbeanstalk:cloudwatch:logs` `StreamLogs: true`, `RetentionInDays`, `DeleteOnTerminate: false`.
- Enhanced health causes (`eb health`, Events) usually point to failed health checks, 5xx rates, or a deploy that timed out; read `/var/log/eb-engine.log` via `eb logs`.

## Workflow
1. Confirm the workload fits (supported runtime, single deployable, under 500 MB, config under 4 KB); otherwise pick ECS or Lambda.
2. Confirm account, region, application and environment names; create the service role and least-privilege instance profile.
3. Put option settings, deployment policy, health check and log streaming in `.ebextensions` or a saved configuration under version control; keep the database and secrets outside the environment.
4. Create a staging environment, deploy a labelled version, and verify health, logs and a smoke test.
5. For production, show the version label and configuration diff, get explicit approval, and deploy with immutable or traffic splitting (or clone and swap URLs for platform changes).
6. Watch enhanced health and CloudWatch alarms through the evaluation window; roll back by redeploying the previous label or swapping URLs back.
7. Clean up unused versions (lifecycle policy) and old environments only after approval.

## Red flags
- All at once or plain rolling on production with a single instance.
- Secrets in `eb setenv`, `option_settings`, saved configurations or the repo.
- Production RDS created inside the Beanstalk environment.
- Console-only changes that make `.ebextensions` misleading, or configuration nobody can recreate.
- Health check on `/` that returns 200 even when the app cannot reach its database.
- `container_commands` migrations without `leader_only`, or migrations that break the running version.
- Platform branches past retirement, or managed updates disabled with no patch plan.
- `eb terminate` run against the wrong environment because `.elasticbeanstalk/config.yml` points elsewhere.

## Related
- `../BlueGreenDeployments/blueGreenDeployments.md` — clone-and-swap URL releases and data tier rules.
- `../CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — pipelines that deploy to Beanstalk.
- `../CloudFormation/cloudFormation.md` — what Beanstalk generates underneath; defining environments as code.
- `../OpsWorks/opsWorks.md` — migrating legacy OpsWorks app stacks, often onto Beanstalk.
- `../LambdaDeployments/lambdaDeployments.md` — the serverless alternative.
- `../../Resilience/AutoScaling/autoScaling.md` — scaling triggers and launch templates.
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` — alarms and tracing for environments.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — instance profiles and secrets.
- `../../../Practices/DeliveryPipeline/deliveryPipeline.md` — platform-neutral delivery pipeline practice; its tool syntax is not Beanstalk syntax.
- `../../../Azure/AppService/appService.md` — Azure counterpart (App Service); concepts map loosely, syntax does not.
- `../../../../DBA/PostgreSQL/DatabaseAdministration/databaseAdministration.md` (when installed) — operating the external database.
- `../../../../actions/dev.md` (when installed) — development workflow.
