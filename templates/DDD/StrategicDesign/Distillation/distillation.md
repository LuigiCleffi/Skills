---
name: ddd-distillation
description: "How to find the CORE DOMAIN and separate it from everything else, covering CORE DOMAIN, GENERIC SUBDOMAINS (buy, published model, outsource, in-house), DOMAIN VISION STATEMENT, HIGHLIGHTED CORE (distillation document, flagged core), COHESIVE MECHANISMS, declarative style, SEGREGATED CORE, ABSTRACT CORE, deep models, and choosing refactoring targets, based on Chapter 15 (Distillation) of Domain-Driven Design. Use when deciding where to invest design effort, what to build vs buy vs outsource, which module deserves the strongest developers, what to refactor first in a large tangled codebase, writing a vision statement or one-page model overview, marking core code, extracting a generic subdomain (identity, notifications, money, time zones, accounting) or a computation engine (graph, rules, scheduling), or when the user mentions core domain, supporting subdomain, generic subdomain, differentiator, build vs buy, competitive advantage, core vs plumbing, or the domain logic drowning in side concerns."
---

# Distillation

Not all of a model deserves equal care. Name the small part that makes the software worth building (the CORE DOMAIN), make it easy to see, give it the best people and the deepest modeling, and push everything else toward generic, cheap, or bought. When two pieces of work compete for time, pick the one that improves the CORE.

The patterns form a ladder of increasing commitment: write a DOMAIN VISION STATEMENT, then HIGHLIGHT the CORE, then factor out GENERIC SUBDOMAINS and COHESIVE MECHANISMS, then repackage into a SEGREGATED CORE, and finally, when insight allows, an ABSTRACT CORE.

## CORE DOMAIN

Ask: if this part were mediocre, would users stop choosing the product? If yes, it is CORE. The answer depends on the business, not the technology. For a short-term rental marketplace, pricing and availability matching may be CORE while user accounts, payments, and messaging are not; for a payments company, the money model is CORE.

- Keep the CORE small. A CORE that contains half the system distinguishes nothing.
- Staff it with strong developers who will stay and learn the domain, paired with real domain experts. A temporary specialist in the CORE is a leak: the knowledge walks out with them. Use outside experts as coaches, not as builders of the CORE.
- Do not expect to buy the CORE. If a framework constrains your CORE, either back it out of the CORE, admit the area is not really CORE and shrink the boundary, or admit you have no special needs and buy a product.
- Build the first end-to-end slice through the CORE, however thin. A walking skeleton of a peripheral feature proves the plumbing and hides the real risk: unexpected domain complexity.
- The CORE changes as insight grows. Revisit the choice at each milestone.

Current note: today this is usually framed as classifying subdomains into core, supporting (specific to you but not a differentiator), and generic (solved problems). Supporting subdomains are built in-house but simply; generic ones are bought or adopted.

## GENERIC SUBDOMAINS

Some parts of the model are needed but carry no special knowledge of your business: identity, notifications, invoicing, currency, calendars and time zones, organization charts, general ledgers. Mixed into the CORE they hide what matters.

Factor each into its own module, with no trace of your specialty in it, and choose how to get it:

| Option | Pros | Cons |
|---|---|---|
| Off-the-shelf / open source | Less code, mature, maintained by others | Evaluation and integration cost, may be overbuilt, may need its own BOUNDED CONTEXT and translation, platform dependencies |
| Published model (an established analysis pattern, accounting, units of measure) | Proven thinking, instant documentation, shared vocabulary | May be more than you need; implement a self-consistent subset |
| Outsourced implementation | Keeps core team on the CORE; forces a clean interface | Spec and review time; handover cost; write acceptance tests for it |
| In-house | Exact fit, easy integration | Ongoing maintenance; cost is routinely underestimated |

- Generic does not mean reusable. Build only the part you need now; do not design for every future user. Reuse of the model (a published design) usually beats reuse of code.
- Stay strictly inside the generic concept. A rental-specific field in the notifications module is either CORE knowledge that leaked out or a missing specialized subdomain.
- Do not let the strongest developers spend weeks perfecting a generic piece before the CORE even exists. Build it when concrete requirements show what is needed, and keep it decoupled either way.

