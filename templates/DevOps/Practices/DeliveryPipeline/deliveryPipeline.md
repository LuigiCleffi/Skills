---
name: devops-delivery-pipeline
description: How to design and build a deployment pipeline from commit to production (build once and promote the same versioned artifact, native OS packages with fpm and signed apt/yum repositories or container images in a registry, package signing with GPG or cosign, CI for infrastructure code with lint, unit tests such as rspec-puppet and packaging, separate vs shared repositories for app and infra, stages and gates, continuous delivery vs continuous deployment, upstream/downstream jobs, copying artifacts between stages, a one-click production deploy, deploy credentials), based on Chapter 7 (Delivery pipeline) of DevOps na Prática. Use when designing pipeline stages, wiring build -> test -> staging -> production, adding a manual approval, "deploy what was tested", versioning artifacts with build number and SHA, publishing .deb/.rpm or images, "gpgme created no signature", apt-key or signed-by errors, ensure => latest surprises, testing Puppet/Ansible/Terraform in CI, or a deploy job fails with "Permission denied" over SSH.
---

# Delivery Pipeline

A delivery pipeline is your release process as automated, versioned code: every commit produces one immutable, versioned artifact, which is promoted unchanged through stages that each try to reject it; only survivors can reach production. Early stages are fast and cheap; later stages are slower and more production-like. Deploying to production changes live systems: the production stage needs an explicit gate (or a deliberate continuous-deployment decision), short-lived least-privilege credentials, and a tested rollback.

## Continuous delivery vs continuous deployment

- **Continuous delivery**: every green commit is deployable; a person (business decision) chooses when. Default for most teams, and required where releases are distributed (mobile, on-premise) or regulated.
- **Continuous deployment**: every green commit goes to production automatically. Needs strong automated tests, monitoring that detects regressions fast, and automated rollback.
- The book's example pipeline auto-deploys every commit to production with no gate. Do not copy that without the safety net above; add an approval step until it exists.

## Build once, promote the artifact

- Version every artifact uniquely and traceably: `1.8.<build number>+g<short SHA>` or an image tag with the SHA. Never reuse a version.
- Store it in an artifact repository (apt/yum repo, Maven/npm registry, container registry, S3), not only inside the CI server.
- Later stages fetch that exact version. Rebuilding per environment means production runs something untested.
- Keep environment-specific configuration out of the artifact (see AdvancedTopics).

## Packaging: native packages or images

Ops tooling already understands OS packages; using them aligns dev and ops. They give versioning and dependencies, a distribution channel (repositories), transactional and idempotent install/upgrade/remove, config-file handling on upgrade, checksums, signatures, and "which package owns this file" auditing.

```bash
# Build a .deb from a directory of build outputs (fpm)
VERSION="1.8.${BUILD_NUMBER}+g${GIT_COMMIT:0:7}"
fpm -s dir -t deb -n shop -v "$VERSION" -a all \
    -d 'tomcat9' --prefix /var/lib/tomcat9/webapps \
    -C combined/target shop.war
```

- `-a all` (Debian name; fpm also accepts `noarch`) for architecture-independent content; real architecture for compiled code.
- Declare runtime dependencies (`-d`) so the package manager orders installs.
- Publish to a repository manager (reprepro, aptly, Pulp, Artifactory, Nexus, a cloud artifact service) that signs the repository metadata.

Current note: for most new services the artifact is a container image pushed to a registry (ECR, ACR, GHCR, Harbor), tagged with the SHA and referenced by digest at deploy time; sign images with cosign/Sigstore or Notation. The same promote-don't-rebuild rule applies.

## Signing and trusting the repository

- Repositories sign metadata with a GPG key; clients verify it. "gpgme created no signature" from reprepro means no usable signing key for the repository user.
- Generate the signing key in a protected way (dedicated key, passphrase or hardware/KMS-backed, stored in the secrets manager), not interactively on the CI box with an empty passphrase as the book does for brevity. Give it an expiry and a rotation plan.
- Publish only the public key; pin it on clients per repository:

```
# /etc/apt/sources.list.d/shop.list
deb [signed-by=/etc/apt/keyrings/shop.gpg] https://packages.internal.example/ stable main
```

Current note: `apt-key` is deprecated on Debian and Ubuntu; use per-repository keyrings with `signed-by` (current puppetlabs-apt and Ansible `deb822_repository` support this).

- Serve the repository over HTTPS and restrict who can publish (only the pipeline identity).

## Deploying the package

- Configuration management declares the repository and the package; the pipeline decides which version:

```puppet
package { 'shop':
  ensure => $shop::version,   # e.g. '1.8.412+g3f9c2ab' passed by the pipeline or Hiera
  notify => Service['tomcat9'],
}
```

- Avoid `ensure => latest` in production: whatever was published last gets installed on the next agent run, outside any gate, and different nodes can end up on different versions. Pin the version and change it through the pipeline.
- Once deploys come from the repository, delete artifacts that were committed into modules.

## CI for infrastructure code

Infrastructure code gets the same treatment: version control, automated build, tests, a packaged artifact, its own pipeline.

