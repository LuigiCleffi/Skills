---
name: bdd-build-process
description: "Covers running executable specifications in the automated build: self-sufficient, order-independent scenarios, feature files versioned with the code, command-line execution, CI as fast feedback, the acceptance stage as a quality gate in a continuous delivery pipeline that promotes one release candidate, publishing living documentation from CI to the build server or a static site, and speeding up acceptance suites by parallelizing within one machine, sharding across machines by tag or directory, merging JSON results, and remote browser grids, based on Chapter 12 (BDD in the build process) of BDD in Action. Use when adding Cucumber, Serenity, behave or Playwright scenarios to CI, designing pipeline stages, fixing flaky or order-dependent scenarios, publishing BDD reports, splitting a slow acceptance suite, or when the user mentions GitHub Actions, GitLab CI, Jenkinsfile, matrix builds, sharding, --parallel, Cucumber JSON merge, Selenium Grid, build once deploy many, release candidate, UAT gate or living documentation publishing."
---

# BDD in the Build Process

Executable specifications pay off only when the build runs all of them, automatically, on every change. Make each scenario self-sufficient, keep feature files in the same repository and version as the code, run them from the command line, gate the delivery pipeline on them, publish the resulting living documentation on every build, and keep the suite fast enough that people wait for it.

## Preconditions for running specs in a build

**Self-sufficient scenarios.** No scenario may depend on another having run first to create data or reach a state.

- Order-dependent suites produce cascades: one real failure makes every downstream scenario fail, and the report shows working features as broken.
- Parallel runners, shards and many test frameworks do not guarantee order. Assume none.
- Each scenario sets up what it needs (API calls, fixtures, factories in `Given` steps or `Before` hooks) and leaves no state that affects others (unique IDs, per-scenario tenants or transactions, cleanup hooks).

```ts
// support/hooks.ts  (@cucumber/cucumber)
Before(async function () {
  this.tenant = await testApi.createTenant({ name: `t-${randomUUID()}` }); // isolated data per scenario
});
After(async function () {
  await testApi.deleteTenant(this.tenant.id);
});
```

Check: run the suite in random order or one scenario alone (`--name`, `--tags`, line number) and confirm the result does not change.

**Versioned with the code.** Feature files, step definitions and support code live in the application repository, on the same branch.

- A given version of the application has exactly one matching set of acceptance criteria; release branches and hotfixes carry theirs.
- Tools that keep scenarios in a separate database or SaaS editor break that link and tempt analysts to write scenarios alone, which developers then quietly rewrite to automate. That ends the collaboration BDD depends on. Keep authorship collaborative and storage in Git.

**Runnable from the command line.** If it only runs from an IDE or a GUI test tool, CI cannot run it.

```bash
npx cucumber-js --tags "not @wip" --format json:reports/cucumber.json
mvn verify -Dcucumber.filter.tags="@approvals"
behave --tags=-wip --format json -o reports/behave.json
npx playwright test --grep @smoke
```

Wrap these in the project's build tool or `package.json` scripts so CI and developers run the same command.

## CI: shorten the feedback loop

- Feedback delay is risk: unit specs answer in seconds, acceptance scenarios in minutes, manual test cycles in days. Automating the criteria moves feedback from days to minutes.
- On every push, CI builds and runs the automated specs; a broken build is the team's top priority to fix.
- Without meaningful automated specs, CI only proves the code compiles. With them, a green build is evidence about features, and the published living documentation lets analysts and testers check delivered behavior themselves instead of waiting for a demo.

## The acceptance stage in a delivery pipeline

In continuous delivery every build is a potential release. Build and package once, then promote that same artifact through quality gates.

```
commit stage       compile, unit specs, integration tests      (minutes, gates the rest)
     |  artifact v1.8.3 (built once)
acceptance stage   automated acceptance criteria + living docs (sharded)
     |
nonfunctional      performance, security, accessibility checks
     |
UAT / staging      deploy v1.8.3 (button press, automated deploy)
     |
production         deploy v1.8.3 when the business decides
```

- Run the commit stage first and fast; behavior-named specs make its failures easy to diagnose.
- Run acceptance scenarios against the deployed release candidate, not a rebuild; the thing you verified is the thing you ship.
- Every manual testing step adds days to lead time. The more the team trusts the automated criteria, the fewer manual gates are needed. Trust comes from readable scenarios and accessible reports: testers must see what is verified and how, or they will repeat that work by hand instead of exploring.
- Use tags to control what gates what: `@wip` excluded from the gate, `@smoke` run after each deployment, full suite before promotion.

## Publishing living documentation from CI

Generate reports on every build; never by hand before a demo.

- Simplest: attach the HTML report as a build artifact or use the CI server's report plugin; provide a stable "latest" link.
- Better for non-developers: deploy the static report to a web host (GitHub Pages, GitLab Pages, an internal static site or bucket), so nobody needs CI access or has to find the right job.
- Keep history: latest on the site, older versions as build artifacts or dated folders.
- Publish from the main branch (and release branches); per-branch reports belong in the pull request as artifacts.

```yaml
# .github/workflows/acceptance.yml (excerpt)
jobs:
  acceptance:
    strategy:
      fail-fast: false
      matrix:
        suite: [time-off, approvals, payroll, reporting]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx cucumber-js --tags "@${{ matrix.suite }} and not @wip" --format json:reports/${{ matrix.suite }}.json
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: cucumber-${{ matrix.suite }}, path: reports/ }

  living-docs:
    needs: acceptance
    if: always() && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { pattern: cucumber-*, merge-multiple: true, path: reports/ }
      - run: npx your-report-generator --input reports --output site/   # merge JSON into one report
      # then deploy site/ to the team's static host
```

