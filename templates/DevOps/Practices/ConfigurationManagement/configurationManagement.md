---
name: devops-configuration-management
description: How to structure configuration-management code so it stays reusable and safe (Puppet classes vs defined types, parameterized classes, modules and their directory layout, init.pp namespaces, files vs templates, separating generic infrastructure modules from application or profile modules, centralizing parameters, resource ordering and collectors, Forge modules and dependency pinning with a Puppetfile, dry runs with --noop), with Ansible and Terraform equivalents, based on Chapter 5 (Puppet beyond the basics) of DevOps na Prática. Use when refactoring a long Puppet manifest or Ansible playbook, creating a module or role, a resource is declared twice ("Duplicate declaration"), "Could not find declared class", choosing class vs define, writing params.pp or Hiera data, wiring templates (ERB/EPP/Jinja2), installing modules from the Forge or Galaxy, pinning modules with Puppetfile, r10k, librarian-puppet or requirements.yml, cross-module coupling such as a shared apt-get update, or secrets sitting in manifests.
---

# Configuration Management Beyond the Basics

Treat infrastructure code like application code: small cohesive units, explicit interfaces (parameters), no hidden coupling, pinned dependencies, and a dry run before every apply. Generic modules know nothing about your application; a thin application (profile) layer composes them with your data. Every apply changes real servers, so confirm the target environment, review the dry-run diff, and get approval before touching production.

## Class or defined type (or role/task)

| Need | Puppet | Ansible | Terraform |
|---|---|---|---|
| Something that exists once per node (a database server, an agent) | `class` (singleton; declaring it twice with different params fails) | role applied once per host | module instantiated once per environment |
| Something repeated with different arguments (a schema, a vhost, a user) | `define` (defined type); each instance needs a unique `$title` | role/task with a loop, or an include with vars | module called with `for_each` |
| Group of resources applied as a unit | `include` or `class { 'x': }` | `import_role` / `include_role` | module block |

- Use `include x` when you need no parameters (idempotent, can appear many times); use the resource-like `class { 'x': ... }` only once per node, ideally in one profile, because it is a duplicate declaration if declared again.
- Inside a defined type, derive every resource title from `$title` (`"${title}-schema"`) or a second instance collides.
- Depend on abstractions, not internals: `require => Class['mysql::server']` instead of `Service['mysql']`. Then the module can change how it installs MySQL without breaking callers.

Current note: the book uses Puppet 2.7 syntax. Class names with hyphens (`mysql-server`) are invalid since Puppet 4; use lowercase with underscores and `::` namespaces. Use typed parameters and `Sensitive` for secrets.

```puppet
# modules/mysql_app/manifests/database.pp
define mysql_app::database (
  String            $schema,
  Sensitive[String] $password,
  String            $user = $title,
) {
  require mysql_app::server
  # Prefer a maintained module's types (e.g. puppetlabs-mysql mysql::db)
  # over exec with passwords on the command line.
}
```

## Module layout

```
modules/tomcat/
  manifests/init.pp      # class tomcat (entry point / namespace)
  manifests/server.pp    # class tomcat::server -> file name matches class name
  files/                 # static files: source => 'puppet:///modules/tomcat/<file>'
  templates/             # ERB (.erb) or EPP (.epp): epp('tomcat/server.xml.epp', {...})
  examples/              # usage examples (the book's tests/ dir); smoke-test with --noop
  spec/                  # rspec-puppet unit tests
  data/ + hiera.yaml     # module-level default data (replaces params.pp)
```

- The directory name is the module name; `tomcat::server` must live in `manifests/server.pp` or autoloading fails with "Could not find class".
- Static content goes in `files/`; anything with variables goes in `templates/`. Reference both through the module path, never absolute paths like `/vagrant/...`.
- Smoke check without changing anything: `puppet apply --noop --modulepath=modules examples/init.pp`. Syntax only: `puppet parser validate`. Style: `puppet-lint`.

Current note: use the Puppet Development Kit for new modules (`pdk new module`, `pdk new class`, `pdk validate`, `pdk test unit`). Perforce stopped publishing public open-source Puppet packages in early 2025; check licensing, or use the community fork OpenVox, before starting new Puppet work.

## Turn hard-coded config into data

Make a generic module accept structures (arrays, hashes) and render them, instead of shipping your application's config files inside it.

```puppet
class tomcat::server (
  Array[Hash]        $connectors   = [],
  Hash[String, Hash] $data_sources = {},
) {
  package { 'tomcat9': ensure => installed }
  file { '/etc/tomcat9/server.xml':
    content => epp('tomcat/server.xml.epp', { 'connectors' => $connectors }),
    require => Package['tomcat9'],
    notify  => Service['tomcat9'],
  }
  service { 'tomcat9': ensure => running, enable => true }
}
```

```text
<%- | Array[Hash] $connectors | -%>
<%# templates/server.xml.epp %>
<% $connectors.each |$c| { -%>
  <Connector <%= $c.keys.sort.map |$k| { "${k}=\"${c[$k]}\"" }.join(' ') %> />
<% } -%>
```

- Sort hash keys when rendering so the file is byte-identical between runs; otherwise every run "changes" the file and restarts the service.
- Keep certificates, keystores, WAR files, and connection strings out of the generic module.

## Infrastructure modules vs application modules

Separation of concerns at two levels:

- **Component modules** (`mysql`, `tomcat`, `nginx`): reusable by any team, no application names, no secrets.
- **Application / profile modules** (`shop::web`, `shop::db`): compose component modules with your data. Node manifests shrink to `include shop::web`.
- Put a client library (`mysql::client`) in the module it belongs to, not in whichever module first needed it.
- Centralize application data in one place. The book's `params.pp` class is the old pattern; use Hiera (module data or environment data) with automatic parameter lookup:

