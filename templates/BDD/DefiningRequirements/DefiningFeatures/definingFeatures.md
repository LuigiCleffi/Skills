---
name: bdd-defining-features
description: "Covers the capability / feature / user story / example vocabulary, writing feature descriptions in the \"In order to ... As a ... I want\" and \"As a ... I want ... So that\" formats, decomposing features by business task instead of by screens, stories as disposable planning artifacts with starter acceptance criteria, epics, tags for requirements that do not fit a hierarchy, illustrating features with concrete examples, spotting rules that are really a solution in disguise, Real Options, Deliberate Discovery, Three Amigos and discovery workshops, and the example-to-working-code loop, based on Chapter 4 (Defining and illustrating features) of BDD in Action. Use when turning capabilities into features, splitting a feature into stories, writing or reviewing a story card or acceptance criteria, arguing about epic vs feature vs story, running a Three Amigos or Example Mapping session, asking stakeholders for examples, requirements feel vague or keep changing, choosing when to commit to a library or design, or deciding which story to tackle first."
---

# Defining and Illustrating Features

A feature is software functionality that gives a stakeholder a capability tied to a business goal; a user story is only a planning slice of it; concrete examples are how the team learns what the feature really has to do. Describe features in business terms, illustrate them with examples gathered in conversation, and do not commit to a solution until the examples have told you enough to choose one.

## The four levels and what each is for

| Level | Answers | Example (meal-kit subscription) | Lifetime |
|---|---|---|---|
| Capability | What must the stakeholder be able to do, regardless of implementation? | Subscribers can manage deliveries around their schedule | Long; tied to the business goal |
| Feature | How will the software help? Deliverable and testable on its own | Pause deliveries online | Becomes a feature file and living documentation |
| User story | How do we slice the feature into sprint-sized work? | Pause for a fixed number of weeks | Discarded once the feature ships |
| Example | What exactly happens in one concrete situation? | Pausing on Thursday skips next Monday's box | Becomes a scenario |

- A feature could in principle go to production alone and be worth something. If it would only make sense together with siblings, it is a story.
- Do not spend meetings on terminology. Agree on one vocabulary per team (or reuse the one in `../../FirstSteps/WhirlwindTour/whirlwindTour.md`) and move on.
- Epics are just large stories used for planning; place them under features or treat them as synonyms. Some teams place epics above features, which only means they use a finer-grained "feature".

## Writing a feature description

Start with a title only. Expand it when you are close to scheduling the work:

```gherkin
Feature: Pause deliveries online
  In order to keep subscribers who travel or go on holiday
  As the retention manager
  I want subscribers to pause and resume deliveries without calling support
```

- Line 1 (In order to): the business goal. Use it as a sanity check: does this feature still serve that goal, given what we know now? If the goal has moved, re-rank or drop the feature.
- Line 2 (As a): pick the stakeholder who actually wants the outcome. Often that is the business owner, not the end user; this reveals when users must be persuaded rather than merely enabled.
- Line 3 (I want): what the software does, in business words, with no screens, buttons or technology.
- "As a ... I want ... So that" carries the same information; choose one format per project. Newcomers stay closer to the goal with "In order to" first.

## Decomposing features

Decompose by business task and outcome, never by an imagined UI flow.

- Good: Pause deliveries online -> Pause for N weeks / Pause until a date / Resume early / Skip a single box.
- Risky: Account page -> Pause button -> Calendar modal -> Confirmation page. This commits to a design, hides the goal, and silently drops options (here "skip a single box" vanished once the calendar modal became the plan).
- Ask business stakeholders whether a smaller slice can ship earlier; that is their call, not the team's.
- Several decomposition levels between a real feature and a sprint-sized story are normal.
- When a story serves two parents (a "strong password at sign-up" story belongs to both "Join online" and "Keep customer data safe"), keep the primary parent and tag the cross-cutting concern (`@security`, `@compliance`) instead of forcing a single tree.

## Stories are planning artifacts

- A story is a promise to have a conversation. The card carries a title, the three-line narrative, priority and a rough estimate; the back holds a few starter acceptance criteria.
- Starter criteria do not need to be exhaustive. They are the agenda for the example conversation, not the specification.
- Defer the details of a story until close to implementation, the last responsible moment: earlier, you specify things you will learn are wrong; later, you have no time to talk to stakeholders.
- Demo each finished story even if it will not ship alone. Demos regularly surface missing stories (a reminder email nobody mentioned) and reshape upcoming ones (a template that marketing, not developers, must be able to edit at any time).
- Once a feature ships, delete or archive its stories. The feature description, its examples and the passing scenarios describe the system; stories only describe how it was built. Organize feature files by feature, never one file per story.

## Illustrating features with examples

Discovery follows a learning loop: take a concrete case, reflect on it, adjust the shared model, then look for a new case that could break the model. Each example you propose is a hypothesis about a rule; a "no" from the expert is the most valuable answer.

Starter criteria for "Compensate late deliveries": a box more than 30 minutes late earns a 10% voucher. The conversation, with a tester keeping the table:

| Case | Late by | Cause | Compensation? | Learned |
|---|---|---|---|---|
| Normal | 31 min | Courier delay | 10% voucher | Confirms the starter rule |
| Boundary | 30 min | Courier delay | None | "More than" is strict |
| Weather | 90 min | Storm warning | Apology only | New rule: force majeure |
| Address changed late | 45 min | Customer edited address after dispatch | None | New rule: customer-caused delay |
| Repeat | 35 min, third time this month | Courier delay | 10% plus a free box | The real goal is retention, not a fixed percentage |

