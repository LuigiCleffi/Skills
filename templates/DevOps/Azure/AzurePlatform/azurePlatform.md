---
name: azure-platform
description: How to navigate and choose among Microsoft Azure services — compute options (App Service, Functions, Container Apps, AKS, Virtual Machines, Batch), storage and polyglot persistence (Blob, Table, Azure SQL Database, Cosmos DB, Azure Cache for Redis), integrated services (Azure AI Search, Traffic Manager, Front Door), regions, availability zones and region pairs, Azure Resource Manager and the resource hierarchy, Windows and Linux support, VHD portability and language SDKs, based on Chapter 2 (Getting to Know Microsoft Azure) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user asks which Azure service to use for a workload, where to store images, key-value data, documents or relational data, how to route users to the nearest region, which region or zone to deploy to, whether Azure supports Linux, Java, Node.js or Python, how to avoid lock-in, what ARM is, or mentions Windows Azure, DocumentDB, Azure Search, Traffic Manager, Front Door, availability zones, region pair, polyglot persistence or az provider register.
---

# Azure Platform

Azure is a catalog of managed services on one control plane, Azure Resource Manager (ARM). Pick each service by the job (compute shape, data access pattern, global routing), prefer managed PaaS over self-run software, and place everything in a region and zone layout that matches the availability target. Everything is created, changed and deleted through ARM, so it can and should be described as code.

## Resource hierarchy and control plane

```
Microsoft Entra tenant
└─ Management groups (policy and RBAC inheritance)
   └─ Subscriptions (billing and quota boundary)
      └─ Resource groups (lifecycle boundary: deploy and delete together)
         └─ Resources (app, database, cache, ...)
```

- Every portal click, CLI command, Bicep/ARM template, Terraform run and SDK call goes through ARM; RBAC, Azure Policy, locks and the Activity Log apply uniformly.
- A resource group should hold things that share a lifecycle. Do not mix production and test in one group: deleting a group deletes everything in it.
- Resource providers must be registered per subscription before first use (`az provider register --namespace Microsoft.Web`); a `MissingSubscriptionRegistration` error means this step is missing.

Current note: the book predates Azure Resource Manager as the default. Azure Service Manager (classic deployment model), the classic management portal and classic Cloud Services have been retired; all new work uses ARM, the Azure portal, Azure CLI, Azure PowerShell, Bicep or Terraform.

## Compute: choose by workload shape

| Workload | Prefer | Avoid when |
|---|---|---|
| Web app or API, standard runtime | App Service | Needs OS-level installs; then containers or VMs |
| Event-driven, spiky, short tasks | Azure Functions | Long-running or very high steady throughput |
| Containers without managing Kubernetes | Azure Container Apps | You need full Kubernetes APIs |
| Many services, Kubernetes skills in-house | AKS | Small team without cluster operations capacity |
| Legacy, custom OS, licensed software | Virtual Machines / scale sets | A PaaS option fits |
| Large parallel compute (rendering, simulations) | Azure Batch, or VM scale sets | Small or interactive jobs |
| Background jobs tied to a web app | WebJobs or Functions | Independent scaling needed |

## Storage and data: polyglot persistence

Pick the store by access pattern, not habit. Using several stores is fine when each has a clear job and an owner.

| Need | Service |
|---|---|
| Files, images, backups, static assets | Blob Storage (with a CDN or Front Door for public delivery) |
| Cheap key-value or wide rows, simple lookups by key | Table Storage, or Cosmos DB for Table for global distribution and SLAs |
| Relational data, transactions, reporting | Azure SQL Database (or Azure Database for PostgreSQL/MySQL) |
| JSON documents, global distribution, tunable consistency | Azure Cosmos DB |
| Low-latency cache, sessions, rate limits | Azure Cache for Redis (see its retirement note in the Redis skill) |
| Full-text and vector search over your content | Azure AI Search |

Current note: DocumentDB was renamed Azure Cosmos DB in 2017 and now offers several APIs (NoSQL, MongoDB, Cassandra, Gremlin, Table, PostgreSQL); Azure Search is now Azure AI Search. Treat the book's service names as historical.

- Every additional store adds backup, monitoring, security and consistency work. Justify each one.
- Keeping data stores in the same region as the compute that uses them avoids latency and egress cost.

## Global routing and integrated services

