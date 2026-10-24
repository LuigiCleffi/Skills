---
name: bdd-executable-specifications
description: "Covers turning agreed examples into executable Gherkin scenarios, feature file anatomy (Feature title as a user activity, narrative description, scenario titles and descriptions), the roles of Given, When and Then, And/But and one idea per step, comments, data tables inside steps, Scenario Outline with Examples tables and notes columns, declarative vs imperative scenarios, expressive Given/When/Then steps, Background, scenario independence, organizing feature files by capability, and tags for issue links, cross-cutting concerns, filtering and hooks, with JBehave equivalents (Narrative, Meta, GivenStories), based on Chapter 5 (From examples to executable specifications) of BDD in Action. Use when writing or reviewing a .feature file, converting examples or acceptance criteria into scenarios, scenarios read like click-by-click test scripts, steps are duplicated across scenarios, a scenario has several When/Then pairs, choosing between a data table and a Scenario Outline, naming scenarios, deciding what goes in Background, scenarios depend on each other or on run order, structuring the features folder, or choosing tags such as @wip, @slow, @web or issue keys."
---

# From Examples to Executable Specifications

A scenario is one agreed example written so that stakeholders can read it and a tool can run it: a context, one action, and the observable outcome, all in business language. Write scenarios declaratively (what the system must achieve, not how a user clicks through it), keep each one independent, and remove every word that does not help explain the business rule.

## From vague statement to scenario

"Visitors pay for parking by the hour" leaves the important questions open: is there a free period, is there a daily cap, do members pay less, how are partial hours rounded? Left open, developers answer them by guessing. Ask for examples in the stakeholders' own vocabulary, note the rules they reveal, and formulate the key ones:

```gherkin
Scenario: Short stay within the free period
  Given the first 30 minutes of parking are free
  And I am a visitor without a membership
  When I leave the garage after 25 minutes
  Then I should pay nothing
```

Gherkin keywords are localized (more than 70 spoken languages, selected with a `# language: pt` header), so scenarios can stay in the stakeholders' own language.

## Feature file anatomy

```gherkin
@capability:parking-payments
Feature: Paying for a parking stay
  In order to turn spaces over quickly during business hours
  As the garage operator
  I want visitors to pay according to how long they stayed

  Rule: Stays are billed per started hour after a free period

    Scenario: Short stay within the free period
      ...
    Scenario: Being charged for a partly used hour
      ...
```

- Title: name a user activity with a clear scope ("Paying for a parking stay"), not a vague area ("Parking management").
- Description: free text between the title and the first scenario. Use it for the business goal (often the "In order to / As a / I want" narrative from `../DefiningFeatures/definingFeatures.md`). It appears in reports; comments do not.
- Scenario title: a short phrase stating what makes this example different from its siblings, like a subtitle. Summarize the context and action; leave the expected outcome out of the title, because outcomes change more often than situations.
- Scenario description: text right under the scenario title can explain a calculation or rule; it also shows up in living documentation.

Current note: Gherkin 6+ adds `Rule:` to group scenarios under the business rule they illustrate (it maps directly to rule cards from Example Mapping), and `Example:` as a synonym of `Scenario:`. JBehave uses `.story` files with a `Narrative:` block and is far less common today than Cucumber-family tools; Thucydides, used for reporting in the book, is now Serenity BDD.

## Given, When, Then

| Step | Purpose | Check |
|---|---|---|
| Given | Puts the system into the state the example needs; may be purely informative | Exactly the preconditions this example depends on: missing ones become hidden assumptions, extra ones blur the point |
| When | The single action or event under test (user action, incoming message, batch run) | One business action, phrased as intent |
| Then | The observable outcome compared with expectations | Ties back to the value of the feature; no internal state that the business cannot see |

- `And` and `But` continue the previous keyword; they exist only for readability.
- One idea per step. "Given I am a member and it is a weekend" becomes two steps: easier to read, easier to change when one rule changes, and both steps become reusable.
- Phrase Givens in the past or present perfect ("Given Ana has registered a vehicle") so they read as things that already happened.

