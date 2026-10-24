---
name: ddd-domain-object-lifecycle
description: "How to manage domain objects from creation to deletion with AGGREGATE (root, boundary, invariants enforced per transaction, local vs global identity, references only to roots), FACTORY (factory method on the root, standalone factory, creation vs reconstitution, where invariant logic goes, when a plain constructor is enough) and REPOSITORY (collection-like interface for aggregate roots, hard-coded vs specification queries, transaction control left to the client, in-memory fakes, relationship to factories, no find-or-create), plus designing relational schemas as object stores, based on Chapter 6 (The Lifecycle of a Domain Object) of Domain-Driven Design. Use when drawing aggregate boundaries, an invariant breaks under concurrent edits, choosing what to lock or version, deciding what to cascade on delete, a transaction touches many aggregates, constructors take ten arguments or clients assemble object graphs, mapping rows or JSON back into objects, designing a repository interface, an ORM or DAO leaks into domain code, services run raw SQL, a findAll loads the whole table, deciding between getOrCreate and explicit create, or the user mentions aggregate root, consistency boundary, optimistic locking, factory, builder, repository, DAO, unit of work, reconstitution, or ORM mapping."
---

# The Lifecycle of a Domain Object

Draw an AGGREGATE boundary around each cluster of objects whose rules must hold together after every change, let only its root be referenced from outside, and make that unit what you create, load, save, lock and delete. Create aggregates through FACTORIES when assembly is non-trivial, and obtain existing roots only through REPOSITORIES that look like in-memory collections. Everything else is reached by traversal from a root.

## AGGREGATE

Interconnected models give no natural limit to what a change affects, what a delete removes, or what a transaction must lock. Lock too little and invariants break silently under concurrency; lock too much and users block each other. The fix is a model decision: an explicit consistency boundary.

Rules:
- One ENTITY is the root, with global identity. It is responsible for checking all invariants of the aggregate.
- Inner entities have local identity, unique only within the aggregate.
- Outside objects may hold references only to the root. The root may hand out an inner object for transient use within one operation, or copies of values.
- Only roots are loaded directly from storage; inner objects are reached through the root.
- Inner objects may reference other aggregate roots.
- Deleting the root deletes everything inside the boundary.
- When any change inside the boundary commits, every invariant of the whole aggregate holds. Rules that span aggregates are allowed to lag and are reconciled later (events, scheduled jobs).

Example: a training `Cohort` holds `Enrollment`s with the invariants "enrollments never exceed capacity" and "a learner enrolls at most once". Learners and course catalog prices live outside: many cohorts use them, they change on their own schedule, and pulling them in would create contention. The enrollment copies the price at booking time, so a catalog price change does not retroactively break existing cohorts; a separate process can flag cohorts priced under an outdated catalog.

```ts
class Cohort {                                   // AGGREGATE ROOT
  private readonly enrollments: Enrollment[] = [];
  private version = 0;                           // optimistic lock for the whole aggregate

  constructor(readonly id: CohortId, readonly courseId: CourseId, private capacity: number) {}

  enroll(learner: LearnerId, price: Money): void {   // only way to add an Enrollment
    if (this.enrollments.length >= this.capacity) throw new CohortFull(this.id);
    if (this.enrollments.some(e => e.learner.equals(learner))) throw new AlreadyEnrolled(learner);
    this.enrollments.push(new Enrollment(this.nextSeatNo(), learner, price)); // local identity
  }

  reduceCapacity(newCapacity: number): void {
    if (newCapacity < this.enrollments.length) throw new CapacityBelowEnrollments();
    this.capacity = newCapacity;
  }

  seats(): readonly EnrollmentView[] { return this.enrollments.map(e => e.view()); } // copies out
  private nextSeatNo(): number { return this.enrollments.length + 1; }
}
```

Choosing boundaries: put inside what must be consistent at commit and is created/deleted together; keep outside what is shared, contended, or changes independently. Lock or version the root so a change anywhere inside conflicts with any concurrent change to the same aggregate.

