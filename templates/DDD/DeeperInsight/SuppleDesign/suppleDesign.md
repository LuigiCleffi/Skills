---
name: ddd-supple-design
description: "Shaping domain code so it is safe to use, combine and change: INTENTION-REVEALING INTERFACES, SIDE-EFFECT-FREE FUNCTIONS with command-query separation and logic moved into VALUE OBJECTS, ASSERTIONS (pre/postconditions, class and AGGREGATE invariants as tests), CONCEPTUAL CONTOURS and WHOLE VALUE granularity, STANDALONE CLASSES, CLOSURE OF OPERATIONS, declarative design and its pitfalls (frameworks, code generation, domain-specific languages), declarative style, SPECIFICATION combinators (and/or/not via COMPOSITE) and subsumption, carving off subdomains and drawing on established formalisms such as specialized math, plus an end-to-end example integrating the patterns, based on Chapter 10 (Supple Design) of Domain-Driven Design. Use when callers must read an implementation to use it, method names describe mechanics instead of intent, a method both computes and mutates, results change depending on call order, an entity method has surprising effects on its arguments, every requirement forces wide changes, a calculation class drags many dependencies, operations return primitives or maps instead of domain values, eligibility rules need and/or/not combinations, someone asks whether a new policy is stricter than the old one, or the user mentions supple design, CQS, immutability, design by contract, invariants, value object operations, fluent domain APIs or composite specifications."
---

# Supple Design

A supple design serves two developers: the client developer who combines domain objects to express new scenarios, and the developer who changes them later. Make the code say what it does in the UBIQUITOUS LANGUAGE (intention-revealing names), make its effects predictable (side-effect-free functions on VALUE OBJECTS, assertions for the remaining commands), and cut it along the domain's natural seams (conceptual contours, standalone classes, closed operations) so that elements combine into a declarative style.

Simple is not easy. Supple design is the target for the most intricate, most changed parts of the core, not a uniform polish for every class, and not license for speculative layers of abstraction.

## Intention-revealing interfaces

- If a developer must read the implementation to use an object, encapsulation has failed, and a reader may infer a purpose the code only fulfills by accident.
- Name types, methods and parameters for effect and purpose, never for mechanism; use glossary terms. State rules and outcomes, not the algorithm.
- Design the interface from the client side by writing the test first, in the language you wish you could use.

```ts
// Before: mechanism and magic numbers
scheduler.process(practitioner, date, 2);
// After: the call states the domain action and the outcome
const slot = practitioner.offerEarliestSlot(onOrAfter(date), forVisit(VisitType.FollowUp));
```

## Side-effect-free functions

- Separate commands (change observable state, return no domain data) from queries (return results, change nothing). Keep commands tiny.
- Move complex calculation into VALUE OBJECTS that return new values. Values can be created, passed around and discarded; entity lifecycles cannot.
- Functions compose and nest without surprises and are trivial to test; that is what lets a developer combine rules without tracing execution.

```ts
class Practitioner {                                  // ENTITY: only a simple command mutates
  private booked = TimeWindowSet.empty();
  book(window: TimeWindow): void {
    if (!this.freeWithin(window.day()).covers(window)) throw new SlotUnavailable(window);
    this.booked = this.booked.union(TimeWindowSet.of(window));
  }
  freeWithin(day: DateRange): TimeWindowSet {         // query: pure, delegates to values
    return this.workingHours.within(day).minus(this.booked);
  }
}
```

Current note: method-level command-query separation is not CQRS; separate read and write models (and event sourcing) are optional architecture choices, not part of supple design itself.

## Assertions

- For each remaining command, state postconditions (what is guaranteed afterwards), preconditions (what must hold to get the guarantee) and class or AGGREGATE invariants (what is true after any operation).
- Assertions describe state, not procedure, so clients can trust them instead of tracing delegation. Polymorphic implementations must honor the same assertions.
- Without language support, encode them as unit tests (arrange the precondition, act, assert the postcondition) and as guard clauses for invariants.

```ts
it("waitlist promotion moves the first patient into the freed slot", () => {
  const list = Waitlist.of([ana, bruno]);               // precondition: non-empty list
  const { appointment, remaining } = list.promotedInto(freedSlot); // function: returns new values
  expect(appointment.patient).toEqual(ana);             // postcondition
  expect(remaining.patients()).toEqual([bruno]);        // postcondition
  expect(list.patients()).toEqual([ana, bruno]);        // the original value is untouched
  expect(remaining.patients()).not.toContain(appointment.patient); // invariant: never waiting and booked
});
```

If an honest postcondition sounds strange ("the argument is left unchanged but counted", "total may exceed capacity"), suspect a missing concept and look for a model whose assertions make common sense, rather than documenting the oddity.

