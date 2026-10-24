---
name: ddd-design-patterns-in-the-model
description: "How to tell when a technical design pattern is also a domain pattern and how to apply it in the domain layer, covering STRATEGY (aka POLICY) for interchangeable business rules or processes, COMPOSITE for true part-whole hierarchies with uniform behavior at every level, why FLYWEIGHT is only an implementation option for VALUE OBJECTS, and the test that a domain pattern must say something about the domain, based on Chapter 12 (Relating Design Patterns to the Model) of Domain-Driven Design. Use when a domain service is full of if/else or switch on a mode, pricing type, ranking criterion or customer tier; adding a new business option means editing a core algorithm; a policy should be configurable or selectable; a hierarchy (bundles of bundles, tasks of tasks, org units, nested budgets) is handled with different code per level; totals require walking several collection types; or someone proposes a GoF pattern (Strategy, Composite, Flyweight, State, Interpreter) in domain code."
---

# Relating Design Patterns to the Model

Some technical design patterns also describe real domain concepts. Use one in the domain layer only when it works on two levels at once: it solves a design problem in the code and it names a concept that domain experts would recognize (a policy, a whole made of parts). If it only solves a technical problem, it belongs to implementation, not to the model.

## The two-level test

Before applying a pattern to domain code, answer both:

1. **Model level:** Is there a domain concept this pattern expresses? Can you say a sentence in the UBIQUITOUS LANGUAGE that uses it ("the scheduler offers slots ranked by the clinic's booking policy")?
2. **Design level:** Does the pattern's known structure and its documented consequences fit here?

If only (2) holds, the pattern is an implementation detail; keep it out of the glossary and out of model diagrams. If only (1) holds, model the concept directly without forcing the pattern's structure. When both hold, you get the concept made explicit plus the accumulated design experience of the pattern (its trade-offs still apply in full).

## STRATEGY (POLICY)

Use when a domain process has several legitimate ways of being done and the choice is getting mixed into the process itself: conditionals on "mode" in every computation, a service with `findCheapest`/`findFastest`/`findSomethingElse` methods, or new options that require editing the core algorithm.

Factor the varying rule into a policy object that the stable process receives. As a domain pattern, the emphasis is not swapping algorithms; it is making a business rule explicit and nameable.

Before: the ranking criterion is scattered.

```ts
class SlotFinder {
  find(request: AppointmentRequest, mode: "earliest" | "sameClinician"): Slot[] {
    return this.openSlots(request).sort((a, b) =>
      mode === "earliest" ? a.start.getTime() - b.start.getTime()
                          : this.continuityScore(request, b) - this.continuityScore(request, a));
    // ...and the same branch again in filtering, paging and fallbacks
  }
}
```

After: the process is unconditional; the rule is a named concept.

```ts
interface SlotRankingPolicy {                 // a domain concept: "booking policy"
  score(slot: Slot, request: AppointmentRequest): number;   // higher is better; side-effect free
}

class EarliestAvailable implements SlotRankingPolicy {
  score(slot: Slot) { return -slot.start.getTime(); }
}

class ContinuityOfCare implements SlotRankingPolicy {
  score(slot: Slot, req: AppointmentRequest) {
    return slot.clinicianId.equals(req.usualClinicianId) ? 1_000 - slot.daysFromNow() : -slot.daysFromNow();
  }
}

class WeightedPolicy implements SlotRankingPolicy {   // new combinations without touching SlotFinder
  constructor(private parts: [SlotRankingPolicy, number][]) {}
  score(s: Slot, r: AppointmentRequest) { return this.parts.reduce((t, [p, w]) => t + w * p.score(s, r), 0); }
}

class SlotFinder {
  find(request: AppointmentRequest, policy: SlotRankingPolicy, limit = 5): Slot[] {
    return this.openSlots(request)
      .map(slot => ({ slot, score: policy.score(slot, request) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.slot);
  }
}
```

The behavior now reads as a domain statement: the finder returns open slots with the highest score under the clinic's chosen policy.

- **Consequences that still apply:** clients must know which policies exist and choose one (a modeling question: who picks, the clinic configuration, the patient, the request type?). Policies multiply objects; make them stateless and share instances if that matters.
- **Where the choice lives:** keep selection out of the policy itself. A clinic setting, a factory, or the application service maps configuration to a policy instance.
- **Testing:** each policy is a pure function, tested alone; the process is tested once with a stub policy.
- **Wrong when:** only one variant exists and no second is in sight (speculative generality), or the "strategies" differ only by a parameter (a rate, a threshold), which is a VALUE OBJECT, not a family of classes.

Python sketch for a rule-style policy:

```python
class LateCancellationPolicy(Protocol):
    def fee(self, appointment: Appointment, cancelled_at: datetime) -> Money: ...

@dataclass(frozen=True)
class FlatFeeWithinWindow:
    window: timedelta
    fee_amount: Money
    def fee(self, appointment, cancelled_at):
        return self.fee_amount if appointment.start - cancelled_at < self.window else Money.zero()
```

## COMPOSITE

Use when an important object is made of parts that are made of parts, at varying depth, and the levels are conceptually the same kind of thing. Symptoms without it: each level has its own class and its own copy of common behavior, containers cannot hold containers of their own level, and any total requires recursion through several collection types.

First ask the model question: is this a true whole-part hierarchy where every node is the same conceptual type? A work breakdown in a project plan qualifies: a phase, a deliverable and a single task are all "work" with an estimate, a cost and a completion state.

