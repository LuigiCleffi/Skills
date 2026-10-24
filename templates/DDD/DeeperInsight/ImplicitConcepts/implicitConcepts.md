---
name: ddd-implicit-concepts
description: "Finding concepts that are hinted at but missing from the model and making them explicit objects: listening to the language of domain experts, scrutinizing awkward code, contemplating contradictions between experts, reading the domain literature, trying again after false starts, and modeling less obvious categories of concepts (explicit constraints, processes as domain objects or STRATEGY, and the SPECIFICATION pattern for validation, selection via REPOSITORY queries, and building to order), based on Chapter 9 (Making Implicit Concepts Explicit) of Domain-Driven Design. Use when experts use a term that appears nowhere in the code, a report or script assembles data the model never names, a calculator or service class keeps growing special cases, boolean methods like isEligible or isOverdue swell with rules and dependencies, business rules leak into controllers, batch scripts or SQL, the same rule is written differently for validation, querying and creation, two experts give contradictory statements, or someone asks how to discover missing domain concepts, model a business rule, implement the specification pattern, or combine a specification with a repository or ORM query."
---

# Making Implicit Concepts Explicit

Deep models grow by noticing a concept the domain relies on but the code only implies (scattered fields, a report, a tangle of conditionals) and giving it a name and a home in the model. Hunt for these in expert vocabulary, awkward code, contradictions and the field's literature; express not only things but also constraints, processes and rules (SPECIFICATION) as explicit model elements in the domain layer.

## Listen to language

- Signals: experts use a short term for something complicated; they gently correct your wording; their confusion lifts when a particular phrase is used; both developers and experts say a word that is not in the code (a double warning).
- A new word is a lead to follow in conversation, not an automatic class ("nouns are objects" is not the rule).
- Look for data that is assembled for a report, an export or an email but never modeled. That is often a concept the business already treats as a unit.

Example (food delivery): dispatchers keep saying "the courier's run", meaning the ordered set of pickups and drop-offs assigned to one courier for one trip. The code had `order.courierId`, `order.pickupSequence` and a SQL view used only by the dispatcher screen.

```ts
// Before: the run exists only as a query and a few loose fields.
const stops = await db.query(
  "SELECT * FROM orders WHERE courier_id = $1 ORDER BY pickup_sequence", [courierId]);

// After: Run is explicit; routing returns one; dispatch and the customer ETA both use it.
class Run {
  private constructor(readonly id: RunId, readonly courier: CourierId, private stops: Stop[]) {}
  static plan(courier: CourierId, stops: Stop[]): Run {
    if (!stops.length) throw new DomainError("A run needs at least one stop");
    return new Run(RunId.next(), courier, stops);
  }
  etaFor(order: OrderId): Date { /* derived from stop sequence and travel estimates */ }
}

interface RoutePlanner { planRun(courier: CourierId, orders: Order[]): Run; } // not "write rows to a table"
```

Gains: the planner's interface speaks the domain, it no longer knows the table layout, ETA logic moves out of the screen into the domain layer, and "run" joins the glossary.

## Scrutinize awkwardness

- Dig where the design hurts: procedures hard to explain, a class that every new requirement makes bigger, a calculation full of "special cases" that experts say are normal.
- If experts enjoy modeling, explore with them; if not, brainstorm with other developers and use the expert as a validator, watching for recognition or discomfort.

Example (health insurance claims): `ClaimCalculator` handled deductibles, co-pays and annual caps with flags and running totals per claim. Asking "what do you call the amount the member has paid toward the deductible this year?" produced "accumulator". Making `BenefitAccumulator` explicit (per member, per plan year, per benefit kind) split the logic: each claim line applies against accumulators; the calculator shrank to a sequence of `accumulator.apply(line)` calls, and family vs individual deductibles became two accumulator instances instead of branches.

## Contemplate contradictions