## Declarative, not imperative

Imperative (a test script, coupled to the UI, interleaving When and Then):

```gherkin
Scenario: Update payment card
  Given I am logged in
  Then I should see the dashboard
  When I click "Billing"
  And I type "4111 1111 1111 1111" into "Card number"
  And I click "Save"
  Then I should see "Card updated"
```

Declarative (one action, business words, no UI, no irrelevant data):

```gherkin
Scenario: Replacing an expired payment card
  Given my saved card has expired
  When I replace it with a valid card
  Then my next monthly charge should use the new card
```

- Hide how the context is created. "Given an admin account exists in the database" leaks setup; "Given I am signed in as an administrator" states intent and lets the automation choose the fastest route (API, fixture, UI).
- Hide navigation. If authentication is specified elsewhere, assume the user signs in; do not repeat it.
- Drop data the business does not care about. If the values typed into a registration form do not influence the outcome, do not list them; if some do, put only those in a small table.
- Reuse data from the Given in the Then ("Then I should see all of my vehicles") instead of repeating a table.
- A scenario with several When/Then pairs is several scenarios, or a flow that should be stated at a higher level.

## Data tables in a step

Use a table when a step needs structured data; it removes repetition and makes columns comparable.

```gherkin
Scenario: Transferring prepaid hours to a colleague
  Given the following prepaid balances:
    | holder | hours |
    | Ana    | 20    |
    | Bruno  | 4     |
  When Ana transfers 6 hours to Bruno
  Then the prepaid balances should be:
    | holder | hours |
    | Ana    | 14    |
    | Bruno  | 10    |
```

Headers are optional; a single-column table works as a list (`Then I can choose from: | Monthly | Annual |`).

## Scenario Outline and Examples

When several scenarios differ only in data, one outline plus an examples table is shorter, easier to scan for gaps, and better documentation. Readers skim the third near-identical scenario and miss the detail that matters.

```gherkin
Scenario Outline: Fee depends on stay length and membership
  Given I am a <customer>
  When I leave after <minutes> minutes
  Then I should pay <fee>

  Examples: Visitors
    | customer | minutes | fee   | notes                   |
    | visitor  | 30      | 0.00  | free period boundary    |
    | visitor  | 31      | 4.00  | first started hour      |
    | visitor  | 600     | 25.00 | daily cap applies       |

  Examples: Members
    | customer | minutes | fee   | notes                   |
    | member   | 31      | 3.00  | 25% member discount     |
```

- Each row runs as its own scenario; `<name>` placeholders are replaced from the matching column.
- A notes column nobody references in the steps is a cheap way to say why a row exists.
- Tables make boundaries visible: when you lay rows side by side, missing cases (a member at the cap?) stand out; take them back to the stakeholder.
- Several `Examples:` blocks, each with a name and optionally its own tags, separate groups of rows.
- Use an outline for one rule across many values; use a data table for a structured input or output of a single example.

Current note: `Scenario Template:` is an accepted synonym for `Scenario Outline:`, and `Scenarios:` for `Examples:`. In JBehave, a plain `Scenario:` with an `Examples:` table plays the same role.

## Background and shared context

```gherkin
Background:
  Given Ana holds a monthly parking pass
  And her pass is linked to the vehicle "ABC-1234"
```

- Runs before every scenario in the file; keep it to a few Givens that every scenario truly needs.
- Background is shared context, not a dumping ground: if a reader has to scroll up to understand a scenario, move the context back into it.
- A scenario can still add its own Givens (`Given her pass has expired`).
- JBehave equivalent: `GivenStories:` pointing at another `.story` file; Gherkin's Background is simpler.

## Independence and level

