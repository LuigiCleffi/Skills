---
name: azure-sql-database
description: "How to choose and operate relational SQL Server workloads on Azure (Azure SQL Database as database-as-a-service, Azure SQL Managed Instance, SQL Server on Azure VMs as IaaS, DTU vs vCore purchasing, General Purpose, Business Critical and Hyperscale tiers, serverless auto-pause, elastic pools, scaling up and read scale-out, logical server firewall rules, Allow Azure services, private endpoints, Entra-only authentication and managed identity, TDE, auditing, automatic backups with point-in-time and long-term retention, geo-replication and failover groups, unsupported features such as CLR and cross-database queries, connection strings, transient fault retries, schema migrations in a pipeline, license-included vs Azure Hybrid Benefit on VMs), based on Chapter 10 (Relational data with SQL Server) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user creates or migrates a SQL Server database to Azure, runs az sql server create, az sql db create or az sql server firewall-rule create, sees error 40615 (client IP not allowed), 40613 or 40501 (database unavailable or busy, transient), 18456 login failed, 10928 resource limits, DTU or CPU at 100%, wants to remove SQL passwords from connection strings, restore to a point in time, add a geo-replica, or decide between Azure SQL Database, Managed Instance, a VM, PostgreSQL or a NoSQL store."
---

# Azure SQL Database and SQL Server on Azure

Default to the managed service (Azure SQL Database, or Managed Instance when you need instance-level SQL Server features) and run SQL Server on a VM only when you need OS access or features the PaaS options lack. Keep the database off the public internet, authenticate with Microsoft Entra ID instead of SQL passwords, and deploy schema changes from the pipeline. Creating servers, changing firewall rules, scaling, failing over, restoring and dropping databases touch production data: confirm subscription, server, database and environment, show the plan first, and get explicit approval.

Current note: the classic portal (`manage.windowsazure.com`), "Quick Create" and classic VM endpoints are retired; use Azure Resource Manager (portal, CLI, Bicep, Terraform). Azure SQL Database now has automatic backups with point-in-time restore, 99.99% SLA options, zone redundancy and serverless compute, which the book's description predates.

## Choose the deployment

| Need | Choice |
|---|---|
| New app database, minimal administration | Azure SQL Database (single database) |
| Many small databases with uneven load | Elastic pool |
| Lift-and-shift needing SQL Agent, cross-database queries, CLR, Service Broker, instance-level logins | Azure SQL Managed Instance |
| OS access, unsupported features, third-party agents, specific SQL Server version | SQL Server on an Azure VM (`../VirtualMachines/virtualMachines.md`) |
| Open-source relational engine | Azure Database for PostgreSQL flexible server (see `../../../DBA/PostgreSQL/README.md`, when installed) |
| Schemaless documents or simple key/value | Cosmos DB or Table storage |

## Sizing and scaling

- vCore model (General Purpose, Business Critical, Hyperscale) is the default choice; DTU (Basic, Standard, Premium) bundles CPU, IO and memory and suits small, simple databases.
- Serverless (General Purpose) auto-scales vCores and can auto-pause idle databases; the first connection after a pause is slow, so do not use auto-pause behind latency-sensitive APIs.
- Scale up or down by changing the service objective (`az sql db update --service-objective`); it is online but ends with a brief reconnect, so apps need retry logic.
- Read scale-out (Business Critical, Premium, Hyperscale) gives a read-only replica via `ApplicationIntent=ReadOnly`; reads there can lag.
- Horizontal scale for writes means sharding across databases (elastic database tools) or Hyperscale; it is an application design change, not a setting. The book's "add more servers" is not how a single database scales.
- Find bottlenecks first with Query Performance Insight, Query Store and `sys.dm_db_resource_stats` before paying for a bigger tier.

## Provisioning with Entra-only authentication

```bash
az account show --query "{sub:name, id:id}"
az sql server create -g rg-app-prod -n sql-app-prod -l brazilsouth \
  --enable-ad-only-auth --external-admin-principal-type Group \
  --external-admin-name sql-admins-prod --external-admin-sid <group-object-id>
az sql db create -g rg-app-prod -s sql-app-prod -n appdb \
  --edition GeneralPurpose --family Gen5 --capacity 2 \
  --zone-redundant true --backup-storage-redundancy Zone
```

Inside the database, grant the app's managed identity only what it needs:

```sql
CREATE USER [app-api-prod] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [app-api-prod];
ALTER ROLE db_datawriter ADD MEMBER [app-api-prod];
```

- Connection string without secrets: `Server=tcp:sql-app-prod.database.windows.net,1433;Database=appdb;Authentication=Active Directory Default;Encrypt=True;` (Microsoft.Data.SqlClient).
- If SQL authentication is unavoidable, generate the password, store it in Key Vault, reference it from app settings, and never echo it in a terminal, log or chat.
- Do not give the application `db_owner`; run migrations under a separate deployment identity.

## Network access

