---
name: ddd-crunching-knowledge
description: "How a team turns scattered domain knowledge into a useful domain model through knowledge crunching: what a model is (a selective, purposeful abstraction, not a diagram or a realistic copy), the three uses of a model in domain-driven design, collaborating with domain experts through scenarios and sketches, binding the model to an early infrastructure-free prototype, distilling by dropping concepts, continuous learning, knowledge-rich design that captures business rules and policies (not just nouns), extracting a hidden concept such as a POLICY (STRATEGY) out of a guard clause, and deep models that come from shifts in perspective, based on Chapter 1 (Crunching Knowledge) of Domain-Driven Design. Use when starting work in an unfamiliar business domain, interviewing domain experts, turning a vague feature request into concepts, requirements read like 'read a file, sort it, print a report', a business rule is buried in an if statement in a controller or service, the model is just a data schema with getters and setters, experts say the software 'doesn't think the way we do', deciding what to leave out of a model, running a modeling or Event Storming session, or the user mentions domain expert, knowledge crunching, discovery, domain model, policy, business rule, or deep model."
---

# Crunching Knowledge

A domain model is a deliberately selective, organized abstraction of what the experts know, chosen because it helps solve this problem, not because it is realistic. Build it by crunching knowledge with domain experts: walk concrete scenarios, sketch, name concepts, bind them to running code early, keep what carries the scenarios and drop what does not, and make every important rule an explicit, named part of the model.

## What a model is (and is not)

- A model is the idea a diagram, a sentence or the code conveys; none of those artifacts is the model by itself.
- It is a simplification for a purpose. Like a map, it shows what matters for the journey and omits the rest. A "complete" or "realistic" model is not a goal.
- In domain-driven design one model does three jobs at once:
  1. It shapes the design of the core of the software, so the code can be read through the model (see Binding Model and Implementation).
  2. It is the backbone of the language the whole team speaks (see Communication and the Use of Language).
  3. It is distilled knowledge: the team's agreed way of carving up the domain and saying what matters most.
- The value is in the domain logic. Frameworks and infrastructure support it; elaborate technical machinery that crowds out the model is a project risk, not progress.

## The knowledge-crunching loop

Knowledge crunching is collaborative and led by developers. Raw material comes from experts, users of existing systems, legacy code, business documents and a lot of conversation.

1. **Pick one feature or scenario** to focus on, so the conversation has edges ("what happens when a claim arrives after the policy lapsed?").
2. **Sketch while talking.** Draw three to five boxes with names the experts use; let them correct the names and the relationships. Every correction is new knowledge.
3. **Ask for concrete cases and edge cases.** "Is this always true? What if there are two? Who decides? What do you do today when this goes wrong?"
4. **Resolve synonyms and conflicts.** When two experts use different words for one thing, or one word for two things, stop and settle it. Record the decision in the glossary.
5. **Bind to code early.** Write a tiny prototype of the domain objects driven by automated tests: no database, no UI, no framework. Seeing the model compute something real makes the experts sharper critics.
6. **Walk new requirements through the model.** When the objects cannot carry a scenario, change or add concepts; refactor the code along with the model.
7. **Distill.** Remove concepts that turned out not to matter, and split a concept when a needed part is tangled with an unneeded one.

Why the alternatives fail:

| Approach | Failure |
|---|---|
| Waterfall hand-off (experts to analysts to programmers) | One-way flow; analysts never learn from code or early versions; knowledge does not accumulate |
| Iterate on features without abstracting | Software works, but developers learn *what* to build, never *why*; no leverage, every feature is built from scratch |
| Developers abstract alone | Concepts are technically tidy but naive; they miss how experts actually think |

Current note: Event Storming (sticky notes for domain events on a timeline, then commands, actors, policies and aggregates) is a common way to run the first crunching sessions with many experts at once. Treat its output as raw material for the model, not the model itself.

## Knowledge-rich design: rules, not just nouns

"Find the nouns" yields a data schema. Business activities, rules, policies and constraints are as much part of the domain as the things they act on, and experts juggle contradictory rules without noticing. Crunching surfaces those rules so they can be clarified, reconciled, or explicitly put out of scope.

A common smell is a key business rule buried in an `if` check inside an application service:

```ts
// Before: the rule is an anonymous calculation inside a use case
async function submitClaim(claim: Claim, policyholder: Policyholder) {
  if (claim.amount.lessThan(Money.usd(500)) && !policyholder.hasFraudFlags() && policyholder.tenureMonths() >= 6) {
    claim.approve();
  } else {
    claim.routeToAdjuster();
  }
  await claims.save(claim);
}
```

No claims manager can review that line, and nobody reading the requirement "fast-track small claims from established customers" can find it. Name the concept:

