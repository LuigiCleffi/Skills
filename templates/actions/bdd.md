---
name: bdd
description: "Turn approved requirements into concrete examples and executable scenarios before implementation: discover the rules and examples behind each user story, formulate them as declarative Gherkin in the domain's language, automate them as failing acceptance tests, and hand dev the outer loop that tdd fills from the inside. Owns feature files, step definitions, and acceptance-test glue; never production code. Use after spec-checklist and before uiux and dev whenever a change has business behavior worth agreeing on with examples."
---

# bdd — Examples and Executable Specifications

## Purpose and ownership

Make the agreed behavior concrete before code exists. Turn each approved requirement into a small set of key examples, write them as scenarios that business and engineering read the same way, and automate them so they fail until the behavior is built.

**This skill owns feature files, step definitions, and acceptance-test glue (drivers, page objects or tasks, test data builders). It must not create, modify, or delete production code.** `dev` owns production implementation; `tdd` owns unit-level tests.

## Position in the workflow

```text
plan → spec-definition → spec-checklist → ddd → bdd → uiux → dev
                                                             ├─ outer loop: bdd scenario (red → green)
                                                             └─ inner loop: tdd ⇄ dev, until the scenario passes
                                                           → review → other skills
```

Run `bdd` when the scoped work has business behavior with rules worth illustrating: calculations, eligibility, workflows, permissions, state changes, integrations with observable outcomes.

Skip it for chores, refactors with identical behavior, dependency bumps, and purely visual changes (those go to `uiux` or straight to `dev`). In that case `dev` records "BDD: not applicable" and proceeds.

## Skill boundaries

- `plan`, `spec-definition`, `spec-checklist`: decide **what** the product must do and **why**. `bdd` treats their decisions as fixed.
- `bdd`: makes that behavior concrete with examples and executable scenarios, and owns their automation.
- `uiux`: decides how the behavior looks and responds. It references `bdd` scenario IDs and adds only UI-specific checks (states, focus, accessibility) instead of restating business rules.
- `tdd`: writes unit-level tests for the pieces a failing scenario needs.
- `dev`: implements production code until the scenarios and unit tests pass.
- `review`: checks scenarios for intent, traceability, and test quality alongside the code.

Do not copy another skill's full workflow into this skill. Invoke it and use its output.

## Inputs and source of truth

- The approved specification (`SpecifyRequirements.md`): user stories, acceptance scenarios, functional requirement IDs, edge cases.
- The `spec-checklist` result. Only items marked **Ready** may become scenarios.
- Existing feature files, step definitions, glue code, the scenario runner command, and its reports.
- The project's domain vocabulary: the `ddd` glossary and `DomainModel.md` when they exist, otherwise entity names and the words users and the spec use. Write scenarios in those exact terms; when a scenario needs a term or rule the glossary lacks, send it back to `ddd` rather than coining one.

Never invent a rule to complete an example. A question that changes the expected outcome is a product question: send it back to `spec-definition` and leave that example out until it is answered.

## Reference library

When `BDD/README.md` is installed, it routes to one skill per chapter of *BDD in Action*. Read only the skills that match the step you are on:

| Step | Skills |
|---|---|
| Why BDD, and the whole cycle at a glance | `BDD/FirstSteps/SoftwareThatMakesADifference/softwareThatMakesADifference.md`, `BDD/FirstSteps/WhirlwindTour/whirlwindTour.md` |
| From business goals to features | `BDD/DefiningRequirements/FeatureInjection/featureInjection.md` |
| Discovering rules and examples | `BDD/DefiningRequirements/DefiningFeatures/definingFeatures.md` |
| Writing Gherkin scenarios | `BDD/DefiningRequirements/ExecutableSpecifications/executableSpecifications.md` |
| Wiring step definitions | `BDD/DefiningRequirements/AutomatingScenarios/automatingScenarios.md` |
| Keeping acceptance tests robust and layered | `BDD/CodingTheBddWay/AcceptanceTests/acceptanceTests.md` |
| Automating through the UI | `BDD/CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` |
| Automating through APIs, services, and domain code | `BDD/CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` |
| Handing off to the unit-level inner loop | `BDD/CodingTheBddWay/BddAndUnitTesting/bddAndUnitTesting.md` |
| Reports and living documentation | `BDD/TakingBddFurther/LivingDocumentation/livingDocumentation.md` |
| Running scenarios in CI and the delivery pipeline | `BDD/TakingBddFurther/BuildProcess/buildProcess.md` |

When the project is JavaScript or TypeScript and `JavaScript/README.md` is installed, write step definitions and test helpers following its language skills, and use its browser, async, HTTP, and Node.js skills when automating through the UI or APIs.