## Conceptual contours

- Neither "make everything tiny" nor "lump it all" works. Decompose operations, classes and AGGREGATES into units that each are one complete domain concept (a WHOLE VALUE); do not split a meaningful operation into steps, and do not expose detail nobody in the domain manipulates.
- Watch the axes of change across refactorings. When new requirements land in one place, the design follows a contour. When a requirement forces broad reshuffling, the model needs deeper insight.

Example: availability rules modeled as `AvailabilityRule.windowsWithin(range): TimeWindowSet` with `WeeklyHours`, `OneOffClosure`, `OnCallRotation`. Adding `PublicHolidayCalendar` later was one new class; nothing else changed.

## Standalone classes

- Every association, argument type and return type is a dependency, and implicit concepts (four loose ints that really mean a color, a range or money) count too.
- Aim to factor the most intricate computations into classes that depend only on language primitives and basics: understandable and testable alone.
- Dependencies inside a MODULE are cheaper than across modules; remove the nonessential ones, keep the meaningful ones. Do not reduce everything to primitives.

`TimeWindow` and `TimeWindowSet` depend only on instants; `Practitioner` depends on them, never the reverse.

## Closure of operations

Where it fits, make an operation's arguments and result the same type as the receiver. It adds no new concepts and makes chaining natural. Mostly a VALUE OBJECT technique; ENTITIES rarely result from computation. Half-closed operations (one extra primitive argument) give most of the benefit.

```ts
class TimeWindowSet {
  static empty(): TimeWindowSet { return new TimeWindowSet([]); }
  static of(...ws: TimeWindow[]): TimeWindowSet { return new TimeWindowSet(normalize(ws)); }
  private constructor(private readonly windows: readonly TimeWindow[]) {}
  union(o: TimeWindowSet): TimeWindowSet     { return TimeWindowSet.of(...this.windows, ...o.windows); }
  intersect(o: TimeWindowSet): TimeWindowSet { /* pairwise overlaps */ }
  minus(o: TimeWindowSet): TimeWindowSet     { /* subtract each window */ }
  slots(length: Minutes): TimeWindow[]       { /* half-closed: returns windows of the given length */ }
  covers(w: TimeWindow): boolean             { return this.windows.some((x) => x.contains(w)); }
  equals(o: TimeWindowSet): boolean          { /* value equality on normalized windows */ }
}
```

## Declarative design and declarative style

- Declarative design means part of the program is an executable specification: rules, mappings or a domain-specific language that actually drives behavior, by reflection or code generation.
- Pitfalls: declaration languages too weak for real needs inside frameworks that are hard to extend; generated code mixed with handwritten code so regeneration destroys work; teams bypassing the framework and corrupting its guarantees; rule engines with control rules whose order changes results.
- Best value: narrow frameworks that automate tedious, error-prone mechanics (persistence mapping, validation, serialization) and leave the model free.
- A domain-specific language gives the strongest link to the UBIQUITOUS LANGUAGE but costs refactoring tools and splits the team into language builders and users; consider it for mature, stable models. Internal DSLs (fluent APIs in the host language) avoid much of that cost.
- Once you have intention-revealing interfaces, side-effect-free functions and assertions, client code can already be written in a declarative style without any framework.

## SPECIFICATION combinators

Predicates are closed under and, or and not, so combined specifications show CLOSURE OF OPERATIONS. A simple COMPOSITE implementation:

```ts
abstract class Spec<T> {
  abstract isSatisfiedBy(c: T): boolean;
  and(o: Spec<T>): Spec<T> { return new AndSpec(this, o); }
  or(o: Spec<T>): Spec<T>  { return new OrSpec(this, o); }
  not(): Spec<T>           { return new NotSpec(this); }
}
class AndSpec<T> extends Spec<T> {
  constructor(private a: Spec<T>, private b: Spec<T>) { super(); }
  isSatisfiedBy(c: T) { return this.a.isSatisfiedBy(c) && this.b.isSatisfiedBy(c); }
}
// OrSpec and NotSpec follow the same shape.

const eligible = speaks("pt").and(acceptsPlan(plan)).and(onLeave().not());
const matches = practitioners.filter((p) => eligible.isSatisfiedBy(p));
```

- Implement only what you use; "and" is the most common and the cheapest. Adding operators later is easy if the concept stays clean.
- If many tiny objects hurt (memory, persistence) or the spec must become a database query, represent it as data (an expression tree or array interpreted at runtime, or translated by the repository into a query) while keeping the same model.

## Subsumption