Current note: Vaughn Vernon's widely used rules refine this pattern: design small aggregates, reference other aggregates by identity (`LearnerId`, not a `Learner` object), modify one aggregate per transaction, and use eventual consistency (often via domain events, a building block added after the book) between aggregates.

How to tell it's wrong: one aggregate loads half the database; two users editing different parts of one large aggregate constantly conflict; code fetches inner objects with their own queries and edits them; an invariant is checked in a service that reads several aggregates without any locking.

## FACTORY

Complex assembly is a responsibility of the domain layer but not of the object being assembled, and pushing it onto clients couples them to internals and concrete classes. A FACTORY encapsulates creation and hands back a product that satisfies every invariant.

Requirements:
- Each creation operation is atomic: everything needed is passed in one call, and it either returns a valid object or fails (pick one convention, e.g. throw a domain error).
- Return the abstract type when concrete subclasses vary.

Where to put it:

| Situation | Site |
|---|---|
| Adding an element inside an existing aggregate | Factory method on the root (`cohort.enroll(...)`) |
| One object's data and rules dominate creating another, separate aggregate | Factory method on that object (`account.openSubscription(plan)` returns a new `Subscription` root) |
| No natural host, or hierarchy to hide | Standalone factory or domain service |
| Simple class, no polymorphism, all arguments available, trivial construction | Public constructor; still atomic and invariant-safe |

```ts
class RentalAgreementFactory {
  constructor(private readonly ids: AgreementNumberSequence) {}
  create(customer: CustomerId, items: RentalLine[], period: RentalPeriod): RentalAgreement {
    if (items.length === 0) throw new EmptyAgreement();
    return RentalAgreement.draft(this.ids.next(), customer, items, period); // system-assigned identity
  }
  reconstitute(row: AgreementRow, lines: LineRow[]): RentalAgreement {
    return RentalAgreement.restore(new AgreementNumber(row.number), /* ... */); // keeps stored identity
  }
}
```

- Entity factories take the minimum needed for a valid aggregate; value factories take the complete description.
- Assigning generated identity is a natural factory job (it knows what to ask the sequence or UUID generator for); externally supplied IDs come in as arguments.
- Invariant logic normally lives in the product; a factory may hold rules that only matter at creation (identity format, immutable values).
- Choose parameters from lower layers or closely related model objects, and depend on their abstract types, to avoid a dependency tangle.
- **Reconstitution** differs from creation: it never issues a new ID, and if stored data violates an invariant it cannot just refuse; it needs a repair or quarantine strategy (log, flag for review, load in a restricted state).

## REPOSITORY

To use an existing object you must create it, traverse to it, or search for it. Raw queries in clients bypass aggregates, move rules into SQL and turn entities into data bags. A REPOSITORY lets clients treat every stored root of one type as if it sat in a simple collection, hiding how it is loaded and saved.

- Only for aggregate roots that need direct access; never for inner objects, rarely for values (saved itineraries or fixed enumerations are the exceptions; needing one often means an unrecognized entity).
- Methods: add/remove, find by identity, intention-revealing criteria queries, and summary queries (counts, totals) the model calls for.
- Interface in the domain layer, in domain terms; implementation in infrastructure.
- Leave transaction control to the client (application service or unit of work); the repository does not commit.
- Delegate reconstitution to a factory or mapper; the repository finds old objects, the factory makes new ones. The client adds a new object to the repository explicitly.
- Avoid find-or-create: whether an object is new is usually meaningful in the domain.

```ts
interface CohortRepository {                     // domain layer
  byId(id: CohortId): Promise<Cohort | undefined>;
  openForCourse(course: CourseId, from: LocalDate): Promise<Cohort[]>;
  countWithWaitlist(course: CourseId): Promise<number>;
  add(cohort: Cohort): Promise<void>;
  save(cohort: Cohort): Promise<void>;           // throws ConcurrencyConflict on stale version
}

class InMemoryCohortRepository implements CohortRepository { /* Map-backed fake for tests */ }
```

