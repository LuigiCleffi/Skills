---
name: aws-opsworks
description: How to understand and migrate legacy AWS OpsWorks workloads (OpsWorks Stacks with stacks, layers, instances, apps and the Setup/Configure/Deploy/Undeploy/Shutdown lifecycle events; OpsWorks for Chef Automate; OpsWorks for Puppet Enterprise; per-user SSH access and Show/Deploy/Manage/Deny stack permissions) onto supported services such as Systems Manager State Manager and Run Command with AWS-ApplyChefRecipes or AWS-ApplyAnsiblePlaybooks, Session Manager, CloudFormation or CDK, CodeDeploy, Elastic Beanstalk and ECS, based on Chapter 10 (Using AWS OpsWorks to Manage and Deploy your Application Stack) of AWS Certified DevOps Engineer - Professional. Use when the user finds OpsWorks stacks, Chef cookbooks or Puppet manifests tied to OpsWorks, aws opsworks CLI calls, opsworks-agent, custom cookbooks repositories, layer recipes or stack JSON in a codebase, asks how to replace OpsWorks after its end of life, needs to map layers and lifecycle events to Auto Scaling groups, launch templates and SSM associations, wants to run existing Chef recipes without a Chef server, or needs to replace OpsWorks user SSH keys with Session Manager.
---

# AWS OpsWorks (legacy) and Its Replacements

Current note: every OpsWorks offering has reached end of life (OpsWorks for Puppet Enterprise in March 2024, OpsWorks for Chef Automate and OpsWorks Stacks in May 2024). Do not create new OpsWorks resources or extend existing ones; treat any OpsWorks artifact you find as something to inventory and migrate. The concepts below exist so you can read old configurations and map them to supported services.

## What OpsWorks was

OpsWorks wrapped Chef and Puppet as managed configuration management. Three flavors existed:

| Flavor | Model | Typical replacement |
|---|---|---|
| OpsWorks Stacks | Stacks of layers; Chef recipes run on lifecycle events by a local agent | CloudFormation/CDK for infrastructure, Systems Manager for configuration, CodeDeploy for app releases; or Elastic Beanstalk/ECS when a platform fits |
| OpsWorks for Chef Automate | Managed Chef Automate server; nodes ran chef-client against it | Self-managed Chef Infra Server, or SSM running cookbooks in local mode |
| OpsWorks for Puppet Enterprise | Managed Puppet master; nodes ran Puppet agent | Self-managed Puppet Enterprise/open source, or rewrite toward SSM, Ansible or images |

The book framed OpsWorks as a fast path for teams that already had Chef or Puppet code. That reasoning now points to running the same code with supported tooling, not to OpsWorks.

## Reading an OpsWorks Stacks configuration

- **Stack**: the unit for one system (for example a LAMP application per environment). A stack was either Linux or Windows, never mixed; custom AMIs had to derive from a supported OS (no custom Windows AMIs). Stacks were shown globally regardless of region.
- **Layer**: blueprint for a set of instances: packages, recipes per lifecycle event, security groups, volumes. Built-in layers covered load balancers, databases, app servers (PHP, Rails, Node.js, Java), plus Ganglia and Memcached on Linux; custom layers ran your own recipes.
- **Instance**: provisioned by OpsWorks (24/7, time-based or load-based) or a registered existing EC2 or on-premises Linux server running the OpsWorks agent.
- **App**: code location (Git, S3, HTTP archive) plus settings; deploying it fired the Deploy event.
- **Lifecycle events**:
  - Setup: on every boot, installs packages and base config.
  - Configure: on all instances whenever stack membership changes (instance online/offline, Elastic IP or load balancer attach), to refresh things like host lists.
  - Deploy / Undeploy: release or remove an app version.
  - Shutdown: before termination, for draining and cleanup.
- **Stack JSON / custom JSON**: attributes passed to recipes. Often holds endpoints and, in old stacks, credentials that must be rotated during migration.
- **Users and permissions**: OpsWorks users were imported IAM users with per-user SSH keys or RDP access and per-stack levels Show, Deploy (adds app deploys), Manage (adds stack changes) and Deny.

## Mapping to supported services

| OpsWorks concept | Replace with |
|---|---|
| Stack per environment | One CloudFormation stack or CDK stage per environment, parameterized |
| Layer | Auto Scaling group with a launch template (one per role), or an ECS service |
| Load balancer layer | Application Load Balancer and target groups |
| Database layer | Amazon RDS or Aurora (not a self-managed DB on instances) |
| Memcached layer | Amazon ElastiCache |
| Ganglia layer and 13 stack metrics | CloudWatch agent, dashboards and alarms |
| Setup event | User data or a launch-time SSM association; better, bake an AMI (EC2 Image Builder) or container image |
| Configure event | Service discovery (Cloud Map, ALB, Parameter Store) instead of rewriting host lists; if needed, EventBridge on Auto Scaling events triggering an SSM Automation |
| Deploy / Undeploy | CodeDeploy (in-place or blue/green) driven by CodePipeline or another CI system |
| Shutdown event | Auto Scaling lifecycle hook on termination plus SSM or Lambda cleanup |
| Stack/custom JSON | Parameter Store for config, Secrets Manager for secrets |
| Per-user SSH/RDP keys | Session Manager with IAM Identity Center, logged to CloudWatch Logs or S3 |
| Show/Deploy/Manage/Deny | IAM policies scoped by tags or resource ARNs |
| Time/load-based instances | Auto Scaling scheduled actions and target tracking policies |

## Running existing Chef or Ansible code without a server

Systems Manager can run cookbooks in local mode or playbooks on tagged instances, which preserves recipe investment while removing the OpsWorks agent.

