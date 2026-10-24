---
name: bdd-feature-injection
description: "How to find the business value behind a project and the minimum features that deliver it, covering Feature Injection (hunt the value, inject the features, spot the examples), value coming from outputs rather than inputs, the vision to goals to capabilities to features to stories to examples traceability chain, vision statements and the product-flyer exercise, SMART business goals in value-first form, the four goal categories (increase revenue, protect revenue, reduce costs, avoid future costs) and their public-sector variant, popping the why stack, Impact Mapping (Why, Who, How, What) with metrics for each assumption, identifying stakeholders including gatekeepers and those negatively affected, implementation-neutral capabilities including cross-cutting ones, and the Purpose-Based Alignment Model (differentiating, parity, partner, minimum impact), based on Chapter 3 (Understanding the business goals: Feature Injection and related techniques) of BDD in Action. Use when kicking off a project or epic, a request arrives as a solution or shopping list of features, the backlog is too long to prioritize, stakeholders fight over whose feature goes first, nobody can say why a feature exists, deciding how much effort or polish a feature deserves, writing a vision statement or business goals, drawing an impact map, or tracing scenarios back to goals."
---

# Understanding the business goals: Feature Injection

Before writing a single scenario, know why the software is being built and how each feature is supposed to produce value. Feature Injection works backwards from the value to the smallest set of features that can produce it, then uses examples to fill in their scope; features that cannot be traced to a goal are waste until proven otherwise.

## The traceability chain

```text
Vision        why the product exists, in two or three sentences
  Goals       measurable business outcomes (revenue, cost, service)
    Stakeholders  who must act or change behavior for the goal to happen
      Capabilities  "to be able to ...", implementation-neutral
        Features      what you actually build and ship
          Stories       iteration-sized slices of a feature
            Examples      concrete cases -> acceptance criteria -> scenarios
              Code
```

- Every scenario should be traceable upward. A cheap way to keep the link in the repo is tags: `@goal:repeat-orders @capability:book-delivery` on the feature file, so reports can roll results up by goal.
- The chain is built iteratively, not top-down once: deliver the slice with the most value, risk or learning, observe, and revise the upper layers.

## Feature Injection in three moves

1. **Hunt the value.** Clarify how the system is expected to produce business value before listing features. This keeps low-value stories from entering the backlog in the first place instead of filtering them out later.
2. **Inject the features.** Value sits in outputs: the decision a report enables, the sale completed, the payment processed, the item shipped. Start from the most valuable outputs and work back to the minimum features needed to produce them. Inputs (forms, admin screens, imports) exist only to serve those outputs.
3. **Spot the examples.** A feature name ("Pay an invoice by instant transfer") is a placeholder. Use high-level examples to discover the variations in inputs and behavior that change the outcome, and expand scope only until the expected value is reachable.

## Write a vision statement

A shared vision lets the team make scope and design calls without escalating each one. Keep it short enough to read in a minute, about objectives rather than technology or deadlines, and visible to everyone (not buried in a PMO document).

A widely used template, filled with an invented example:

```text
FOR      independent physiotherapy clinics
WHO      lose revenue to no-shows and phone-tag rescheduling
THE      ClinicFlow scheduler IS A patient self-booking service
THAT     lets patients book, move and confirm sessions themselves, any time
UNLIKE   generic calendar tools
OUR PRODUCT knows treatment plans, so it books the whole course, not one slot
```

- To draft it, imagine the product flyer: what it does, who it is for, why they would pick it over the alternative, its three or four selling points. Draft in small cross-functional groups and merge.

## Write business goals that can be judged

- State goals value-first: "In order to cut no-show losses by 30% within six months, as the clinic owner, I want patients to confirm or move sessions themselves." Putting the outcome first stops the "so that" clause from becoming an afterthought.
- Make them SMART: Specific, Measurable, Achievable, Relevant, Time-bound. Numbers and dates tell you whether the goal is even feasible (5% in a year and 200% in six months are different projects) and whether it was met.
- Almost every commercial goal falls into one of four buckets; name the bucket, it sharpens the conversation:

| Category | Example |
|---|---|
| Increase revenue | More completed treatment courses per patient |
| Protect revenue | Keep clinics from moving to a competitor's scheduler |
| Reduce costs | Fewer reception hours spent on rescheduling calls |
| Avoid future costs | Audit trail required by an upcoming health-data rule |

- Public-sector and non-profit projects usually aim to improve service, reduce costs, or avoid future costs, within an externally fixed budget.

## Pop the why stack

Requests arrive as solutions. Ask "why" repeatedly (about five times is typical) until you hit a goal in one of the categories above.

```text
Request: "Patients should get an SMS the day before each session."
Why?  -> "So they remember the appointment."
Why does that matter? -> "Forgotten sessions are our biggest no-show cause."
Why is a no-show a problem? -> "The slot is paid staff time we cannot resell that late."
So the goal is: reduce unbillable therapist hours lost to no-shows.
```

- Now alternatives become discussable: an SMS with a one-tap "move my session" link, a waiting list that refills freed slots, a deposit policy. The original request may still win, but on evidence.
- Knowing the why is what lets you re-evaluate a feature when assumptions change mid-project. A requirement stated only as a detailed solution cannot be re-evaluated.

## Draw an impact map

An impact map is a mind map built in conversation with four levels:

