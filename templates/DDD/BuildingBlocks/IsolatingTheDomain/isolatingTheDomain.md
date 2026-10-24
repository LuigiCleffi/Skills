---
name: ddd-isolating-the-domain
description: "How to isolate domain logic from UI, application coordination and infrastructure: LAYERED ARCHITECTURE with User Interface, Application, Domain and Infrastructure layers and their responsibilities, the one-way dependency rule, a thin application layer that coordinates while domain objects hold the rules, communicating upward through observers, callbacks or domain events, infrastructure exposed as services behind interfaces, using architectural frameworks selectively so they do not dictate the domain model, the domain layer as the home of the model, and the SMART UI anti-pattern (when it is the right choice and why it excludes domain-driven design), with transaction script as a middle ground, based on Chapter 4 (Isolating the Domain) of Domain-Driven Design. Use when deciding where a piece of logic belongs, business rules live in controllers, React components, route handlers, SQL, stored procedures or ORM hooks, domain classes import the ORM, HTTP or framework types, an application service is hundreds of lines of if statements, designing a project folder structure, choosing between a simple CRUD app and a rich domain model, a framework forces domain objects to extend its base classes, unit tests need a database or web server to check a business rule, or the user mentions layered architecture, layers, separation of concerns, application service, domain layer, infrastructure, smart UI, transaction script, hexagonal, ports and adapters, or clean architecture."
---

# Isolating the Domain

Put all code that expresses the domain model in one layer that depends on nothing above it and on no technical detail, so the model can be read, tested and evolved on its own. Around it, keep a thin application layer that coordinates use cases, a user interface that translates requests and results, and infrastructure that supplies technical capabilities through interfaces. If the project is simple data entry with few rules, consciously choose a SMART UI instead, and accept that domain-driven design no longer applies.

## Why isolate

- Domain logic is a small part of the code but carries most of the value. Mixed into UI handlers, queries and framework callbacks, it becomes impossible to see or reason about.
- Symptoms of not isolating: a cosmetic UI change alters a business rule; a rule change requires tracing UI, database and integration code; automated tests need the whole stack; model-driven objects become impractical.

## LAYERED ARCHITECTURE

| Layer | Responsibility | Must not |
|---|---|---|
| User Interface (presentation, API controllers, CLI, message consumers) | Show information and interpret commands from a human or another system; map transport formats to application calls | Make business decisions |
| Application | Define the jobs the software does; load domain objects, ask them to do the work, commit, and trigger follow-up actions. May hold task progress state | Contain business rules or business-situation state |
| Domain | Business concepts, the state of the business situation, and the rules | Know how it is displayed, stored, transported or scheduled |
| Infrastructure | Generic technical capabilities: persistence, messaging, email, clock, file storage, framework glue | Contain domain knowledge |

- Dependency rule: an element depends only on elements in its own layer or layers beneath it. Communication upward goes through an indirect mechanism.
- Some projects merge UI and application, or have several infrastructure layers. The non-negotiable part is the separate domain layer.
- Separated layers evolve at different rates and can be deployed separately where needed.

Current note: hexagonal architecture (ports and adapters) and its relatives are a common alternative to strict layering: the domain and application core sit in the middle, define ports (interfaces such as repositories or a payment gateway), and infrastructure adapters implement them. The dependency points inward, so the domain never imports infrastructure. It serves the same goal as this chapter: an isolated domain.

## A use case across the layers

Transferring stock between two warehouses, where the domain rule is "a transfer never creates or destroys units":