- Default to a private endpoint and `publicNetworkAccess` disabled for production; use VNet rules or narrow IP rules for anything else.
- Server firewall rules apply to all databases on the logical server; database-level rules (`sp_set_database_firewall_rule`) scope to one.
- Error 40615 means the client IP is not allowed. Add the specific address (`az sql server firewall-rule create ... --start-ip-address 203.0.113.10 --end-ip-address 203.0.113.10`) for the time needed, then remove it.
- Never add `0.0.0.0`–`255.255.255.255`. The "Allow Azure services" rule (`0.0.0.0`) admits every Azure customer's resources, not just yours; prefer private endpoints or VNet integration from App Service.

## Feature differences from SQL Server

- Not in single database: CLR assemblies, cross-database and distributed queries (elastic query is limited), SQL Agent (use elastic jobs, Azure Automation or pipeline jobs), instance-level settings, `BACKUP DATABASE` to disk, linked servers. Managed Instance covers most of these.
- Same TDS protocol and T-SQL, so drivers, SSMS, Azure Data Studio and EF Core work unchanged.
- Assess compatibility before migrating with Azure Migrate / Data Migration Assistant; migrate with Azure Database Migration Service, BACPAC (small databases) or transactional replication.

## Reliability and data protection

- Transient errors (40613, 40501, 40197, 49918 and connection resets during reconfiguration) are normal; enable retries (`EnableRetryOnFailure()` in EF Core or SqlClient's retry logic) with backoff and idempotent writes.
- Automatic backups give point-in-time restore for 1–35 days (7 by default); add long-term retention for compliance. Restores create a new database; test them.
- Geo-replication or failover groups give a readable secondary in another region; failover groups provide a stable listener name for apps. Failover is a production change requiring approval and a fail-back plan.
- TDE is on by default; enable auditing to Log Analytics and Microsoft Defender for SQL in production.

## Schema changes

- Keep schema in source control (EF Core migrations, DACPAC/SQL projects, Flyway) and apply it from the pipeline with the deployment identity.
- Generate and review the script (`dotnet ef migrations script --idempotent`, `SqlPackage /Action:Script`) before applying; take note of the restore point time.
- Make changes backward compatible (expand, migrate, contract) so the previous app version still runs during rollout.

## SQL Server on a VM (IaaS)

- Use a marketplace SQL Server image (license included, pay per hour) or bring your license with Azure Hybrid Benefit.
- Register with the SQL IaaS Agent extension for automated patching, backups and license management.
- Put data and log files on separate managed disks sized for IOPS; follow the storage best practices for SQL Server on Azure VMs.
- Never expose port 1433 or RDP to the internet; reach the VM via private network, VPN or Azure Bastion. You own patching, backups, HA (Always On availability groups) and monitoring.

## Workflow

1. Decide SQL Database, elastic pool, Managed Instance or VM from the feature and administration needs.
2. Confirm subscription, region, environment, tier, zone redundancy and backup redundancy; estimate cost; get approval.
3. Provision with Bicep/Terraform/CLI, showing the plan or `what-if`; enable Entra-only auth and a private endpoint.
4. Create contained users for managed identities with least-privilege roles; store any remaining secret in Key Vault.
5. Configure retries in the application; apply schema through reviewed migration scripts.
6. Enable auditing, Defender for SQL and alerts on CPU/DTU, storage, deadlocks and failed connections.
7. Test a point-in-time restore and, if used, a failover group failover in a non-production environment.
8. For drops, restores over existing databases, failovers or downscaling in production: explicit approval, verified backup, and a rollback path first.

## Red flags

- A firewall rule open to all IPs, or "Allow Azure services" used as the security boundary.
- SQL admin passwords in connection strings committed to git, pipeline logs or chat.
- The application connecting as server admin or `db_owner`.
- No retry logic, so every scale operation or failover causes errors.
- Schema changed by hand in production SSMS sessions.
- Never-tested restores; assuming the default 7-day retention meets compliance.
- Serverless auto-pause behind a user-facing API.
- Port 1433 or 3389 open to the internet on a SQL Server VM.
- Treating Azure SQL as identical to on-premises SQL Server (CLR, Agent, cross-database queries).

## Related

- `../VirtualMachines/virtualMachines.md` — VMs, networking and Bastion for SQL Server on IaaS.
- `../AppService/appService.md` — managed identity, VNet integration and Key Vault references for the app.
- `../DocumentDb/documentDb.md` and `../TableStorage/tableStorage.md` — non-relational options for polyglot persistence.
- `../AzureSearch/azureSearch.md` — indexing Azure SQL for full-text search.
- `../../AWS/Resilience/DataProtection/dataProtection.md` — AWS counterpart for encryption and backups; not interchangeable.
- `../../Practices/DeliveryPipeline/deliveryPipeline.md` — running migrations as a pipeline stage.
- `../../../DBA/PostgreSQL/DatabaseAdministration/databaseAdministration.md` — roles, backup and restore concepts on PostgreSQL (when installed).
- `../../../DBA/PostgreSQL/QueryPerformanceTuning/queryPerformanceTuning.md` — reading plans and indexing; principles carry over, syntax does not (when installed).
- `../../../DataSystems/DistributedData/Transactions/transactions.md` — isolation levels and their anomalies (when installed).
- `../../../DataSystems/DistributedData/Replication/replication.md` — geo-replica lag and failover (when installed).
- `../../../CleanCode/ErrorHandling/errorHandling.md` — handling transient failures cleanly (when installed).
