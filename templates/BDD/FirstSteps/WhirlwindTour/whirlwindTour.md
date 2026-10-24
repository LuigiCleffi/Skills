---
name: bdd-whirlwind-tour
description: "The end-to-end BDD lifecycle on a single feature, covering stating the business goal, describing features with the In order to / As a / I want and As a / I want / So that templates, splitting features into stories, refining concrete examples through conversation, turning them into Given/When/Then acceptance criteria, organizing feature files by capability, running scenarios as pending, writing step definitions starting from the Then step, discovering the API you wish you had, dropping to TDD unit specifications with mocked collaborators, table-driven unit examples, passing scenarios as progress and living documentation, the tester's role, and handling change requests and bugs through the specifications, based on Chapter 2 (BDD: the whirlwind tour) of BDD in Action. Use when starting BDD on a new feature or project, walking a team through the full cycle once, setting up a first feature file and step definitions, deciding how acceptance tests and unit tests relate (outer and inner loop), seeing undefined or pending steps, organizing the features folder, reporting progress from scenario results, or handling a change request or bug fix in a BDD codebase."
---

# BDD: the whirlwind tour

One feature, all the way through: goal, feature, story, examples, scenario, step definitions, unit specifications, code, living documentation, and later a change. Use this as the map; each stage has its own skill for depth. The rhythm to keep is outer loop (an acceptance scenario that fails) driving an inner loop (many small TDD cycles) until the scenario passes.

## 1. State the goal before the feature

- Write one sentence of business value, usually about revenue, cost, or service: "Raise repeat grocery orders by making delivery slots easier to get."
- Use it to rank feature ideas. "Show available delivery windows at checkout" clearly serves the goal; "let customers rate drivers" might, but needs an argument.

## 2. Describe features and split them into stories

Two card templates are common; the order matters less than stating the benefit explicitly.

```text
In order to <business value>        As a <stakeholder>
As a <stakeholder>                  I want <capability>
I want <capability>                 So that <benefit>
```

- Value-first ("In order to ...") keeps the goal from being an afterthought; it suits higher-level features. Role-first suits detailed stories inside a feature. Mixing them by level is fine.
- Split a feature that will not fit an iteration, or where you want early feedback on one part (for example, the UI) before building the rest:

```text
Feature: Book a home delivery slot
  Story: See the next available slots for my address
  Story: Reserve a slot during checkout
  Story: Get offered an alternative store when my store is full
```

- The story list is a conversation tool, not a contract. Expect to drop, merge and add stories as feedback arrives.

## 3. Refine examples through conversation

Ask the domain expert for concrete cases and then interrogate each one:

- **Missing context.** "Next slots from now" depends on more than the time: the store serving the address, the order cutoff before each slot. Add it to the `Given`.
- **Unrepresentative data.** One slot proves little; give enough rows that the rule (skip full slots, respect cutoff, show up to N) is visible.
- **Hidden expectations.** If customers need time to pack a basket, maybe they need several options, not just the first.

```gherkin
Feature: See the next available delivery slots
  In order to plan when I will be home
  As a customer
  I want to see the next slots I can still book

  Scenario: Full slots and slots past their cutoff are not offered
    Given the Centro store serves postcode 01310
    And Centro has these delivery slots today:
      | slot        | cutoff | remaining |
      | 14:00-15:00 | 12:00  | 3         |
      | 15:00-16:00 | 13:00  | 0         |
      | 16:00-17:00 | 14:00  | 5         |
      | 17:00-18:00 | 15:00  | 2         |
      | 18:00-19:00 | 16:00  | 4         |
    When a customer at postcode 01310 asks for slots at 12:30
    Then they should be offered 16:00-17:00, 17:00-18:00 and 18:00-19:00
```

## 4. Organize and run the specification before any code exists

- Group feature files by business capability, not by technical layer: `features/delivery/`, `features/checkout/`, `features/notifications/`. These folders become the chapters of the living documentation.
- Run the suite immediately. Unbound steps are reported as undefined or pending, which is the correct starting state: the requirement is recorded and visibly not done.

```ts
// features/step_definitions/delivery.steps.ts (@cucumber/cucumber)
import { Given, When, Then } from "@cucumber/cucumber";

Given("the {word} store serves postcode {word}", function (store: string, postcode: string) {
  return "pending";
});
```

Current note: the book's reporting tool, Thucydides, is now Serenity BDD; JBehave `.story` files have largely given way to Cucumber `.feature` files. Cucumber's own HTML/JSON/message formatters, Allure and Serenity BDD all distinguish passed, failed, pending, undefined and skipped.

## 5. Write step definitions from the outcome backwards

- Start with the `Then`: decide what you need to observe, then write the call you wish existed to get it. Designing the API from the caller's side gives a small, readable interface.
- Keep steps thin: translate text to domain calls, hold scenario state in the World, assert on outcomes. No business logic in glue code.

```ts
import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

Given("{word} has these delivery slots today:", function (store: string, table) {
  this.calendar.load(store, table.hashes());
});

When("a customer at postcode {word} asks for slots at {word}", async function (postcode: string, time: string) {
  this.offered = await this.app.slotFinder.nextAvailable(postcode, this.clock.today(time));
});

Then("they should be offered {slotList}", function (expected: string[]) {
  assert.deepEqual(this.offered.map((s) => s.label), expected);
});
```