```ts
// ui/http/transferController.ts — translate the request, nothing more
export async function postTransfer(req: Request, res: Response) {
  const { fromId, toId, sku, quantity } = parseTransferBody(req.body);
  const result = await transferStock.execute({ fromId, toId, sku, quantity });
  res.status(201).json(result);
}

// application/transferStock.ts — coordinate, no rules
export class TransferStock {
  constructor(private readonly warehouses: WarehouseRepository, private readonly tx: UnitOfWork) {}

  async execute(cmd: TransferStockCommand): Promise<TransferReceipt> {
    return this.tx.run(async () => {
      const from = await this.warehouses.byId(cmd.fromId);
      const to = await this.warehouses.byId(cmd.toId);
      const transfer = from.transferTo(to, Sku.of(cmd.sku), Quantity.of(cmd.quantity));
      await this.warehouses.save(from);
      await this.warehouses.save(to);
      return transfer.receipt();
    });
  }
}

// domain/warehouse.ts — the rule lives here
export class Warehouse {
  transferTo(destination: Warehouse, sku: Sku, quantity: Quantity): StockTransfer {
    this.withdraw(sku, quantity);          // throws InsufficientStock if it would go negative
    destination.receive(sku, quantity);
    return new StockTransfer(this.id, destination.id, sku, quantity);
  }
}

// domain/warehouseRepository.ts — an interface the domain owns
export interface WarehouseRepository {
  byId(id: WarehouseId): Promise<Warehouse>;
  save(warehouse: Warehouse): Promise<void>;
}

// infrastructure/persistence/pgWarehouseRepository.ts implements WarehouseRepository with SQL
```

- The controller could be replaced by a message consumer or CLI without touching the application or domain.
- The application layer knows *when* to commit; the domain knows *what* a valid transfer is.
- The domain test needs no database: `new Warehouse(...).transferTo(...)` and assert the quantities.
- Changing two warehouses in one transaction is a deliberate choice here to keep the example short; with aggregates, the usual preference is one aggregate per transaction and eventual consistency between them (see The Lifecycle of a Domain Object).
- With the plumbing out of the way, there is room to deepen the model (stock ledgers, reservations, in-transit stock) without cluttering the use case.

A typical folder layout:

```text
src/<bounded-context>/
  domain/          entities, value objects, domain services, repository interfaces, domain events
  application/     use cases / application services, commands, DTOs
  infrastructure/  repository implementations, ORM mappings, gateways, messaging
  ui/ (or api/)    controllers, resolvers, consumers, views
```

Enforce the rule with a dependency check in CI (for example a lint rule that forbids `domain/` importing `infrastructure/`, `ui/`, ORM or HTTP packages).

## Relating the layers

- Downward calls are ordinary: upper layers call public interfaces of lower ones and may hold references.
- Upward communication beyond answering a query uses callbacks, OBSERVER, or domain events published by the domain and handled by the application layer.
- UI-to-application patterns (MVC and its variants, application coordinators) are all acceptable as long as domain objects are designed without thinking about the UI.
- Infrastructure rarely initiates domain actions and knows nothing of the domain. Expose it as services behind interfaces. Example: the application layer decides *when* to notify a customer through a `Notifier` interface; the infrastructure decides *how* (email, SMS, push).

```ts
export interface Notifier { send(to: CustomerContact, message: Notification): Promise<void>; }

// application layer, after commit
for (const event of warehouse.pullEvents()) {
  if (event instanceof StockFellBelowReorderPoint) await notifier.send(buyerContact, reorderNotice(event));
}
```

Current note: domain events became a first-class building block after the book. Let aggregates record events, and let the application layer dispatch them after the transaction commits (or via an outbox) rather than calling infrastructure from inside domain objects.

## Architectural frameworks

- Some infrastructure is intrusive: frameworks that require domain classes to extend base classes, carry annotations, or follow fixed method signatures.
- Use frameworks for the hard technical problems they solve, and only the parts you need. Keep most business logic in plain classes of your language.
- Keep the domain readable: if an ORM's active-record base class, lifecycle hooks or lazy-loading proxies dictate the shape of domain objects, move persistence mapping to infrastructure (data mapper, separate persistence models, mapping configuration).
- A framework that slows development or constrains domain choices is a cost to weigh, not a given.

## The domain layer is where the model lives

- The domain layer is the code manifestation of the model and everything directly related to it. In a model-driven design its constructs mirror the model's concepts.
- That correspondence is impossible while domain logic is mixed with other concerns. Isolation is a prerequisite for domain-driven design, whatever the exact layering scheme.

## SMART UI anti-pattern

