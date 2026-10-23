---
name: azure-virtual-machines
description: How to provision, connect to, network and operate Azure virtual machines as IaaS (when a VM is justified over App Service or containers, Azure Resource Manager resources behind a VM: resource group, virtual network, subnet, network security group, NIC, public IP and managed disks, VM sizes, current Linux images, SSH keys instead of passwords, Entra ID login, Azure Bastion and just-in-time access, cloud-init and extensions, availability sets, availability zones and scale sets, static private IPs, VNet peering, site-to-site and point-to-site VPN, deallocate vs stop billing, patching with Azure Update Manager, Azure Backup and Azure Monitor Agent), based on Chapter 11 (A bit more about virtual machines) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user runs az vm create, az network vnet create or az network nsg rule create, needs to SSH or RDP into a VM, sees Permission denied (publickey) or connection timed out on port 22, wants a fixed IP, needs to install software App Service cannot (GAC, registry, native binaries), connects on-premises to Azure with a VPN, moves a VM to another VNet, wonders why a stopped VM still bills, or migrates classic (ASM) VMs and cloud services to Resource Manager.
---

# Azure Virtual Machines

Choose a VM only when the workload needs OS-level control that App Service, Container Apps, AKS or Functions cannot give; with a VM you own patching, hardening, backup and monitoring. Build VMs from code (Bicep, Terraform or scripted CLI) with SSH keys or Entra ID login, no public management ports, and an availability design chosen up front. Creating, resizing, deleting VMs and changing networks or NSGs affects running systems and cost: confirm subscription, resource group, region and environment, show the plan first, and get explicit approval.

Current note: classic (ASM) VMs, cloud services as VM containers, endpoints and `manage.windowsazure.com` are retired. In Resource Manager a VM is a set of separate resources (NIC, disks, public IP, NSG) in a resource group, disks are managed (no storage account to choose), and NSG rules replace endpoints. Ubuntu 12.04 is long out of support; use a current LTS image.

## When a VM is the right tool

| Need | Choice |
|---|---|
| Web app or API with a supported runtime | App Service (`../AppService/appService.md`) |
| Containerized services | Container Apps or AKS |
| Event-driven or scheduled code | Functions, or WebJobs (`../WebJobs/webJobs.md`) |
| Registry or GAC changes, native components, custom OS agents, lift-and-shift, licensed software tied to a host | Virtual machine |
| Many identical stateless instances with autoscale | Virtual Machine Scale Set |

## Provisioning (Linux example)

```bash
az account show --query "{sub:name, id:id}"
az group create -n rg-render-dev -l brazilsouth
az network vnet create -g rg-render-dev -n vnet-render-dev \
  --address-prefixes 10.20.0.0/16 --subnet-name snet-app --subnet-prefixes 10.20.1.0/24
az network nsg create -g rg-render-dev -n nsg-app
az network nsg rule create -g rg-render-dev --nsg-name nsg-app -n allow-https \
  --priority 100 --direction Inbound --access Allow --protocol Tcp \
  --destination-port-ranges 443 --source-address-prefixes Internet
az vm create -g rg-render-dev -n vm-render-01 --image Ubuntu2204 --size Standard_D2s_v5 \
  --vnet-name vnet-render-dev --subnet snet-app --nsg nsg-app --public-ip-address "" \
  --admin-username azureops --generate-ssh-keys --assign-identity \
  --zone 1 --custom-data cloud-init.yaml --os-disk-delete-option Delete
```