- Separate repository when infra and app change at different rates and are owned differently (the book's choice); same repository when they must change atomically or the team is small. Either way, the app pipeline should not rebuild infra on every app commit.
- Build stages for infrastructure code:
  1. Install pinned tooling (`bundle install` with a Gemfile.lock, `pip install -r` with pins, `terraform init` with a lock file).
  2. Lint and validate: `puppet-lint`, `puppet parser validate`; `ansible-lint`, `yamllint`; `terraform fmt -check`, `terraform validate`, `tflint`; plus a policy/security scanner (Checkov, tfsec/Trivy, cfn-lint, cfn-guard).
  3. Unit tests: rspec-puppet, Molecule for Ansible roles, `terraform test` or Terratest.
  4. Package the exact module set (tarball with resolved third-party modules, or a tagged commit) as a versioned artifact.

```ruby
# modules/shop/spec/classes/web_spec.rb (rspec-puppet)
require 'spec_helper'
describe 'shop::web' do
  let(:params) { { 'version' => '1.8.412+g3f9c2ab' } }
  it { is_expected.to compile.with_all_deps }
  it { is_expected.to contain_package('shop').with_ensure('1.8.412+g3f9c2ab') }
end
```

- Exclude local state and downloaded dependencies from the repository (`.vagrant`, vendored module dirs, `.terraform/`), but commit lock files.

## Stages and gates

| Stage | Purpose | Trigger |
|---|---|---|
| Commit build (app, infra in parallel) | compile, unit tests, lint, package, publish | every push |
| Acceptance | deploy artifact to a test env, run functional/API tests | automatic on green |
| Staging / UAT | production-like env, performance, user validation | automatic or manual |
| Production | deploy the same artifact and infra version | manual approval (CD) or automatic (CDp) |

- Split acceptance tests into their own stage once they slow the commit build.
- Pass versions explicitly between stages (pipeline parameters or outputs), not "whatever is latest". The book uses Jenkins Parameterized Trigger and Copy Artifact with "last successful build as fallback"; a fallback can deploy a different build than the one that triggered, so avoid it in production.
- Model the pipeline in one place: a Jenkins declarative pipeline with `input` for approval, GitHub Actions jobs with `environment:` protection rules, GitLab environments, Azure Pipelines stages, AWS CodePipeline.

```yaml
# GitHub Actions: promote one artifact through gated environments
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.v.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      - id: v
        run: echo "version=1.8.${{ github.run_number }}+g${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
      # build, test, publish package or image tagged with the version
  deploy-staging:
    needs: build
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh staging "${{ needs.build.outputs.version }}"
  deploy-production:
    needs: [build, deploy-staging]
    environment: production        # required reviewers configured on the environment
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }   # OIDC to the cloud, no stored keys
    steps:
      - run: ./deploy.sh production "${{ needs.build.outputs.version }}"
```

## The deploy step and its credentials

- The book's deploy job uses `scp` and `ssh` from the CI user with a passphrase-less key copied to the web server, then runs `puppet apply`. If you push over SSH: dedicated deploy user, key restricted (`from=`, forced command), limited sudo, keys in the CI credentials store, host keys verified (no `StrictHostKeyChecking=no`).
- Prefer pull or brokered models: agents pulling the pinned version, SSM Run Command or Session Manager, Azure Run Command, Kubernetes/Argo CD, or a deploy service; and short-lived cloud credentials via OIDC.
- Make deploys idempotent and self-cleaning: unpack into a fresh versioned directory and remove leftovers, so files from a previous release cannot leak into the next.
- Deploy all affected components in a defined order (database migrations before the app version that needs them), not just the web tier.
- Record what was deployed where (version, SHA, who approved, when).

## Workflow

1. Map the current path from commit to production, including manual steps and approvals; agree on continuous delivery or deployment.
2. Choose the artifact type (OS package or image) and repository; define the version scheme with build number and SHA.
3. Set up signing with a protected key and client-side verification (`signed-by`, digest pinning).
4. Add a CI pipeline for infrastructure code: pinned tools, lint, validate, unit tests, versioned package.
5. Define stages, the artifact/version hand-off between them, and gates; require approval for production.
6. Implement the deploy step with least-privilege, short-lived credentials; pin versions instead of `latest`.
7. Confirm target account/subscription, region and environment; show the plan or diff of the first production deploy and get explicit approval.
8. Document and rehearse rollback (redeploy previous version, re-apply previous infra commit) before the first production run.

## Red flags

- Different artifacts per environment, or rebuilding at deploy time.
- `ensure => latest`, `:latest` image tags, or "last successful build" fallbacks in production paths.
- Unsigned packages or images, empty-passphrase signing keys, `apt-key add`, `[trusted=yes]` repositories.
- CI deploying to production with no gate and no automated rollback.
- Passphrase-less SSH keys with root or broad sudo on production; disabled host key checking.
- Infrastructure code that is never linted or tested, or lives only on someone's laptop.
- Deploys that leave old files behind or update one tier while ignoring dependent tiers.
- Secrets in job definitions, pipeline YAML or build logs.

## Related

- `../ContinuousIntegration/continuousIntegration.md` — the commit stage this pipeline starts from.
- `../ConfigurationManagement/configurationManagement.md` — modules the pipeline tests and deploys.
- `../AdvancedTopics/advancedTopics.md` — blue-green, orchestration, database changes, per-environment config.
- `../Monitoring/monitoring.md` — detecting a bad deploy quickly.
- `../../AWS/Delivery/CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — the same pipeline with CodePipeline/CodeDeploy (`appspec.yml`); syntax is not interchangeable.
- `../../AWS/Delivery/CiCdAndSdlc/ciCdAndSdlc.md` — CI/CD stages mapped to AWS services.
- `../../AWS/Delivery/BlueGreenDeployments/blueGreenDeployments.md` — lower-risk production cutovers on AWS.
- `../../Azure/AppService/appService.md` — deployment slots and pipelines for Azure App Service.
- `../../../DataSystems/Foundations/EncodingAndEvolution/encodingAndEvolution.md` — rolling upgrades with mixed versions (when installed).
- `../../../actions/review.md` — reviewing pipeline and deploy changes (when installed).