```ts
// notifications/ — generic: knows channels and templates, nothing about rentals
export interface Notifier {
  send(to: RecipientId, template: TemplateKey, data: Record<string, string>): Promise<void>;
}

// pricing/ (CORE) depends on the generic module through a narrow interface
export class PriceDropAlert {
  constructor(private readonly notifier: Notifier) {}
  async notifyWatchers(listing: Listing, newNightly: Money, watchers: GuestId[]) {
    for (const guest of watchers) {
      await this.notifier.send(guest, "price-drop", { listing: listing.title, price: newNightly.format() });
    }
  }
}
```

## DOMAIN VISION STATEMENT

Write about one page describing the CORE and the value it brings. Leave out anything that does not distinguish this model from any other system (UI responsiveness, hosting, frameworks, security plumbing). Write it early and revise it. Use it to settle "is this CORE?" arguments, to orient new team members, and to explain trade-offs to management.

```markdown
## Domain vision (rental marketplace)
The model matches guests to stays by expressing availability, house rules and seasonal demand
as first-class concepts, so hosts can price per night from demand signals instead of fixed rates,
and guests see only stays that genuinely fit their dates, party and constraints.
Not in scope here: login, payments processing, messaging delivery, page performance.
```

## HIGHLIGHTED CORE

A vision statement is too broad to tell a developer which classes are CORE. Make the CORE visible with little or no code change:

- **Distillation document**: 3-7 sparse pages naming the essential concepts, their key relationships and the main interactions, readable by non-developers, pointing into the code for detail. Minimal, so it ages slowly.
- **Flagged core**: mark CORE elements in the primary repository of the model (an annotation, a doc tag, a `CODEOWNERS` entry, a folder README), so anyone can tell at a glance whether a file is in or out.

```ts
/** @core Availability matching: the differentiator. Changes need review by the domain lead. */
export class StayMatcher { /* ... */ }
```

```text
# CODEOWNERS
/src/pricing/      @rentals/core-modelers
/src/availability/ @rentals/core-modelers
```

Use the distillation document as a process tool: a change that does not alter the document can be made freely; a change that alters CORE concepts, relationships, or the CORE boundary needs team consultation and a new version of the document announced to everyone.

## COHESIVE MECHANISMS

When the "how" (algorithms) swamps the "what" (the domain statement), look for a conceptually coherent computation and move it into a small framework behind an INTENTION-REVEALING INTERFACE. Prefer known formalisms: graphs, interval arithmetic, constraint solving, rule combination. The domain states the problem; the mechanism solves it.

```ts
// mechanism/intervals.ts: pure math, no rental vocabulary, tested in isolation
export class DateRange {
  private constructor(readonly start: PlainDate, readonly endExclusive: PlainDate) {}
  static of(start: PlainDate, endExclusive: PlainDate): DateRange { /* validate start < end */ return new DateRange(start, endExclusive); }
  overlaps(other: DateRange): boolean { return this.start < other.endExclusive && other.start < this.endExclusive; }
  minus(others: DateRange[]): DateRange[] { /* gap computation */ return []; }
}

// availability/ (CORE) reads declaratively
export class Listing {
  isFreeFor(stay: DateRange): boolean {
    return !this.bookings.some(b => b.period.overlaps(stay)) && !this.blocks.some(b => b.overlaps(stay));
  }
}
```

- GENERIC SUBDOMAIN vs COHESIVE MECHANISM: a generic subdomain is an expressive model of some part of the business, just less central; a mechanism models no business at all, it computes what the expressive model asks.
- A mechanism belongs in the CORE only when the algorithm itself is the proprietary value (a pricing optimizer that beats competitors). Even then, keep it behind an interface.
- Re-merging a mechanism later (for performance or simplicity) is fine if the declarative interface survives.
- The payoff: with supple mechanisms and generic subdomains doing the work, the CORE can read like a small language of combinable statements (see `../../DeeperInsight/SuppleDesign/suppleDesign.md`).

## SEGREGATED CORE

When a large, critical BOUNDED CONTEXT has its CORE tangled with supporting code, repackage:

1. Identify a core subdomain (start from the distillation document).
2. Move its classes into a new module named for the concept (`availability/`, not `core/` or `common/`).
3. Sever data and behavior that do not express the concept; move them to other modules, even imperfectly placed ones.
4. Simplify the CORE's internal relationships and make each outbound dependency explicit and self-explanatory. Keep doing this.

