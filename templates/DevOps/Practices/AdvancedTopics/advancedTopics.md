---
name: devops-advanced-topics
description: Next steps after a basic delivery pipeline (continuous improvement with post-mortems and mapping manual deploy steps, moving environments to the cloud with the NIST characteristics and IaaS/PaaS/SaaS, VPCs, security groups, key pairs and user data, CALMS, advanced monitoring with log aggregation, metrics, visualization, APM, uptime checks and automatic rollback, complex multi-service pipelines, database change management decoupled from app deploys, deploy orchestration, blue-green and immutable servers, per-environment configuration, architecture evolution driven by change frequency, failure points, SLAs, scalability, cost and usage patterns, and security of secrets and access), based on Chapter 8 (Advanced topics) of DevOps na Prática. Use when planning a cloud migration, opening security group ports, putting cloud access keys in a Vagrantfile or script, choosing PaaS vs IaaS, running a post-mortem, automating a manual deploy runbook, ordering multi-tier deploys, evolving a database schema without downtime, choosing how to inject per-environment config, sizing for an SLA such as 99.99%, splitting a component out, cutting cloud cost, or hardening secrets and SSH access.
---

# Advanced DevOps Topics

Treat the delivery process as a system you keep improving with evidence: form a hypothesis, change one thing, measure, keep or revert. Tools are the least important part; culture, automation, lean flow, measurement and sharing (CALMS) decide whether the pipeline helps. Several topics here create or change cloud resources, access rules and data: confirm account, region and environment, preview the change, get approval for production or destructive steps, and keep a rollback path.

## Continuous improvement from real incidents

- After a costly failure, run a blameless post-mortem: timeline, contributing causes, what made detection slow, concrete actions with owners.
- To automate a manual deploy, shadow the next one and write down every manual step and every check the operator does to decide whether to continue. Those checks become automated verifications; the steps become scripts, ordered by risk and frequency.
- Rehearse automated steps in lower environments first. Configuration mistakes (wrong database URL for one process) are typical of manual deploys and pass superficial smoke tests, so verify behavior, not just "it responds".
- Ask for explicit team capacity for delivery improvements; show the data.

## Moving to the cloud

Cloud traits (NIST): on-demand self-service, broad network access, resource pooling, rapid elasticity, measured service. Service models: IaaS (you manage the OS: EC2, Azure VMs, Compute Engine), PaaS (you manage the app: Elastic Beanstalk, App Service, Heroku, App Engine), SaaS (you configure a product).

- Choose the highest abstraction that meets the requirements; IaaS means you own patching, scaling and hardening.
- Infrastructure already defined as code moves with little change; the book reuses its Puppet code and only adapts for a different network interface name. Expect differences like that (single NIC, no fixed private IP, different default user) and make code read facts instead of hard-coding them.
- Network: a VPC/VNet with private subnets for databases and app servers; only load balancers in public subnets. Security groups allow the minimum: HTTPS from the internet to the load balancer, app ports only from the load balancer's group, SSH/RDP not open to `0.0.0.0/0` (prefer Session Manager, Bastion or VPN).
- Bootstrap through user data or cloud-init, kept small (install the agent, fetch configuration); bake heavier setup into images.
- Credentials: never put access keys in a Vagrantfile, script or repository. Use SSO/IAM Identity Center or `az login` for humans, instance profiles/managed identities for machines, OIDC for CI.
- Cost: tag everything (owner, environment), tear down test environments when done, schedule non-production (CI servers idle nights and weekends), set budgets and alerts.

Current note: the book provisions EC2 with the vagrant-aws plugin and access keys in the Vagrantfile, using a 32-bit Ubuntu 12.04 AMI and an `m1.small` instance. Use Terraform, CloudFormation/CDK or Bicep for cloud resources, current LTS images looked up by name or SSM public parameter instead of hard-coded AMI IDs, and current instance families.

```bash
# Preview before creating anything; confirm identity and region first
aws sts get-caller-identity
aws configure get region
terraform plan -out=tfplan      # review, get approval, then: terraform apply tfplan
```