- When two experts (or one expert on two days) give facts that cannot both be true, ask what model would make both true.
- Example: "a patient has one primary physician" versus "patients see whoever is on duty". Both hold once you separate `CareTeamAssignment` (a standing relationship) from `Encounter` (a single visit with a treating clinician).
- Not every contradiction must be resolved inside one model; some indicate separate BOUNDED CONTEXTS. Thinking it through is still informative.

## Read the book

- Many fields (accounting, inventory costing, actuarial science, logistics, scheduling) have books that lay out well-defined concepts. Read them to get a coherent starting vocabulary and better questions for your experts.
- Example: an inventory team stuck on "average cost" bugs found FIFO cost layers in an introductory cost-accounting text; `CostLayer` became an explicit VALUE OBJECT consumed on each issue.
- Published analysis patterns are another source of starting points (see Related).

## Try, try again

- Expect several leads before one is worth modeling, and expect to replace it later. Do not get attached to your own ideas.
- Each change of direction still embeds insight and leaves the design easier to bend next time. Quick experiments beat long attempts to get it right first.

Current note: Event Storming is a common way to surface implicit concepts quickly: unnamed things between events, "hot spot" stickies for confusion and disagreement, and phrases like "when X happens" that point to DOMAIN EVENTS worth making explicit.

## Explicit constraints

- A simple invariant can live in the operation, but give it a named method so the rule is visible and has room to grow.
- Factor the constraint into its own object when: evaluating it needs data that does not belong to the host; similar rules appear in unrelated objects; conversations focus on the rule while the code hides it in conditionals.

```ts
class Course {
  enroll(student: Student, policy: EnrollmentPolicy): void {
    const verdict = policy.check(this, student);
    if (!verdict.allowed) throw new EnrollmentRefused(verdict.reason);
    this.roster.push(student.id);
  }
}

class EnrollmentPolicy {                // the rule is a named, testable domain object
  constructor(private readonly waitlistMargin: number) {}
  check(course: Course, student: Student): Verdict {
    if (!student.hasPassed(course.prerequisites)) return Verdict.refuse("prerequisites missing");
    if (course.enrolledCount() >= course.capacity + this.waitlistMargin) return Verdict.refuse("course full");
    return Verdict.allow();
  }
}
```

## Processes as domain objects

- Do not make procedures prominent in general, but a process the business itself performs belongs in the model: as a domain SERVICE when there is one way, or as interchangeable STRATEGY objects when there are several.
- Test: do domain experts talk about this process (refund calculation, dispatch, underwriting), or is it just program mechanism (retry loop, pagination)? Only the former is modeled.

```ts
interface RefundPolicy { refundFor(booking: Booking, cancelledAt: Date): Money; }
class FlexibleRefund implements RefundPolicy { /* full refund until 24h before */ }
class StrictRefund implements RefundPolicy { /* 50% until 7 days before, then nothing */ }
```

## SPECIFICATION

When a boolean rule outgrows a test method on its object (dependencies on other aggregates, policy settings, dates), do not move it to the application layer, which leaves an anemic object. Create a predicate-like VALUE OBJECT that states the criteria and can tell whether a candidate satisfies them.

```ts
interface Specification<T> { isSatisfiedBy(candidate: T): boolean; }

class LapsedMembership implements Specification<Membership> {
  constructor(private readonly asOf: LocalDate, private readonly graceDays: number) {}
  isSatisfiedBy(m: Membership): boolean {
    return m.paidThrough.plusDays(this.graceDays).isBefore(this.asOf) && !m.isFrozen();
  }
}
```

A FACTORY can configure it from policy data (grace days per membership tier), so `Membership` does not depend on the policy store. One rule, three uses:

**Validation.** `if (lapsed.isSatisfiedBy(m)) blockCheckIn(m)`.

**Selection.** Reuse the same concept to find candidates. In memory: `repo.selectSatisfying(spec)` filters. With a database, keep the rule's meaning in the specification and the SQL in infrastructure:

