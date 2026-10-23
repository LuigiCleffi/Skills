---
name: devops-continuous-integration
description: How to set up and run continuous integration (version control as the single entry point for every change, automated builds, the test pyramid and Marick's agile testing quadrants, unit/integration/acceptance tests in the build, the integrate-often ritual, a CI server that builds every commit, broken-build etiquette, archiving artifacts, and keeping the CI server itself as code with Jenkinsfile, Jenkins Configuration as Code or GitHub Actions workflows), based on Chapter 6 (Continuous integration) of DevOps na Prática. Use when creating or fixing a CI job or workflow, writing a Jenkinsfile or .github/workflows YAML, the build is red or flaky, builds are slow, tests are skipped, someone edits code directly on a server, choosing Poll SCM vs webhooks, archiving a WAR/JAR/image, recovering a lost Jenkins server, or deciding which tests belong in the commit build.
---

# Continuous Integration

Every change (application code, infrastructure code, configuration) starts as a commit in version control, and every commit to the shared branch is built and tested automatically within minutes. A red build is the team's top priority: fix it or revert it before anything else is merged. The CI server is production infrastructure for the team, so define it as code and be able to rebuild it.

## Version control is the only way in

- No change reaches any server except through a commit. Editing code or config "live" on a server removes audit, review and reproducibility; treat it as an incident and back-port the change to the repository.
- Commits carry author, message and an immutable ID (the Git SHA); use the SHA to trace any artifact or production problem back to its change.
- Version everything needed to rebuild: source, build scripts, infrastructure code, pipeline definitions, schema migrations. Exclude build outputs, downloaded dependencies and secrets (`.gitignore`, plus secret scanning).

## Automate the build

- One command builds, tests and packages from a clean checkout: `mvn -B verify`, `./gradlew build`, `npm ci && npm test`, `dotnet test`, `make`. If a developer needs a wiki page of steps, the build is not automated.
- The build resolves dependencies itself, at pinned versions, and produces artifacts (JAR/WAR, package, container image, reports).
- Run the same command locally and in CI. CI-only scripts drift.
- Keep the commit build fast (aim for under 10 minutes). Cache dependencies; split slow suites into later pipeline stages instead of deleting them.

## Tests in the build

| Type | Scope | Speed | Where |
|---|---|---|---|
| Unit | one unit, no I/O | milliseconds | every commit, every developer run |
| Integration / component | module plus a real dependency (DB, queue, HTTP service) | seconds | commit build if fast, else next stage |
| Acceptance / functional | whole system from outside (UI or API) | minutes | commit build while small, then its own stage |

Use Brian Marick's quadrants to spot gaps: technology-facing tests that support the team (unit, component) should be fully automated; business-facing tests that support the team (functional, examples) should be automated too, not run from spreadsheets; business-facing critique (exploratory, usability) stays human; technology-facing critique (performance, load, security) is usually neglected and found in production. Plan for it.

- Acceptance tests need the app and its dependencies running; start them in the build (containers, Testcontainers, a build-phase server like Maven `integration-test`) rather than pointing at a shared environment.
- Replace fixed sleeps (`Thread.sleep(5000)` waiting for an index) with explicit waits on a condition; sleeps make tests slow and flaky.
- Publish test reports (JUnit XML) so trends and failures are visible in the CI UI.

## The integration ritual

1. Finish a small, shareable change; run the full local build.
2. Pull the latest shared branch; rebuild and retest with others' changes.
3. Push only on green. Integrate at least daily; mature teams push several times a day.
4. If a change is too big to finish in a day, split it, hide it behind a feature flag, or at least rebase often. Long-lived branches are deferred integration.

## The CI server

- Builds every push to the shared branch and every pull request; uses webhooks, not polling. (The book polls Git every minute with `* * * * *`; polling wastes resources and adds delay. Use `H/5 * * * *` only as a fallback where webhooks cannot reach the server.)
- Starts from a clean workspace every time so results are deterministic.
- Archives the artifact that passed, with its version and SHA, so later stages deploy exactly what was tested. Never rebuild for deployment.
- Radiates status: build badge, chat notification on failure, branch protection that requires the check.
- Broken build rule: nobody merges onto red; the last committers fix forward within minutes or revert.

```groovy
// Jenkinsfile (declarative), stored in the repository
pipeline {
  agent { label 'linux' }
  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '50'))
  }
  stages {
    stage('Build and test') {
      steps { sh 'mvn -B -ntp clean verify' }
    }
  }
  post {
    always  { junit '**/target/*-reports/*.xml' }
    success { archiveArtifacts artifacts: 'combined/target/*.war', fingerprint: true }
  }
}
```

```yaml
# .github/workflows/ci.yml
name: ci
on:
  push: { branches: [main] }
  pull_request:
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # pin third-party actions to a commit SHA
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21', cache: maven }
      - run: mvn -B -ntp verify
      - uses: actions/upload-artifact@v4
        with: { name: app-${{ github.sha }}, path: combined/target/*.war }
```

Current note: the book configures a Maven freestyle job through the Jenkins web UI and installs Jenkins with Puppet on a Vagrant VM (Java 6, Maven 2). Today define jobs as code (Jenkinsfile with Multibranch Pipeline, or GitHub Actions/GitLab CI/Azure Pipelines YAML in the repository) and run builds on ephemeral agents or containers.

## The CI server as code

The team is blocked when CI is down, so it must be rebuildable from the repository, with no manual UI configuration.

- Job definitions: Jenkinsfile per repository plus Multibranch or Organization Folder discovery (or Job DSL), not hand-made jobs. The book captures job `config.xml` into Puppet templates; that works but is brittle across plugin versions.
- Controller configuration: Jenkins Configuration as Code (JCasC) YAML for tools, security realm, agents and credentials references:

```yaml
# jenkins.yaml (JCasC)
tool:
  maven:
    installations:
      - name: maven-3
        home: /usr/share/maven
```

- Plugins: pin them in `plugins.txt` and install with the plugin installation manager in an image build.
- Secrets: in the CI credentials store or an external manager (Vault, AWS Secrets Manager, Azure Key Vault); for cloud access prefer OIDC federation over long-lived keys. Never in job config, workflow YAML or logs; mask them.
- Prove it: destroy and recreate the CI server (or its container) in a non-production setting and confirm jobs reappear and pass.
- Hosted CI (GitHub Actions, GitLab SaaS, Azure Pipelines, CodeBuild) removes the server to maintain; the pipeline YAML is still the code to review.

## Workflow

1. Confirm the repository, default branch, and which CI system and runners are in use; check who owns CI configuration.
2. Make the build one command from a clean checkout; pin dependency and tool versions.
3. Classify existing tests; put fast ones in the commit build, plan stages for slow ones, fix or quarantine flaky ones with a ticket.
4. Write the pipeline as code (Jenkinsfile or workflow YAML): clean checkout, build, test, publish reports, archive the versioned artifact.
5. Trigger on push and pull request via webhook; require the check in branch protection.
6. Move CI credentials to the secrets store with least-privilege scopes; review workflow `permissions`.
7. Push a trivial commit to verify the trigger, the green path, a deliberate failure, and notifications.
8. Make the CI controller reproducible (JCasC, pinned plugins, image) and test a rebuild before relying on it.

## Red flags

- Changes made directly on servers or in the CI UI with no commit.
- Builds that only work on one machine, or that require manual steps.
- A red build left for hours, or people merging on top of it.
- Commenting out or `@Ignore`-ing failing tests to get green.
- Fixed sleeps and order-dependent tests causing flakiness.
- Polling SCM every minute across many jobs.
- Rebuilding the artifact for deployment instead of promoting the tested one.
- Secrets in Jenkinsfiles, workflow YAML, job XML or build logs; workflows from forks that can read secrets; unpinned third-party actions.
- A single hand-configured CI server with no backup or code to recreate it.

## Related

- `../DeliveryPipeline/deliveryPipeline.md` — what happens after the commit build: packaging, repositories, deploy stages.
- `../ConfigurationManagement/configurationManagement.md` — the infrastructure code that CI must also build and test.
- `../InfrastructureAsCode/infrastructureAsCode.md` — provisioning the CI server itself from code.
- `../WhatIsDevOps/whatIsDevOps.md` — why late integration ("last mile") hurts.
- `../../AWS/Delivery/CodeCommitAndCodeBuild/codeCommitAndCodeBuild.md` — CI on AWS (CodeBuild `buildspec.yml`); syntax differs from Jenkins and GitHub Actions.
- `../../AWS/Delivery/CiCdAndSdlc/ciCdAndSdlc.md` — CI/CD concepts mapped to AWS services.
- `../../../TDD/README.md` — writing the unit tests CI runs (when installed).
- `../../../CleanCode/UnitTests/unitTests.md` — fast, independent, repeatable tests (when installed).
- `../../../actions/tdd.md` — test-first workflow (when installed).
- `../../../actions/dev.md` — development workflow that ends in a green build (when installed).