- Spec A subsumes spec B when anything satisfying A also satisfies B (A implies B): a stricter rule. Useful for "which policies got stricter after the regulation change?" independently of current data.
- General implication is hard; special cases are easy. Parameterized specs compare parameters; and-only composites compare sets of leaf specs. Supporting or/not plus subsumption gets hard fast; choose one unless the value is clear.

```ts
class MinimumNotice extends Spec<Booking> {
  constructor(readonly hours: number) { super(); }
  isSatisfiedBy(b: Booking) { return b.hoursBeforeStart() >= this.hours; }
  subsumes(o: MinimumNotice) { return this.hours >= o.hours; }
}
// And-only: a.subsumes(b) when every leaf of b is among the leaves of a.
```

## Carve off subdomains and use formalisms

- Do not try to make the whole system supple at once. Pull out a cohesive piece (scheduling math, unit conversion, pricing rules) into its own module; what remains shrinks and reads declaratively in terms of it.
- Borrow established formalisms: accounting, interval or set algebra, graph theory, probability. Specialized math is clean, combinable and easy for experts to accept.

## Example: integrating the patterns (availability math)

1. Start: `Clinic.findOpenSlots(practitionerId, week)` loops over hours, checks bookings, closures and room usage, and caches "taken" flags on the practitioner while computing. Naming is fine; behavior is not predictable.
2. Separate command from query: `openSlots()` becomes pure; caching and booking move to a separate tiny command.
3. Make the implicit concept explicit: every step manipulates sets of time windows. Introduce `TimeWindowSet`, first as a helper, then as an immutable VALUE OBJECT.
4. Close the operations: `union`, `intersect`, `minus` return `TimeWindowSet`. Add assertions as tests: `a.minus(a)` is empty; `a.union(b).covers(w)` when either covers `w`; operations never mutate operands.
5. Client code becomes declarative and analytics come for free (the same functions answer "how much capacity is unused next month?" without side effects):

```ts
const open = practitioner.workingHours.within(week)
  .minus(practitioner.bookings(week))
  .minus(clinic.closures(week))
  .intersect(room.availability(week));
return open.slots(visit.length);
```

## Workflow

1. Pick the most intricate, most changed area of the core; do not polish everything.
2. Rename public elements to intention-revealing glossary terms; write client-style tests first.
3. Split mixed compute-and-mutate operations; move calculations into immutable VALUE OBJECTS.
4. Write postconditions and invariants as tests and guard clauses; treat odd assertions as a modeling signal.
5. Look for conceptual contours: one complete concept per element; note where changes land over time.
6. Cut dependencies of the hardest computations until they are standalone; prefer closed operations on values.
7. Introduce combinable SPECIFICATIONS where rules combine; add subsumption only for a real need.
8. Record new value types and operations in `DomainModel.md` and the glossary.

## Red flags

- Names like `process`, `handle`, `doCalc`, `data`, or flags that select behavior.
- A method that returns a result and also changes state; a query whose answer depends on call order.
- Entities mutating their arguments; postconditions that only make sense after reading the code.
- Domain operations returning maps, tuples or raw numbers where a domain value exists.
- One requirement forcing changes across many classes; or classes split so fine that clients must assemble them.
- A core calculation class importing repositories, HTTP clients or clocks.
- Heavy rule engines, code generators or external DSLs adopted for a model still in flux.
- Speculative flexibility layers with no domain contour behind them.

## Related

- `../ImplicitConcepts/implicitConcepts.md` — finding the concepts supple design then shapes; basic SPECIFICATION.
- `../Breakthrough/breakthrough.md` — how supple code enables deep-model refactoring.
- `../DesignPatternsInTheModel/designPatternsInTheModel.md` — COMPOSITE and STRATEGY in the domain.
- `../AnalysisPatterns/analysisPatterns.md` — established models to borrow.
- `../../BuildingBlocks/ModelInSoftware/modelInSoftware.md` — VALUE OBJECTS and ENTITIES.
- `../../BuildingBlocks/DomainObjectLifecycle/domainObjectLifecycle.md` — AGGREGATE invariants.
- `../../StrategicDesign/Distillation/distillation.md` — COHESIVE MECHANISMS and GENERIC SUBDOMAINS.
- `../../../actions/ddd.md` — recording value types and operations.
- `../../../actions/dev.md` — implementing the design.
- `../../../actions/tdd.md` — tests as assertions and client-first interfaces.
- `../../../actions/review.md` — checking names, side effects and dependencies.
- `../../../CleanCode/Functions/functions.md` — command-query separation, no side effects (when installed).
- `../../../CleanCode/Classes/classes.md` — cohesion and dependencies (when installed).
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — avoiding speculative generality (when installed).
- `../../../TDD/Patterns/DesignPatterns/designPatterns.md` — Value Object and Composite (when installed).