## Advanced monitoring

Production telemetry is the safety net for frequent deploys; it extends testing.

| Area | What to have |
|---|---|
| Log aggregation | central, indexed, searchable logs with retention; no SSH-and-grep |
| Metrics | system, application, process and business metrics, emitted from code |
| Visualization | dashboards that summarize, not walls of graphs |
| Runtime / APM | latency breakdown (DB, external calls, rendering), errors, real-user timing |
| Availability | external checks from several regions |
| Analytics | correlations, trends, capacity and cost insight |

- Watch key metrics during and after each deploy and roll back automatically on regression (canary analysis, CodeDeploy alarms, Argo Rollouts, App Service slot swap back).
- Keep secrets and personal data out of logs and traces.

Current note: Nagios, Graphite, Logstash/Elasticsearch, StatsD and similar are the book's examples. Current common choices are OpenTelemetry for instrumentation, Prometheus and Grafana for metrics, Loki or OpenSearch/Elasticsearch for logs, and managed suites (CloudWatch, Azure Monitor/Application Insights, Datadog, New Relic).

## Complex pipelines

- Many services means more integration stages (contract tests, environment-level integration tests) and fan-in of multiple artifacts.
- Chained Jenkins freestyle jobs become unmanageable; use tools that model pipelines and environments natively (Jenkins declarative pipelines, GoCD, GitHub Actions environments, GitLab, Azure Pipelines, CodePipeline).
- Record which versions of which components were tested together, and promote that set.

## Database changes

- Schema evolves; you cannot drop and recreate data on each deploy. Use versioned migrations (Flyway, Liquibase, Alembic, EF Core migrations, Rails migrations) stored with the code and applied by the pipeline.
- Decouple database deploys from app deploys with expand/contract: add new structures compatible with the old app, deploy the app, backfill, then remove old structures in a later release. Each step must be backward compatible so the app can roll back.
- Back up (or confirm point-in-time recovery) before production migrations; get explicit approval for destructive ones; test on production-sized data for lock and duration.

## Deploy orchestration, blue-green, immutable servers

- With multiple tiers, order matters (database before web; replicas in a specific order to avoid data loss). Put the order in a script or orchestration tool, not in someone's head.
- Blue-green: keep the current environment (blue), build a parallel one (green) with the new version, test it, switch traffic (load balancer, DNS, slot swap), keep blue for fast rollback, then retire it. Watch for shared state: both versions must work with the same database schema during the switch.
- Immutable servers: never patch in place; build a new image, replace instances, discard old ones. Removes drift and makes rollback "switch back".

Current note: Capistrano and Fabric still work; MCollective was deprecated and removed from Puppet in favor of Bolt. Ansible, Bolt, SSM Automation, and platform-native rollouts (Kubernetes Deployments, ECS, App Service slots) cover most orchestration today.

## Per-environment configuration

Build the artifact once; inject environment differences at deploy or run time.

| Approach | Good for | Watch out |
|---|---|---|
| One config file per env in the repo, selected at runtime | few, stable settings | config baked into artifact; change needs a deploy |
| Separate config package per environment | reconfigure without redeploying the app | more artifacts to version |
| Same hostname everywhere, DNS resolves per env | endpoints only | does not cover other settings |
| Central config store (Hiera, SSM Parameter Store, App Configuration, Consul) | many hosts, hierarchical overrides | access control, availability of the store |
| Environment variables (twelve-factor) | containers, PaaS | not for large structured config; never log the environment |

Secrets are configuration with stricter rules: fetch them at runtime from Secrets Manager, Key Vault, Vault or encrypted Hiera (hiera-eyaml); never in the artifact or repository.

## Evolving the architecture

Use production data to revisit the physical architecture. Criteria:

