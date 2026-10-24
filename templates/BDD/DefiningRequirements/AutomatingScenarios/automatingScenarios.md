---
name: bdd-automating-scenarios
description: "Covers deciding which scenarios to automate, step definitions as glue between Gherkin text and the application, the three-layer structure (scenarios, step definitions, test automation layer), step matching with regular expressions, Cucumber Expressions and named placeholders, parameter type conversion and custom parameter types, step variants and aliases, sharing state between steps (World, dependency injection, behave context, scenario context), embedded data tables (iterate, convert to objects, compare), steps for Scenario Outlines, combining steps, and scenario outcomes (passed, failed, error, undefined, pending, skipped), with setup for Cucumber-JVM, JBehave, Behave, SpecFlow/Reqnroll and cucumber-js, based on Chapter 6 (Automating the scenarios) of BDD in Action. Use when writing or reviewing step definitions or glue code, a step shows as undefined, pending or ambiguous, step text and annotations drift apart, step definitions grow fat or call drivers directly, passing data between steps, converting a Gherkin table to objects, comparing expected and actual tables, choosing a BDD runner for Java, TypeScript, Python or .NET, running scenarios by tag, or producing JSON or JUnit reports for CI."
---

# Automating the Scenarios

A BDD tool cannot run plain-text scenarios by itself: step definitions translate each step into calls on the application, and the tool reports each step's outcome. Keep step definitions thin translators that delegate to a separate test automation layer, keep state scoped to one scenario, and treat undefined or pending steps as unfinished work, never as passing.

## Decide what to automate

- Automate key examples that are stable, valuable to the business, and cheap enough to check repeatedly; they cut manual regression, speed releases, and feed a progress view of delivered features.
- Leave some scenarios to manual or exploratory testing when automation would cost more than it saves.
- Push detail that only developers care about down to unit or integration tests.
- Do not formalize scenarios for experimental features the business does not understand yet; prototype first.
- Continuous integration and delivery depend on this suite; see `../../TakingBddFurther/BuildProcess/buildProcess.md`.

## Three layers

| Layer | Question it answers | Owns |
|---|---|---|
| Scenarios (`.feature`) | What are we trying to achieve? | Business language only |
| Step definitions (glue) | What does the application need to do for this step? | Parsing parameters, calling the layer below, assertions |
| Test automation layer | How do we do it? | API clients, page objects or Screenplay tasks, database fixtures, Playwright/WebDriver |

A step definition is a conductor: it knows what to ask for, not how. Whether "Given I am a member" inserts a row, calls a REST endpoint or fills in a form is the automation layer's decision, and can change without touching the scenario or the step. In this repository's workflow, `bdd` owns all three test layers; production code belongs to `dev`.

```ts
// features/support/world.ts
import { setWorldConstructor, World, IWorldOptions } from "@cucumber/cucumber";
import { ParkingApi } from "../../test-automation/parkingApi"; // automation layer

export class ParkingWorld extends World {
  readonly parking = new ParkingApi(process.env.BASE_URL ?? "http://localhost:3000");
  customerId?: string;
  fee?: number;
  constructor(options: IWorldOptions) { super(options); }
}
setWorldConstructor(ParkingWorld);
```

```ts
// features/step_definitions/parking_fee.steps.ts
import { Given, When, Then, defineParameterType } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { ParkingWorld } from "../support/world";

defineParameterType({ name: "customerType", regexp: /visitor|member/, transformer: (s) => s });

Given("I am a {customerType}", async function (this: ParkingWorld, type: string) {
  this.customerId = await this.parking.createCustomer({ type });
});

When("I leave after {int} minutes", async function (this: ParkingWorld, minutes: number) {
  this.fee = await this.parking.completeStay(this.customerId!, minutes);
});

Then("I should pay {float}", function (this: ParkingWorld, expected: number) {
  assert.equal(this.fee, expected);
});
```

Current note: cucumber-js is now `@cucumber/cucumber`; steps return promises (async functions) instead of calling a `callback`, and use `function`, not arrow functions, so `this` is the World. Cucumber Expressions (`{int}`, `{float}`, `{word}`, `{string}`, custom types) are the default alongside regular expressions.

## Matching step text

| Tool | Placeholder style | Keyword-sensitive? |
|---|---|---|
| Cucumber-JVM, cucumber-js, Reqnroll/SpecFlow | Cucumber Expressions or regex | No: Given/When/Then are interchangeable |
| Behave | `{name}` / `{name:d}` (parse), regex optional | Yes by decorator, though steps can be shared with `@step` |
| JBehave | `$name` | Yes: "Given I pay" and "When I pay" are different steps |

