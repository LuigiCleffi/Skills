---
name: bdd-acceptance-tests
description: "Covers turning pending executable specifications into reliable, maintainable automated acceptance tests: the four qualities of a good acceptance test (communicates, gives meaningful feedback, reliable, maintainable), keeping the suite green-or-pending, dedicated test databases, resetting state per scenario vs per suite, before/after hooks scoped by tags, scenario-specific data in steps and tables, personas and known entities, and the three automation layers (Business Rules, Business Flow, Technical) that separate the what from the how, based on Chapter 7 (From executable specifications to rock-solid automated acceptance tests) of BDD in Action. Use when automating Gherkin scenarios, writing step definitions or acceptance-test glue code, designing test data setup, adding Before/After/BeforeAll hooks, fixing flaky or order-dependent scenarios, a small UI change breaks dozens of scenarios, the suite is always partly red and ignored, scenarios rely on mystery seed data, introducing personas, step libraries, page objects or the Screenplay pattern, or the user mentions Cucumber hooks, behave environment.py, test database reset, test isolation, layers of abstraction or brittle acceptance tests."
---

# From Executable Specifications to Rock-Solid Acceptance Tests

An automated acceptance test is production-grade code whose job is to tell the truth about one business rule: it passes if and only if the system satisfies that rule. Make every scenario start from a known state it controls, keep the data that matters visible in the scenario, and layer the glue code so the business rule, the user journey and the technical interaction can change independently.

## What a good acceptance test must do

Judge every automated scenario against four qualities; a test that fails one of them costs more than it returns.

| Quality | Check | Typical violation |
|---|---|---|
| Communicates | A stakeholder can read the scenario and say which business behavior it demonstrates | Steps narrate clicks and field names |
| Meaningful feedback | A failing run tells a developer which requirement broke and where the interaction stopped | `expected true but was false` with no context |
| Reliable | Fails only when the behavior is wrong; technical failures are easy to isolate | Timing, shared data, test order |
| Maintainable | A change in one screen or API touches one class, not every scenario | Copy-pasted selectors and setup in each step |

- The suite should contain only passing and pending scenarios. A red scenario is an alarm that stops the line, not background noise. Once a team tolerates a few permanently broken tests, nobody looks at the results and the suite loses its purpose.
- Quarantine flaky scenarios immediately (tag them, e.g. `@quarantine`, exclude from the gating run, open a ticket) and fix the cause; never leave them failing in the main run.
- Treat glue code with the same discipline as production code: refactoring, naming, no duplication, code review. Developers and testers should build it together.

## Putting the system in a known state

Before automating any step, decide how each scenario gets a clean, predictable environment.

- Give acceptance tests their own database (and queues, buckets, mail sinks). Never share it with developers or manual testers. Keep its engine and configuration close to production.
- Provision it automatically. Current note: containers have largely replaced VM provisioning with Puppet/Chef for this; Testcontainers (Java, Node, Python, .NET, Go) or a `docker compose` file per run is the usual way to get a disposable, production-like database.

| Strategy | Isolation | Speed | Risk |
|---|---|---|---|
| Rebuild schema + reference data before each scenario | Best: no scenario can leak into another | Slowest | Usually acceptable with containers, transactional rollback or truncate-and-reseed |
| Rebuild once per suite run | Each scenario must clean up what it creates | Faster | Hidden coupling between scenarios, order-dependent failures |
| Per-scenario unique data (tenant, IDs) in a shared DB | Good if every query is scoped | Fast, parallel-friendly | One unscoped query reintroduces coupling |

Prefer per-scenario reset; fall back only when measured runtime forces it. Whatever you choose, every scenario must pass when run alone and in any order.

## Hooks: intervene at the right lifecycle point

BDD tools expose hooks before/after the suite, each feature, each scenario (and each example row, and each step in some tools). Scope expensive setup with tags so unit-speed scenarios do not pay for a database reset.

