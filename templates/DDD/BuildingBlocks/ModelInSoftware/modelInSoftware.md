---
name: ddd-model-in-software
description: "How to express a domain model in code with the tactical building blocks ENTITY (identity and lifecycle continuity), VALUE OBJECT (immutable, equality by attributes, whole values), domain SERVICE (stateless operations named in the ubiquitous language, versus application and infrastructure services) and MODULE (packages that tell the domain story), plus constraining associations (traversal direction, qualifiers, removing non-essential links) and mixing modeling paradigms such as rules engines, based on Chapter 5 (A Model Expressed in Software) of Domain-Driven Design. Use when deciding whether a class is an entity or a value object, choosing an ID strategy (natural key, generated UUID, external ID), implementing equals/hashCode or structural equality, replacing primitives (string email, number price) with value types, splitting a god entity, a bidirectional or many-to-many relationship is getting messy, logic has no obvious home, a class is named XxxManager or XxxHelper, deciding between a domain service and a method on an entity, organizing folders/packages (by feature vs entities/, services/, repositories/), an ORM splits data from behavior, or the user mentions entity, value object, primitive obsession, identity, immutability, domain service, aggregate of values, or package structure."
---

# A Model Expressed in Software

Every model element must map to a concrete code element with the same meaning. For each concept ask, in order: does the business care *which one* it is across time (ENTITY), or only *what it is* (VALUE OBJECT), or is it an action that belongs to no thing (SERVICE)? Then constrain every association to what the domain actually needs, and group classes into MODULES by concept, not by technical category.

## Associations: constrain them

A model association is a promise that the code offers a traversal with the same meaning, whether a field, a collection, or a repository query behind a method. Unconstrained many-to-many and bidirectional links are hard to implement and hard to understand. Reduce them in three ways:

1. **Pick a traversal direction** that reflects which way the domain actually asks the question. A `Clinic` knows its `Veterinarian`s on staff; nothing needs vet-to-clinic navigation, so `Veterinarian` stays independent.
2. **Add a qualifier** that cuts multiplicity. "A pet has many vaccinations" becomes "a pet has at most one current vaccination per vaccine type", which also writes a business rule into the model.
3. **Delete associations** that no use case or invariant needs.

```ts
class Pet {
  private readonly current = new Map<VaccineType, Vaccination>(); // qualified: one per type
  vaccinationFor(type: VaccineType): Vaccination | undefined {
    return this.current.get(type);
  }
}
```

A link that survives as bidirectional now communicates that both directions really matter. Never make two VALUE OBJECTS point at each other; if that seems necessary, one of them probably has identity.

## ENTITY

Use when the object must be tracked through state changes, storage, transmission and even other systems, and two instances with equal attributes may still be different things (two identical refunds on the same day) or the same thing with different attributes (a customer whose address changed).

- Identity is a model decision: the business must define "the same thing". Choose the means: a natural key that is guaranteed unique (and watch for edge cases), an ID from an external authority (users must get tools to fix collisions), or a system-generated ID that may or may not be shown to users (tracking codes, booking references).
- The identifier is immutable once assigned and survives persistence, serialization and archiving. Language reference equality (`===`, `==` in Java) is not identity: every load from a database creates a new instance.
- Keep the entity lean: identity, the attributes used to find or match it, and its lifecycle behavior. Move descriptive clusters into value objects or associated objects.

```ts
class Patient {                         // ENTITY: a pet registered at a clinic
  constructor(
    readonly id: PatientId,             // generated, immutable
    private name: PetName,
    private owner: OwnerId,
    private weight: Weight,
  ) {}
  recordWeight(w: Weight): void { this.weight = w; }
  transferTo(newOwner: OwnerId): void { this.owner = newOwner; }
  equals(other: Patient): boolean { return this.id.equals(other.id); }
}
```

Wrong when: equality compares all fields; IDs get reassigned on import; every object in the system gets a surrogate ID "just in case"; matching duplicates is done by name alone with no human review where the domain needs it.

## VALUE OBJECT

Use when only the attributes matter: money, a date range, a dosage, a shipping address in a webshop. The context decides: in a property-management system the rentable unit at that address is tracked over time, so it becomes an ENTITY that holds the address as a value.

- Immutable: change means replacement. That makes sharing and passing safe and removes aliasing bugs.
- Equality by all attributes. No identity, no repository, no lifecycle.
- A whole value: group attributes that only make sense together (amount + currency, street + city + postcode) and put the related behavior on it.
- May be composed of other values and may even reference entities.
- Mutability is a rare performance exception (very frequent change, expensive allocation); a mutable value must never be shared.

```ts
class Dosage {
  private constructor(readonly amount: number, readonly unit: "mg" | "ml") {}
  static of(amount: number, unit: "mg" | "ml"): Dosage {
    if (!(amount > 0)) throw new InvalidDosage(amount);
    return new Dosage(amount, unit);
  }
  scaledBy(factor: number): Dosage { return Dosage.of(this.amount * factor, this.unit); }
  equals(o: Dosage): boolean { return this.amount === o.amount && this.unit === o.unit; }
}
```

```java
public record Money(BigDecimal amount, Currency currency) {
  public Money { if (amount.scale() > currency.getDefaultFractionDigits()) throw new IllegalArgumentException(); }
  public Money plus(Money o) { requireSame(o); return new Money(amount.add(o.amount), currency); }
  private void requireSame(Money o) { if (!currency.equals(o.currency)) throw new CurrencyMismatch(); }
}
```

Because values have no identity, the persistence layer is free to copy them into the owner's row (embedded columns, JSON) instead of a separate table. Wrong when: values have setters, carry database IDs, are looked up by ID, or primitives (`string email`, `number cents`) spread validation across the codebase.