```ts
abstract class WorkItem {
  constructor(readonly id: WorkItemId, readonly title: string) {}
  abstract estimate(): Hours;
  abstract cost(rates: RateCard): Money;
  abstract percentComplete(): number;
  abstract tasks(): readonly Task[];          // the operational traversal clients care about
}

class Task extends WorkItem {                 // leaf: answers from its own values
  constructor(id: WorkItemId, title: string, private hours: Hours, private role: Role, private done: boolean) { super(id, title); }
  estimate() { return this.hours; }
  cost(rates: RateCard) { return rates.for(this.role).times(this.hours.value); }
  percentComplete() { return this.done ? 100 : 0; }
  tasks() { return [this]; }
}

class WorkPackage extends WorkItem {          // composite: aggregates its children
  private readonly children: WorkItem[] = [];
  add(item: WorkItem) { if (item === this) throw new Error("cycle"); this.children.push(item); }
  estimate() { return this.children.reduce((s, c) => s.plus(c.estimate()), Hours.zero()); }
  cost(rates: RateCard) { return this.children.reduce((s, c) => s.plus(c.cost(rates)), Money.zero()); }
  percentComplete() {
    const total = this.estimate().value;
    return total === 0 ? 0 : this.children.reduce((s, c) => s + c.percentComplete() * c.estimate().value, 0) / total;
  }
  tasks() { return this.children.flatMap(c => c.tasks()); }
}
```

- The power is in the operational symmetry: the same meaningful questions (estimate, cost, progress, tasks) can be asked of any node, large or small. Designers often build the tree structure and stop there; flesh out the behavior at every level.
- A class diagram of a COMPOSITE says less about how real instances assemble (a plan always has phases, phases contain deliverables). Convey assembly rules through FACTORIES, instance diagrams, tests and examples.
- Leaves may still differ (a purchased item vs a staffed task); subclass leaves for genuine domain differences only.
- **Aggregate boundaries:** a deep composite inside one AGGREGATE can become large. If parts change independently or by different people, hold child references by identity and compute roll-ups in a query or read model.
- **Wrong when:** the levels are conceptually distinct and experts treat them differently (an organization vs a person vs a role), or the hierarchy is fixed at two levels and uniform treatment buys nothing. Apply COMPOSITE when a need appears, not in anticipation.

## FLYWEIGHT and other implementation-only patterns

FLYWEIGHT (sharing instances of a small set of heavily repeated values) is a valid optimization for immutable VALUE OBJECTS, such as shared `Currency` or `UnitOfMeasure` instances, and never for ENTITIES. It says nothing about the domain, so it is not a domain pattern: keep it inside the value object's factory and out of the model record.

Other GoF patterns can qualify when they pass the two-level test: STATE for a lifecycle experts describe as stages with different allowed actions, SPECIFICATION (built on interpreter-like composition) for business predicates, OBSERVER only when the notification itself is a domain event. There is no fixed list; the test is whether the pattern says something about the domain.

Current note: a Domain Event (for example `WorkItemCompleted`) is now usually preferred over raw OBSERVER wiring in the domain layer, because the event is a named concept in the language.

## Workflow

1. When code smells suggest a pattern (scattered mode conditionals, per-level duplication), state the domain concept first in one sentence of the ubiquitous language.
2. Confirm with a domain expert that the concept is real (they talk about "booking policies" or "work packages").
3. Apply the pattern's structure; read its documented consequences and decide each one consciously (who selects the policy, stateless sharing, aggregate size).
4. Name the classes with domain terms (`ContinuityOfCare`, not `ConcreteStrategyB`); add the concept to the glossary.
5. Test policies as pure functions and composites by asking the same question at leaf and root levels.
6. Record in `DomainModel.md` which patterns are domain patterns and which are implementation choices.

## Red flags

- A service method per variant (`findCheapest`, `findFastest`) or a mode flag tested in several places.
- Pattern names leaking into domain names (`PricingStrategyImpl`, `NodeComposite`).
- A COMPOSITE over things experts consider different kinds, forcing meaningless methods on some nodes.
- Building the tree structure but leaving totals and traversals in callers.
- Strategy classes that differ only by a constant.
- Applying a pattern because it might be needed later.
- Implementation-only patterns (FLYWEIGHT, caching proxies) appearing in model diagrams or the glossary.

## Related

- `../../../actions/ddd.md` — records domain patterns in `DomainModel.md` and the glossary.
- `../../../actions/dev.md` — implementing policies and composites.
- `../../../actions/review.md` — checking that patterns in domain code carry domain meaning.
- `../SuppleDesign/suppleDesign.md` — side-effect-free functions and closure of operations used by policies and composites.
- `../ImplicitConcepts/implicitConcepts.md` — SPECIFICATION and making policies explicit.
- `../AnalysisPatterns/analysisPatterns.md` — higher-level domain patterns.
- `../BringingThePiecesTogether/bringingThePiecesTogether.md` — using design patterns as prior art.
- `../../BuildingBlocks/ModelInSoftware/modelInSoftware.md` — VALUE OBJECTS and where FLYWEIGHT may apply.
- `../../BuildingBlocks/DomainObjectLifecycle/domainObjectLifecycle.md` — aggregate size and factories for composites.
- `../../../TDD/Patterns/DesignPatterns/designPatterns.md` — technical design patterns in TDD (when installed).
- `../../../CleanCode/Classes/classes.md` — open-closed and single responsibility behind STRATEGY (when installed).
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — polymorphism vs switch statements (when installed).
