## AI Skills

Before discovering examples for a feature, writing or reviewing Gherkin
scenarios, automating acceptance criteria, connecting scenarios to unit
tests, or publishing living documentation, find the skills that apply to the
step you are on in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of John Ferguson Smart's *BDD in Action:
Behavior-Driven Development for the Whole Software Lifecycle* (Manning,
2015). When `actions/bdd.md` is installed, it owns the workflow: it turns
the approved specification into confirmed examples and failing scenarios,
and hands `dev` the outer loop that `actions/tdd.md` fills from the inside.
These skills define how each step is done. Tooling has moved on since the
book (Thucydides is Serenity BDD, SpecFlow gave way to Reqnroll, Playwright
and Cypress sit beside Selenium); the skills carry a short "Current note"
where that matters.

### First Steps (Part 1)

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./FirstSteps/SoftwareThatMakesADifference/softwareThatMakesADifference.md` | Deciding whether BDD fits, explaining it to stakeholders, writing a first feature file, or judging whether a broken scenario is a changed requirement or a regression. |
| 2 | `./FirstSteps/WhirlwindTour/whirlwindTour.md` | Running one feature through the full cycle: examples, a pending scenario, step definitions, the TDD inner loop, living documentation, change requests. |

### Defining Requirements (Part 2)

| Ch | Skill | Use when |
|---|---|---|
| 3 | `./DefiningRequirements/FeatureInjection/featureInjection.md` | Kicking off a project or epic, a request arrives as a solution, the backlog is unranked, or you need a vision, goals, an impact map, or an effort level. |
| 4 | `./DefiningRequirements/DefiningFeatures/definingFeatures.md` | Splitting capabilities into features and stories, running Three Amigos or Example Mapping, challenging rules with examples, Real Options, Deliberate Discovery. |
| 5 | `./DefiningRequirements/ExecutableSpecifications/executableSpecifications.md` | Writing or reviewing `.feature` files: declarative Given/When/Then, outlines vs data tables, Background, independent scenarios, feature folders, tags. |
| 6 | `./DefiningRequirements/AutomatingScenarios/automatingScenarios.md` | Writing step definitions and glue: thin steps over an automation layer, parameters, per-scenario state, tables, undefined or pending outcomes, runner setup. |

### Coding the BDD Way (Part 3)

| Ch | Skill | Use when |
|---|---|---|
| 7 | `./CodingTheBddWay/AcceptanceTests/acceptanceTests.md` | Automating scenarios robustly: hooks, test-data reset, personas, flaky or order-dependent tests, layering steps so UI changes don't break suites. |
| 8 | `./CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` | Driving a browser in scenarios: UI vs API level, locators, waits instead of sleeps, page objects, slow or brittle Selenium or Playwright suites. |
| 9 | `./CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` | Automating business rules below the UI: controller, domain, batch or REST API steps, JSON checks, performance and other non-functional scenarios. |
| 10 | `./CodingTheBddWay/BddAndUnitTesting/bddAndUnitTesting.md` | Going from a failing scenario to code outside-in: thin step definitions, unit specs, mocks for new collaborators, behavior-named tests. |

### Taking BDD Further (Part 4)

| Ch | Skill | Use when |
|---|---|---|
| 11 | `./TakingBddFurther/LivingDocumentation/livingDocumentation.md` | Setting up BDD reports: feature readiness and coverage, linking issue tags to the backlog, organizing reports, documenting legacy systems. |
| 12 | `./TakingBddFurther/BuildProcess/buildProcess.md` | Putting scenarios in CI/CD: independent scenarios, an acceptance gate, publishing living documentation, parallelizing and sharding slow suites. |

# Context for AI: Behavior-Driven Development

## 1. Conversations First, Tools Second

BDD is a way to reach a shared understanding of what to build through
concrete examples. Gherkin and Cucumber record and automate that
understanding; they do not replace the conversation. A scenario nobody
outside engineering has read is just an end-to-end test.

## 2. Examples Pin Down Rules

For every rule, find the few contrasting examples that make it
unambiguous, including the boundary and the failure that matters. When an
example raises a question the specification does not answer, it is a
product question: send it back instead of guessing the outcome.

## 3. Say What, Not How

Write scenarios declaratively in the domain's language: the situation, the
action the user takes, and the outcome that must hold. Keep clicks,
selectors, and URLs in the automation layer, so a redesign changes step
code, not the specification.

## 4. Outside-In, Two Loops

A failing scenario is the outer loop and defines done for a slice. Unit
tests written test-first are the inner loop that builds the pieces. Keep
exhaustive combinations in unit tests and only key examples in scenarios.

## 5. Executable and Living

Scenarios run in CI on every change, are traced to requirement IDs, and
produce reports the whole team can read. A scenario that is skipped,
flaky, or out of date is a defect in the documentation, not noise to
ignore.

## 6. How the AI Should Apply It

- Do not claim BDD unless the scenarios were confirmed by the user and
  observed failing for the right reason before the production change.
- Never edit feature files or step definitions to make a scenario pass
  without agreement; never weaken an expected outcome.
- Never invent rules or expected values to complete an example.
- Report honestly: which scenarios pass, fail, or are pending, with the
  command that was run.