```python
class SqlCohortRepository(CohortRepository):     # infrastructure layer
    def save(self, cohort: Cohort) -> None:
        n = self.session.execute(
            "UPDATE cohort SET capacity=:c, version=version+1 WHERE id=:id AND version=:v",
            {"c": cohort.capacity, "id": str(cohort.id), "v": cohort.version}).rowcount
        if n == 0:
            raise ConcurrencyConflict(cohort.id)
        self._replace_enrollments(cohort)        # whole aggregate written together; no commit here
```

Query styles: start with hard-coded methods; add SPECIFICATION-based queries (`matching(spec)`) only when many combinations are needed, and keep room for specialized hand-tuned queries. Clients may ignore the implementation, but developers must not: a convenient `all()` that loads every row, or N+1 loading of aggregates, still kills production. Work with your framework's persistence model rather than fighting it, keeping the essentials (roots only, domain-term interface).

Current note: CQRS is an optional choice when read screens need shapes that do not match aggregates; read models can bypass repositories, while writes still go through them.

## Relational databases as object stores

- When the schema exists mainly to store this model, keep tables close to the objects (one aggregate per table plus child tables, foreign keys as references to other roots), name columns and tables in the ubiquitous language, and accept some denormalization to keep mapping obvious.
- Do not let other processes write to that store directly; they bypass invariants and freeze the schema.
- A legacy or shared database implies a second model; treat the boundary explicitly (see model integrity).
- A deliberately separate schema is a valid choice when other consumers need it; drifting into one because nobody updated the schema is not.

## Workflow

1. List invariants from the spec; mark which must hold at commit and which can be reconciled later.
2. Group objects so each commit-time invariant lies inside one boundary; pick the root; keep shared or contended objects outside and reference them by ID.
3. Check the boundary against concurrency: who edits this at the same time? Shrink it if unrelated edits would conflict.
4. Decide creation: constructor, factory method on a root, or standalone factory; decide identity assignment; define reconstitution and how it handles bad stored data.
5. Define one repository interface per root that needs global access, with the queries the use cases need, in domain terms; write the in-memory fake first and test the domain against it.
6. Implement persistence: save the whole aggregate atomically with a version check; leave commit to the application service.
7. Write concurrency and invariant tests (two edits on one aggregate; capacity limits; delete cascades).
8. Record boundaries, roots, factories and repositories in `DomainModel.md`.

## Red flags

- Repositories or DAOs for every table, including inner entities.
- External code holding references to inner objects or updating child rows directly.
- Invariants enforced by row-level locks on a single child instead of the root.
- One transaction modifying several aggregates as routine, or one giant aggregate to avoid that.
- Application code assembling aggregates with `new` calls and setters; half-built objects saved.
- Reconstitution that generates fresh IDs or silently drops invalid stored data.
- Repositories that commit, expose query builders or ORM sessions, or return table rows.
- `findOrCreate` used for entities; `findAll()` used to compute summaries.
- Batch jobs or other services writing directly to the aggregate's tables.

## Related

- `../../../actions/ddd.md` — records aggregates, factories and repositories in `DomainModel.md`.
- `../ModelInSoftware/modelInSoftware.md` — entities and value objects that form aggregates.
- `../IsolatingTheDomain/isolatingTheDomain.md` — repository interfaces in the domain, implementations in infrastructure.
- `../WorkedExample/workedExample.md` — boundaries and repositories chosen for a real feature set.
- `../../DeeperInsight/ImplicitConcepts/implicitConcepts.md` — SPECIFICATION for repository queries.
- `../../StrategicDesign/ModelIntegrity/modelIntegrity.md` — legacy databases as another bounded context.
- `../../../actions/dev.md`, `../../../actions/tdd.md`, `../../../actions/review.md` — building and checking the persistence code.
- `../../../DataSystems/DistributedData/Transactions/transactions.md` — isolation levels, optimistic locking and retries (when installed).
- `../../../DBA/PostgreSQL/TablesConstraintsIndexes/tablesConstraintsIndexes.md` — constraints that back aggregate invariants (when installed).
- `../../../CleanCode/Systems/systems.md` — separating construction from use (when installed).
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping ORM and third-party APIs (when installed).
