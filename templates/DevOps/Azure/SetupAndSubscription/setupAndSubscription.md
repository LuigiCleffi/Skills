---
name: azure-setup-and-subscription
description: How to set up an Azure working environment safely — tenants, subscriptions, free accounts and credits, management groups, resource groups, naming and tagging, budgets and cost alerts, RBAC and Privileged Identity Management, Azure CLI, Azure PowerShell, Azure Developer CLI, Bicep and IDE tooling, the Azure portal, and passwordless CI authentication with OIDC workload identity federation, based on Chapter 3 (Software Setup and Subscription) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user is starting with Azure, creating a subscription or free trial, running az login, az account set or Connect-AzAccount, gets "the subscription could not be found", AuthorizationFailed or "does not have authorization to perform action", wants dev, test and prod separated, needs a budget or spending alert, asks which tools to install, mentions the Azure SDK, Visual Studio publish, the classic or "Ibiza" portal, or wants GitHub Actions or Azure DevOps to deploy without storing a client secret.
---

# Azure Setup and Subscription

Before building anything, know exactly which tenant, subscription and region every command will hit, separate environments by subscription, cap spending with budgets, and give people and pipelines only the roles they need. Install command-line tooling so every change can be scripted, reviewed and repeated instead of clicked.

## Accounts, tenants and subscriptions

- **Tenant** (Microsoft Entra ID directory): identities live here. **Subscription**: billing, quota and RBAC boundary, trusted by exactly one tenant. **Resource group**: resources sharing a lifecycle.
- Separate production from non-production at the subscription level (for example `sub-shop-prod`, `sub-shop-nonprod`), grouped under management groups so policy and RBAC are inherited.
- A free account or trial credit is for learning; do not let production depend on it. When credit ends, resources stop or move to pay-as-you-go depending on the offer; check the offer terms.
- A personal Microsoft account owning a company subscription is a continuity risk; use organizational identities and at least two owners.

## Command-line tooling

| Tool | Use |
|---|---|
| Azure CLI (`az`) | Cross-platform scripting, pipelines, quick inspection |
| Azure PowerShell (`Az` module) | PowerShell-centric automation |
| Bicep (`az bicep`) | Declarative ARM infrastructure as code |
| Azure Developer CLI (`azd`) | Templates that provision and deploy an app end to end |
| Terraform (azurerm provider) | Multi-cloud teams standardized on Terraform |
| VS Code / Visual Studio with Azure extensions | Local development, debugging, resource browsing |

Current note: the book's setup (Azure SDK 2.5, Visual Studio publish profiles, and switching between the classic management portal and the then-new "Ibiza" portal) is obsolete. The classic portal and Azure Service Manager are retired; use the Azure portal (portal.azure.com), Azure CLI or PowerShell, and the current per-language SDKs.

```bash
az login                                   # interactive; use --use-device-code on headless hosts
az account list -o table                   # every subscription you can see
az account set --subscription "sub-shop-nonprod"
az account show --query "{tenant:tenantId, sub:name, id:id}" -o table
az config set defaults.location=brazilsouth defaults.group=rg-shop-dev   # local defaults, per machine
```

- Run `az account show` at the start of every session and before any change; scripts should set the subscription explicitly rather than inherit whatever was last selected.
- Errors like "subscription could not be found" usually mean the wrong tenant: `az login --tenant <tenant-id>`.

## Naming and tagging

- Adopt a naming convention such as `<type>-<workload>-<env>-<region>-<nnn>` (`app-shop-prod-brs-001`, `rg-shop-prod`), respecting each resource's length and character rules and global-uniqueness requirements (storage accounts, web apps, Key Vaults).
- Require tags such as `env`, `owner`, `costCenter`, `dataClassification`; enforce them with Azure Policy instead of hoping.

## Access control

