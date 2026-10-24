---
name: ddd-large-scale-structure
description: "How to give a large system a shared organizing principle without a straitjacket, covering EVOLVING ORDER, SYSTEM METAPHOR, RESPONSIBILITY LAYERS (potential, operations, commitment, policy, decision support), KNOWLEDGE LEVEL (type objects that configure operational objects), PLUGGABLE COMPONENT FRAMEWORK, how restrictive a structure should be, upward communication via events, and refactoring toward a fitting structure, based on Chapter 16 (Large-Scale Structure) of Domain-Driven Design. Use when developers cannot tell where new code belongs, many modules follow inconsistent styles, a big domain layer needs organizing beyond modules, deciding dependency rules between domain packages, users must configure roles, plans, types or rules at runtime, building a plug-in or vendor-adapter ecosystem, enforcing layer rules with lint or architecture tests, or when the user mentions system metaphor, responsibility layers, knowledge level, type object, meta level, configurable behavior, plug-in architecture, hub and components, or architecture that fights the domain."
---

# Large-Scale Structure

When a model is too big to understand from its modules alone, adopt a small set of system-wide rules or roles that tells anyone where a part fits without reading it. Let that structure emerge and change with understanding; keep it minimal, put its terms into the UBIQUITOUS LANGUAGE, flag exceptions, and drop or replace it when it starts forcing awkward designs.

## EVOLVING ORDER

Two failure modes: a free-for-all where every module is designed differently and nobody sees the whole, and an up-front architecture that freezes domain decisions before anyone understands the domain. The problem is not rules but rigid, ill-fitting rules imposed from outside.

- Use a large-scale structure only when it clearly helps. Small teams with well-named modules, some distillation, and good communication often need none. Unlike the CONTEXT MAP, structure is optional.
- Start loose (a metaphor or two layers), refine it from real coding experience, and expect it to change type entirely.
- An ill-fitting structure is worse than none. Aim for the minimal set of rules that solves problems you actually have.
- Exceptions are allowed but must be flagged, so developers can assume the structure holds unless told otherwise. Many exceptions mean the structure should change.
- The structure should work across BOUNDED CONTEXTS and accommodate legacy or external systems you cannot reshape (loosen the rules, or define how those systems relate).

## SYSTEM METAPHOR

Sometimes a concrete analogy captures the team's imagination and points design in a useful direction (a "firewall", an "assembly line", a "ledger"). Adopt it as a structure, absorb it into the UBIQUITOUS LANGUAGE, and let it guide decisions across modules and even contexts, since contexts can map to it loosely.

- Every metaphor carries baggage. Watch for design features copied from the analogy that do not fit the problem; drop the metaphor when it misleads.
- Most projects never find a good one. The domain model and UBIQUITOUS LANGUAGE are not a "naive metaphor"; they already do this job.

## RESPONSIBILITY LAYERS

Many domains have natural strata: some concepts change independently and at a different rate from others that depend on them. Turn these into a few broad conceptual layers, each named for a major responsibility, and refactor so every object, AGGREGATE and MODULE sits within one layer. Upper layers may use any lower layer (relaxed layering); lower layers know nothing of upper ones.

These are domain layers inside the domain layer, not the UI/application/domain/infrastructure layers of `../../BuildingBlocks/IsolatingTheDomain/isolatingTheDomain.md`.

Common layers (keep to four or five at most):

| Layer | Question it answers | Rate of change | EV charging network example |
|---|---|---|---|
| Decision support | What should we do or set? | Little state | Load-shifting recommendations, site expansion analysis |
| Policy | What are the rules and goals? | Slow | Tariff rules, grid load limits, fleet-customer priority |
| Commitment | What have we promised? | Moderate | Fleet contracts, reserved charging slots |
| Operations | What is being done? | Fast | Charging sessions, reservations, faults |
| Potential (capability) | What could we do? | Moderate | Sites, chargers, connector power, grid connection capacity |

Choose layers that tell the business story, respect conceptual dependency (upper concepts mean something only against lower ones; lower ones stand alone), and follow CONCEPTUAL CONTOURS (different rates or sources of change). Placement is a domain decision: whether a `Customer` is Potential (long relationship) or Operations (one-off) depends on how the business treats customers.