```yaml
# CloudFormation: apply Chef recipes from S3 to every web instance in an environment
WebConfigAssociation:
  Type: AWS::SSM::Association
  Properties:
    Name: AWS-ApplyChefRecipes
    AssociationName: !Sub "${Env}-web-chef"
    Targets:
      - Key: tag:Role
        Values: [web]
      - Key: tag:Env
        Values: [!Ref Env]
    ScheduleExpression: rate(30 minutes)
    ComplianceSeverity: HIGH
    Parameters:
      SourceType: [S3]
      SourceInfo: [!Sub '{"path":"https://s3.amazonaws.com/${CookbookBucket}/cookbooks.tar.gz"}']
      RunList: ['recipe[app::default]']
      WhyRun: ['False']
```

- Run once with `WhyRun: True` (Chef dry run) against a non-production target first; for Ansible use `AWS-ApplyAnsiblePlaybooks` with `Check: True`.
- Instances need the SSM Agent and an instance profile with `AmazonSSMManagedInstanceCore`; private subnets need VPC endpoints for `ssm`, `ssmmessages` and `ec2messages` or a NAT path.
- Recipes written against OpsWorks attributes (`node[:opsworks]`, `search(:node, ...)` on stack data, `deploy` resources from OpsWorks cookbooks) will not work unchanged. Grep for them and replace with explicit attributes or Parameter Store lookups.
- Treat this as a bridge. For new work prefer immutable images or containers, with configuration management limited to what must change at runtime.

## Replacing per-user SSH access

```bash
# Interactive shell without opening port 22 or distributing keys
aws ssm start-session --target i-0abc123def4567890 --region eu-west-1
```

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "ssm:StartSession",
    "Resource": "arn:aws:ec2:*:*:instance/*",
    "Condition": {"StringEquals": {"ssm:resourceTag/Env": "staging"}}
  }, {
    "Effect": "Allow",
    "Action": "ssm:StartSession",
    "Resource": "arn:aws:ssm:*:*:document/SSM-SessionManagerRunShell"
  }, {
    "Effect": "Allow",
    "Action": ["ssm:TerminateSession", "ssm:ResumeSession"],
    "Resource": "arn:aws:ssm:*:*:session/${aws:userid}-*"
  }]
}
```

Remove imported OpsWorks users' public keys from `authorized_keys`, close inbound 22/3389 in security groups, and enable session logging before announcing the change.

## Inventory before migrating

```bash
aws opsworks describe-stacks --region us-east-1
aws opsworks describe-layers --stack-id <id>
aws opsworks describe-instances --stack-id <id>
aws opsworks describe-apps --stack-id <id>
```

The OpsWorks API endpoint may no longer answer after end of life; if so, inventory from what remains: EC2 instances tagged `opsworks:stack`/`opsworks:layer`, the custom cookbooks repository, CloudTrail history, and the instances' `/var/lib/aws/opsworks` and `/etc/aws/opsworks` directories. Capture: OS and AMI, packages, recipes per event, app sources, custom JSON, Elastic IPs, volumes, load balancer attachments, users with access, and anything that ran on Configure.

## Workflow
1. Confirm account, region and environment; list every OpsWorks-related resource and the code repositories behind it.
2. Classify each stack: lift to Elastic Beanstalk or ECS (standard web app), rebuild as CloudFormation/CDK + ASG + CodeDeploy (custom), or keep Chef/Puppet self-managed (large estate, hybrid).
3. Move secrets from custom JSON and app settings to Secrets Manager or Parameter Store; rotate any credential that ever lived there.
4. Write the replacement as code in a non-production account; run cookbooks in dry-run mode; review the CloudFormation change set.
5. Deploy the new environment alongside the old one and test it on its own endpoint.
6. With explicit approval, shift traffic using a blue/green technique (Route 53 weighted records or ALB), keeping the old instances as the rollback path.
7. Monitor with CloudWatch alarms; only after a stable window, and with approval, decommission old instances, Elastic IPs, volumes and IAM users.

## Red flags
- Proposing new OpsWorks stacks, layers or Chef Automate servers.
- Database passwords or API keys in stack or custom JSON, or in a cookbook repo.
- Instances still running the OpsWorks agent that nobody patches or owns.
- Long-lived per-user SSH keys and port 22 open to `0.0.0.0/0`.
- Recipes that depend on Configure-event host lists, migrated without a service-discovery replacement.
- Terminating old OpsWorks instances before confirming their data volumes and Elastic IPs are no longer needed.
- Copying OpsWorks permission levels into broad `*` IAM policies instead of scoped ones.

## Related
- `../ElasticBeanstalk/elasticBeanstalk.md` — the managed-platform replacement for simple app stacks.
- `../CloudFormation/cloudFormation.md` — infrastructure as code for the rebuilt stacks.
- `../CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — replacing the Deploy event.
- `../BlueGreenDeployments/blueGreenDeployments.md` — cutting traffic from old stacks to new ones.
- `../../Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` — State Manager, Run Command, Session Manager, Patch Manager.
- `../../Resilience/AutoScaling/autoScaling.md` — launch templates and lifecycle hooks replacing layers and Shutdown.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — replacing stack permissions and custom JSON secrets.
- `../../../Practices/ConfigurationManagement/configurationManagement.md` — platform-neutral Puppet/configuration management practice; Puppet module syntax is not OpsWorks or SSM syntax.
- `../../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — general infrastructure-as-code principles.
- `../../../../CleanCode/Systems/systems.md` (when installed) — separating construction from use.
- `../../../../actions/dev.md` (when installed) — development workflow.