- When the expert starts grading cases instead of saying yes/no, step back: the starter rules were one possible solution, and the real requirement is a different measure (here, the risk of losing an unhappy subscriber). Rewrite the criteria around that measure.
- Keep only key examples as scenarios. Many examples exist just to steer the conversation.
- Record open questions explicitly; do not let them become silent assumptions.

Current note: Example Mapping (rules, examples, questions on colored cards, time-boxed to about 25 minutes per story) is now the most common way to run this conversation. Too many rule cards means the story should split; too many question cards means it is not ready. Rules can later map to Gherkin `Rule:` blocks (see `../ExecutableSpecifications/executableSpecifications.md`).

## Real Options

- Options have value: the less you know about the best solution, the more it is worth being able to switch.
- Options have a price: a thin abstraction, a configuration switch, a spike, a design discussion.
- Options expire: an option on solution A dies when there is no longer time to integrate A before the delivery date. You can sometimes push expiry back by making integration cheaper.
- Never commit early unless you know why, and never delay past what you need: as soon as you have enough information, decide and build quickly.

Example: the compensation rules engine could be built in house or bought. Buy the option cheaply by putting the decision behind one port (`CompensationPolicy`), ship the simplest rule set, and let real examples and stakeholder feedback decide before the integration lead time runs out.

## Deliberate Discovery

- Assume you are ignorant of something important; ignorance is the main constraint on delivery.
- Hunt uncertainty deliberately: spikes, prototypes shown to the stakeholder within days, learning tests against a candidate library (see `../../../TDD/Patterns/RedBarPatterns/redBarPatterns.md`, when installed).
- Order stories by uncertainty, not by ease. Tackle the story you understand least first, then re-plan with what it taught you.
- Real Options keeps decisions open; Deliberate Discovery produces the knowledge that closes them sooner.

## Who takes part in the conversation

| Format | When | Cost and caveat |
|---|---|---|
| Whole-team workshop with stakeholders | Teams new to BDD, new domains, start of an iteration | Best shared understanding; expensive and hard to schedule |
| Three Amigos (business/PO, developer, tester) | Experienced teams, per story or feature | Tester finds edge cases, developer flags technical constraints, PO judges value; draft the scenarios together at one screen |
| Analyst drafts, developer and tester review | When access is limited | Weaker shared understanding; review is mandatory, not optional |

For an agent: you cannot replace the stakeholder in this conversation. Propose candidate examples, edge cases and questions, and mark every rule you inferred rather than heard as an open question for the user.

## From examples to working code

1. Pick one acceptance criterion of the story you are about to build.
2. Explore it with examples until the team agrees on the behavior.
3. Formulate the key examples as scenarios (`../ExecutableSpecifications/executableSpecifications.md`).
4. Automate them and watch them fail for the right reason (`../AutomatingScenarios/automatingScenarios.md`).
5. Implement with TDD in the inner loop until the scenario passes; refactor.
6. Move to the next criterion. The story is done when all of its scenarios pass; testers then explore around them and stakeholders review.

## Workflow

1. Confirm the capability and business goal this feature serves (`../FeatureInjection/featureInjection.md`); stop if none.
2. Write the feature title; add the three-line narrative only when it is near scheduling. Choose the stakeholder who owns the outcome.
3. Decompose into stories by business task; tag cross-cutting concerns; check that no option was lost to an imagined UI.
4. Order stories by uncertainty first, value second.
5. For the next story, run a Three Amigos or Example Mapping session; keep a table of examples and a list of open questions.
6. Challenge every starter rule with boundary and counter-examples; reframe the criteria if the rules turn out to be a solution.
7. Identify decisions you cannot make yet; buy cheap options and note when each expires; schedule discovery to resolve them.
8. Hand key examples to formulation, then into the outer loop of `../../../actions/bdd.md` and `../../../actions/dev.md`.

## Red flags

- Stories named after screens, buttons or components.
- A feature with no traceable business goal, or a goal that no longer holds but the feature stays on the plan.
- Acceptance criteria treated as complete before any example conversation.
- Detailed specs written for stories months away.
- Feature files or documentation organized by story or sprint.
- Examples invented by developers or an agent alone and presented as agreed requirements.
- Picking the easiest stories first while the riskiest unknown waits.
- Hard-wiring a library or vendor while the team still says "we don't know which is best", or deferring a decision past the point where any option can still be delivered.
- Long debates about whether something is an epic, feature or story.

## Related

- `../../../actions/bdd.md` — the workflow that runs discovery and formulation.
- `../FeatureInjection/featureInjection.md` — goals, stakeholders and capabilities that features must serve.
- `../ExecutableSpecifications/executableSpecifications.md` — turning the key examples into Gherkin scenarios.
- `../AutomatingScenarios/automatingScenarios.md` — step definitions for those scenarios.
- `../../FirstSteps/WhirlwindTour/whirlwindTour.md` — the end-to-end BDD flow these practices fit into.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — tags and feature hierarchy in reports.
- `../../../actions/dev.md`, `../../../actions/tdd.md` — outer and inner loops once examples are agreed.
- `../../../actions/uiux.md` — design work that follows discovery for user-facing features.
- `../../../ProductDefinition/specs/spec-definition.md` — the spec structure features and examples refine (when installed).
- `../../../ProductDefinition/specs/spec-checklist.md` — open questions to resolve before formulation (when installed).
- `../../../UIUX/ProductDesign/productDesign.md` — product framing that feeds capabilities and features (when installed).
- `../../../TDD/Patterns/RedBarPatterns/redBarPatterns.md` — learning tests as a Deliberate Discovery tool (when installed).