## SERVICE

Use when a significant domain operation does not naturally belong to any entity or value, typically because it coordinates several of them under rules that belong to none (moving stock between two warehouses, matching a donor to a recipient).

A good domain service:
- is named for an activity in the UBIQUITOUS LANGUAGE (`StockTransfer`, not `InventoryManager`);
- takes and returns domain objects;
- is stateless: any instance gives the same result; it may change global state through the objects it touches.

```ts
class StockTransfer {                   // domain layer
  transfer(from: Warehouse, to: Warehouse, sku: Sku, qty: Quantity): TransferRecord {
    if (from.id.equals(to.id)) throw new SameWarehouse();
    from.release(sku, qty);             // each warehouse still enforces its own rules
    to.receive(sku, qty);
    return TransferRecord.of(from.id, to.id, sku, qty);
  }
}
```

Keep services in the right layer:

| Layer | Example | Contains business rules? |
|---|---|---|
| Application | `TransferStockHandler`: parse request, load aggregates, call domain service, commit, trigger notification | No; coordination only |
| Domain | `StockTransfer`: debit/credit rules, refusal reasons | Yes |
| Infrastructure | `EmailSender`, `CsvExporter` | No business meaning |

Medium-grained domain services also keep fine-grained object choreography from leaking into application code. Wrong when: entities become property bags and every rule lives in `XxxService` (anemic model); a service holds per-request state in fields; a service operation name is not something a domain expert would say.

## MODULES

Modules are chapters of the model's story: put together what must be understood together, name them in the ubiquitous language, and refactor them when the model changes, just as you refactor classes.

- Low coupling means concepts that can be reasoned about independently; high cohesion means concepts with rich relationships live together. If two modules are tightly coupled, look for a missing concept or a different split.
- Separate the domain from UI, application and infrastructure code. Beyond that, do not let frameworks impose per-layer packages that scatter one concept's data, behavior and mapping across folders.
- Keep everything that implements one conceptual object in one module, unless you really deploy it separately. Generated code may live apart.

```
src/
  scheduling/        appointment.ts, timeSlot.ts, appointmentRepository.ts, rescheduling.ts
  medicalRecords/    patient.ts, vaccination.ts, dosage.ts
  billing/           invoice.ts, money.ts, pricingPolicy.ts
  infrastructure/    postgres/, email/
```

Not `entities/`, `valueObjects/`, `services/`, `repositories/`: grouping by pattern tells the story of the developer's reading list, not of the business.

Current note: hexagonal (ports and adapters) packaging is a common alternative to strict layering; the same rule applies, the domain core is organized by concept and adapters sit outside.

## Mixing paradigms

Objects suit most domains, but parts may fit rules engines, workflow engines, relational logic or mathematical solvers better. Keep MODEL-DRIVEN DESIGN across the seam:

- Model the concepts so they fit the paradigm they will be implemented in; do not fight the tool.
- Use identical names for the same concept on both sides, recorded in the glossary.
- Be skeptical: a handful of rules is usually clearer as objects (or SPECIFICATIONS) than as an engine plus a second deployment.
- Encapsulate a loosely coupled subsystem (a pricing solver) behind a domain-named interface.

## Workflow

1. List the nouns and verbs from the spec and glossary.
2. For each noun ask whether the business tracks it individually over time. Yes: ENTITY; decide and document the identity source and uniqueness scope. No: VALUE OBJECT; define its whole set of attributes, validation and behavior.
3. Replace primitives that carry rules (amounts, emails, ranges, quantities) with value objects.
4. For each verb, find the object that owns the data and rules. If none fits without distortion, define a stateless domain SERVICE with a ubiquitous-language name; keep orchestration in the application layer.
5. Draw associations, then give each a direction, add qualifiers where a rule limits multiplicity, and delete the unneeded ones.
6. Group classes into modules by concept; check coupling between modules and look for a missing concept if it is high.
7. Record the classification, identity strategy and modules in `DomainModel.md`; write tests for value equality, invariants and identity equality before production code.

## Red flags

- Every class has a surrogate `id` and setters; no class has behavior (anemic model).
- `equals` on an entity compares fields, or a value object compares references.
- The same concept is passed around as a raw string or number with ad hoc validation.
- `OrderManager`, `PatientHelper`, `UtilService` holding the real business logic.
- Bidirectional many-to-many mappings generated by the ORM because "it was easy".
- Folders named after patterns or framework tiers; one concept spread across five packages.
- Module names that no domain expert would recognize, or that still reflect last year's model.
- A rules engine whose rules no longer use the model's names.

## Related

- `../../../actions/ddd.md` — the workflow that records these classifications in `DomainModel.md`.
- `../IsolatingTheDomain/isolatingTheDomain.md` — the layer these objects live in.
- `../DomainObjectLifecycle/domainObjectLifecycle.md` — aggregates, factories and repositories built from these blocks.
- `../WorkedExample/workedExample.md` — the blocks applied end to end.
- `../../ModelInPractice/UbiquitousLanguage/ubiquitousLanguage.md` — where service and module names come from.
- `../../DeeperInsight/SuppleDesign/suppleDesign.md` — side-effect-free functions and closure on value objects.
- `../../DeeperInsight/ImplicitConcepts/implicitConcepts.md` — SPECIFICATION and other explicit concepts.
- `../../../actions/dev.md`, `../../../actions/tdd.md`, `../../../actions/review.md` — implementing and checking the model.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects versus data structures (when installed).
- `../../../CleanCode/Classes/classes.md` — cohesion and small classes (when installed).
- `../../../CleanCode/MeaningfulNames/namesThatRevealTheirPurpose.md` — naming classes and operations (when installed).
- `../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — mapping relationships to storage models (when installed).
