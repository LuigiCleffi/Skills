---
name: bdd-software-that-makes-a-difference
description: "What Behavior-Driven Development is for and how its parts fit together, covering the two failure modes (building the thing wrong vs building the wrong thing), the knowledge constraint and managing uncertainty, BDD's origins in TDD and its relation to Specification by Example and ATDD, the core principles (features tied to business value, collaborative specification, concrete examples, executable specifications, low-level specifications, living documentation), a Gherkin primer (Feature, Scenario, Given/When/Then/And/But, Scenario Outline, Examples, data tables), and the benefits, costs and preconditions of adopting BDD, based on Chapter 1 (Building software that makes a difference) of BDD in Action. Use when deciding whether BDD fits a team or project, explaining BDD to stakeholders, framing a feature as goal, examples and executable specification, reading or writing a first .feature file, renaming unit tests as behavior (should...), deciding what to do when an existing scenario breaks after a change, or when the user mentions BDD, Gherkin, Cucumber, acceptance criteria, Specification by Example, ATDD, executable specifications, living documentation or outside-in development."
---

# Building software that makes a difference

BDD exists to fix two different failures at once: shipping the wrong features, and shipping the right features badly. Treat every piece of work as a chain, business goal to feature to concrete examples to executable specifications to code, and refuse to add a link that does not trace back to the one above it.

## Two ways a project fails

| Axis | Symptom | BDD lever |
|---|---|---|
| Building the right thing (what) | Features nobody uses, requests implemented literally, scope creep, "it does what we asked but not what we need" | Goals first, features justified by goals, examples agreed with the business |
| Building the thing right (how) | Regressions, slow change, outdated docs, long manual test phases | Executable specifications, outside-in TDD, living documentation |

- Diagnose which axis hurts before proposing practices. A team with solid TDD and CI but low feature adoption needs discovery work, not more unit tests; a team that ships the right features but breaks them every release needs automation and design discipline.
- Quality practices alone do not save a project whose features are misaligned; alignment alone does not save a codebase nobody can change safely. Plan for both.

## The knowledge constraint

- The scarce resource on most projects is not time or budget but knowledge of what to build and how. That knowledge grows unevenly as the project runs.
- Do not try to remove uncertainty by locking a full specification up front. Plan to reduce it: deliver the slices that teach you the most (highest value, highest risk, biggest unknowns) and adjust.
- Users know their goals well and are poor judges of the best solution. Capture goals and examples from them; propose solutions with the team.
- When reality contradicts the plan, update the plan and the specifications, not reality.

## What BDD is, and is not

- BDD is a set of practices layered on whatever process the team uses (Scrum, Kanban, XP, an internal process). It is not a methodology replacement.
- It began as a way to teach TDD better: name tests as sentences describing behavior ("should ...") instead of after methods, so intent survives refactoring and the next test is easier to see. It then moved up into requirements analysis by giving analysts a structured, example-based language that tools can execute.
- Specification by Example, Acceptance Test-Driven Development (ATDD) and BDD overlap heavily. Use whichever term the team already knows; the shared core is conversation around concrete examples that become automated acceptance criteria.

```ts
// Method-named tests say nothing about intent
it("testApply", () => { /* ... */ });

// Behavior-named specifications survive refactoring and suggest missing cases
describe("when applying a loyalty voucher", () => {
  it("should reduce the order total by the voucher value", () => { /* ... */ });
  it("should refuse a voucher that has expired", () => { /* ... */ });
  it("should never make the order total negative", () => { /* ... */ });
});
```

## Principles to apply

1. **Features earn their place.** A feature is a deliverable slice of functionality that helps reach a named business goal. Ask which goal a request serves before accepting it into the backlog.
2. **Specify together.** Business, development and testing perspectives shape a feature before it is built (often called a "three amigos" conversation). Requirements written alone by users tend to be solution designs; ask for the need behind them.
3. **Embrace uncertainty.** Expect understanding to change; get feedback by showing working slices early.
4. **Illustrate with concrete examples.** Natural-language requirements hide assumptions; examples expose them. Testers are especially good at asking for the edge case that breaks a rule.
5. **Write executable specifications, not just automated tests.** An executable specification uses the agreed examples and vocabulary, runs in the build, decides when a feature is done, and keeps guarding it afterwards as a regression check.
6. **Write low-level specifications, not just unit tests.** Work outside-in: the acceptance scenario defines the outcome, and each class or function needed to reach it is designed through behavior-named unit specifications.
7. **Deliver living documentation.** Reports generated from the specifications describe what the system does, in business terms, and are always current because they run.
8. **Use it for maintenance.** Specifications tell a maintainer where behavior lives and what a change might break.

## A Gherkin primer