```ts
// After: the rule is a domain concept with a name from the language
export class FastTrackPolicy {
  constructor(private readonly ceiling: Money, private readonly minimumTenureMonths: number) {}

  qualifies(claim: Claim, policyholder: Policyholder): boolean {
    return claim.amount.lessThan(this.ceiling)
      && !policyholder.hasFraudFlags()
      && policyholder.tenureMonths() >= this.minimumTenureMonths;
  }
}

async function submitClaim(claim: Claim, policyholder: Policyholder) {
  if (fastTrack.qualifies(claim, policyholder)) claim.approve();
  else claim.routeToAdjuster();
  await claims.save(claim);
}
```

- The class is a POLICY (the STRATEGY design pattern). The motivation here is not swapping rules at runtime; it is that "fast-track policy" is a real concept the business talks about.
- Now a developer can show the expert `FastTrackPolicy.qualifies` and ask "is this right?", which closes the feedback loop.
- Do not do this for every trivial detail. Spend this effort on rules that matter to the business (see Distillation); keep the rest simple.

## Continuous learning

- Projects never start knowing enough, and seemingly simple domains hide the most false assumptions.
- Projects leak knowledge: people leave, teams reorganize, outsourced code arrives without understanding. If the code and the few documents do not express the model, the knowledge leaves with the people.
- So learning is part of the job: developers deliberately study the specific domain, not just technology, and a stable core of people who know it works on the most critical areas.
- Record what was learned where the next person will find it: names in code, the glossary, the domain model record, tests that read as rules.

## Deep models come from shifts in perspective

- Useful models rarely sit on the surface. Early concepts that seemed central often get demoted, reframed or deleted as understanding grows.
- Example: a subscription product first modeled as "charge the card every month" (Customer, Card, Charge). Experts kept being unhappy with upgrades, refunds and grace periods. The deeper view was *entitlements*: what the customer is allowed to use and for which period, with invoices and payments as consequences of entitlement changes. Charges did not disappear; they stopped being the center.
- Signals that a deeper model is waiting: experts keep explaining around the model, features bolt awkwardly onto the wrong object, the same special case keeps reappearing.
- You cannot plan where crunching ends. Early work still pays off: shared vocabulary, trained people, and a feedback loop through running code.

## Workflow

1. Name the feature or decision being explored and the domain experts available; if no expert is reachable, record the assumptions explicitly as open questions.
2. Gather inputs: specs (`ProductDefinition/specs`), existing code, business documents, support tickets, and expert conversations.
3. Run scenario walkthroughs with a small sketch; capture every term, synonym, contradiction and rule in the glossary and the domain model record (`DomainModel.md`).
4. List the business rules separately from the nouns: policies, thresholds, eligibility, sequencing constraints, calculations. Decide for each: in scope, out of scope, or open question.
5. Write a minimal, infrastructure-free prototype of the core objects with tests that state the rules in domain language.
6. Review the prototype and tests with an expert; feed corrections back into the model, glossary and code.
7. Prune: delete concepts that no scenario needs; split tangled ones.
8. Repeat per feature. When a new requirement does not fit, treat it as a chance to deepen the model rather than to add a special case.

## Red flags

- Requirements gathered as "what screens and reports do you want" with no conversation about the underlying concepts.
- Domain objects that are only data holders while all rules live in controllers, services, SQL or UI handlers.
- An important business rule appearing as a magic number or compound `if` in an application method.
- A model diagram nobody on the business side has seen or could explain.
- Concepts kept "because the real world has them" though no scenario uses them.
- Developers who cannot explain a rule's reason, only its implementation.
- One person acting as translator between experts and developers.
- Infrastructure (persistence, messaging, framework setup) built for weeks before any domain behavior runs.

## Related

- `../UbiquitousLanguage/ubiquitousLanguage.md` — turning crunched knowledge into the shared language.
- `../ModelDrivenDesign/modelDrivenDesign.md` — keeping the crunched model and the code as one.
- `../../BuildingBlocks/IsolatingTheDomain/isolatingTheDomain.md` — where the extracted rules belong in the code.
- `../../DeeperInsight/ImplicitConcepts/implicitConcepts.md` — techniques for surfacing hidden concepts such as policies and specifications.
- `../../DeeperInsight/Breakthrough/breakthrough.md` — what happens when a deep model suddenly emerges.
- `../../StrategicDesign/Distillation/distillation.md` — deciding where modeling effort is worth spending.
- `../../../actions/ddd.md` — the workflow that records the model and glossary.
- `../../../actions/bdd.md` — turning expert examples into scenarios in the same language.
- `../../../actions/tdd.md` — test-driving the infrastructure-free prototype.
- `../../../ProductDefinition/specs/spec-definition.md` — the specification the crunching starts from (when installed).
- `../../../BDD/DefiningRequirements/DefiningFeatures/definingFeatures.md` — discovering examples and rules with stakeholders (when installed).
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects with behavior versus data structures (when installed).