- Step definitions are global across all feature files. The same text cannot mean two different things in two features; rephrase one of them.
- Ambiguous matches (two definitions match one step) are errors; tighten patterns instead of ordering them.
- Anchor regular expressions (`^...$`) so a short pattern does not swallow longer steps.
- Typed parameters convert for you: `{int}`, `{float}`, dates with a custom type, enums in Java (`Status status`).
- Text drift between feature file and glue makes steps undefined again; use an IDE plugin that highlights unmatched steps, and run the suite in CI so drift fails fast.

## Variants and aliases

Allow natural phrasing without duplicating methods:

- Cucumber Expressions: alternative text with a slash (`I leave/exit the garage`) and optional text in parentheses (`after {int} minute(s)`); braces are reserved for parameters.
- Regex: wrap alternatives in a non-capturing group `^I (?:leave|exit) after (\d+) minutes?$`; a capturing group would become an extra parameter and break the method signature.
- JBehave: `@Alias("...")` or `{leave|exit}` inline; Reqnroll/SpecFlow: stack several `[When(...)]` attributes.
- Do not alias wording that the team should converge on; normalize the scenario instead.

## Sharing state between steps

The tool creates fresh step context for every scenario, so per-scenario state is safe; state that survives across scenarios is a bug.

| Stack | Mechanism |
|---|---|
| cucumber-js | Properties on the World (`this.fee`) |
| Cucumber-JVM | Constructor injection of a shared helper (cucumber-picocontainer, Spring or Guice); fields on one step class only if all related steps live there |
| Behave | Attributes on `context` (`context.fee`); `context.table` for step tables |
| Reqnroll / SpecFlow | Context injection of a POCO or `ScenarioContext` through the binding constructor |
| Serenity BDD (JBehave/Cucumber) | `Serenity.setSessionVariable("member").to(member)` and `Serenity.sessionVariableCalled("member")` |

Prefer a typed context object over string-keyed maps; group step definitions by domain concept so the data flow stays readable. Never use static fields.

Current note: `ScenarioContext.Current` is deprecated since SpecFlow 3; inject the context instead. SpecFlow reached end of life and Reqnroll is its open-source successor with the same Gherkin bindings. Thucydides is now Serenity BDD.

## Tables in step definitions

Two jobs: build test data from a table, and compare actual results with an expected table. Use the tool's table API; hand-written row-by-row comparison is slow to write and reports failures poorly.

```java
// Cucumber-JVM 7
public record PrepaidBalance(String holder, int hours) {}

public class PrepaidHoursSteps {
    private final ParkingDriver parking; // injected by cucumber-picocontainer
    public PrepaidHoursSteps(ParkingDriver parking) { this.parking = parking; }

    @DataTableType
    public PrepaidBalance balance(Map<String, String> row) {
        return new PrepaidBalance(row.get("holder"), Integer.parseInt(row.get("hours")));
    }

    @Given("the following prepaid balances:")
    public void theFollowingPrepaidBalances(List<PrepaidBalance> balances) {
        parking.seedBalances(balances);
    }

    @When("{word} transfers {int} hours to {word}")
    public void transfers(String from, int hours, String to) {
        parking.transferHours(from, to, hours);
    }

    @Then("the prepaid balances should be:")
    public void balancesShouldBe(List<PrepaidBalance> expected) {
        assertThat(parking.balances()).containsExactlyInAnyOrderElementsOf(expected);
    }
}
```

```python
# Behave: features/steps/prepaid_steps.py
@given("the following prepaid balances:")
def step_impl(context):
    for row in context.table:
        context.parking.seed_balance(row["holder"], int(row["hours"]))
```

- cucumber-js: `table.hashes()` gives one object per row, `table.rowsHash()` a two-column key/value map.
- Reqnroll/SpecFlow: `table.CreateSet<T>()` to build objects and `table.CompareToSet(actual)` to assert.
- Convert explicitly (`int(...)`, `Integer.parseInt`); table cells arrive as strings.

Current note: since Cucumber-JVM 3, tables no longer convert to arbitrary objects automatically; register `@DataTableType` (or a default transformer such as Jackson). Annotations live in `io.cucumber.java.en`.

## Steps for outlines and composite steps

- Outline steps need no special code: placeholders are substituted before matching, so the same definition serves outlines and ordinary scenarios. In JBehave prefer `$name` over `<name>` in the pattern so it matches both.
- To offer a coarser step ("Given Ana is a member who has signed in"), call the automation layer's functions for each part rather than invoking other steps by text. Behave supports `context.execute_steps("""...""")`, but nested step calls hide failures and couple steps to wording; Cucumber-JVM never offered it.

## Scenario outcomes

| Outcome | Meaning | Action |
|---|---|---|
| Passed | Every step ran without failure | None |
| Failed | An assertion did not hold: the application does not behave as specified | Treat as a defect or an unfinished feature |
| Error | An unexpected exception: the application or the test code is broken | Investigate the glue and automation layer first |
| Undefined | No step definition matches; the tool prints a snippet | Paste the snippet and implement it |
| Pending | A definition exists but is marked unfinished | Finish it; never leave in main |
| Skipped | Not run because an earlier step failed, errored or was pending | Fix the earlier step |

