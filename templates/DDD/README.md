## AI Skills

Before naming domain concepts, modeling entities, value objects, aggregates,
services, events, factories, or repositories, deciding where logic belongs,
refactoring toward a better model, or drawing bounded contexts, find the
skills that apply to the task in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one chapter of Eric Evans's *Domain-Driven Design:
Tackling Complexity in the Heart of Software* (Addison-Wesley, 2003). When
`actions/ddd.md` is installed, it owns the workflow: it turns the approved
specification into `DomainModel.md` and the ubiquitous language glossary
that `bdd`, `uiux`, and `dev` build on. These skills define how each
modeling decision is made. Where later practice refined the book (domain
events as a building block, small aggregates referenced by identity,
core/supporting/generic subdomains, Event Storming, ports and adapters),
the skills carry a short "Current note".

### Putting the Domain Model to Work (Part I)

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./ModelInPractice/CrunchingKnowledge/crunchingKnowledge.md` | Discovering an unfamiliar domain with experts, or a business rule is buried in a guard clause and the model is only a data schema. |
| 2 | `./ModelInPractice/UbiquitousLanguage/ubiquitousLanguage.md` | Naming code, building the glossary, business and code using different words, or one term with two meanings. |
| 3 | `./ModelInPractice/ModelDrivenDesign/modelDrivenDesign.md` | Code doesn't mirror the domain model, concepts exist only as naming conventions, or the UI shows a different model than the one underneath. |

### Building Blocks of a Model-Driven Design (Part II)

| Ch | Skill | Use when |
|---|---|---|
| 4 | `./BuildingBlocks/IsolatingTheDomain/isolatingTheDomain.md` | Deciding which layer logic goes in, rules living in controllers, UI or SQL, the domain importing the ORM, or rich model vs CRUD. |
| 5 | `./BuildingBlocks/ModelInSoftware/modelInSoftware.md` | Deciding entity vs value object, choosing an identity strategy, giving homeless logic a domain service, constraining associations, organizing modules. |
| 6 | `./BuildingBlocks/DomainObjectLifecycle/domainObjectLifecycle.md` | Drawing aggregate boundaries, invariants that break under concurrency, designing factories, reconstitution and repositories, ORM leaking into the domain. |
| 7 | `./BuildingBlocks/WorkedExample/workedExample.md` | Turning a spec into a domain model step by step, choosing repositories, iterating boundaries, integrating an external system through an anticorruption layer. |

### Refactoring Toward Deeper Insight (Part III)

| Ch | Skill | Use when |
|---|---|---|
| 8 | `./DeeperInsight/Breakthrough/breakthrough.md` | Requirements keep surprising the model, adjustment or special-case classes pile up, or a big remodel must be weighed before a release. |
| 9 | `./DeeperInsight/ImplicitConcepts/implicitConcepts.md` | Expert terms are missing from the code, rules swell `isX()` methods or leak into scripts and SQL, or you need explicit constraints or SPECIFICATION. |
| 10 | `./DeeperInsight/SuppleDesign/suppleDesign.md` | Callers must read implementations, methods mix computing and mutating, rules need and/or/not, or a core calculation is hard to combine or change. |
| 11 | `./DeeperInsight/AnalysisPatterns/analysisPatterns.md` | Modeling balances, ledgers, credits, commissions or accruals, a batch job hiding rules, or borrowing a known pattern without changing its meaning. |
| 12 | `./DeeperInsight/DesignPatternsInTheModel/designPatternsInTheModel.md` | Mode conditionals scattered in domain logic, nested part-whole hierarchies, or deciding whether a design pattern belongs in the domain model. |
| 13 | `./DeeperInsight/BringingThePiecesTogether/bringingThePiecesTogether.md` | Deciding if and when to refactor the model, running a short modeling session, using prior art, or handling the moment the model proves wrong. |

### Strategic Design (Part IV)

| Ch | Skill | Use when |
|---|---|---|
| 14 | `./StrategicDesign/ModelIntegrity/modelIntegrity.md` | Drawing context or service boundaries, integrating legacy or third-party systems, one term meaning different things, choosing ACL, shared kernel or conformist. |
| 15 | `./StrategicDesign/Distillation/distillation.md` | Deciding where to invest design effort, build vs buy vs outsource, what to refactor first, or separating the core domain from generic subdomains. |
| 16 | `./StrategicDesign/LargeScaleStructure/largeScaleStructure.md` | Nobody can tell where code belongs, domain packages need dependency rules, behavior must be configurable at runtime, or building plug-in ecosystems. |
| 17 | `./StrategicDesign/BringingTheStrategyTogether/bringingTheStrategyTogether.md` | Starting or assessing strategic design, deciding first steps, setting up architecture teams or frameworks, or fitting legacy into the target structure. |

# Context for AI: Domain-Driven Design

## 1. The Model Is the Code

A domain model that lives only in diagrams or documents is not the model.
The classes, methods, and modules are the model; keep their names and
structure faithful to how the domain works, and change the model and the
code together.

## 2. One Language, Per Context

Use the words domain experts use, in conversation, in the spec, in
scenarios, in the UI, and in the code. Inside one bounded context a term has
one meaning. When two parts of the system mean different things by the same
word, that is a context boundary, not a naming accident.

## 3. Rules Live in the Domain

Business rules and invariants belong in entities, value objects, aggregates,
and domain services, not in controllers, UI handlers, SQL, or scripts. Keep
the domain layer free of persistence, transport, and framework concerns.

## 4. Protect Invariants With Aggregates

An aggregate root guards the rules that must hold together. Keep
aggregates small, reference other aggregates by identity, change one
aggregate per transaction, and use domain events for what can be
eventually consistent.

## 5. Spend Design Effort on the Core

Not every part deserves a rich model. Find the core domain that makes the
product worth building and model it deeply; use simpler designs or
off-the-shelf solutions for supporting and generic parts.

## 6. How the AI Should Apply It

- Do not invent domain knowledge; ask, or send the question back to the
  specification.
- Prefer the project's existing model, names, and architecture over a new
  pattern vocabulary; introduce DDD structures only where the change needs
  them.
- Do not create bounded contexts, services, or layers the project does not
  need.
- Report which model elements, invariants, and glossary terms the change
  added or altered, and which model questions remain open.