```ts
interface MembershipRepository {
  paidThroughBefore(date: LocalDate): Promise<Membership[]>;   // generic query, not a rule
  selectSatisfying(spec: LapsedMembership): Promise<Membership[]>;
}

// In the specification: narrow with a generic query, then apply the exact rule in memory.
async satisfyingElementsFrom(repo: MembershipRepository): Promise<Membership[]> {
  const candidates = await repo.paidThroughBefore(this.asOf.minusDays(this.graceDays));
  return candidates.filter((m) => this.isSatisfiedBy(m));
}
```

- Trade-off: putting SQL in the specification keeps the rule in one place but leaks table structure into the domain; a fully specialized repository query is fastest but moves the rule; the narrow-then-filter split is a middle ground. Pick per performance need and record the choice.
- If the ORM can translate model-level criteria into SQL, let the specification build those criteria and the infrastructure generate the query.

**Building to order.** A generator's interface takes a specification describing the result instead of exposing procedures. The implementation is decoupled, clients know what to expect, and the same spec validates the output in tests.

```ts
interface RosterGenerator {
  /** Postcondition: every shift in the result satisfies `coverage`; throws NoRosterFound otherwise. */
  generate(week: Week, staff: Nurse[], coverage: Specification<Shift>): Roster;
}
```

Start with validation (it forces the rules into code and gives you a test oracle), then write a simple greedy prototype that satisfies the contract so the rest of the system can integrate; a specialist can replace the solver later without touching the model.

## Workflow

1. Collect leads: unfamiliar expert terms, report-only data, growing classes, contradictions, relevant literature. Note them in `DomainModel.md` as open questions.
2. For each lead, sketch a candidate concept and walk two or three real scenarios through it with an expert.
3. If it clarifies the scenarios, add the term to the glossary and decide its building block (ENTITY, VALUE OBJECT, SERVICE, STRATEGY, SPECIFICATION, policy object).
4. Refactor under tests: introduce the concept, move logic from scripts, controllers and SQL into it, delete the duplicated fragments.
5. For rules: name them; factor to a policy or SPECIFICATION when they distort their host; reuse one specification for validation, selection and generation.
6. Revisit after the next requirement; replace the concept if a better one appears.

## Red flags

- Expert vocabulary absent from code; code vocabulary experts do not recognize.
- Reports, exports or batch scripts holding domain logic the model lacks.
- `isX()` methods with many dependencies, or rules moved to services in the application layer "to keep the entity clean".
- The same eligibility rule written separately in a validator, a SQL query and a generator.
- Constraints buried in setters or controllers instead of named methods or policy objects.
- Modeling program mechanics (retry, paging) as domain processes.
- A full predicate-logic framework built before any concrete rule needs it.

## Related

- `../Breakthrough/breakthrough.md` — how explicit concepts set up a breakthrough.
- `../SuppleDesign/suppleDesign.md` — combining SPECIFICATIONS with and/or/not and subsumption.
- `../AnalysisPatterns/analysisPatterns.md` — published models as reading material.
- `../DesignPatternsInTheModel/designPatternsInTheModel.md` — STRATEGY and COMPOSITE in the domain.
- `../../ModelInPractice/CrunchingKnowledge/crunchingKnowledge.md` — conversations that surface leads.
- `../../ModelInPractice/UbiquitousLanguage/ubiquitousLanguage.md` — growing the glossary.
- `../../BuildingBlocks/ModelInSoftware/modelInSoftware.md` — choosing ENTITY, VALUE OBJECT or SERVICE.
- `../../BuildingBlocks/DomainObjectLifecycle/domainObjectLifecycle.md` — REPOSITORIES and FACTORIES used with specifications.
- `../../StrategicDesign/ModelIntegrity/modelIntegrity.md` — contradictions that signal separate contexts.
- `../../../actions/ddd.md` — recording concepts and glossary entries.
- `../../../actions/bdd.md` — scenarios in the new vocabulary.
- `../../../actions/dev.md` — implementing the refactoring.
- `../../../CleanCode/MeaningfulNames/namesThatRevealTheirPurpose.md` — naming the new concepts (when installed).
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — avoiding anemic data holders (when installed).
- `../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — query languages behind specification-based selection (when installed).