- **Change frequency**: keep together what changes together; split what changes at different rates (app vs infra pipelines).
- **Failure points**: choose them deliberately. An embedded component (search inside the app JVM) can take the whole app down; moving it out lets the app degrade gracefully (disable search or fall back to a simpler query).
- **Deploy units**: small, loosely coupled pieces that deploy independently.
- **SLAs**: 99.99% a year allows about 52.6 minutes of downtime; meeting it may need redundancy across zones, rate limiting per client, and load shedding.
- **Scalability**: horizontal (more nodes) for stateless web tiers, vertical (bigger nodes) often for databases; decide per component.
- **Cost and usage patterns**: separation adds cost; scale on predictable peaks and seasons; switch off idle environments.
- **Resource profile**: web tiers are CPU/concurrency bound, databases memory/disk bound; size and place them accordingly.

## Security

- Strong, unique secrets per environment; do not share production secrets across environments or with everyone on the team.
- Never commit plain-text secrets; encrypt sensitive data, including users' personal data at rest; keep secrets out of logs, chat, email and sticky notes.
- Avoid logging into production servers; block interactive SSH where possible so every change goes through the pipeline (and gaps in automation become visible).
- Defense in depth: network, OS, packages, application, identity. Patch promptly and track vulnerabilities in dependencies and images.
- Add automated security checks (dependency scanning, SAST, DAST, IaC scanning) to the pipeline; use the OWASP Top 10 as a baseline for web apps.

## Workflow

1. Pick one improvement backed by an incident, metric or observed manual step; state the hypothesis and how you will measure it.
2. For infrastructure changes: confirm account/subscription, region and environment; show the plan/change set/what-if; get explicit approval for production and anything destructive; define the rollback.
3. Implement in small steps behind the pipeline, starting in non-production.
4. Measure the effect (deploy frequency, lead time, change failure rate, time to restore, cost, error rate).
5. Keep or revert; write down and share what was learned.

## Red flags

- Cloud access keys in code, Vagrantfiles, CI variables without scoping, or chat.
- Security groups allowing SSH, RDP or database ports from anywhere.
- Test environments left running with nobody owning the bill.
- Hard-coded AMI or image IDs and IPs copied between regions or accounts.
- Schema changes that break the currently running app version, or migrations run without a backup.
- Environment-specific values baked into the artifact; rebuilding per environment.
- Blue-green with no plan for shared database compatibility, or deleting blue before green is proven.
- Manual production logins as the normal way to deploy or debug.
- Monitoring that only says "down" while wrong results go unnoticed.

## Related

- `../DeliveryPipeline/deliveryPipeline.md` — the pipeline these topics extend.
- `../Monitoring/monitoring.md` — basic monitoring and alerting this builds on.
- `../InfrastructureAsCode/infrastructureAsCode.md` — reproducible environments that make cloud moves cheap.
- `../ConfigurationManagement/configurationManagement.md` — Hiera and encrypted data for per-environment config.
- `../WhatIsDevOps/whatIsDevOps.md` — culture and collaboration behind CALMS.
- `../../AWS/Fundamentals/WellArchitectedPillars/wellArchitectedPillars.md` — architecture trade-offs on AWS.
- `../../AWS/Fundamentals/IamAndSecrets/iamAndSecrets.md` — IAM roles, Secrets Manager, Parameter Store.
- `../../AWS/Delivery/BlueGreenDeployments/blueGreenDeployments.md` — blue-green on AWS; syntax is not interchangeable with Azure.
- `../../AWS/Monitoring/EnterpriseLogging/enterpriseLogging.md` — centralized logging on AWS.
- `../../AWS/Resilience/AutoScaling/autoScaling.md` — horizontal scaling and immutable replacement.
- `../../Azure/CloudComputingOverview/cloudComputingOverview.md` — cloud models from the Azure side.
- `../../Azure/VirtualMachines/virtualMachines.md` — IaaS on Azure.
- `../../../DBA/PostgreSQL/DatabaseAdministration/databaseAdministration.md` — backups and roles before schema changes (when installed).
- `../../../DataSystems/Foundations/EncodingAndEvolution/encodingAndEvolution.md` — backward and forward compatible schema evolution (when installed).
- `../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` — reliability, scalability and maintainability trade-offs (when installed).
- `../../../CleanCode/Systems/systems.md` — separating construction from use, at system scale (when installed).