```ts
// features/support/hooks.ts  (@cucumber/cucumber)
import { BeforeAll, Before, After, AfterAll, Status } from "@cucumber/cucumber";

BeforeAll(async () => { await testDb.start(); await testDb.migrate(); });
Before({ tags: "@db" }, async () => { await testDb.truncateAndSeedReferenceData(); });
After(async function ({ result }) {
  if (result?.status === Status.FAILED) this.attach(await this.diagnostics(), "text/plain");
});
AfterAll(async () => { await testDb.stop(); });
```

```python
# features/environment.py  (behave)
def before_scenario(context, scenario):
    if "db" in scenario.effective_tags:
        context.db.reset()
```

```java
// Cucumber-JVM 7
@Before("@db and not @readonly")
public void resetDatabase() { testDatabase.reset(); }
```

Current note: Cucumber-JVM 7 and cucumber-js both have suite-level `BeforeAll`/`AfterAll` plus `BeforeStep`/`AfterStep`, and tag hooks take full tag expressions (`@db and not @wip`). Lettuce is unmaintained; use behave (or pytest-bdd). SpecFlow has reached end of life; Reqnroll is its open-source successor with the same `[BeforeScenario("tag")]` style hooks.

- Hooks set up infrastructure and reference data; they must not hide data that explains the business rule.
- Attach diagnostics (logs, screenshots, request/response) on failure in an `After` hook so the report gives meaningful feedback.

## Scenario-specific data: show what matters, seed what is shared

Pre-populated data makes a scenario read like a riddle: the reader cannot tell why the expected result is what it is.

- Seed reference data everyone already knows (countries, product categories, store locations, plan names).
- Put in the scenario any data that is central to the rule or likely to change, including items that must be excluded, so the example also shows the boundary.
- State the rule in a sentence under the scenario title.

```gherkin
Scenario: Only slots that start after the order cutoff are offered
  Delivery slots are offered only if they start at least 90 minutes after checkout.
  Given the Riverside store has delivery slots at 10:00, 11:00, 11:30 and 13:00
  When a customer checks out from Riverside at 09:45
  Then the offered slots should be 11:30 and 13:00
```

The example invites the next questions (what about exactly 90 minutes? no slots left today?), which become new scenarios. Use tables to inject several records, and a Scenario Outline when the same setup must be exercised with several inputs.

## Personas and known entities

A persona bundles a complete, realistic data set under a name the whole team knows, so steps stay short without becoming vague.

```gherkin
Given Marta is a lapsed subscriber
When Marta renews her subscription
Then Marta should get the returning-member discount
```

```ts
// {persona} is a custom parameter type (defineParameterType) resolving a name to a Persona
Given("{persona} is a lapsed subscriber", async function (persona: Persona) {
  this.customer = await this.fixtures.save(persona.with({ subscription: "lapsed" }));
});
```

- Define personas in one place (`test/personas.ts`), versioned with the code, documented for the team. Keep them fictional.
- Use the persona as a template and override only the field the scenario is about (`persona.with({ age: 67 })`). The override is the interesting part of the example; make it visible in the step.
- Known entities apply the same idea to non-people: a standard invoice file, a reference shipment, a typical policy. Name them; vary only what the rule needs.
- Do not let personas accumulate hidden facts that a scenario silently depends on. If the outcome depends on an attribute, mention it in the step.

## Separate the what from the how: three layers

Business rules change rarely and for business reasons; screens, field names and client libraries change often. Put each in its own layer so a technical change touches one place.

| Layer | Contains | Changes when | Written by |
|---|---|---|---|
| Business Rules | Feature files: scenarios stating outcomes in domain terms | The business changes its mind or understanding | Three amigos |
| Business Flow | Step definitions and step libraries describing the user's journey as domain actions | The workflow changes (a new consent step) | Developers and testers, readable by the product owner |
| Technical | Page objects, API clients, message builders, DB fixtures | Markup, endpoints, protocols change | Developers |

