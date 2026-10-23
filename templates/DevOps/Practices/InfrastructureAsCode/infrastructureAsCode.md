---
name: devops-infrastructure-as-code
description: How to manage servers and environments as version-controlled, idempotent, declarative code instead of manual commands - provisioning versus configuration versus deployment and their different lifecycles, why one-shot shell scripts break on re-run, idempotence and desired state, configuration management tools (Puppet, Chef, Ansible, Salt, CFEngine) versus provisioning tools (Terraform/OpenTofu, CloudFormation, Bicep) versus images (Packer, Dockerfile), Puppet resources, providers, manifests, explicit ordering with require/notify, guarded exec with unless/onlyif/creates, file resources with templates and variables, service restarts on config change, testing on a throwaway copy before replacing production, rebuilding from scratch to prove the code, and keeping secrets out of manifests and state, based on Chapter 4 (Infrastructure as code) of DevOps na Pratica (Danilo Sato). Use when a server must be rebuilt after a failure, someone configures production over SSH by hand, a setup script fails the second time it runs, writing a Puppet manifest, Ansible playbook, Terraform module or Vagrantfile provisioner, puppet apply or ansible-playbook --check output is confusing, resources run in the wrong order, a config change does not restart the service, exec runs on every apply, servers drift apart (snowflakes), passwords sit in manifests or Terraform state, or the team asks which IaC tool to choose.
---

# Infrastructure as Code

Describe the desired state of every server and environment in code, keep it in version control, and let an idempotent tool converge reality to it. Test the code on a disposable copy, review the plan, then apply through automation; if you cannot destroy a server and rebuild it from the repository, it is not yet infrastructure as code.

## Provisioning, configuration, deployment

Name the stages, because they change at different rates and often belong to different tools:

| Stage | Covers | Changes | Typical tools |
|---|---|---|---|
| Provisioning | Allocate compute, network, storage, DNS, base OS | Rarely | Terraform/OpenTofu, CloudFormation, Bicep, cloud APIs |
| Configuration | OS settings, users, packages, NTP, SSH, log rotation, firewall, middleware | Occasionally | Ansible, Puppet, Chef, Salt; or baked into images with Packer or a Dockerfile |
| Deployment | Put a specific application version and its settings in place | Many times a day | Pipeline deploy step, container orchestrator, CodeDeploy, App Service deploy |

- One server may host many deployments; keep the application version out of the server's base configuration so a deploy does not require reprovisioning.
- Cloud and virtualisation collapse provisioning from weeks to minutes, which is what makes rebuild-instead-of-repair practical.

## Why idempotent and declarative

- A hand-written install script documents the first run but usually fails or does damage on the second: the package exists, the user exists, the line was already appended.
- Idempotent tools compare current state with declared state and change only the difference. Running them twice in a row should report zero changes on the second run; make that a test.
- Declare outcomes ("package present", "service running and enabled", "file has this content") rather than steps ("install", "start", "append").
- Any tool is better than none; choose one the team can review and maintain, and stop making manual changes once it owns a resource.

## Configuration management in practice (Puppet shown, same ideas elsewhere)

Core vocabulary: a **resource** is one managed thing (package, file, service, user, exec); a **provider** implements it per platform (apt, yum, systemd); a **manifest** is a file of resources. Order is not file order: declare dependencies.

```puppet
# manifests/web.pp - example: nginx reverse proxy for an app
package { 'nginx':
  ensure => installed,
}

file { '/etc/nginx/conf.d/shop.conf':
  ensure  => file,
  owner   => 'root',
  group   => 'root',
  mode    => '0644',
  content => epp('shop/shop.conf.epp', { 'upstream_port' => 8080 }),
  require => Package['nginx'],
  notify  => Service['nginx'],          # restart only when the content changes
}

service { 'nginx':
  ensure => running,
  enable => true,
}

exec { 'create-cache-dir-acl':
  command => '/usr/bin/setfacl -m u:www-data:rwx /var/cache/shop',
  unless  => '/usr/bin/getfacl /var/cache/shop | /bin/grep -q "user:www-data:rwx"',
  require => Package['nginx'],
}
```

- `require` orders resources; `notify`/`subscribe` also trigger a refresh (restart) when the upstream resource changes.
- `exec` is not idempotent by itself: always guard it with `unless`, `onlyif` or `creates`, or replace it with a proper resource type. An unguarded `exec` runs on every apply.
- Large configuration files belong in templates (EPP or ERB) with variables, not in inline strings.
- Use `puppet apply --noop` (or `puppet agent --test --noop`) to see what would change before applying.

Current note: the book uses Puppet 3 syntax (unquoted `mode => 0644`, ERB with bare variables, absolute template paths). Modern Puppet requires file modes as strings, uses modules with `template('module/file.erb')` or EPP, and reads data from Hiera. Many teams now use Ansible for configuration and Terraform/OpenTofu for provisioning, with container images replacing most per-server configuration.

The same intent in Ansible:

```yaml
- hosts: web
  become: true
  tasks:
    - ansible.builtin.apt: { name: nginx, state: present, update_cache: true, cache_valid_time: 3600 }
    - ansible.builtin.template: { src: shop.conf.j2, dest: /etc/nginx/conf.d/shop.conf, mode: "0644" }
      notify: restart nginx
    - ansible.builtin.service: { name: nginx, state: started, enabled: true }
  handlers:
    - name: restart nginx
      ansible.builtin.service: { name: nginx, state: restarted }
```

Run `ansible-playbook site.yml --check --diff --limit staging` first.

## Provisioning with plans

```bash
terraform init -backend-config=env/staging.backend.hcl
terraform plan -var-file=env/staging.tfvars -out=staging.tfplan
terraform show staging.tfplan          # review: anything to destroy or replace?
terraform apply staging.tfplan         # applies exactly the reviewed plan
```

- Use remote state with locking and encryption (S3 with locking, Azure Storage, Terraform Cloud); never commit state files.
- State can contain secrets in plain text; restrict who can read it.
- Run `plan` regularly (or in CI) to detect drift from manual changes.

Current note: Terraform moved to the BUSL licence in 2023; OpenTofu is the open-source fork with a compatible workflow.

## Secrets

- The book's manifests hard-code database passwords and copy a keystore from the repository. Do not do this.
- Pull secrets at apply or run time from a secret store: Hiera with eyaml or a Vault backend, Ansible Vault or a lookup plugin, AWS Secrets Manager or Parameter Store, Azure Key Vault, HashiCorp Vault.
- Mark sensitive variables (`sensitive = true` in Terraform, `no_log: true` in Ansible, `Sensitive` type in Puppet) so they do not appear in output or logs.
- Keys and certificates are deployed with restrictive owner and mode, and rotated through the store, not through a commit.

## Test before you replace

- Apply new or changed code to a throwaway instance first (the book adds a temporary `web2` VM next to `web`). Locally: Vagrant, containers, or Molecule for Ansible; in the cloud: an ephemeral environment from the same code.
- Lint and validate in CI: `puppet parser validate`, `puppet-lint`, `ansible-lint`, `terraform fmt -check` and `terraform validate`, `tflint`, policy checks (Checkov, OPA/Conftest).
- Verify behaviour, not just a clean run: the service answers, the port is closed where it should be (Testinfra, Serverspec, InSpec).
- Once the copy works, rebuild the real server from scratch with the same code and let monitoring confirm it is healthy. Rebuilding proves nothing was left manual.

## Safety

- Confirm account or subscription, region, workspace or inventory, and environment before every plan or apply. A wrong `--limit` or workspace is a production outage.
- Always show the plan, `--check --diff` or `--noop` output first; read it for destroys, replacements and changes to IAM, DNS, security groups and data stores.
- Get explicit approval for production applies and for anything destructive (`destroy`, replacements of databases or volumes, `vagrant destroy` on shared machines).
- Have a rollback path: revert the commit and re-apply, keep previous images or AMIs, snapshot data stores before risky changes.
- Run automation with least-privilege credentials, preferably short-lived (OIDC from CI), never personal admin keys.

## Workflow

1. Write down the manual steps for the server (or start from the log kept during the first setup).
2. Separate them into provisioning, configuration and deployment; pick the tool for each.
3. Express each step as a declarative resource; add explicit dependencies and refresh triggers.
4. Replace every unguarded command with a resource or add `unless`/`onlyif`/`creates`.
5. Move secrets to a secret store and variables to environment data files.
6. Lint, validate and apply to a throwaway instance; apply twice and confirm the second run changes nothing.
7. Show the plan for the real environment, get approval, apply through CI, and verify with monitoring.
8. Forbid further manual changes; detect drift with scheduled plans or no-op runs.

## Red flags

- "I'll just SSH in and fix it" on a server that is managed by code.
- A setup script that only works on a fresh machine.
- `exec` or `shell` tasks without guards that run every time.
- Passwords, keys or keystores committed with the manifests, or state files in the repository.
- Applying straight to production without a plan, check or noop run.
- Code that has never rebuilt a server from scratch.
- Relying on declaration order instead of explicit dependencies.
- One giant manifest per server instead of reusable modules or roles.

## Related

- `../StartInProduction/startInProduction.md` — the manual setup this code replaces.
- `../Monitoring/monitoring.md` — confirming a rebuilt server is healthy.
- `../ConfigurationManagement/configurationManagement.md` — modules, roles, data separation and testing for larger codebases.
- `../ContinuousIntegration/continuousIntegration.md` — running lint and tests for infrastructure code.
- `../DeliveryPipeline/deliveryPipeline.md` — applying infrastructure changes through the pipeline.
- `../../AWS/Delivery/CloudFormation/cloudFormation.md` — AWS counterpart (stacks, change sets); not interchangeable with Bicep/ARM or Terraform syntax.
- `../../AWS/Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` — AWS configuration management and drift detection.
- `../../Azure/AzurePlatform/azurePlatform.md` — Azure Resource Manager concepts.
- `../../../CleanCode/Systems/systems.md` (when installed) — separating construction from use.
- `../../../actions/review.md` (when installed) — reviewing infrastructure changes.
- `../../../actions/tdd.md` (when installed) — test-first applied to infrastructure checks.
