---
name: ddd-breakthrough
description: "Refactoring toward deeper insight and handling a modeling breakthrough: the three levels of refactoring (micro-refactorings, refactoring to patterns, refactoring to a deeper model), what makes a model deep rather than naive, how a supple design feeds model discovery, the non-linear payoff of steady refactoring, recognizing the symptoms that precede a breakthrough, deciding whether to take a large model change under deadline pressure and executing it safely, keeping focus on basics instead of chasing breakthroughs, and the cascade of insights that follows, based on Chapter 8 (Breakthrough) and the Part III introduction (Refactoring Toward Deeper Insight) of Domain-Driven Design. Use when requirements keep surprising the design, special-case or 'adjustment' objects pile up, rounding or reconciliation bugs resist fixes, domain experts call the model 'too technical' or never use a term that lives in the code, a whiteboard session reveals a simpler model, the team must decide whether a big remodel is worth it before a release, or someone asks how to refactor to a deeper model, what a deep model is, or whether to rewrite a core domain class."
---

# Breakthrough

Most model improvement is a steady stream of small refactorings driven by domain learning; occasionally that stream exposes a much simpler, deeper model that changes a large part of the design at once. Keep doing the small refactorings, watch for the symptoms that the current model is fighting the domain, and when a deeper model appears, decide deliberately (cost, risk, timing) whether to switch now, then execute the switch behind tests.

## Three levels of refactoring

| Level | Motivation | Example |
|---|---|---|
| Micro-refactoring | Something visible in the code: long method, duplication, bad name | Extract Method, Rename, Move Field |
| Refactoring to patterns | A known design pattern fits the code's shape | Replace conditional with STRATEGY |
| Refactoring to a deeper model | New understanding of the domain, or making the model clearer in code | Replace `ProrationAdjustment` hacks with explicit `ServicePeriod`s |

- The third level does not replace the others; it gives them a direction. A deep-model change is usually executed as a series of micro-refactorings, but the reason for each step is domain insight, not code smell.
- There is no catalog for deep-model refactorings. Follow what the conversations with experts and the awkward code reveal.
- Result to aim for: a developer can say not only what the code does but why, in terms the business recognizes.

## Deep models versus naive models

- First models come from nouns and verbs in requirements. They describe visible, physical things accurately and are usually shallow for the software's purpose.
- A deep model expresses what the experts actually care about and drops what is incidental. It may be abstract or concrete; what matters is that it cuts to the core concern.
- Example: a gym chain's first model had `Member`, `Card`, `TurnstileEntry`. The business really cared about entitlements (which sites, which hours, which classes a membership grants, and for which dates). Cards and turnstiles became infrastructure details; `Entitlement` and `MembershipTerm` became the heart of the model.
- New team members will keep proposing the naive classes. That is a sign they have not yet gone through the discovery, not that the deep model is wrong. Record the reasoning in the glossary and `DomainModel.md`.
- Deep models tend to come with a simple, possibly abstract, vocabulary that the experts enjoy using.

## Supple design feeds discovery

- Model and design form a loop: a deep model enables expressive code, and code that is clear and safe to change lets developers experiment, which yields more insight.
- When code is hard to refactor, modeling stops. Repeated refactoring driven by real insight tends to make the design flexible exactly where change keeps happening, and stiff elsewhere.

## Recognizing that a breakthrough is near

The payoff from refactoring is not linear: many small gains, then sometimes a jump. Signals that the current model is wrong at a basic level:

- Each new requirement, even a small one, needs a special case or an "adjustment" object.
- Persistent numeric inconsistencies (rounding, cents that do not reconcile) that more elaborate algorithms do not cure.
- A concept in the code that experts do not recognize ("we never call it that"); experts deferring to it because they assume it is a technical necessity.
- Experts calling diagrams or discussions "too technical". Treat it as a warning that the model is wrong or badly expressed.
- Two concepts tied together in the model that vary independently in the business.

## Example: from proration hacks to service periods

A SaaS billing context kept adding classes for plan changes mid-cycle. Every case needed new credit logic and a penny-fixing step.

```ts
// Before: changes are patched onto a fixed-price subscription.
class Subscription {
  private credits: Credit[] = [];
  private adjustments: ProrationAdjustment[] = [];

  changePlan(newPlan: Plan, at: Date): void {
    const unused = this.unusedFraction(at);               // float
    this.credits.push(new Credit(this.plan.price * unused));
    this.adjustments.push(new ProrationAdjustment(newPlan, at));
    this.plan = newPlan;
  }

  invoiceTotal(cycle: BillingCycle): number {
    let total = this.plan.price;
    for (const a of this.adjustments) total += a.extraCharge(cycle);
    for (const c of this.credits) total -= c.amount;
    return this.fixRounding(total);                        // grows every sprint
  }
}
```

Walking through scenarios with the billing team showed the experts never thought in credits and adjustments. They thought: "for each day, the customer was entitled to one plan at one price". The subscription is a timeline of service periods; an invoice is the sum of what each period costs within the cycle.