| Level | Question | Clinic example |
|---|---|---|
| Why | Which goal? | Cut no-show losses 30% in six months |
| Who | Who can help, benefit, or block it? | Patients, receptionists, therapists, data-protection officer |
| How | What behavior change would move the goal? | Patients move sessions instead of skipping; receptionists refill freed slots fast |
| What | What could we deliver to cause that? | Self-service rescheduling link, waiting-list auto-offer, reminder SMS |

- Each path Why to What is an assumption. Attach a metric to check it after release ("share of moved sessions done via link", "freed slots refilled within 2 hours") and revise the map with the results. Maps are living hypotheses, not plans.
- Remember the What level can include non-software options (a policy change, staff training).
- Run it in reverse to tame a contested backlog: put every requested feature on the board, connect each to who benefits and how, up to a goal. Features that reach no goal, or a minor one, lose priority without anyone having to say no personally.

```yaml
# docs/impact-map.yaml : kept next to the features it justifies
goal: Cut no-show losses 30% by 2027-06
actors:
  - who: patient
    impacts:
      - how: moves a session instead of skipping it
        deliverables: [self-service-reschedule-link, reminder-sms]
        metric: share of reschedules done by patients
  - who: receptionist
    impacts:
      - how: refills freed slots quickly
        deliverables: [waiting-list-auto-offer]
        metric: median minutes from cancellation to rebooking
```

## Identify stakeholders properly

- **Users** whose daily work changes (patients, receptionists). They may not care about the business goal at all; design features that make the goal-supporting behavior the easy one for them.
- **Beneficiaries and sponsors** who own the goal and the budget; quantified goals let them judge return on investment.
- **Gatekeepers** who do not use the system but can block it: security, regulators, operations, data protection. Find them early.
- Note who is affected negatively (an extra verification step annoys staff and customers) and minimize it, even when the net effect is positive.

## Express capabilities, not solutions

- A capability gives a stakeholder the ability to reach a goal without fixing the implementation; it reads naturally after "to be able to". "To be able to fill a cancelled slot the same day" could be a waiting list, an SMS blast, or a receptionist dashboard.
- Shopping-list requirements copied from a competitor ("add patient", "archive patient", "delete patient") say nothing about scale or purpose: ten new records a month might be handled by a script, ten thousand need self-service. Pop the why stack to turn them into capabilities.
- Capabilities can be cross-cutting: confidentiality of health data, usability on a slow mobile connection, availability during clinic hours. Write them in the same value-first form; they later become non-functional scenarios.

## Decide how much effort a feature deserves

The Purpose-Based Alignment Model sorts features on two questions: is it mission critical to operate, and does it differentiate you in the market?

| | Low differentiation | High differentiation |
|---|---|---|
| **Mission critical** | Parity: match the market, no gold-plating (login, card payment, invoices) | Differentiating: invest, build in-house, innovate (treatment-plan-aware booking) |
| **Not critical** | Minimum impact: least effort, buy, outsource or skip | Partner: valuable but outside core skills; integrate a specialist |

- Use it to set the depth of specification too: differentiating features get rich example sets and exploratory testing; parity features get the scenarios that prove they match expectations.

## Workflow

1. Get or draft the vision statement with the stakeholders; make it visible to the team.
2. Write the business goals value-first and SMART; classify each into a goal category.
3. For every incoming request, pop the why stack until it reaches a goal, and record the goal.
4. Build an impact map per main goal (Why, Who, How, What), with a metric per assumption.
5. List stakeholders, including gatekeepers and negatively affected groups.
6. Express what they need as implementation-neutral capabilities, including cross-cutting ones.
7. Inject the minimum features that deliver the most valuable outputs; place each in the Purpose-Based Alignment quadrant to size the effort.
8. Spot examples for the first features and hand them to feature definition and formulation.
9. After each release, check the metrics, update the map and re-rank the backlog.

## Red flags

- A backlog of hundreds of stories with no goal attached to any of them.
- Goals like "modernize the platform" with no measure, date or value category.
- Requirements copied from a competitor's manual or an old system screen by screen.
- "The user asked for it" as the only justification for a feature.
- Stakeholders reduced to one generic "user" role; regulators and operations discovered at go-live.
- Impact maps drawn once at kickoff and never checked against real metrics.
- Parity features gold-plated while the differentiating feature is starved.
- Scenarios written for features whose goal nobody can name.

## Related

- `../../FirstSteps/SoftwareThatMakesADifference/softwareThatMakesADifference.md` — why building the right thing matters.
- `../../FirstSteps/WhirlwindTour/whirlwindTour.md` — where goal-first discovery sits in the full cycle.
- `../DefiningFeatures/definingFeatures.md` — turning injected features into stories and examples.
- `../ExecutableSpecifications/executableSpecifications.md` — formulating the spotted examples.
- `../../CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — automating cross-cutting capabilities.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — rolling results up by goal and capability.
- `../../../actions/bdd.md` — discovery step that consumes goals and capabilities.
- `../../../ProductDefinition/plan.md` — product vision, goals and success criteria (when installed).
- `../../../ProductDefinition/specs/spec-definition.md` — requirements that features must trace to (when installed).
- `../../../ProductDefinition/specs/spec-checklist.md` — unresolved questions to settle before formulation (when installed).
- `../../../UIUX/ProductDesign/productDesign.md` — product strategy and value from the design side (when installed).
