---
name: azure-cloud-computing-overview
description: How to decide whether and how to run a workload in the cloud — public, private and hybrid cloud, the IaaS, PaaS and SaaS service models (plus containers and serverless), the shared responsibility split each model implies, pay-as-you-go cost behavior, and the four elasticity patterns (rapid growth, predictable peaks, unexpected spikes, on-and-off batch bursts) mapped to Azure autoscale, scheduled scaling and ephemeral compute, based on Chapter 1 (Cloud Computing Overview) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user asks whether to move an app to the cloud, IaaS vs PaaS vs SaaS, VM vs App Service vs Functions vs containers, public vs private vs hybrid cloud, who patches the OS, lift-and-shift vs re-platform, sizing for Black Friday or a launch, a report that takes hours and could use more machines temporarily, paying for idle servers, cloud cost surprises, Azure Stack, Azure Local, or "what does the provider manage for me".
---

# Cloud Computing Overview

Choose the highest-level service model that still meets the workload's control requirements: SaaS before PaaS, PaaS (or serverless) before containers, containers before raw VMs. Every step down buys control and costs operational work you then own (patching, scaling, backups, hardening). Then pick the elasticity pattern the load actually follows and design scaling for that pattern, not for a guessed peak.

## Deployment models

| Model | What it is | Choose when |
|---|---|---|
| Public cloud | Provider's data centers, shared multi-tenant, pay per use, no minimum commitment by default | Default for new workloads; variable load; global reach |
| Private cloud | Cloud-style self-service on your own hardware | Hard data-residency or disconnected-site requirements; existing hardware investment |
| Hybrid | Public cloud joined to on-premises via VPN/ExpressRoute and identity federation | Gradual migration; data that must stay on-premises while front ends scale in public cloud |

- Hybrid adds two failure domains and a network link; design for that link failing (queueing, retries, degraded mode).
- Identity is the backbone of hybrid: federate on-premises directory users to Microsoft Entra ID instead of creating parallel cloud accounts.

Current note: the book's private-cloud stack (Windows Server 2012 with Windows Azure Pack) is long superseded; Microsoft's on-premises offerings today are Azure Stack Hub and Azure Local (formerly Azure Stack HCI), managed through Azure Arc.

## Service models and who owns what

| Layer | On-premises | IaaS (VMs) | Containers (AKS, Container Apps) | PaaS (App Service, SQL Database) | Serverless (Functions) | SaaS |
|---|---|---|---|---|---|---|
| Hardware, network, virtualization | You | Provider | Provider | Provider | Provider | Provider |
| OS install and patching | You | You | Provider (nodes partly you on AKS) | Provider | Provider | Provider |
| Runtime, middleware | You | You | You (image) | Provider | Provider | Provider |
| Application code and config | You | You | You | You | You | Provider |
| Data, identities, access policy | You | You | You | You | You | You |

- Data, identity and access configuration are always yours, even in SaaS. A misconfigured public storage container or an over-privileged account is never the provider's fault.
- IaaS is right when you need OS-level control: custom drivers, software that must be installed into the OS or a global assembly cache, licensing tied to machines, or a lift-and-shift with no time to re-platform.
- PaaS is right for standard web apps, APIs and databases: you deploy code, the platform patches, load balances and scales.
- Serverless fits event-driven, spiky or low-traffic work billed per execution; watch cold starts, execution time limits and per-invocation cost at high volume.
- SaaS fits commodity capabilities (email, CRM, identity): buy, do not build.

## Elasticity patterns

Cloud cost follows usage, so map the load shape to a scaling mechanism.

| Pattern | Shape | Azure mechanism |
|---|---|---|
| Rapid growth | Start minimal, grow steadily with adoption | Start on small PaaS tiers; scale up then out; revisit tier quarterly; reservations once the baseline is stable |
| Predictable peaks | Known events (Black Friday, enrollment, month-end) | Scheduled autoscale profiles that raise the minimum instance count before the event and lower it after |
| Unexpected spikes | Viral traffic, bot storms | Metric-based autoscale with headroom, caching and a CDN in front, queue-based load leveling, rate limiting |
| On and off | Heavy batch for hours, then nothing | Ephemeral compute: Functions, Container Apps jobs, Azure Batch, or scale-to-zero; delete or deallocate when done |