```ts
// After: a plan change closes one period and opens another. No credits, no adjustments.
class ServicePeriod {
  constructor(readonly plan: Plan, readonly range: DateRange) {}
  chargeWithin(cycle: DateRange): Money {
    const days = this.range.overlapDays(cycle);
    return this.plan.dailyRate(cycle).times(days);       // exact minor units, no float
  }
}

class Subscription {
  private periods: ServicePeriod[] = [];

  changePlan(newPlan: Plan, effective: Date): void {
    const current = this.currentPeriod();
    this.periods = [...this.periods.slice(0, -1),
      current.endingBefore(effective), ServicePeriod.openFrom(newPlan, effective)];
  }

  invoiceLines(cycle: DateRange): InvoiceLine[] {
    return this.periods
      .filter((p) => p.range.overlaps(cycle))
      .map((p) => InvoiceLine.of(p.plan, p.chargeWithin(cycle)));
  }
}
```

- `Credit` and `ProrationAdjustment` disappeared; they were developer inventions.
- Rounding happens once per line, in one place, so it stops drifting.
- Pauses, free trials and backdated changes became "another kind of period" instead of new special cases.

## Deciding whether to take it

A breakthrough often arrives at a bad time, and the change may have few safe stopping points. Ask, and write the answers in the decision record:

1. How long to get back to today's functionality on the new model?
2. Can the current problems be solved without it, and how sure are we?
3. What will the next release cost if we do not change now? Will an installed base or migrated data make it harder later?
4. Do the developers and experts agree it is simpler and fits the business better?

The decision involves schedule and politics, so it belongs to whoever owns delivery risk, with the team's estimate. An agent should present the options and the evidence, not decide unilaterally.

Make the switch safe:

- Pin current behavior first with characterization tests and the expert scenarios from the whiteboard session (they become BDD scenarios in the new language).
- Introduce the new model beside the old one (parallel change / branch by abstraction), route one use case at a time, compare outputs on real data, then delete the old path.
- Plan data migration explicitly: map old records into the new structure, verify totals reconcile, keep a rollback path.

Current note: the payoff of deep remodeling is highest in the core subdomain; for supporting or generic subdomains, a workable model is usually enough.

## Focus on basics

- Do not try to schedule a breakthrough or stall waiting for one. They usually follow many modest refactorings.
- Push on the levers you control: knowledge crunching, a tight UBIQUITOUS LANGUAGE, making implicit concepts explicit, supple design, distillation.
- Take small improvements even when they stay inside the current conceptual frame.

## The cascade of insights

- After a breakthrough the code is clearer, so the next awkwardness becomes visible: a missing ENTITY whose duties are smeared across others, or a term experts use ("transaction", "settlement") that appears nowhere in the code.
- Treat that as the next round of the same process. Teams that ride this cascade speed up as the system grows instead of slowing down.

## Workflow

1. Keep refactoring continuously at all three levels; tag commits or notes with the domain insight that motivated each model change.
2. Track the symptoms list above in the domain model record; when several accumulate in one area, schedule a modeling session with experts there.
3. Walk concrete scenarios through a candidate model on a whiteboard or in a scratch test file before touching production code.
4. If a deeper model emerges, update the glossary and `DomainModel.md` with the new terms and which old classes they replace.
5. Estimate and present the decision (the four questions) to the person who owns the schedule.
6. If approved: characterization tests, parallel implementation, use case by use case cutover, data migration with reconciliation, removal of the old model.
7. After landing, look again for the next missing concept.

## Red flags

- Waiting for a breakthrough instead of making small improvements.
- Adding "adjustment", "override", "fix" or "special" classes for each new rule.
- A class name in the code that domain experts say they do not understand or never use.
- Ever more elaborate rounding or reconciliation code instead of questioning the model.
- Rejecting a clearly better model only because it is big, without estimating it; or rewriting the core without tests, a migration plan or approval.
- Restoring naive "obvious" classes that a deeper model deliberately removed.

## Related

- `../ImplicitConcepts/implicitConcepts.md` — techniques for finding the concepts that trigger a breakthrough.
- `../SuppleDesign/suppleDesign.md` — design qualities that make deep-model refactoring affordable.
- `../AnalysisPatterns/analysisPatterns.md` — published models as starting points for deeper insight.
- `../../ModelInPractice/CrunchingKnowledge/crunchingKnowledge.md` — the learning loop that precedes breakthroughs.
- `../../ModelInPractice/UbiquitousLanguage/ubiquitousLanguage.md` — vocabulary changes that accompany a new model.
- `../../StrategicDesign/Distillation/distillation.md` — where deep modeling effort pays off most.
- `../../../actions/ddd.md` — recording the new model and glossary.
- `../../../actions/dev.md` — implementing the switch.
- `../../../actions/tdd.md` — keeping each step green.
- `../../../actions/review.md` — reviewing model changes.
- `../../../TDD/Patterns/Refactoring/refactoring.md` — the micro-refactorings that carry a deep-model change (when installed).
- `../../../CleanCode/LegacyRefactoring/legacyRefactoring.md` — characterization tests before large changes (when installed).