```yaml
# data/common.yaml (environment Hiera)
shop::web::db_host: 'db.internal.example'
shop::web::db_user: 'shop'
lookup_options:
  shop::web::db_password:
    convert_to: 'Sensitive'
# db_password itself comes from hiera-eyaml or an external secrets backend, never plain text
```

Ansible equivalent: generic roles in `roles/`, application playbooks that apply them, variables in `group_vars/<env>/`, secrets in Ansible Vault or a secrets lookup. Terraform equivalent: generic modules, root modules per environment, `*.tfvars` without secrets.

## Dependencies and ordering

- Keep a dependency close to where it is used: same file beats same module beats another module. A module that requires a resource declared in a different module (the book's shared `Exec['apt-update']`) is coupled; remove that coupling.
- Global ordering belongs in the profile layer, once:

```puppet
class shop::base {
  include apt                     # puppetlabs-apt
  Class['apt'] -> Package <| |>   # refresh package index before any package
}
```

- Know that a collector (`<| |>`) also realizes virtual resources it matches; scope it with a search expression if you use virtual resources.
- `->` / `require` order resources; `~>` / `notify` also trigger a refresh (service restart). Use notify only where a restart is truly needed.

Current note: `always_apt_update` from puppetlabs-apt 1.x is gone; current versions use `class { 'apt': update => { 'frequency' => 'daily' } }` (or `always`).

## Reusing community modules and pinning them

- Prefer well-maintained Forge or Galaxy modules (supported or approved, recent releases, tests, compatible OS list) over hand-written `exec` resources. Read the module before using it: it runs as root.
- Declare every external module, with an exact version, in one manifest and install from it in CI and on servers:

```ruby
# Puppetfile (r10k or Code Manager; the book used librarian-puppet)
forge 'https://forge.puppet.com'
mod 'puppetlabs-stdlib', '9.6.0'
mod 'puppetlabs-apt',    '9.4.0'   # pin the version you tested
```

- Ansible: `requirements.yml` with pinned versions, `ansible-galaxy install -r requirements.yml`. Terraform: module `version` constraints plus a committed `.terraform.lock.hcl` for providers.
- Do not commit the downloaded modules directory; do commit the lock or pinned versions.
- "Could not find declared class X" after a refactor usually means the module is not installed or not on the `modulepath`.

## Refactor safely

A refactor changes structure, not behavior. Prove it:

1. Capture current behavior: `puppet apply --noop` (or `ansible-playbook --check --diff`, `terraform plan`) should show no changes against an already-converged node.
2. Make one structural move at a time (extract class, extract define, move file into module, parameterize).
3. After each move, re-run the dry run and unit tests; expect zero diff.
4. Rebuild a throwaway node from scratch (VM or container) to prove the code converges from empty, not only from an already-configured server.

## Workflow

1. Confirm which environment and nodes the code targets and how it is applied (agent/server, masterless apply, CI job).
2. Read the existing manifests; list duplicated resources, cross-module references, hard-coded values and secrets.
3. Decide class vs define vs profile for each group of resources; name them with module namespaces.
4. Extract generic modules first, then the application layer; move values to Hiera or role variables; move secrets to an encrypted backend.
5. Pin external modules in a Puppetfile or requirements file; install them the same way in CI.
6. Run lint, parser validation, unit tests and a `--noop` / `--check` / `plan` dry run; show the diff.
7. Get approval before applying to production; apply to a non-production node first; keep the previous commit ready to re-apply as rollback.

## Red flags

- Passwords, keystore passphrases or private keys in manifests, templates, `params.pp`, or the module's `files/`.
- `exec` resources that put credentials on the command line (visible in process lists and logs) or lack `unless`/`onlyif`/`creates` guards, so they are not idempotent.
- A generic module that contains your application's names, certificates or artifacts.
- The same resource declared in two modules, or a module requiring another module's internal resource.
- Unpinned module versions, or modules installed by hand on servers.
- Templates that iterate unsorted hashes, causing a change and restart on every run.
- Applying straight to production without a dry run, or "fixing" a server by hand so it drifts from code.
- Weak TLS settings carried over from old examples (the book's connector uses `SSLv3`); require TLS 1.2 or later.

## Related

- `../InfrastructureAsCode/infrastructureAsCode.md` — the basics this skill builds on: resources, idempotence, provisioning VMs.
- `../ContinuousIntegration/continuousIntegration.md` — running lint and tests on every commit.
- `../DeliveryPipeline/deliveryPipeline.md` — CI for infrastructure code (lint, rspec-puppet, package) and deploying it.
- `../AdvancedTopics/advancedTopics.md` — per-environment configuration and secrets management.
- `../../AWS/Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` — AWS-native configuration (State Manager, Run Command, Config); syntax is not interchangeable.
- `../../AWS/Delivery/OpsWorks/opsWorks.md` — managed Chef/Puppet on AWS (end of life; migrate).
- `../../Azure/VirtualMachines/virtualMachines.md` — configuring Azure VMs (extensions, cloud-init); not interchangeable with AWS syntax.
- `../../../CleanCode/Classes/classes.md` — cohesion and single responsibility, which apply to modules too (when installed).
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping third-party modules you do not control (when installed).
- `../../../CleanCode/LegacyRefactoring/legacyRefactoring.md` — refactoring in small, verified steps (when installed).
- `../../../actions/review.md` — review checklist for infrastructure code changes (when installed).