- `--public-ip-address ""` keeps the VM private; publish it through a load balancer or Application Gateway instead.
- `--generate-ssh-keys` writes keys under `~/.ssh` if missing; never paste a private key into chat, a repo or a pipeline log. For teams, prefer Entra ID login (`AADSSHLoginForLinux` extension plus the `Virtual Machine Administrator Login`/`User Login` roles).
- `cloud-init` (Linux) or the Custom Script extension handles first-boot setup; keep it idempotent and keep secrets out of it (fetch them from Key Vault using the VM's managed identity).
- Check the image alias and size are available in the region: `az vm image list --output table`, `az vm list-skus -l brazilsouth --size Standard_D2s`.
- Prefer a hardened golden image built with Packer and stored in Azure Compute Gallery over long hand-run setup scripts.

## Connecting securely

- Do not open 22 or 3389 to `Internet`/`*`. Use Azure Bastion (`az network bastion ssh ...`), a VPN, or just-in-time access from Defender for Cloud, which opens the port to one IP for a limited time.
- "Connection timed out" on 22 usually means NSG, no public IP, or a route; "Permission denied (publickey)" means wrong user or key. Use `az vm run-command invoke` or the serial console to diagnose without opening ports.
- Verify host keys on first connect rather than accepting blindly.
- Disable password authentication on Linux; on Windows use strong unique passwords stored in Key Vault, or Entra ID login.

## Availability and scaling

- Single VM SLA depends on disk type; for real availability run two or more instances across availability zones (or an availability set where zones are unavailable) behind a load balancer.
- Availability sets spread VMs across fault and update domains in one datacenter; zones spread across physically separate datacenters in the region. Both are chosen at creation time.
- Scale sets add autoscale and rolling upgrades for identical instances; keep instances stateless.
- Use managed disks (Premium SSD v2 or Premium SSD for production databases) and separate data disks from the OS disk.

## Virtual networks

- Plan non-overlapping address spaces with on-premises and other VNets before creating anything; changing them later is disruptive. Azure reserves 5 addresses in every subnet.
- Connect VNets with peering; connect on-premises with a VPN Gateway (site-to-site), single machines with point-to-site, or ExpressRoute for private dedicated links.
- Need a fixed IP? Set the NIC's private IP to static (`az network nic ip-config update --private-ip-address 10.20.1.10`) and use a Standard static public IP when a public one is required.
- A VM's NIC can move to another subnet in the same VNet; moving to a different VNet means recreating the VM from its existing disks. Plan placement up front.
- Use NSGs on subnets (and NICs when needed), with application security groups to express rules by role rather than IP.

## Operations and cost

- Patching: Azure Update Manager with maintenance configurations; automatic guest patching where acceptable.
- Backup: Azure Backup policy for each VM, with restore tested; snapshots alone are not a backup strategy.
- Monitoring: Azure Monitor Agent with data collection rules, VM Insights, alerts on CPU, disk, heartbeat.
- `az vm stop` keeps the compute allocated and billed; `az vm deallocate` stops compute billing (disks and static IPs still bill). Use auto-shutdown for dev VMs.
- Deleting a VM does not delete its disks, NIC or public IP unless delete options were set; clean up orphaned resources after approval.
- Tag resources (owner, environment, cost center) and use reservations or savings plans for steady production VMs.

## Workflow

1. Justify a VM over PaaS; record the reason.
2. Confirm subscription, region, environment, VNet address plan and availability design (zones, set or scale set).
3. Write Bicep/Terraform (or a reviewed CLI script); run `what-if`/`plan` and get approval before production changes.
4. Create the VM private, with SSH keys or Entra ID login, a managed identity and least-privilege NSG rules.
5. Configure through cloud-init, extensions or Ansible from source control; pull secrets from Key Vault at runtime.
6. Connect through Bastion, VPN or JIT; verify with `az vm get-instance-view` and the boot diagnostics.
7. Enable Update Manager, Azure Backup and Azure Monitor Agent before calling it production-ready.
8. For resize (restarts the VM), redeploy, deletion or network moves: approval, a maintenance window, a backup and a rollback path.

## Red flags

- SSH or RDP open to the internet; password login on Linux.
- Private keys or admin passwords in repos, scripts, cloud-init or chat.
- A single VM for a service that needs high availability.
- Hand-configured "pet" servers with no image or code to rebuild them.
- No patching, backup or monitoring in place.
- Stopped-not-deallocated dev VMs and orphaned disks and IPs running up cost.
- Overlapping VNet and on-premises address ranges discovered at VPN time.
- Following classic portal steps (cloud services, endpoints, storage accounts for disks).

## Related

- `../AppService/appService.md` — the PaaS option to prefer for web workloads.
- `../SqlDatabase/sqlDatabase.md` — SQL Server on a VM vs managed SQL.
- `../AzurePlatform/azurePlatform.md` — IaaS vs PaaS on Azure.
- `../SetupAndSubscription/setupAndSubscription.md` — subscriptions, resource groups and CLI login.
- `../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — building servers from code.
- `../../Practices/ConfigurationManagement/configurationManagement.md` — Puppet/Ansible-style configuration of VMs.
- `../../Practices/Monitoring/monitoring.md` — what to monitor on hosts.
- `../../AWS/Fundamentals/FundamentalServices/fundamentalServices.md` — EC2 and VPC counterparts; syntax and networking defaults are not interchangeable.
- `../../AWS/Resilience/AutoScaling/autoScaling.md` — AWS counterpart to scale sets.
- `../../../CleanCode/Systems/systems.md` — separating construction from use, applied to environments (when installed).
