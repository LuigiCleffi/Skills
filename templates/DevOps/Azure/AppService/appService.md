---
name: azure-app-service
description: How to host, deploy, scale and operate web apps and APIs on Azure App Service — App Service plans and pricing tiers (Free, Shared, Basic, Standard, Premium v3, Isolated v2), scale up vs scale out, autoscale rules and schedules, zip deploy, GitHub Actions with OIDC, deployment slots with swap, swap preview and sticky settings, health checks, Always On, app settings and Key Vault references, managed identity, custom domains and TLS certificates, Application Insights monitoring and alerts, Marketplace apps, and when to move to containers or VMs, based on Chapter 4 (Hosting on Azure Web Apps) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user deploys to Azure Web Apps or App Service, runs az webapp create, az webapp deploy or az webapp deployment slot swap, sees quota exceeded or "site stopped" on a Free plan, 503 or cold starts after idle, wants staging slots or blue-green on Azure, needs autoscale at a CPU threshold, a custom domain or HTTPS certificate, a publish profile replaced by CI, connection strings out of web.config, or asks whether App Service can run something that must be installed into the OS or the GAC.
---

# Azure App Service

App Service is the default Azure home for a standard web app or API: you deploy code or a container to an App Service plan and the platform handles OS patching, load balancing and scaling. Pick the plan tier by features you need (slots, autoscale, zone redundancy, VNet integration), deploy through a pipeline into a staging slot, verify, then swap. Every plan change, swap, scale rule and setting change on production needs a confirmed target and explicit approval.

## Plans and tiers

The plan is the set of VMs; every app in a plan shares its CPU and memory and scales together.

| Tier | Isolation | Key capabilities | Use for |
|---|---|---|---|
| Free (F1), Shared (D1) | Shared VMs with other customers, daily CPU quotas | No SLA, no slots, no autoscale, no Always On | Experiments only |
| Basic (B1–B3) | Dedicated VMs | Manual scale (few instances), custom domains and TLS, Always On | Low-traffic internal apps, dev/test |
| Standard (S1–S3) | Dedicated | Autoscale, deployment slots | Smaller production apps |
| Premium v3 (P0v3–P3v3, memory-optimized variants) | Dedicated, faster hardware | More slots and instances, zone redundancy, better price/performance | Most production workloads |
| Isolated v2 | Single-tenant App Service Environment in your VNet | Network isolation, very high scale | Strict network or compliance requirements |

- Free and Shared quotas stop the app when exceeded; never run anything users depend on there.
- Too many apps in one plan compete for resources and scale as one unit. Split noisy or critical apps into their own plans.
- Choose Linux or Windows per runtime; a plan is one OS. Check available runtimes with `az webapp list-runtimes --os linux`.

Current note: the book describes "Azure Websites/Web Apps" with Free, Shared and Standard modes on small/medium/large VMs and the classic management portal. The product is now Azure App Service with the tiers above, managed in the Azure portal or through ARM, Bicep or the CLI; old instance sizes and per-tier limits in the book no longer apply. Check current limits in the docs before committing to a tier.

## Provision as code

```bicep
param appName string
param location string = resourceGroup().location

resource plan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'plan-${appName}'
  location: location
  kind: 'linux'
  sku: { name: 'P0v3', capacity: 2 }
  properties: { reserved: true }          // required for Linux plans
}

resource app 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: true
      healthCheckPath: '/healthz'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}
```

```bash
az account show -o table
az deployment group what-if -g rg-shop-dev -f appservice.bicep -p appName=app-shop-dev-001
```

## Deploy through a pipeline, not a publish profile

- Publish profiles carry deployment credentials (basic auth for FTP and Web Deploy). Treat one as a secret, never commit it, and prefer disabling basic-auth publishing on the app so only identity-based deployment works.
- Prefer CI with OIDC (see the setup skill) and an artifact built once and promoted.

```yaml
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/webapps-deploy@v3
        with:
          app-name: app-shop-prod-001
          slot-name: staging
          package: ./publish
```

```bash
# Equivalent CLI zip deploy into a slot
az webapp deploy -g rg-shop-prod -n app-shop-prod-001 --slot staging --src-path app.zip --type zip
```

- Portal "Deployment Center" integrations with GitHub, Bitbucket, local Git or Azure Repos are fine for prototypes; for production keep the pipeline definition in the repository.

Current note: the Dropbox and Visual Studio Online continuous deployment options the book links to are gone or renamed (Visual Studio Online became Azure DevOps). Use GitHub Actions, Azure Pipelines or another CI system.

## Deployment slots and swaps

A slot is a live copy of the app with its own hostname; swapping exchanges slots after warming the target instances, so production gets new code without a cold start.

```bash
az webapp deployment slot create -g rg-shop-prod -n app-shop-prod-001 --slot staging
az webapp config appsettings set -g rg-shop-prod -n app-shop-prod-001 --slot staging \
  --slot-settings ASPNETCORE_ENVIRONMENT=Staging          # sticky: stays with the slot
# smoke test https://app-shop-prod-001-staging.azurewebsites.net, then with approval:
az webapp deployment slot swap -g rg-shop-prod -n app-shop-prod-001 --slot staging --target-slot production
# rollback = swap again
```

