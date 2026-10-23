---
name: devops-what-is-devops
description: What DevOps and continuous delivery mean in practice and how to assess a team against them - the dev versus ops conflict of incentives, hand-offs through tickets and SLAs, the vicious cycle of infrequent large risky deploys, the "last mile" between feature-complete and running in production, small batches, automation of build, test, packaging, environments, infrastructure configuration, data migration, monitoring, logs, metrics, audit, security and deploy, shared ownership and DORA metrics (deployment frequency, lead time, change failure rate, recovery time), based on Chapter 1 (Introduction) of DevOps na Pratica (Danilo Sato). Use when someone asks what DevOps is, wants to adopt DevOps or continuous delivery, says deploys are rare, scary, manual or need a change ticket, releases are batched monthly or quarterly, a "release weekend" or code freeze is planned, ops and dev blame each other, deployments are handed off with a runbook document, the team wants to measure delivery performance, or needs a roadmap of which practices to automate first.
---

# What Is DevOps

DevOps is a culture of shared responsibility between the people who change a system and the people who keep it running, made practical by automating every step from commit to production. The decision rule: when deploys hurt, deploy smaller and more often, and automate the step that hurts instead of adding another manual approval around it.

## The problem it solves

- **Opposed incentives.** Development is rewarded for change; operations is rewarded for stability. Left alone, each optimises its own goal and the two collide at deploy time.
- **Hand-offs.** Dev packages a release, writes installation notes, opens a ticket; ops executes it under an SLA. Every hand-off is a queue, a translation step and a place where knowledge is lost.
- **The vicious cycle.** Painful deploys lead to more process, process makes deploys rarer, rare deploys bundle more changes, bigger bundles fail more often and are harder to diagnose, failures justify more process.
- **The last mile.** Work that happens after features are "done" and before users see them: integration, system, performance and security testing, user acceptance, deploy rehearsals, data migration. Teams that demo every sprint but ship quarterly carry this risk invisibly. The business gets no return until the change runs in production.

## What changes with continuous delivery

- **Small batches lower risk.** Fewer changes per deploy means fewer suspects when something breaks and a smaller rollback. This is counter-intuitive to people used to "stabilisation phases"; show them the data from their own incidents.
- **Automation, not deletion, of controls.** The checks that process was protecting (tests, approvals, audit trail, segregation of duties) stay; they move into the pipeline as repeatable gates that run on every change.
- **Deploy is routine.** The goal is that any engineer, including a new hire, can put a reviewed change into production safely through the pipeline, with no special ceremony.
- **Separate deploy from release** where useful: ship code dark behind a feature flag, then release to users gradually. This keeps batches small even when a feature is large.

## What to automate, roughly in order

Start where the pain and the error rate are highest; a common order:

1. Version control for everything: application, tests, build scripts, infrastructure, pipeline definitions, database migrations.
2. One-command build that produces a versioned artifact and runs fast automated tests (see continuous integration).
3. Environment creation and server configuration as code (see infrastructure as code).
4. Automated deploy of the same artifact to every environment, including database migrations.
5. Monitoring, alerting, centralised logs and metrics, so problems are seen before users report them.
6. Security and compliance checks as pipeline stages (dependency and image scanning, policy as code, audit logs).

```yaml
# Skeleton of an automated path to production (GitHub Actions)
name: delivery
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/build.sh          # compile, unit tests, package versioned artifact
      - run: ./scripts/acceptance.sh     # tests against a production-like environment
  deploy-staging:
    needs: build
    environment: staging
    runs-on: ubuntu-latest
    steps: [ { uses: actions/checkout@v4 }, { run: ./scripts/deploy.sh staging } ]
  deploy-production:
    needs: deploy-staging
    environment: production              # protected: required reviewers, OIDC to the cloud
    runs-on: ubuntu-latest
    steps: [ { uses: actions/checkout@v4 }, { run: ./scripts/deploy.sh production } ]
```

The structure matters more than the tool: one artifact, the same deploy script per environment, production gated by an explicit approval and credentials issued by OIDC rather than stored keys.

## Culture and ownership