A mutually exclusive alternative to everything above: put business logic into the user interface, build the application as many small screens each with its rules embedded, share data through a relational database, and use the most automated UI or low-code tools available.

When it is the right call: simple functionality dominated by data entry and display, few business rules, short timelines, and a team without object-modeling experience or support.

| Advantages | Disadvantages |
|---|---|
| Immediate productivity on simple apps | Integration between apps only through the database |
| Little training needed | No reuse of behavior, no abstraction of the business problem |
| Quick prototype-and-adjust cycles with users | Iteration hits a ceiling because there is nothing to refactor toward |
| Small modules are independent and easy to schedule | Complexity buries it quickly; growth only by adding more simple apps |
| Relational databases and low-code tools work well | Migration to another approach means replacing whole applications |

- Choose it consciously. The costly mistake is heavy infrastructure and a sophisticated design approach the team will not carry through, or a flexible general-purpose language used as if it bought flexibility.
- Middle ground: TRANSACTION SCRIPT separates UI from application logic but has no object model. Acceptable for low-complexity areas; know its limit on complexity.
- Test for whether an architecture can support domain-driven design: does it isolate domain code into a cohesive design loosely coupled to the rest?

## Other kinds of isolation

- The domain also needs protection from other models it does not own: external systems, legacy databases, vendor APIs. Use BOUNDED CONTEXTS and ANTICORRUPTION LAYERS (see Maintaining Model Integrity).
- Inside the domain layer, separate the core concepts from supporting detail (see Distillation).

## Workflow

1. Classify each piece of new logic: presentation/transport, use-case coordination, business rule or state, or technical capability. Place it in the matching layer.
2. Decide per bounded context whether it warrants a domain model or is simple CRUD; record the decision (smart UI or transaction script is acceptable for genuinely simple areas).
3. Define repository and gateway interfaces in the domain or application layer; implement them in infrastructure.
4. Keep application services short: load, delegate to domain objects, persist, dispatch events. Move any `if` that encodes a business rule into the domain.
5. Keep framework and ORM types out of domain classes; map in infrastructure.
6. Add or update a dependency rule check so `domain/` imports nothing from outer layers or technical packages.
7. Test domain rules with plain unit tests; test application services with in-memory repositories; test infrastructure with integration tests.

## Red flags

- Business rules in controllers, UI components, route handlers, SQL views, triggers or ORM lifecycle hooks.
- Domain classes importing HTTP, ORM, queue or framework packages, or extending framework base classes for convenience.
- Fat application services full of rule-bearing conditionals while entities are bags of getters and setters (anemic domain model).
- A business rule duplicated in the frontend and backend because neither owns it.
- Infrastructure code that knows domain specifics (an email adapter that decides who should be notified).
- Unit tests for a business rule that need a database, web server or message broker.
- A SMART UI drifting into a complex domain, or a heavy layered architecture imposed on a trivial CRUD screen.
- No enforced dependency direction; `domain/` quietly importing `infrastructure/`.

## Related

- `../ModelInSoftware/modelInSoftware.md` — entities, value objects and services that populate the domain layer.
- `../DomainObjectLifecycle/domainObjectLifecycle.md` — aggregates, factories and repositories crossing the domain/infrastructure line.
- `../WorkedExample/workedExample.md` — the building blocks applied end to end.
- `../../ModelInPractice/ModelDrivenDesign/modelDrivenDesign.md` — why the domain layer must mirror the model.
- `../../StrategicDesign/ModelIntegrity/modelIntegrity.md` — bounded contexts and anticorruption layers.
- `../../StrategicDesign/Distillation/distillation.md` — separating core from supporting domain code.
- `../../../actions/ddd.md` — records layer placement in the domain model.
- `../../../actions/dev.md` — implementing within the layers.
- `../../../actions/review.md` — checking dependency direction and rule placement.
- `../../../CleanCode/Systems/systems.md` — separating construction from use, dependency injection (when installed).
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping third-party code behind interfaces (when installed).
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects versus data structures, anemic models (when installed).
- `../../../DataSystems/DistributedData/Transactions/transactions.md` — transaction boundaries the application layer controls (when installed).