Segregation often surfaces model insight (a constraint that should be explicit, an association that should be direct). It can make some links to non-core code more awkward and may break a cohesive non-core package; accept that for a clearer CORE. It is a team decision: everyone must use the same CORE definition, and changes to that definition go through the team's decision process, not one pair's initiative.

## ABSTRACT CORE

When subdomain modules interact so much that cross-module references explode, slice horizontally: put the fundamental abstractions (interfaces, abstract types) that carry most interactions into one package; specialized implementations live in subdomain packages and depend only on that core package. This only works when the abstractions are real domain concepts, not "everything that is referenced a lot". The ABSTRACT CORE should read like the distillation document, but executable.

```ts
// core-model/ — the abstract core
export interface Stay { readonly period: DateRange; readonly party: PartySize; }
export interface PricingPolicy { nightlyRate(listing: ListingRef, night: PlainDate): Money; }
export interface HouseRule { permits(stay: Stay): RuleOutcome; }

// pricing/seasonal.ts, pricing/demand.ts, rules/pets.ts ... implement these; they import core-model only
```

## Choosing refactoring targets

- Pain-driven work: check whether the root cause is in the CORE or in the CORE's relationship to a supporting piece. If so, fix that root, not the symptom.
- Free refactoring time: spend it first on factoring the CORE, then on segregating it, then on making supporting subdomains truly generic.
- Deep models distill: the biggest returns from refactoring toward deeper insight come in the CORE.

## Workflow

1. List the subdomains in the request and the codebase; classify each as CORE, supporting, or generic, with one sentence of justification tied to business value.
2. Draft or update the domain vision statement (one page) and add it to `DomainModel.md`.
3. Mark the CORE: list its key concepts in the distillation section of `DomainModel.md` and flag the code (annotation, folder README, `CODEOWNERS`).
4. For each generic subdomain, choose buy / published model / outsource / in-house and record the reason; keep it free of CORE vocabulary.
5. Look for algorithm-heavy code inside CORE classes; extract cohesive mechanisms behind intention-revealing interfaces with their own unit tests.
6. If the CORE is still entangled, plan a SEGREGATED CORE refactoring in small steps, agreed by the team; consider an ABSTRACT CORE only once the key abstractions are clearly domain concepts.
7. Prioritize the backlog: CORE improvements first; start new projects with a thin end-to-end slice through the CORE.

## Red flags

- The best engineers own the framework, the ORM layer or the time-zone library while the pricing or matching logic is written feature by feature by whoever is free.
- "Core" means "shared utilities" (`core/`, `common/`, `shared/` folders full of helpers).
- A generic module that imports CORE types or mentions business-specific terms.
- Building a fully general generic component with no concrete consumer yet.
- The first prototype exercises only login, CRUD and notifications.
- CORE classes with dozens of private algorithmic helpers hiding a few domain statements.
- A purchased framework dictating the shape of the CORE model.
- A vision statement full of technology choices and non-functional requirements, or never read after funding.
- A distillation document as long as the design docs, or out of date with the code.
- Individuals redefining the CORE boundary on their own.

## Related

- `../../../actions/ddd.md` — workflow that records CORE, subdomains and the vision statement in `DomainModel.md`.
- `../ModelIntegrity/modelIntegrity.md` — BOUNDED CONTEXTS and CONTEXT MAP; bought generic subdomains usually need an ANTICORRUPTION LAYER.
- `../LargeScaleStructure/largeScaleStructure.md` — structure that complements distillation.
- `../BringingTheStrategyTogether/bringingTheStrategyTogether.md` — combining distillation with context and structure; strategic assessment.
- `../../DeeperInsight/SuppleDesign/suppleDesign.md` — intention-revealing interfaces, side-effect-free functions and declarative style used by mechanisms.
- `../../DeeperInsight/AnalysisPatterns/analysisPatterns.md` — published models for generic subdomains.
- `../../DeeperInsight/Breakthrough/breakthrough.md` — deep models that change a project's trajectory, most valuable in the CORE.
- `../../ModelInPractice/CrunchingKnowledge/crunchingKnowledge.md` — building domain knowledge in the team that owns the CORE.
- `../../../actions/dev.md`, `../../../actions/review.md` — prioritizing and reviewing changes to CORE code.
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping third-party code for bought subdomains (when installed).
- `../../../CleanCode/Classes/classes.md` — cohesion and single responsibility when extracting mechanisms (when installed).
- `../../../CleanCode/Systems/systems.md` — separating concerns at system level (when installed).
