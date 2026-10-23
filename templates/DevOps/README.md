## AI Skills

Before building or changing a pipeline, infrastructure code, a deployment,
monitoring, or cloud resources, identify which infrastructure the project
runs on. Read the platform-neutral practices, then only the entry point for
that platform. Services, CLIs, template languages, and IAM models differ
between clouds; do not apply one platform's skills to another.

| Folder | Entry point | Use when |
|---|---|---|
| Practices | `./Practices/README.md` | Always, for platform-neutral practice: delivery culture, monitoring, infrastructure as code, configuration management, continuous integration, delivery pipelines, deployment strategies. |
| AWS | `./AWS/README.md` | The project runs on Amazon Web Services (AWS CLI, CloudFormation/SAM/CDK, CodeBuild/CodePipeline, IAM policies, CloudWatch, `arn:aws:` identifiers). |
| Azure | `./Azure/README.md` | The project runs on Microsoft Azure (az CLI, ARM/Bicep templates, App Service, Azure DevOps or GitHub Actions deploying to Azure, `*.azurewebsites.net`, subscription and resource group IDs). |

## Identifying the platform

Check the repository before choosing: `buildspec.yml`, `appspec.yml`,
`template.yaml` with `AWS::` resources, `cdk.json`, `.aws/` profiles, or
Terraform `provider "aws"` point to AWS; `azure-pipelines.yml`, `*.bicep`,
`azuredeploy.json`, `host.json`, Terraform `provider "azurerm"`, or
`az` commands in scripts point to Azure. Tools such as Terraform, Ansible,
Docker, Kubernetes, and GitHub Actions can target either; look at what they
deploy to. When the project spans several platforms, read the entry point
for the platform the task touches. When it is unclear, ask before writing
platform-specific code.

# Context for AI: Working on Pipelines and Infrastructure

## 1. Know Where You Are

Before running anything, confirm the account or subscription, region, and
environment, and whether it is production: `aws sts get-caller-identity`
and the configured region, or `az account show`. Never assume the default
profile or subscription is the intended one.

## 2. Change Infrastructure Through Code

Make changes in version-controlled code (CloudFormation, CDK, Bicep, ARM,
Terraform, Ansible, Puppet) and the pipeline that applies it, not by hand in
a console. When an emergency forces a manual change, record it and bring the
code back in line afterward so the next apply does not undo it.

## 3. Preview Before You Apply

Show the plan, change set, or what-if output before applying, and read it
for replacements and deletions. Production, destructive, IAM, networking,
DNS, and data-store changes need explicit approval for the specific target
before they run. State what will change, how to verify it, and how to roll
back.

## 4. Secrets and Least Privilege

Never put secrets in code, templates, pipeline definitions, logs, or chat.
Use the platform's secret store (AWS Secrets Manager or Parameter Store,
Azure Key Vault) and short-lived credentials through roles, managed
identities, or OIDC federation from CI. Grant the narrowest permissions
that work, scoped to specific resources.

## 5. Deploy So You Can Undo

Prefer automated, repeatable deployments with health checks and a fast
rollback: blue/green, canary, or rolling with automatic rollback on failed
alarms. Make database migrations backward compatible with the previous
release so code can roll back independently.

## 6. Observe What You Run

Every service ships with metrics, structured logs, alarms on user-facing
symptoms, and an owner who receives them. A deployment is not done until
you can tell from the monitoring whether it worked.

## 7. Report Honestly

Say which commands ran, against which account or subscription, region, and
environment, and what was observed. Distinguish what was applied from what
was only written or planned.