```bash
# Scheduled scale-out before a known peak (App Service plan); confirm the subscription first
az account show --query "{sub:name, id:id}" -o table
az monitor autoscale profile create \
  --resource-group rg-shop-prod --autoscale-name shop-autoscale \
  --name black-friday --min-count 6 --max-count 20 --count 6 \
  --start 2026-11-27T00:00 --end 2026-11-30T23:59 --timezone "E. South America Standard Time"
```

- Autoscale only helps if the app is horizontally scalable: no in-memory session state, no local disk as the source of truth, idempotent background work. Externalize state (Redis, a database, blob storage) before relying on scale-out.
- Scaling a database usually lags scaling web tiers; a scale-out of the front end can simply move the bottleneck to the data store.
- Set a maximum instance count and a budget alert. Uncapped autoscale turns a bot attack into a bill.

## Cost model

- Pay-as-you-go removes capital expense but bills idle resources: a stopped-but-allocated VM, an empty App Service plan, an unused public IP all cost money.
- Steady baseline load is cheaper on reservations or savings plans; bursty load on autoscale or consumption plans.
- Egress (data leaving a region or Azure) and cross-region replication are frequent surprise costs; estimate them with the Azure pricing calculator.
- Tag every resource with owner, environment and cost center from day one so cost can be attributed.

## Availability expectations

- Each managed service publishes an SLA for a specific configuration (for example, two or more instances, or a zone-redundant SKU). A single-instance deployment usually gets a lower SLA or none.
- The availability of a chain of dependencies is roughly the product of their SLAs: an app at 99.95% calling a database at 99.99% and a cache at 99.9% is below 99.9% overall unless it degrades gracefully when a dependency fails.
- An SLA is a billing credit, not a guarantee. Meet the target with redundancy (zones, regions), health checks and tested failover.

## Migration approaches

| Approach | What changes | When |
|---|---|---|
| Rehost (lift and shift) | Nothing; VMs move as is | Deadline-driven exit from a data center |
| Replatform | Swap hosting (IIS VM to App Service, SQL Server VM to SQL Database) | Most web apps; big ops savings for small code changes |
| Refactor | Re-architect for cloud-native services | When scale, release speed or cost justifies it |
| Replace | Adopt SaaS | Commodity capability |

## Workflow
1. Describe the workload: traffic shape, state, data sensitivity and residency, OS or install dependencies, availability target, budget.
2. Pick the deployment model (public, hybrid, private) from residency and connectivity constraints.
3. Pick the highest service model that satisfies the control requirements; write down why lower levels were rejected.
4. List what you own under that model (patching, backups, scaling, identity) and assign each to someone.
5. Match the load to an elasticity pattern and choose the scaling mechanism; make the app stateless where scale-out is planned.
6. Estimate cost with the pricing calculator, including egress; set budgets and alerts before go-live.
7. Before creating anything, confirm tenant, subscription, region and environment, and get approval for production spend.

## Red flags
- Choosing VMs by default for a standard web app "to keep control" without an owner for patching.
- Assuming the provider backs up or secures your data and access configuration in PaaS or SaaS.
- Autoscale configured on an app that keeps sessions in memory or writes to local disk.
- No maximum instance count, no budget, no cost alerts.
- Sizing permanently for the yearly peak instead of scheduling scale for it.
- Hybrid designs that fail hard when the VPN link drops.
- Batch servers left running after the job finishes.

## Related
- `../AzurePlatform/azurePlatform.md` — the Azure service landscape and how to pick services and regions.
- `../SetupAndSubscription/setupAndSubscription.md` — tenants, subscriptions, budgets and tooling before you build.
- `../AppService/appService.md` — PaaS web hosting and autoscale in practice.
- `../VirtualMachines/virtualMachines.md` — IaaS when you need OS control.
- `../../AWS/Fundamentals/WellArchitectedPillars/wellArchitectedPillars.md` — AWS framing of reliability, cost and operational trade-offs; concepts transfer, service names and syntax do not.
- `../../Practices/WhatIsDevOps/whatIsDevOps.md` — the delivery culture these platforms support.
- `../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` (when installed) — describing load and scalability before choosing infrastructure.
- `../../../CleanCode/Systems/systems.md` (when installed) — separating construction from use so hosting can change.