`if: always()` matters: the report is most needed when scenarios fail.

## Making the acceptance suite fast

A 15 to 30 minute pipeline supports same-day fixes; a 3 hour suite means feedback tomorrow. Measure first (slowest features, setup time, waits), then:

**Cut cost per scenario before adding hardware.** Set up data through APIs, not the UI; test business rules below the UI where the scenario allows (see the UI and non-UI skills); replace fixed sleeps with explicit waits.

**Parallelize on one machine.** Run feature files or scenarios concurrently in separate processes or workers.

```properties
# src/test/resources/junit-platform.properties  (Cucumber-JVM 7)
cucumber.execution.parallel.enabled=true
cucumber.execution.parallel.config.strategy=fixed
cucumber.execution.parallel.config.fixed.parallelism=4
```

```bash
npx cucumber-js --parallel 4
```

Process-level isolation is more robust than threads for scenarios with shared static state. One machine stops scaling quickly for browser tests: too many browsers cause memory pressure and spurious failures.

**Shard across machines.** Split by tag or directory and run each group as a separate CI job (matrix above), each writing its own result file; merge the results into one report afterwards.

```java
// One suite per shard, selected with -Dtest=ApprovalsSuite or by a CI matrix value
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@approvals")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "json:target/cucumber/approvals.json")
public class ApprovalsSuite {}
```

- Balance shards by duration, not by count; rebalance as the suite grows.
- Every shard must produce a result file even on failure, or the merged report silently loses features.
- Self-sufficient scenarios are a hard prerequisite; sharding exposes hidden order dependencies immediately.

Current note: the book's `@Cucumber.Options(format=...)` is gone; Cucumber-JVM 7 uses the JUnit Platform Suite engine shown above, with `plugin` instead of `format`. Jenkins multi-configuration jobs are largely replaced by declarative `Jenkinsfile` pipelines with `parallel`/`matrix`, and by matrix jobs in GitHub Actions or GitLab CI. Playwright has built-in sharding (`--shard=1/4`) and report merging (`merge-reports`).

**Remote browsers.** A browser grid (Selenium Grid, or a cloud browser provider) runs WebDriver sessions on remote nodes across browsers and operating systems. A grid distributes sessions but does not make tests parallel by itself; combine it with runner-level parallelism. Size the hub generously, and use a matrix of shard x browser when cross-browser coverage is required.

Current note: Selenium Grid 4 replaces the `-role hub/node` flags with `standalone`, `hub` and `node` subcommands, and is commonly run from the official Docker images. PhantomJS is discontinued; use headless Chrome or Firefox. Playwright runs headless browsers in parallel workers without a grid.

## Workflow

1. Verify each scenario runs alone and in random order with the same result; fix shared state first.
2. Confirm feature files and glue live in the application repository and run with one documented CLI command.
3. Add the commit stage (unit specs, integration tests) and the acceptance stage (scenarios against the built artifact) to the pipeline; exclude `@wip` from gates.
4. Emit machine-readable results from every shard, merge them, and publish the HTML living documentation on every main-branch build, even when scenarios fail.
5. Measure suite duration; reduce per-scenario cost, then parallelize locally, then shard across machines balanced by duration.
6. For browser suites, add a grid or a runner with built-in workers; add a browser axis only where cross-browser coverage is a requirement.
7. Track pipeline duration and flaky-scenario rate; treat regressions in either as defects.

Changing shared CI configuration, runner capacity or deployment gates affects the whole team: propose the change in a pull request, keep the previous pipeline definition revertible, and get the owner's approval before altering production deployment steps.

## Red flags

- Scenarios that pass only when run in a particular order or as a full suite.
- Acceptance criteria stored outside the repository, or edited in a tool developers never see.
- Tests that can only be started from an IDE or a GUI test tool.
- The release candidate rebuilt at each stage instead of promoted.
- Acceptance stage skipped "for speed" while manual regression testing grows.
- Living documentation published manually, or not published when the build fails.
- Shards whose result files are missing from the merged report.
- Parallelism added on top of fixed sleeps and shared test accounts, then blamed for flakiness.
- A browser grid expected to parallelize a runner configured for serial execution.
- A suite so slow that developers push and stop watching the result.

## Related

- `../../../actions/bdd.md` — the workflow whose scenarios this pipeline runs.
- `../../../actions/dev.md` — running both loops locally before pushing.
- `../LivingDocumentation/livingDocumentation.md` — what the published reports should contain and how to organize them.
- `../../CodingTheBddWay/AcceptanceTests/acceptanceTests.md` — robust, independent acceptance tests and test data setup.
- `../../CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` — browser automation that the grid and workers execute.
- `../../CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — faster criteria below the UI, and nonfunctional gates.
- `../../CodingTheBddWay/BddAndUnitTesting/bddAndUnitTesting.md` — the fast unit specs of the commit stage.
- `../../../DevOps/Practices/ContinuousIntegration/continuousIntegration.md` — CI discipline (when installed).
- `../../../DevOps/Practices/DeliveryPipeline/deliveryPipeline.md` — pipeline stages and artifact promotion (when installed).
- `../../../DevOps/Practices/ConfigurationManagement/configurationManagement.md` — versioning everything with the code (when installed).
- `../../../UIUX/Testing/testing.md` — UI test strategy across levels (when installed).