- A step that runs without asserting anything passes. A half-written step must be marked pending explicitly: `return "pending"` (cucumber-js), `throw new PendingException()` (Cucumber-JVM, `io.cucumber.java.PendingException`), `raise NotImplementedError` as Behave's own snippets do, so the step cannot pass.
- Serenity separates failures (assertion errors) from errors (other exceptions); keep that distinction in triage even without it.
- Write the step definitions before the production code and watch the scenario fail for the right reason, then hand the failing scenario to `../../../actions/dev.md`.

Current note: current Cucumber versions run strictly by default, so undefined and pending steps fail the run; keep it that way in CI and isolate work in progress with a `@wip` tag filter.

## Tool setup at a glance

| Stack | Install | Layout and runner |
|---|---|---|
| Java | `io.cucumber:cucumber-java`, `cucumber-junit-platform-engine`, `cucumber-picocontainer` | `src/test/resources/features`, glue in `src/test/java`; JUnit 5 `@Suite @IncludeEngines("cucumber") @SelectClasspathResource("features")` |
| TypeScript | `npm i -D @cucumber/cucumber ts-node` | `features/*.feature`, `features/step_definitions`, `features/support`; set `requireModule: ["ts-node/register"]` in the config; `npx cucumber-js` |
| Python | `pip install behave` | `features/*.feature`, `features/steps/*.py`, `features/environment.py` for hooks; `behave` |
| .NET | `Reqnroll.NUnit` (or xUnit/MSTest variant) | `.feature` files in the test project; run with `dotnet test` |
| Browser via Playwright | `playwright-bdd` or Playwright called from the automation layer | Keep Playwright calls out of step definitions |

Current note: JBehave (`.story` files, `$name` placeholders) still works but is rarely chosen for new projects; Cucumber-JVM 7 with JUnit 5, or Serenity BDD on top of it, is the common JVM choice. Selenium WebDriver now shares the browser space with Playwright and Cypress.

```bash
npx cucumber-js --tags "@smoke and not @wip" --format json:reports/cucumber.json
behave --tags=transfers --junit --junit-directory reports
```

## Workflow

1. Pick a formulated scenario agreed in `../ExecutableSpecifications/executableSpecifications.md`; confirm it is worth automating at this level.
2. Run the tool to collect undefined-step snippets; reuse existing definitions where the wording already matches.
3. Implement each step as a thin translator: parse parameters (typed or custom types), call the automation layer, assert in Then steps only.
4. Build or extend the automation layer (API client, fixtures, page objects or Screenplay tasks) behind intention-revealing methods.
5. Keep state in the World, injected context or `context`; convert tables to typed objects; compare tables with the tool's API.
6. Run the scenario: it must fail with an assertion (failed), not an exception (error) or undefined/pending step. Fix the glue until it fails for the right reason.
7. Hand off to `../../../actions/dev.md` to make it pass with TDD inside; rerun until green.
8. Wire tag filters and JSON/JUnit reports into CI; no undefined or pending steps on main.

## Red flags

- Step definitions that contain selectors, SQL, HTTP calls or sleeps instead of delegating.
- Assertions inside Given or When steps; Then steps that assert nothing.
- Static or module-level variables carrying data between scenarios.
- Several near-identical step definitions differing only in a literal value.
- Capturing regex groups used for alternatives, giving a mismatched parameter count.
- Undefined or pending steps tolerated in CI, or empty step bodies that pass.
- Errors (exceptions) reported and triaged as if they were application failures.
- Steps calling other steps by text in long chains.
- Production code written or changed while automating scenarios.

## Related

- `../../../actions/bdd.md` — owns feature files, step definitions and glue code.
- `../ExecutableSpecifications/executableSpecifications.md` — how the scenarios being automated should read.
- `../DefiningFeatures/definingFeatures.md` — the example-to-working-code loop this chapter implements.
- `../../CodingTheBddWay/AcceptanceTests/acceptanceTests.md` — structuring the automation layer for maintainability.
- `../../CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` — Playwright/WebDriver, page objects and Screenplay.
- `../../CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — automating business rules below the UI.
- `../../TakingBddFurther/BuildProcess/buildProcess.md` — running scenarios in CI and delivery pipelines.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — reports built from JSON results.
- `../../../actions/dev.md`, `../../../actions/tdd.md` — the outer and inner loops.
- `../../../TDD/Patterns/XUnitPatterns/xUnitPatterns.md` — fixtures and assertions behind step definitions (when installed).
- `../../../DevOps/Practices/ContinuousIntegration/continuousIntegration.md` — CI that runs the suite on every commit (when installed).
