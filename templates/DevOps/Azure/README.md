## AI Skills

Before creating or changing Azure resources, deploying to Azure, or choosing
an Azure service, find the skills that apply to the task in the table below
and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of *Azure: Coloque suas plataformas e
serviços no cloud* (Casa do Código). The book predates Azure Resource
Manager becoming the only deployment model, and several services it
describes have been renamed or retired (Web Apps is App Service, Azure
Search is Azure AI Search, DocumentDB is Azure Cosmos DB, classic Cloud
Services and the classic portal are retired). The skills use current names
and carry a short "Current note" where that matters. Check current Azure
documentation for exact limits, tiers, and API versions. For platform-
neutral practice, also read `../Practices/README.md`.

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./CloudComputingOverview/cloudComputingOverview.md` | Deciding cloud vs on-premises, IaaS, PaaS, SaaS or serverless, public, hybrid or private, or scaling for growth, peaks, spikes or batch bursts. |
| 2 | `./AzurePlatform/azurePlatform.md` | Choosing Azure compute, data stores, global routing, regions and zones; the ARM hierarchy; mapping old names like DocumentDB or Azure Search. |
| 3 | `./SetupAndSubscription/setupAndSubscription.md` | Starting on Azure: subscriptions, `az login` and `az account set`, RBAC, tagging, budgets, CLI and Bicep tooling, OIDC for CI. |
| 4 | `./AppService/appService.md` | Hosting, deploying or scaling web apps on App Service: tiers, slots and swap, autoscale, Key Vault references, TLS and domains, CI deploy. |
| 5 | `./WebJobs/webJobs.md` | Background or scheduled jobs inside an App Service app: `settings.job` CRON, Always On, idempotency, shutdown, or Azure Functions instead. |
| 6 | `./RedisCache/redisCache.md` | Caching with Azure Redis: cache-aside, TTLs, output and session cache, a singleton connection, Entra auth, timeouts, eviction. |
| 7 | `./TableStorage/tableStorage.md` | Cheap key/value or log entities on Azure, PartitionKey and RowKey design, slow scans, 409/412/ServerBusy, moving to `Azure.Data.Tables`. |
| 8 | `./AzureSearch/azureSearch.md` | Full-text, faceted or geo search with Azure AI Search: index schema, push or indexer sync, OData queries, keys vs RBAC. |
| 9 | `./DocumentDb/documentDb.md` | JSON documents in Azure Cosmos DB (formerly DocumentDB): partition key, RU/s and 429s, consistency, parameterized queries, stored procedures. |
| 10 | `./SqlDatabase/sqlDatabase.md` | Choosing or running Azure SQL Database, Managed Instance or SQL Server on a VM: tiers, firewall and private endpoints, Entra auth, backups, retries. |
| 11 | `./VirtualMachines/virtualMachines.md` | Provisioning or securing Azure VMs and VNets: SSH and Bastion, NSGs, zones and scale sets, static IPs, VPN, deallocation billing, patching and backup. |

The book's closing chapter is not a skill.

# Context for AI: Working on Azure

## 1. Know Which Tenant and Subscription You Are In

Run `az account show` before anything else and confirm the tenant,
subscription, and that the target resource group is the intended
environment. Set the subscription explicitly in scripts and pipelines
(`az account set --subscription <id>`); never rely on whatever was last
selected.

## 2. Resource Manager, as Code

Define resources in Bicep, ARM templates, or Terraform and deploy them
through a pipeline. Classic (ASM) resources and the classic portal are
retired; do not follow instructions that rely on them. Group resources by
lifecycle in resource groups and tag them with owner and environment.

## 3. Preview Before You Deploy

Run `az deployment group what-if` (or `terraform plan`) and read it for
deletions and replacements before deploying. Prefer incremental deployment
mode; complete mode deletes resources not in the template and needs
explicit approval.

## 4. Identities, Not Keys

Use managed identities for Azure-hosted code and OIDC workload identity
federation for CI. Keep remaining secrets in Key Vault and reference them
from app settings. Disable shared-key and local authentication where the
service allows it, and grant RBAC roles at the narrowest scope that works.

## 5. Destructive and Hard-to-Reverse Operations

Deleting resource groups, databases, storage accounts, or Key Vaults,
changing networking, firewalls, or private endpoints, role assignments,
production slot swaps, scaling down data tiers, and complete-mode
deployments need explicit approval for the specific target. Enable soft
delete and resource locks on production data, and state how to verify and
roll back.