Applying the structure changes the model. A `Charger.isPreferredForFleets` flag mixes policy into potential; it becomes a `FleetPriorityPolicy` in the Policy layer that the decision-support `SessionScheduler` consults. When a new rule arrives, put its responsibility where the layers allow, even if another design would be equally good on its own; consistency across the team is worth small local trade-offs.

```ts
// operations/ must not import policy/ or decision/. Lower layers announce, upper layers react.
export class ChargingSession {
  private readonly events: DomainEvent[] = [];
  recordEnergy(kwh: Kwh, at: Instant): void {
    this.delivered = this.delivered.plus(kwh);
    this.events.push(new EnergyDelivered(this.id, this.chargerId, kwh, at));
  }
  pullEvents(): DomainEvent[] { return this.events.splice(0); }
}

// policy/ listens; it may depend on operations, never the reverse
export class SiteLoadLimitPolicy {
  constructor(private readonly limits: SiteLimits, private readonly alerts: DecisionQueue) {}
  on(event: EnergyDelivered, currentSiteLoad: Kw): void {
    if (currentSiteLoad.exceeds(this.limits.forCharger(event.chargerId))) {
      this.alerts.raise(new LoadLimitBreached(event.chargerId, currentSiteLoad));
    }
  }
}
```

Operations must record reality even when it breaks policy (a car charged on the wrong connector is still a fact). Upward notification through events avoids two-way dependencies.

Make the layers checkable, since the structure is invisible in UML and in functional tests:

```js
// .eslintrc.cjs: one rule per layer boundary
module.exports = { overrides: [
  { files: ["src/domain/potential/**"],  rules: { "no-restricted-imports": ["error", { patterns: ["**/operations/**", "**/commitment/**", "**/policy/**", "**/decision/**"] }] } },
  { files: ["src/domain/operations/**"], rules: { "no-restricted-imports": ["error", { patterns: ["**/policy/**", "**/decision/**"] }] } },
]};
```

Tools such as dependency-cruiser (TypeScript), ArchUnit (Java) or import-linter (Python) express the same rules as tests.

Current note: Domain Events are now a standard building block and the usual way lower layers or other contexts notify upper ones; hexagonal (ports and adapters) organizes the technical boundary and can coexist with responsibility layers inside the domain.

## KNOWLEDGE LEVEL

When users or administrators must change the roles, types and rules that govern entities at installation or run time, both a rigid model and a fully open one fail: rigid models get abused (fields reused for other meanings), open ones cannot enforce the organization's rules. Split the model into two levels of ordinary domain objects:

- **Knowledge level**: objects that describe and constrain (types, plans, policies), edited rarely by privileged users.
- **Operational level**: the everyday objects whose behavior and allowed relationships are set by their knowledge-level object.

```ts
// knowledge level: edited by an admin when commercial policy changes
export class MembershipPlan {
  constructor(
    readonly id: PlanId,
    readonly name: string,
    readonly billing: BillingScheme,          // per-kWh, monthly-flat, fleet-invoice
    readonly allowedConnectors: ConnectorType[],
    readonly maxReservationsPerWeek: number,
  ) {}
}

// operational level: day-to-day objects constrained by their plan
export class Member {
  constructor(readonly id: MemberId, private plan: MembershipPlan, private reservationsThisWeek: number) {}
  reserve(slot: Slot): Reservation {
    if (!this.plan.allowedConnectors.includes(slot.connector)) throw new ConnectorNotInPlan(this.plan.name);
    if (this.reservationsThisWeek >= this.plan.maxReservationsPerWeek) throw new ReservationQuotaReached();
    this.reservationsThisWeek++;
    return Reservation.for(this.id, slot);
  }
  switchPlan(plan: MembershipPlan): void { this.plan = plan; }
}
```

- Signs you have an implicit knowledge level: a "type" relationship between things, and a cluster of objects whose edits are restricted to super-users.
- Separating the level often exposes merged concepts (here, billing scheme and connector rights could later split into separate knowledge objects).
- Build it from domain objects, not from the language's reflection API, and keep it specialized, not a general rule engine.
- Costs: indirection makes behavior harder to follow; configurers may need programmer-like skill; changing a knowledge object raises migration questions for existing operational objects (do existing members keep the old plan version?). Use it only where customization is essential.
- Unlike responsibility layers, dependencies run both ways between the levels; it can coexist with other structures.

## PLUGGABLE COMPONENT FRAMEWORK