- Build cross-functional teams that own a service end to end, including on-call. People who feel the pager write more operable code.
- Share tools and repositories: developers can read the infrastructure code, operators can read and review application changes.
- Run blameless post-incident reviews focused on system fixes (a missing test, an alert, an automation gap), not individuals.
- Make operational requirements (logging, health checks, metrics, graceful shutdown, configuration via environment) part of the definition of done, not a later ticket.
- Bring operations into design early: architecture decisions made at project start, with the least information, should be revisited as production teaches you.

## Measuring delivery performance

Track the four DORA keys from data the tools already hold, not from surveys alone:

| Metric | Source | Direction |
|---|---|---|
| Deployment frequency | Pipeline or deploy logs | Up |
| Lead time for changes (commit to production) | VCS timestamps plus deploy logs | Down |
| Change failure rate | Deploys linked to incidents, rollbacks, hotfixes | Down |
| Time to restore service | Incident open to resolved | Down |

```bash
# Rough deployment frequency from release tags over the last 90 days (GNU date)
git tag --list 'release-*' --sort=-creatordate \
  --format='%(creatordate:short)' | awk -v since="$(date -d '-90 days' +%F)" '$1 >= since' | wc -l
```

Current note: recent DORA reports call the fourth metric "failed deployment recovery time". Use the metrics to find bottlenecks, never to rank individuals; gaming them destroys their value.

## Safety when introducing automation

Automation multiplies whatever it does, including mistakes. When an agent adds or changes pipelines, deploy scripts or infrastructure code:

- Confirm which account, subscription, cluster, region and environment a job targets before running it.
- Run it against a non-production environment first and show the plan, diff or dry run.
- Get explicit approval before the first production run and for any destructive step.
- Keep a rollback path (previous artifact, previous infrastructure version) and test it.
- Never put secrets in code, pipeline YAML, logs or chat; use the platform secret store and short-lived credentials with least privilege.

## Workflow

1. Map the current path from commit to production: every step, hand-off, queue, manual action and who performs it.
2. Measure a baseline: deploy frequency, lead time, change failure rate, recovery time, and how many changes ship per deploy.
3. Pick the most painful or error-prone manual step and automate it; keep its control as an automated gate.
4. Put everything needed to rebuild the system in version control.
5. Shrink batch size: smaller merges, more frequent deploys, feature flags for incomplete work.
6. Add monitoring and alerting before increasing deploy frequency, so faster change is also observed change.
7. Review metrics and incidents regularly and repeat from step 3.

## Red flags

- "We'll do DevOps" meaning only a new team named DevOps that sits between dev and ops as a new hand-off.
- Releases bundling weeks of changes, code freezes, or release weekends treated as normal.
- Deploys performed by hand from a wiki page or a document attached to a ticket.
- Rollback that has never been rehearsed, or does not exist.
- Developers with no visibility into production logs, metrics or incidents.
- Automation added without tests, review or a non-production target.
- Metrics used to compare or punish individuals.
- Credentials for production pasted into pipeline variables in plain text or shared in chat.

## Related

- `../StartInProduction/startInProduction.md` — get a minimal system into production first.
- `../Monitoring/monitoring.md` — know when production is broken before users tell you.
- `../InfrastructureAsCode/infrastructureAsCode.md` — rebuild servers from versioned code.
- `../ContinuousIntegration/continuousIntegration.md` — fast feedback on every commit.
- `../DeliveryPipeline/deliveryPipeline.md` — one artifact promoted through environments.
- `../AdvancedTopics/advancedTopics.md` — deployment strategies, cloud, architecture.
- `../../AWS/Delivery/CiCdAndSdlc/ciCdAndSdlc.md` — AWS counterpart for CI/CD and the SDLC; AWS service syntax is not interchangeable with Azure or generic tools.
- `../../AWS/Fundamentals/WellArchitectedPillars/wellArchitectedPillars.md` — operational excellence and reliability pillars.
- `../../Azure/CloudComputingOverview/cloudComputingOverview.md` — Azure counterpart for cloud models.
- `../../../actions/dev.md` (when installed) — development workflow.
- `../../../actions/review.md` (when installed) — review workflow for pipeline and infrastructure changes.
- `../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` (when installed) — reliability, scalability and operability as design goals.
