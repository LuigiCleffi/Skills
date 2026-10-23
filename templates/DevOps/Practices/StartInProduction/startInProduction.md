---
name: devops-start-in-production
description: How to get a first, minimal but real production environment running end to end before polishing features - a walking skeleton with separate web/app and database tiers, production-like local environments (Vagrant/VirtualBox then, Docker Compose now), installing middleware and a database, a dedicated least-privilege application database user, removing anonymous/default accounts, restricting bind-address and network access, TLS on the app server, JVM/runtime memory settings, building once into a versioned release-candidate artifact (jar/war/image), externalising configuration such as JNDI DataSources or environment variables, deploying and smoke-testing by tailing logs and probing URLs, based on Chapter 2 (Everything starts in production) of DevOps na Pratica (Danilo Sato). Use when standing up a new environment or the first deploy of a service, asked to "just get it running on a server", writing a docker-compose for app plus database, choosing where builds run, connection strings or passwords are baked into the artifact, GRANT ALL or root is used by the app, bind-address = 0.0.0.0 appears, a self-signed certificate or SSLv3 is configured, Tomcat/JVM runs out of memory (-Xmx), or a manual setup needs to be recorded so it can be automated later.
---

# Start in Production

Software delivers nothing until users run it, so treat the "last mile" as the first mile: put a thin, complete slice of the system (app tier, data tier, TLS, configuration, deploy) into a real environment early. Do it once carefully, record every step, and use that record as the specification for the automation that replaces it.

## Shape the first environment

- Start with the simplest topology that is honest about production: application tier and database on separate hosts or containers, talking over the network with real credentials. A single box hides network, permission and configuration problems.
- Make it reproducible from day one. Then, a Vagrantfile declaring each VM with a fixed private IP; now, usually a Compose file locally and the cloud provider's managed services for real environments.
- Write down every command, file edit and value chosen during manual setup. That log becomes the checklist for infrastructure as code; anything not written down will be forgotten during the next outage.

```yaml
# compose.yaml - production-like local stack; secrets come from a git-ignored file
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: shop
      POSTGRES_USER: shop_owner
      POSTGRES_PASSWORD_FILE: /run/secrets/db_owner_password
    secrets: [db_owner_password]
    volumes: [dbdata:/var/lib/postgresql/data]
  app:
    image: registry.example.com/shop:${APP_VERSION:?set APP_VERSION}
    environment:
      DB_URL: jdbc:postgresql://db:5432/shop
      DB_USER: shop_app
      DB_PASSWORD_FILE: /run/secrets/db_app_password
      JAVA_TOOL_OPTIONS: -XX:MaxRAMPercentage=75
    secrets: [db_app_password]
    ports: ["8443:8443"]
    depends_on: [db]
secrets:
  db_owner_password: { file: ./secrets/db_owner_password }
  db_app_password:   { file: ./secrets/db_app_password }
volumes: { dbdata: {} }
```

Current note: the book's stack (Vagrant 1.5, VirtualBox, Ubuntu 12.04, Java 6, Tomcat 7, Maven 2) is long past end of life. Containers or managed platforms are the usual starting point now; the principles below are unchanged.

## Database tier: secure by default

- Install the server from the distribution or vendor repository, or use a managed database service.
- Remove defaults that ship insecure: anonymous users, test databases, remote root login.
- Create one database or schema per application and a dedicated application role with only the privileges it needs. Keep the schema owner (migrations) separate from the runtime user (DML only).
- Listen only where needed. Opening the listener to all interfaces is acceptable only behind a firewall or security group that admits the app tier alone.

```sql
-- MySQL 8: runtime user limited to the app subnet and to DML on one schema
CREATE DATABASE shop;
CREATE USER 'shop_app'@'10.0.1.%' IDENTIFIED BY '<from secret store>';
GRANT SELECT, INSERT, UPDATE, DELETE ON shop.* TO 'shop_app'@'10.0.1.%';
```

Current note: `GRANT ... IDENTIFIED BY` (used in older guides) was removed in MySQL 8.0; create the user first, then grant. Never use `GRANT ALL ... TO 'app'@'%'` for a runtime account.

- Do not type the real password into the command line where it lands in shell history; prompt for it, or read it from the secret store in the provisioning tool.

## Application tier