When several applications or vendors must interoperate around the same abstractions, distill an ABSTRACT CORE of interfaces and interaction protocol into a hub; components implement the interfaces and can be substituted; applications use components only through those interfaces. Different BOUNDED CONTEXTS can sit behind the component interfaces; the plug-in interface may be a PUBLISHED LANGUAGE.

```ts
// hub/ (abstract core in a shared kernel)
export interface ChargerDriver {
  supports(connector: ConnectorType): boolean;
  startSession(cmd: StartCommand): Promise<SessionHandle>;
  stopSession(handle: SessionHandle): Promise<MeterReading>;
}
// vendors/acme-driver.ts, vendors/legacy-site-adapter.ts implement ChargerDriver
```

Current note: in EV charging, OCPP plays exactly this role as a published protocol between chargers and back-office systems.

- Hard to design: needs precise interfaces and a mature, deep model. Do not make it the first or second structure; it works best after several specialized applications exist.
- It freezes the core protocol: refactoring toward deeper insight slows, because every component must change with it.
- A technical plug-in framework is only needed for real technical problems (distribution, sharing across apps); the pattern itself works inside one program.

## How restrictive and how to evolve

- Looser structures (metaphor, layers) leave room for local design; stricter ones (communication rules between layers, component frameworks) give uniformity. The main contribution is conceptual coherence; every rule must make development easier. Resist building a framework to enforce the structure.
- Refactor toward the structure as you learn; you will not have the final one at the start.
- Keep it minimal; make it part of the UBIQUITOUS LANGUAGE and use it constantly, or it decays (nothing in functional tests checks it).
- Repeatedly restructured models become easier to restructure: axes of change are made flexible, stable parts simplified.
- Distillation lightens restructuring: generic subdomains and mechanisms moved out of the CORE leave less to move; fit each supporting piece into one layer or one component.

## Workflow

1. Confirm the need: list the concrete confusion (where does X go? inconsistent designs? cross-team drift). If modules plus distillation suffice, stop.
2. Look for natural strata (rates and sources of change, conceptual dependency), a metaphor the team already uses, configurable "type" clusters, or many vendor variants.
3. Pick the loosest structure that addresses the problem; write its terms and rules in `DomainModel.md` and the glossary.
4. Assign each existing module and AGGREGATE to a layer or level; refactor offenders (move responsibilities, introduce policies, invert dependencies with events).
5. Encode the rules where possible (lint import rules, architecture tests) and flag documented exceptions.
6. In review, check new code against the structure; when exceptions pile up or designs get awkward, revise or discard it.

## Red flags

- An architecture defined before the domain was understood, now worked around by every team.
- Layers named for technical artifacts ("entities", "helpers", "managers") instead of domain responsibilities.
- More than five layers, or a layer nobody can explain in one sentence.
- Operational objects importing policy or decision-support classes; policy flags living on capability objects.
- Undocumented exceptions everywhere; the structure exists only in one architect's head.
- A metaphor whose implications are steering design even where the domain disagrees.
- Users repurposing free-text fields to encode types or rules (missing knowledge level); or a knowledge level so general that configuring it is programming.
- A pluggable framework built for the first application.

## Related

- `../../../actions/ddd.md` — records the chosen structure, layer assignment and exceptions in `DomainModel.md`.
- `../../../actions/review.md` — checking new code against layer rules.
- `../Distillation/distillation.md` — CORE, generic subdomains, ABSTRACT CORE used by component frameworks.
- `../ModelIntegrity/modelIntegrity.md` — BOUNDED CONTEXTS, SHARED KERNEL, PUBLISHED LANGUAGE.
- `../BringingTheStrategyTogether/bringingTheStrategyTogether.md` — structure across contexts and with distillation.
- `../../BuildingBlocks/IsolatingTheDomain/isolatingTheDomain.md` — technical layered architecture (a different kind of layering).
- `../../DeeperInsight/SuppleDesign/suppleDesign.md` — CONCEPTUAL CONTOURS behind layer boundaries.
- `../../DeeperInsight/AnalysisPatterns/analysisPatterns.md` — origin of the knowledge level idea in analysis patterns.
- `../../DeeperInsight/DesignPatternsInTheModel/designPatternsInTheModel.md` — STRATEGY for policies, COMPOSITE.
- `../../../CleanCode/Systems/systems.md` — system-level separation of concerns (when installed).
- `../../../CleanCode/Classes/classes.md` — dependency direction and cohesion (when installed).
