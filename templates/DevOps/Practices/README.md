## AI Skills

Before setting up an environment, monitoring, infrastructure or
configuration code, continuous integration, a delivery pipeline, or a
deployment strategy, find the skills that apply to the task in the table
below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of *DevOps na Prática: Entrega de Software
Confiável e Automatizada* (Danilo Sato, Casa do Código). The practices are
platform-neutral. The book's examples use Vagrant, Puppet, Jenkins, Nagios,
and Graphite; the skills keep the practice, point to current tools, and
carry a short "Current note" where the tooling has moved on. For the
platform the project runs on, also read `../AWS/README.md` or
`../Azure/README.md`.

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./WhatIsDevOps/whatIsDevOps.md` | Adopting DevOps or continuous delivery, deploys are rare, manual or risky, dev and ops hand off through tickets, or measuring DORA metrics. |
| 2 | `./StartInProduction/startInProduction.md` | Standing up a first environment or first deploy: app and database tiers, least-privilege database user, TLS, a build-once artifact, external config. |
| 3 | `./Monitoring/monitoring.md` | Setting up checks and alerts, writing Nagios-style or Prometheus checks, noisy or untested alerts, or users noticing outages first. |
| 4 | `./InfrastructureAsCode/infrastructureAsCode.md` | Rebuilding servers from code, idempotent Puppet, Ansible or Terraform, guarded commands, plan before apply, secrets out of manifests and state. |
| 5 | `./ConfigurationManagement/configurationManagement.md` | Structuring Puppet or Ansible code into modules or roles, class vs define, Hiera data, pinning external modules, fixing duplicate declarations. |
| 6 | `./ContinuousIntegration/continuousIntegration.md` | Setting up or fixing CI: Jenkinsfile or GitHub Actions, red or flaky builds, test placement, artifact archiving, CI server as code. |
| 7 | `./DeliveryPipeline/deliveryPipeline.md` | Designing commit-to-production stages, promoting one versioned artifact, signed packages or images, testing infrastructure code, gating production deploys. |
| 8 | `./AdvancedTopics/advancedTopics.md` | Cloud moves, post-mortems, database migrations, blue-green and orchestration, per-environment config, SLAs and architecture, secrets and SSH hardening. |

# Context for AI: DevOps Practice

## 1. Deliver Small and Often

Small, frequent, automated releases are safer than large, rare, manual
ones. Shorten the path from commit to production and make every step
repeatable before making it fast.

## 2. One Artifact, Promoted

Build once, version it, and promote the same artifact through every
environment. Configuration differs per environment and lives outside the
artifact; code does not get rebuilt on the way to production.

## 3. Everything in Version Control

Application code, infrastructure, configuration, pipeline definitions, and
monitoring checks live in version control and are reviewed like code.
Servers are rebuilt from code, not repaired by hand.

## 4. Production Is the Goal

A feature is done when it runs in production and you can see that it works.
Monitoring, alerting, and a rollback path are part of the delivery, not a
follow-up.

## 5. Destructive and Hard-to-Reverse Operations

Production deploys, infrastructure applies that replace or delete
resources, database migrations, credential rotation, and firewall or access
changes need explicit approval for the specific target. Show the plan or
dry run first, state how to verify and how to roll back, and keep secrets
out of code, logs, and chat.