- Install the runtime and server via packages or a base image; pin versions.
- Size memory explicitly. Default heap limits are often too small for real applications and too large for small containers. In containers prefer percentage-based flags (`-XX:MaxRAMPercentage`) so the limit follows the container.
- Terminate TLS with a real certificate (ACME/Let's Encrypt, AWS Certificate Manager, Azure Key Vault certificates) at the load balancer or app server. Self-signed certificates are for local use only.

Current note: the book enables `sslProtocol="SSLv3"`. SSLv3 is broken (POODLE) and TLS 1.0/1.1 are deprecated; allow only TLS 1.2 and 1.3.

## Build once, produce a release candidate

- A build compiles, resolves dependencies, runs automated tests and packages a versioned artifact (jar, war, container image). Each successful build is a release candidate.
- Build on a dedicated CI runner in a production-like environment, never on the production server. Installing compilers and source checkouts on production enlarges the attack surface and makes builds unrepeatable.
- Tag artifacts with an immutable version (semantic version plus commit SHA, or image digest) and store them in an artifact repository or registry.
- Promote that same artifact through every environment. Rebuilding per environment means production runs something that was never tested.

## Externalise configuration

- Anything that differs between environments (hosts, ports, credentials, feature flags) lives outside the artifact. The book uses container-managed JNDI DataSources for this; environment variables, mounted files or a configuration service do the same job.
- Secrets come from a secret store (AWS Secrets Manager or Parameter Store, Azure Key Vault, HashiCorp Vault, Kubernetes Secrets backed by one of those), injected at runtime. Never commit them, never write them into the artifact, logs or chat.
- Fail fast at startup if a required setting is missing, with a message naming the setting but not its value.

## Deploy and verify

- Deploy by placing the artifact where the runtime picks it up (drop a war, roll a new image, update a service) through a script, not by hand-copying files.
- Watch startup logs until the application reports ready; first startup may run schema migrations and take longer.
- Smoke test from outside the host, through the same path users take:

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${1:?usage: smoke.sh https://shop.staging.example.com}"
curl -fsS --max-time 10 "$BASE_URL/health" | grep -q '"status":"UP"'
curl -fsS --max-time 10 -o /dev/null -w '%{http_code}\n' "$BASE_URL/" | grep -q '^200$'
echo "smoke test passed for $BASE_URL"
```

- Change default admin credentials of the application and middleware before exposing anything.

## Safety

- Confirm the target host, account or subscription, region and environment before installing or changing anything; production work needs explicit approval.
- Show what will change (the commands, Compose diff, plan) before running it.
- Keep the previous artifact and configuration so the deploy can be reverted; know the rollback command before you deploy.
- Least privilege everywhere: app user, OS user running the service, cloud role of the host.
- Treat any password used in a tutorial or chat as compromised; generate new ones in the secret store.

## Workflow

1. Define the minimal production topology and the single user journey that proves it works.
2. Create the environment reproducibly (Compose, VM definitions, or managed services) and log every manual step.
3. Install and harden the database: remove defaults, create schema, owner role and least-privilege runtime role, restrict network access.
4. Install the runtime, configure TLS 1.2+ with a real certificate, set memory limits explicitly.
5. Build on CI into a versioned artifact; store it in a registry or repository.
6. Inject configuration and secrets at runtime; deploy the artifact by script.
7. Smoke test from outside, check logs, then hand the step log to infrastructure-as-code work.

## Red flags

- Builds run on the production server, or production runs a locally built artifact.
- Database credentials, hostnames or keys inside the artifact or the repository.
- The application connecting as root, as the schema owner, or with `GRANT ALL ... '%'`.
- Database listening on all interfaces with no firewall rule limiting clients.
- Self-signed certificates or SSLv3/TLS 1.0 in a user-facing environment.
- Default admin/admin accounts left active.
- A "production" that exists only as one person's memory of the commands they typed.

## Related

- `../WhatIsDevOps/whatIsDevOps.md` — why the last mile should be the first mile.
- `../Monitoring/monitoring.md` — add checks as soon as something is in production.
- `../InfrastructureAsCode/infrastructureAsCode.md` — turn the manual step log into code.
- `../ContinuousIntegration/continuousIntegration.md` — where builds and tests should run.
- `../DeliveryPipeline/deliveryPipeline.md` — promoting one artifact through environments.
- `../../AWS/Fundamentals/FundamentalServices/fundamentalServices.md` — AWS counterpart (EC2, VPC, RDS); syntax not interchangeable with Azure.
- `../../AWS/Fundamentals/IamAndSecrets/iamAndSecrets.md` — AWS secrets and least privilege.
- `../../Azure/AppService/appService.md` — Azure counterpart for hosting a web app.
- `../../Azure/VirtualMachines/virtualMachines.md` — Azure counterpart for VM-based tiers.
- `../../../DBA/PostgreSQL/DatabaseAdministration/databaseAdministration.md` (when installed) — roles, `pg_hba.conf`, backups.
- `../../../CleanCode/Systems/systems.md` (when installed) — separating construction and configuration from use.
- `../../../actions/dev.md` (when installed) — development workflow.