When a scenario's outcome depends on a large language model and `LLM/README.md` is installed, keep scenarios on observable, checkable outcomes (structure, cited sources, refusals, tool calls made) and move quality judgments to the evaluation sets its skills describe.

## Workflow

### 1. Confirm readiness and scope

List the requirement and user-story IDs in scope and confirm the checklist marks them **Ready**. Blocked items do not get scenarios; independent, ready items may proceed.

### 2. Inspect the existing BDD setup

Find the feature folder, step definitions, glue layers, tags in use, the runner command, and how reports are produced. Reuse existing steps and domain phrases before writing new ones.

If the project has no BDD tooling, propose the lightest option that fits the stack (for example `@cucumber/cucumber` or `playwright-bdd` for TypeScript, Cucumber-JVM or Serenity BDD for Java, `behave` or `pytest-bdd` for Python, Reqnroll for .NET) and ask before adding the dependency.

### 3. Discover rules and examples

For each user story, map:

- **Rules**: the business rules and acceptance criteria that govern it.
- **Examples**: one or two concrete, contrasting examples per rule, with real-looking values, including the boundary and the failure that matters.
- **Questions**: anything the spec does not answer. Return product questions to `spec-definition`.

Prefer the few key examples that pin a rule down over exhaustive combinations. Combinations and edge arithmetic belong in unit tests through `tdd`.

### 4. Formulate scenarios

Write declarative scenarios in the domain's language: what the user wants and what must be true afterward, not which buttons are clicked.

```gherkin
Feature: Course enrollment
  Students enroll in courses that still have seats, within the enrollment window.

  Rule: A course cannot be enrolled in beyond its capacity

    @REQ-FR-03 @slice-1
    Scenario: Last seat goes to the first student who confirms
      Given "Intro to Statistics" has 30 seats and 29 enrolled students
      When Ana confirms her enrollment in "Intro to Statistics"
      Then Ana is enrolled
      And "Intro to Statistics" shows no seats left

    @REQ-FR-03
    Scenario: A full course offers the waiting list instead
      Given "Intro to Statistics" has 30 seats and 30 enrolled students
      When Bruno tries to enroll in "Intro to Statistics"
      Then Bruno is offered a place on the waiting list
      And Bruno is not enrolled
```

- One behavior per scenario, with a title that states the outcome.
- Group scenarios under `Rule:`; use `Scenario Outline` with `Examples` only for genuine data variations of the same rule.
- Keep `Background` short and shared by every scenario in the file.
- Tag each scenario with its requirement ID and slice, and `@wip` while it is being built.

### 5. Confirm the scenarios

Scenarios that encode product decisions are an agreement, not a test detail. Show them to the user (or the product owner) and get confirmation before automating. Record changes back in the spec when the conversation changes a rule.

### 6. Automate the outer loop

- Keep step definitions thin: each step calls domain-level tasks, which call drivers (API client, domain service, or UI page objects or Screenplay tasks).
- Automate below the UI whenever the behavior is not about the UI; reserve browser automation for scenarios whose value is the interface itself.
- Run the narrowest scenario command and confirm each new scenario **fails for the right reason**: a missing endpoint, a wrong result, or an absent screen. An undefined step, a syntax error, or a broken environment is not a valid RED.
- Never force a scenario to fail artificially, and never weaken one to make it pass.

### 7. Hand off to dev

Leave production files unchanged. Use a compact handoff:

- **Scope:** requirement and story IDs covered.
- **Scenarios:** feature file paths and scenario titles, in slice order.
- **Command/result:** the actual command and observed result (expected RED, already passing, or unable to run).
- **Not automated yet:** scenarios held back by open questions.
- **Notes for uiux:** scenario IDs whose outcome has a user-facing surface.

`dev` then makes one scenario pass at a time, using `tdd` for the units that scenario needs, and re-runs the scenario as the definition of done for that slice.

## Guardrails

- Never edit production code, even to make a step compile or a scenario pass.
- Never delete or weaken a meaningful scenario to accommodate current behavior.
- Never invent product rules or expected outcomes.
- Do not write imperative, click-by-click scenarios for business rules.
- Do not automate scenarios whose expected outcome is still an open question.
- Do not claim RED, GREEN, or verification without observing the result.
- Preserve unrelated user changes; report pre-existing failures and environment limits.

## Completion criteria

BDD preparation is complete when every ready requirement in scope has confirmed key examples, the scenarios are written in domain language and traced to requirement IDs, each new scenario has been observed failing for the right reason (or reported as already passing), production files are unchanged, and `dev` has a concise handoff.