- Every scenario must pass alone, in any order, in any subset. Never rely on an earlier scenario leaving data behind ("Given I have items in my cart" must create them). Tools start each scenario from a fresh context and may run them in parallel or filtered.
- Prefer high-level scenarios that state the business intent of a whole flow ("When I book a desk for tomorrow / Then I receive a confirmation with the desk number") over chains of tiny UI steps; they survive redesigns.
- Business-rule scenarios (fee tables, eligibility) need not be end-to-end; they state the rule and its outcomes and let automation call the domain directly.

## Organizing feature files

- One feature per file; the file holds all key examples of that feature, including alternate paths and edge cases. Name it after the feature: `paying_for_a_parking_stay.feature`.
- Group files in folders by capability (`features/parking_payments/`, `features/memberships/`); reporting tools can turn that tree into the requirement hierarchy.
- Feature files are source code: version-controlled with the application, ideally committed at the end of the Three Amigos session that wrote them.
- Never one file per user story. Stories are temporary; link a scenario to a story or issue with a tag if planning needs it.

## Tags

```gherkin
@issue:PARK-142 @web
Feature: Paying for a parking stay

  @slow @external-payments
  Scenario: Paying by card at the exit barrier
```

- Uses: link to the tracker (`@issue:PARK-142`), cross-cutting concerns (`@security`, `@accessibility`), execution groups (`@web`, `@slow`, `@smoke`, `@wip`), and hooks that set up or clean up only for tagged scenarios.
- Feature-level tags are inherited by all its scenarios and examples.
- Agree a small tag vocabulary and document it; unbounded tags make filters and reports useless.

Current note: a Gherkin tag is a single whitespace-free token, so write `@issue:PARK-142` rather than `@issue PARK-142`. Cucumber filters with tag expressions such as `--tags "@web and not @slow"`. JBehave uses a `Meta:` block for the same purpose.

## Workflow

1. Take the agreed key examples and open questions from discovery (`../DefiningFeatures/definingFeatures.md`); do not formulate examples nobody agreed.
2. Find or create the feature file for the feature, in its capability folder; write or refresh the title and narrative.
3. Group examples by business rule (`Rule:`), one scenario per key example; title each by what makes it distinctive.
4. Write Given/When/Then declaratively: minimal context, one action, observable outcome, business vocabulary only.
5. Collapse near-duplicates into an outline with an examples table; use data tables for structured inputs and outputs; scan the table for missing boundaries and raise them.
6. Move truly shared context into a short Background; confirm every scenario still runs alone.
7. Add tags from the agreed vocabulary (issue key, cross-cutting concern, execution group).
8. Read the file aloud with the business owner, tester and developer; then hand it to automation (`../AutomatingScenarios/automatingScenarios.md`).

## Red flags

- Steps that mention buttons, fields, URLs, CSS selectors, SQL or HTTP verbs.
- More than one When, or When and Then interleaved.
- Scenario titles that state the expected result, or are numbered ("Scenario 3").
- Five nearly identical scenarios instead of one outline.
- Givens nobody needs for the outcome, or outcomes that depend on unstated preconditions.
- A scenario that fails when run alone or in a different order.
- A long Background that every reader must scroll back to.
- Comments carrying business information that should be in the description.
- Feature files per sprint or per story; tags with spaces or an ever-growing tag list.

## Related

- `../../../actions/bdd.md` — the workflow that owns feature files and formulation.
- `../DefiningFeatures/definingFeatures.md` — where the examples and rules come from.
- `../AutomatingScenarios/automatingScenarios.md` — step definitions, parameters, tables and outcomes for these scenarios.
- `../../CodingTheBddWay/AcceptanceTests/acceptanceTests.md` — keeping automated scenarios maintainable.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — how titles, descriptions, tables and tags appear in reports.
- `../../../actions/dev.md`, `../../../actions/tdd.md` — the loops that make scenarios pass.
- `../../../ProductDefinition/specs/spec-checklist.md` — confirming every requirement has scenarios (when installed).
- `../../../UIUX/Testing/testing.md` — UI checks that complement declarative scenarios (when installed).
- `../../../CleanCode/UnitTests/unitTests.md` — one concept per test and readability, applied to scenarios (when installed).