`{slotList}` is a custom parameter type that turns "a, b and c" into an array; define it once with `defineParameterType`.

## 6. Drop to the inner loop

The acceptance scenario uses (nearly) the full stack; it is too coarse to design classes with. Switch to unit specifications for each component the step definitions need:

- `SlotFinder.nextAvailable` needs to know which store serves a postcode and which slots that store has. Those are separate concerns: introduce collaborators and mock them, so the unit specification covers only the selection rule.
- Each mock you write is a precise requirement for a component you have not built yet. Turn it into an interface now, implement it later with its own specifications.

```ts
// slotFinder.spec.ts (Vitest)
it("should offer only slots that are open, not full, and limited to three", async () => {
  const stores = { storeFor: vi.fn().mockResolvedValue("centro") };
  const slots = { slotsFor: vi.fn().mockResolvedValue([
    slot("14:00", "12:00", 3), slot("15:00", "13:00", 0), slot("16:00", "14:00", 5),
    slot("17:00", "15:00", 2), slot("18:00", "16:00", 4), slot("19:00", "17:00", 1),
  ]) };
  const finder = new SlotFinder(stores, slots);

  const offered = await finder.nextAvailable("01310", at("12:30"));

  expect(offered.map((s) => s.start)).toEqual(["16:00", "17:00", "18:00"]);
});
```

- Unit specifications should be more thorough than the scenario: use table-driven cases (`it.each`, JUnit `@ParameterizedTest`, pytest `parametrize`, Spock `where:`) to cover boundaries the business never needs to read.
- Repeat for each discovered collaborator until nothing is mocked out that the scenario needs for real. Then the scenario passes, and the feature is done.

Current note: Spock 2 is still the expressive choice on the JVM; in JavaScript/TypeScript, Jest or Vitest with `describe`/`it` gives the same behavior-named style.

## 7. Use results as progress and documentation

- Passed versus pending/undefined scenarios per capability is an objective progress measure: a scenario is either green or not.
- Good living documentation also lists features that are specified but have no automated scenarios yet, so the picture of scope is complete.
- Each passing scenario is a worked example of how the system meets a requirement; for UI scenarios, attach screenshots.
- Testers use green scenarios to skip routine regression checks and spend their time on exploratory testing. Do not claim continuous deployment readiness unless the suite truly covers what QA would otherwise verify.

## 8. Change through the specifications

| Change type | First move | Then |
|---|---|---|
| Existing behavior should change | Edit the scenario to the new expectation; watch it fail | Update the affected unit specifications, change code until both pass |
| Bug the scenarios missed | Add a scenario (or unit specification) that reproduces it; watch it fail | Fix; the new specification proves the fix and guards it |
| Behavior removed or replaced | Delete or rewrite the obsolete scenarios with the business | Remove dead code under green |

A red scenario after the edit is the desired starting point, not a problem.

## Workflow

1. Write the business goal; rank candidate features against it.
2. Describe the chosen feature with a value-first card; split into stories that fit an iteration.
3. Collect examples from the domain expert; add missing context and representative data.
4. Write the scenario in a capability folder; run it and confirm it is pending/undefined.
5. Bind steps starting from `Then`, designing the API you wish you had.
6. For each component the steps call, run the TDD inner loop with mocked collaborators and table-driven cases.
7. Implement the collaborators the same way until the scenario passes without mocks in the acceptance path.
8. Publish results; report progress as green versus pending per capability.
9. For later changes, edit or add the specification first, see red, then change code.

## Red flags

- Writing code first and the scenario afterwards as a formality.
- Step definitions full of business logic, SQL or long UI scripts.
- Acceptance scenarios used to test every boundary instead of unit specifications.
- A scenario that passes the first time it runs against unbuilt code.
- Mocks left in the acceptance path, so the "passing" scenario never touches real components.
- Feature folders mirroring technical layers (`controllers/`, `services/`) rather than capabilities.
- Progress reported as percentage of tasks while scenarios stay pending.
- Change requests implemented in code with scenarios updated later, or never.

## Related

- `../SoftwareThatMakesADifference/softwareThatMakesADifference.md` — why each stage exists.
- `../../DefiningRequirements/FeatureInjection/featureInjection.md` — goals and value-first feature discovery.
- `../../DefiningRequirements/DefiningFeatures/definingFeatures.md` — stories, examples and conversations in depth.
- `../../DefiningRequirements/ExecutableSpecifications/executableSpecifications.md` — Gherkin style, tables, outlines.
- `../../DefiningRequirements/AutomatingScenarios/automatingScenarios.md` — step definitions and tool setup.
- `../../CodingTheBddWay/BddAndUnitTesting/bddAndUnitTesting.md` — the inner loop and mocking discovered collaborators.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — progress and documentation from results.
- `../../../actions/bdd.md` — owns feature files and step definitions in this workflow.
- `../../../actions/tdd.md` — the inner-loop unit specifications.
- `../../../actions/dev.md` — production code that makes scenarios pass.
- `../../../actions/uiux.md` — UI decisions when the feature has a user-facing surface.
- `../../../TDD/Patterns/TestingPatterns/testingPatterns.md` — Mock Object and Child Test (when installed).
- `../../../TDD/Patterns/RedBarPatterns/redBarPatterns.md` — Regression Test for bug fixes (when installed).