```ts
// Business Flow: step definition reads like the journey
When("{persona} renews her subscription", async function (p: Persona) {
  await this.subscriber.opensAccountPage();
  await this.subscriber.choosesToRenew();
  await this.subscriber.confirmsPaymentWith(p.defaultCard);
});

// Technical: only this class knows the markup
export class AccountPage {
  constructor(private page: Page) {}
  async chooseRenew() { await this.page.getByRole("button", { name: "Renew" }).click(); }
}
```

- Step definitions never touch selectors, HTTP details or SQL directly; they call the flow or technical layer.
- Assertions on outcomes go through technical services too (a mail-sink client, a ledger query), keeping steps declarative.
- You can write Business Rules and Business Flow before the UI exists; implement the Technical layer once the interface stabilizes.
- The number of layers is a judgment call: a calculation rule may need only scenario plus a thin step calling the domain service; a long UI journey may need sublayers (tasks composed of interactions).

Current note: Thucydides is now Serenity BDD. Its step libraries (`@Steps`) still exist, and the Screenplay pattern (actors with abilities performing tasks and asking questions) is a popular alternative that makes the flow layer composable; Screenplay implementations also exist for JavaScript (Serenity/JS).

## Workflow

1. Confirm the scenario is agreed and pending; read the feature file before writing any glue code.
2. Choose the reset strategy and environment (dedicated, disposable, production-like) and wire it with suite- and scenario-level hooks scoped by tags.
3. Move rule-relevant data into the scenario; keep only well-known reference data in seeds; introduce or reuse personas and known entities.
4. Write the Business Flow step definitions as domain actions; stub missing technical calls with descriptive method names.
5. Implement the Technical layer (page objects, API clients, fixtures) behind those names.
6. Run the scenario alone, then the full suite in random order and in parallel if supported; fix any order or timing dependence.
7. Add failure diagnostics, then make the scenario fail on purpose (break the rule) to confirm it reports clearly.
8. Hand off to dev/tdd for the production code; the scenario stays the outer loop.

## Red flags

- The suite is "mostly green" and nobody investigates the reds.
- A scenario passes only after another one has run, or fails when run alone.
- Shared test database used by people and pipelines at the same time.
- Expected results that cannot be explained from the scenario text (mystery seed data).
- Persona attributes the outcome depends on but the scenario never mentions.
- Selectors, URLs, SQL or JSON parsing inside step definitions.
- One markup change requires editing many step files.
- Global `Before` hooks doing expensive resets for scenarios that never touch the database.
- Sleeps or retries added to make a scenario pass instead of fixing state or synchronization.

## Related

- `../../DefiningRequirements/AutomatingScenarios/automatingScenarios.md` — step definitions, tools and outlines this chapter makes robust.
- `../../DefiningRequirements/ExecutableSpecifications/executableSpecifications.md` — writing the scenarios the Business Rules layer holds.
- `../UiAcceptanceCriteria/uiAcceptanceCriteria.md` — page objects and the UI Technical layer.
- `../NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — Technical layer against services and domain code.
- `../BddAndUnitTesting/bddAndUnitTesting.md` — the inner loop below these scenarios.
- `../../TakingBddFurther/BuildProcess/buildProcess.md` — running the suite reliably in CI.
- `../../../actions/bdd.md` — the workflow that owns feature files and glue code.
- `../../../actions/dev.md` — automating scenarios as the outer loop during implementation.
- `../../../actions/tdd.md` — the inner loop that drives production code.
- `../../../TDD/Patterns/XUnitPatterns/xUnitPatterns.md` — fixtures, setup and teardown discipline (when installed).
- `../../../CleanCode/UnitTests/unitTests.md` — clean, readable test code (when installed).
- `../../../DevOps/Practices/ContinuousIntegration/continuousIntegration.md` — keeping the build green (when installed).