| Need | Service | Layer |
|---|---|---|
| DNS-based routing to the closest or healthiest region | Traffic Manager | DNS |
| Global HTTP entry point with TLS, caching, WAF and fast failover | Azure Front Door | HTTP (layer 7) |
| Regional HTTP load balancing with WAF | Application Gateway | HTTP, regional |
| Non-HTTP regional load balancing | Azure Load Balancer | TCP/UDP |

- Traffic Manager does not copy your application between regions; it only answers DNS queries. Deploying and keeping each region's copy in sync (code, config, data) is your job.
- DNS-based failover is limited by client and resolver caching of the TTL; Front Door fails over faster for HTTP.

## Regions, zones and pairs

- Choose the region by data residency, latency to users, service availability and price; not every service or SKU exists in every region (`az account list-locations -o table`; check product availability by region).
- Availability zones are physically separate data centers within a region. Zone-redundant SKUs (App Service Premium v3, zone-redundant SQL Database, ZRS storage) survive a data-center loss with no app changes.
- Many regions have a paired region used for platform update sequencing and geo-redundant storage replication; newer regions may have no pair. Plan multi-region disaster recovery explicitly; do not assume it.

## Openness and portability

- Azure runs Windows and Linux; App Service, Functions and Container Apps support .NET, Java, Node.js, Python and PHP (support varies by OS and version).
- Official SDKs are open source under the Azure organization on GitHub; use the current `Azure.*` (.NET), `@azure/*` (JavaScript), `azure-*` (Python) and `com.azure` (Java) packages, authenticating with `DefaultAzureCredential` rather than keys.
- Portability is real at the IaaS level (VHDs can be uploaded and downloaded) and with containers; PaaS-specific features (slots, Key Vault references, Cosmos DB APIs) create soft lock-in. Accept it consciously and keep it behind boundaries in code.

## Making changes safely

```bash
az account show -o table                      # confirm tenant and subscription
az group create -n rg-catalog-dev -l brazilsouth --tags env=dev owner=team-catalog
az deployment group what-if -g rg-catalog-dev -f main.bicep -p env=dev
az deployment group create -g rg-catalog-dev -f main.bicep -p env=dev
```

- Run `what-if` and review it before every deployment; get explicit approval for production and anything that deletes or replaces resources (`Delete`, `Create` on an existing name with changed immutable properties).
- Use `CanNotDelete` locks on production resource groups holding data.
- Never put keys or connection strings in templates or parameter files; use managed identity and Key Vault references.

## Workflow
1. Write down the workload's compute shape, data access patterns, users' locations, residency rules and availability target.
2. Choose compute from the table, preferring managed services; justify any VM.
3. Choose one data store per access pattern; justify each additional store.
4. Choose region(s), zone redundancy and global routing to meet the availability target and residency.
5. Lay out management groups, subscriptions and resource groups by environment and lifecycle.
6. Describe resources in Bicep or Terraform; run what-if or plan, review, and apply with approval.
7. Wire identity (managed identities, RBAC), secrets (Key Vault) and monitoring (Azure Monitor, Application Insights) before go-live.

## Red flags
- Designing against classic (ASM) resources, the classic portal or Cloud Services (classic).
- Production and test in the same resource group or subscription.
- Assuming Traffic Manager replicates data or code between regions.
- Assuming a region pair or geo-redundant storage is a tested disaster-recovery plan.
- A new data store added with no owner, backup or monitoring.
- Using account keys or connection strings where managed identity is supported.
- Picking a region without checking that every needed service and SKU is available there.

## Related
- `../CloudComputingOverview/cloudComputingOverview.md` — service models and elasticity patterns.
- `../SetupAndSubscription/setupAndSubscription.md` — tenant, subscription and tooling setup.
- `../AppService/appService.md`, `../VirtualMachines/virtualMachines.md` — compute choices in depth.
- `../TableStorage/tableStorage.md`, `../DocumentDb/documentDb.md`, `../SqlDatabase/sqlDatabase.md`, `../RedisCache/redisCache.md`, `../AzureSearch/azureSearch.md` — data services.
- `../../AWS/Fundamentals/FundamentalServices/fundamentalServices.md` — AWS counterpart; concepts map, names and syntax do not.
- `../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — describing infrastructure as reviewed code.
- `../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` (when installed) — choosing data models for polyglot persistence.
- `../../../CleanCode/Boundaries/boundaries.md` (when installed) — isolating provider-specific APIs.