- Assign roles to groups, not individuals, at the narrowest scope that works (resource group before subscription).
- Prefer specific built-in roles (`Website Contributor`, `Key Vault Secrets User`, `Reader`) over `Owner` or `Contributor`. `User Access Administrator` and `Owner` can grant access to others; keep them rare.
- Use Privileged Identity Management for just-in-time elevation to production roles where licensed.

```bash
az role assignment create \
  --assignee-object-id <group-object-id> --assignee-principal-type Group \
  --role "Website Contributor" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-shop-dev
```

## Pipelines without stored secrets (OIDC)

Use workload identity federation so CI gets short-lived tokens; no client secret is stored anywhere.

```bash
az ad app create --display-name gh-shop-deploy-nonprod
az ad sp create --id <app-id>
az ad app federated-credential create --id <app-id> --parameters '{
  "name": "gh-main", "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:acme/shop:environment:nonprod",
  "audiences": ["api://AzureADTokenExchange"] }'
# then a narrow role assignment for the service principal on the target resource group only
```

```yaml
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    environment: nonprod        # environment protection rules gate production
    runs-on: ubuntu-latest
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - run: az account show -o table
```

- Use a separate identity per environment, scoped to that environment's resource groups; bind the federated subject to the GitHub environment so only gated jobs can deploy to production.

## Cost guardrails

- Create a budget with alert thresholds on every subscription before deploying workloads; budgets alert, they do not stop spending.
- Review Cost Management by tag weekly in the first months; delete forgotten resources (unattached disks, idle plans, public IPs).
- Use Azure Policy to restrict allowed regions and expensive SKUs in non-production.

```bash
az consumption budget create --budget-name nonprod-monthly --amount 500 \
  --category cost --time-grain monthly \
  --start-date 2026-11-01 --end-date 2027-10-31
# add notification thresholds and recipients in Cost Management or via Bicep (Microsoft.Consumption/budgets)
```

## Guardrails for changes

- Confirm tenant, subscription, region and environment before every change; state them in the plan you show the user.
- Show `az deployment ... what-if` (or `terraform plan`) and get explicit approval for production or destructive changes.
- Put `CanNotDelete` locks on production resource groups holding data: `az lock create -n keep -g rg-shop-prod --lock-type CanNotDelete`.
- Never paste keys, connection strings, passwords or tokens into code, logs, tickets or chat; store them in Key Vault and reference them.

## Workflow
1. Confirm or create the tenant with organizational identities and at least two owners.
2. Create subscriptions per environment under management groups; register needed resource providers.
3. Install Azure CLI, Bicep and the IDE extensions; set the active subscription explicitly in every script.
4. Define naming and tagging rules and enforce tags and allowed regions with Azure Policy.
5. Grant group-based, least-privilege RBAC; set up PIM for production elevation where available.
6. Create OIDC-federated deployment identities per environment for CI.
7. Create budgets and cost alerts, then start provisioning through reviewed infrastructure as code.

## Red flags
- Commands run without checking `az account show`; scripts relying on the last selected subscription.
- Production and development sharing a subscription.
- Client secrets for deployment service principals stored in CI variables when OIDC is available.
- `Owner` or `Contributor` at subscription scope for a pipeline or an individual developer.
- No budget or cost alert on a subscription with autoscaling resources.
- A single personal account owning the company subscription.
- Instructions referencing the classic portal, Azure Service Manager or publish-profile passwords as the deployment method.

## Related
- `../CloudComputingOverview/cloudComputingOverview.md` — deciding service model and scaling pattern.
- `../AzurePlatform/azurePlatform.md` — resource hierarchy, ARM and service selection.
- `../AppService/appService.md` — first deployment target once the subscription is ready.
- `../../AWS/Fundamentals/IamAndSecrets/iamAndSecrets.md` — AWS counterpart for identity and secrets; IAM policy syntax is not interchangeable with Azure RBAC.
- `../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — scripted, reviewed environments.
- `../../Practices/ContinuousIntegration/continuousIntegration.md` — CI that consumes the deployment identity.
- `../../../actions/dev.md` (when installed) — development workflow.