```gherkin
Feature: Reserving a meeting room
  In order to avoid double-booked meetings
  As an office member
  I want to reserve a room for a time slot

  Scenario: Reserving a free room
    Given room "Atlas" is free between 10:00 and 11:00 today
    When Dana reserves "Atlas" from 10:00 to 11:00
    Then the reservation should be confirmed
    And "Atlas" should show as busy between 10:00 and 11:00

  Scenario: Reserving a room that is already taken
    Given room "Atlas" is reserved by Leo from 10:00 to 11:00 today
    When Dana tries to reserve "Atlas" from 10:30 to 11:30
    Then the reservation should be refused because the slot overlaps
    But Leo's reservation should remain unchanged
```

- `Given` sets the context, `When` performs the one action under test, `Then` checks the outcome; `And`/`But` continue the previous step type.
- A `Scenario Outline` with an `Examples` table runs once per row; use it when the rule is the same and only data varies.
- A data table inside a step shows structured input or output compactly.

```gherkin
  Scenario Outline: Room capacity limits
    Given room "<room>" seats <capacity> people
    When a meeting for <attendees> people is booked in "<room>"
    Then the booking should be <result>

    Examples:
      | room  | capacity | attendees | result   |
      | Atlas | 6        | 6         | accepted |
      | Atlas | 6        | 7         | refused  |
      | Orion | 12       | 10        | accepted |
```

Current note: Gherkin 6+ adds the `Rule:` keyword to group scenarios under the business rule they illustrate, and `Example:` as a synonym for `Scenario:`. Cucumber (cucumber-js, Cucumber-JVM 7, behave for Python, Reqnroll/SpecFlow for .NET) is now the dominant toolchain; JBehave is much less used. Step text is bound with Cucumber Expressions (`{int}`, `{string}`) as well as regular expressions.

## When an existing specification breaks

A red scenario after a change has exactly two readings; decide which before touching code:

- **The requirement changed.** The scenario no longer describes the wanted behavior: update it with the business (or delete it if the behavior is gone).
- **The change broke a requirement.** The scenario is still right: it is a regression, fix the code.

Never "fix" a failing scenario by editing its expected outcome without confirming the requirement changed.

## Is BDD a fit here?

Check these preconditions before recommending the full practice:

- Can someone with business authority join short conversations about examples during the iteration? Without engagement, BDD degrades to Gherkin-flavored test scripts.
- Is delivery iterative? BDD assumes requirements evolve; a fixed, signed-off spec handed to a remote team limits it to the coding level.
- Do testers take part before coding starts, not only at the end?
- Does the team have, or will it build, the skill to write maintainable acceptance automation? Badly layered UI scripts become a maintenance tax.

If only the coding level is reachable, still use behavior-named specifications and outside-in TDD; say clearly that the discovery benefits are being left on the table.

## Workflow

1. Identify which failure axis is the problem (what, how, or both) and say so.
2. For each requested feature, name the business goal it serves; challenge features that serve none.
3. Hold (or simulate, with the user as business voice) a specification conversation and collect concrete examples, including edge cases.
4. Formulate the key examples as Gherkin scenarios in the domain's vocabulary.
5. Automate them as executable specifications in the build; they start pending or failing.
6. Implement outside-in, designing each unit through behavior-named specifications (`tdd` inner loop).
7. Publish the specification results as living documentation and use them for progress and release decisions.
8. On every later change, update or add scenarios first and classify any failure as changed requirement or regression.

## Red flags

- Features accepted into the backlog with no stated business goal.
- Requirements arriving as screen designs or field lists with no "why".
- Gherkin written by one person after the code is done, used only as test scripts.
- Scenarios phrased in UI mechanics (clicks, field ids) instead of business behavior.
- Unit tests named after methods (`testApply`, `testSave`) with no behavior described.
- Expected outcomes edited to make a red scenario green without asking whether the requirement changed.
- Specifications frozen up front and change treated as failure.
- BDD sold as a replacement for the team's process, or adopted with no business participation at all.

## Related

- `../WhirlwindTour/whirlwindTour.md` — the same lifecycle walked end to end on one feature.
- `../../DefiningRequirements/FeatureInjection/featureInjection.md` — finding goals and the features that serve them.
- `../../DefiningRequirements/DefiningFeatures/definingFeatures.md` — features, stories and examples in detail.
- `../../DefiningRequirements/ExecutableSpecifications/executableSpecifications.md` — writing good Gherkin.
- `../../CodingTheBddWay/BddAndUnitTesting/bddAndUnitTesting.md` — low-level, behavior-named specifications.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — reports and progress from specifications.
- `../../../actions/bdd.md` — the workflow skill that applies these practices.
- `../../../actions/tdd.md` — the inner loop that implements each scenario.
- `../../../actions/dev.md` — orchestrates bdd, tdd and production code.
- `../../../ProductDefinition/plan.md` — product goals that BDD features must trace to (when installed).
- `../../../TDD/Patterns/TDDPatterns/tddPatterns.md` — the TDD cycle BDD grew out of (when installed).
- `../../../CleanCode/UnitTests/unitTests.md` — clean, readable low-level specifications (when installed).