- Mark environment-specific settings and connection strings as slot settings ("deployment slot setting") or the staging values will travel into production on swap.
- Use swap with preview (`--action preview`, then `--action swap` or `--action reset`) when production settings must be applied and verified before traffic moves.
- Set `healthCheckPath` and a warm-up path so the swap waits for a healthy app; failing health checks also pull bad instances out of rotation.
- Database schema changes must be backward compatible with the previous version, since rollback by swap does not roll back data.
- Traffic routing (`az webapp traffic-routing set --distribution staging=10`) gives a simple canary.

## Scaling

- **Scale up** (bigger tier/size) for memory or CPU per request; causes a restart of the plan's instances.
- **Scale out** (more instances) for throughput; the app must be stateless (sessions and files in Redis, a database or Blob Storage). ARR affinity cookies hide statefulness; turn affinity off once state is externalized.

```bash
PLAN_ID=$(az appservice plan show -g rg-shop-prod -n plan-shop-prod --query id -o tsv)
az monitor autoscale create -g rg-shop-prod --resource "$PLAN_ID" \
  --name shop-autoscale --min-count 2 --max-count 8 --count 2
az monitor autoscale rule create -g rg-shop-prod --autoscale-name shop-autoscale \
  --condition "CpuPercentage > 70 avg 10m" --scale out 1
az monitor autoscale rule create -g rg-shop-prod --autoscale-name shop-autoscale \
  --condition "CpuPercentage < 30 avg 15m" --scale in 1
```

- Always pair a scale-out rule with a scale-in rule, keep a minimum of two instances for production, and set a maximum that fits the budget and the database's capacity.
- Scheduled profiles handle known peaks; metric rules handle surprises.

## Configuration and secrets

- App settings become environment variables; connection strings in `web.config` or `appsettings.json` should move to app settings, and secrets to Key Vault.
- Use the managed identity plus Key Vault references: `@Microsoft.KeyVault(SecretUri=https://kv-shop-prod.vault.azure.net/secrets/DbPassword/)`, after granting the identity `Key Vault Secrets User`. Better still, connect to Azure SQL, Storage and Redis with the managed identity and no secret at all.
- Never echo app settings to logs or chat; `az webapp config appsettings list` prints secret values.

## Domains and TLS

- Keep `httpsOnly: true` and minimum TLS 1.2. Custom domains need Shared tier or above; TLS bindings need Basic or above.
- Validate domain ownership with the TXT `asuid` record, then a CNAME (or A record for apex). Changing DNS for a production domain needs approval and a TTL plan.
- Use App Service managed certificates or certificates stored in Key Vault; track expiry.

## Monitoring

- Enable Application Insights (OpenTelemetry-based distro) for requests, dependencies, exceptions and traces; stream logs with `az webapp log tail` while debugging.
- Alert on HTTP 5xx rate, response time, health-check failures, CPU and memory percentage of the plan, and instance count at maximum. Send alerts to an action group the on-call team watches, not one person's mailbox.

## When App Service is the wrong fit

- Software that must be installed into the OS, registered in the GAC or needs drivers: use a custom container on App Service (Windows or Linux), Container Apps, AKS or VMs.
- Long-running heavy background processing: move it to Functions, Container Apps jobs or a separate plan.
- Marketplace templates (WordPress and similar) are a fast start, but you still own patching the application and its plugins, and the database is a separate service to size and back up.

Current note: the book's alternatives (Cloud Services web roles) are retired, and the ClearDB MySQL offering for gallery apps is gone; use containers or VMs for OS control and Azure Database for MySQL flexible server for MySQL.

## Workflow
1. Confirm tenant, subscription, region, resource group and environment.
2. Choose OS, runtime and tier from required features; decide plan sharing.
3. Describe plan, app, identity, settings, health check and slots in Bicep or Terraform; run what-if and get approval.
4. Move secrets to Key Vault or managed identity; mark slot-sticky settings.
5. Build once in CI; deploy to the staging slot with OIDC; smoke test.
6. Swap to production with approval; watch Application Insights; swap back on regression.
7. Configure autoscale (out and in), alerts, custom domain and TLS; record rollback steps.

## Red flags
- Production on Free or Shared tier, or a single instance.
- Publish profile or FTP credentials committed, emailed or pasted into chat.
- Deploying straight to the production slot from a developer machine.
- Environment-specific settings not marked as slot settings.
- Scale-out rules with no scale-in rule or no maximum.
- In-memory session state with autoscale and ARR affinity masking it.
- Connection strings with passwords in `web.config` or `appsettings.json` in the repository.
- Heavy background jobs sharing a plan with a latency-sensitive web app.

## Related
- `../WebJobs/webJobs.md` — background jobs running inside the app's plan.
- `../RedisCache/redisCache.md` — externalizing session state and caching for scale-out.
- `../SetupAndSubscription/setupAndSubscription.md` — OIDC deployment identities and RBAC.
- `../VirtualMachines/virtualMachines.md`, `../SqlDatabase/sqlDatabase.md` — OS control and the relational back end.
- `../../AWS/Delivery/ElasticBeanstalk/elasticBeanstalk.md` — closest AWS counterpart; configuration syntax is not interchangeable.
- `../../AWS/Delivery/BlueGreenDeployments/blueGreenDeployments.md` — blue-green concepts on AWS.
- `../../Practices/DeliveryPipeline/deliveryPipeline.md` — build once, promote through environments.
- `../../Practices/Monitoring/monitoring.md` — what to alert on and why.
- `../../../actions/dev.md` (when installed), `../../../CleanCode/Systems/systems.md` (when installed).
