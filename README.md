# Skills Code Kit

Reusable instructions for AI coding agents to help developers build software that is clear, correct, maintainable, and aligned with product requirements.

**Skills Code Kit** provides focused instruction sets for Clean Code, development workflows, code reviews, test-driven development (TDD), behavior-driven development (BDD), domain-driven design (DDD), databases, data-intensive system design, DevOps and cloud infrastructure, product definition, and UI/UX decisions. Install the instructions you need directly into an existing project without cloning this repository.

## Why Skills Code Kit?

AI coding tools can generate code quickly, but speed alone does not guarantee quality.

These instructions establish shared engineering standards for how an AI agent should understand an existing codebase, make changes, review implementations, test behavior, and connect technical decisions to product requirements.

The goal is not to enforce style for its own sake. It is to make code easier to understand and change while protecting correctness, security, performance, and maintainability.

## Installation

**Requirements:** Node.js 20 or newer and npm.

Navigate to the root of the project where you want to install the instructions, then run:

```bash
npx skills-code-kit
```

The interactive installer lets you choose between installing everything and selecting individual instruction groups.

Review the files to be installed and confirm before proceeding.

> Run the command from your target project's root directory. The installer writes the selected instructions into the current working directory.

## Available instruction groups

### 1. Clean Code Standards

**Purpose:** Establish principles for writing elegant, readable, cohesive, and maintainable code.

This instruction set guides AI agents to:

- Choose names that reveal intent and meaningful purpose.
- Keep functions, classes, and modules focused on a clear responsibility.
- Avoid unnecessary complexity, duplication, and repetitive logic.
- Handle errors and edge cases carefully.
- Consider correctness, security, performance, and resource management.
- Avoid introducing messy code that makes future changes harder.

**Installed files:**

`CleanCode/` — the `README.md` entry point plus every Clean Code skill folder it routes to.

### 2. Development Workflow

**Purpose:** Guide implementation of features, bug fixes, and other code changes.

This instruction set helps AI agents:

- Understand the existing architecture before making changes.
- Follow established project conventions.
- Identify the appropriate implementation approach.
- Keep changes focused and cohesive.
- Verify behavior through relevant tests and checks.
- Communicate what changed and what remains unresolved.

**Installed file:**

`actions/dev.md`

### 3. Code Review

**Purpose:** Evaluate code changes systematically rather than relying on whether the code merely looks correct.

The review workflow focuses on:

- Functional correctness and regressions.
- Security vulnerabilities and unsafe assumptions.
- Edge cases and error handling.
- Duplicated logic and unnecessary complexity.
- Missing or inadequate tests.
- Maintainability and consistency with the existing architecture.

**Installed file:**

`actions/review.md`

### 4. Test-Driven Development (TDD)

**Purpose:** Encourage implementation guided by observable, testable behavior.

The TDD instructions help AI agents:

- Define expected behavior before implementation.
- Use tests to clarify requirements.
- Implement the smallest change that satisfies the expected behavior.
- Refactor while preserving correctness.
- Verify that relevant tests pass.

It also installs a test pattern library: one skill per chapter of Kent Beck's *Test-Driven Development: By Example*, routed from `TDD/README.md`. The pattern skills cover choosing the next test (Test List, Starter Test, One Step Test), writing it (Assert First, Evident Data, Mock Object, Self Shunt, Log String), getting to green (Fake It, Triangulate, Obvious Implementation), xUnit mechanics, the design patterns and refactorings TDD relies on, and step size and test quality. The worked money and xUnit examples show those moves in a real session.

**Installed files:**

- `actions/tdd.md`
- `TDD/` — the `README.md` entry point plus one skill folder per chapter, grouped into `MoneyExample/`, `XUnitExample/` and `Patterns/`.

### 5. Databases (DBA): Oracle and PostgreSQL

**Purpose:** Guide work on Oracle databases and the applications built on them, from SQL and schema design to security, data movement, tuning, and administration.

`DBA/README.md` routes to one folder per database engine, so the agent only reads skills for the engine the project uses:

- `DBA/Oracle/` — one skill per chapter of *Oracle Database 11g: The Complete Reference*.
- `DBA/PostgreSQL/` — one skill per chapter of *PostgreSQL: Up and Running*, 3rd edition.

They help AI agents:

- Write correct, efficient SQL, PL/SQL, and PL/pgSQL.
- Design tables, indexes, partitions, views, and materialized views.
- Apply security: privileges, roles, virtual private databases, and encryption.
- Move data with SQL*Loader, Data Pump, external tables, and database links on Oracle, or pg_dump, `\copy`, replication, and foreign data wrappers on PostgreSQL.
- Recover from mistakes with flashback, and treat destructive operations with care.
- Diagnose and tune queries using the data dictionary, execution plans, and caches.

**Installed files:**

`DBA/` — the `README.md` entry point, plus `Oracle/` and `PostgreSQL/`, each with its own `README.md` and one skill folder per chapter.

### 6. Data-Intensive Systems

**Purpose:** Guide the design and change of systems whose hard problems are the amount, complexity, and rate of change of their data rather than CPU.

`DataSystems/README.md` routes to one skill per chapter of Martin Kleppmann's *Designing Data-Intensive Applications*, grouped into `Foundations/`, `DistributedData/` and `DerivedData/`. They help AI agents:

- State reliability, scalability, and maintainability requirements with load parameters and percentiles.
- Choose between relational, document, and graph models, and between storage engines (LSM-trees, B-trees, column stores).
- Encode data and evolve schemas with backward and forward compatibility across rolling deploys.
- Replicate and partition data, and handle replication lag, failover, rebalancing, and hot spots.
- Pick transaction isolation levels and recognize lost updates, write skew, and phantoms.
- Reason about network faults, unreliable clocks, process pauses, fencing tokens, linearizability, and consensus.
- Build batch and stream pipelines with change data capture, event sourcing, idempotence, and exactly-once semantics.

**Installed files:**

`DataSystems/` — the `README.md` entry point plus one skill folder per chapter.

### 7. Product Definition

**Purpose:** Clarify what should be built and how success should be evaluated before implementation begins.

This group includes planning and specification documents to help define:

- Product goals and scope.
- Functional requirements and constraints.
- Acceptance criteria.
- Specification completeness and readiness.
- The relationship between product expectations and implementation work.

**Installed files:**

- `ProductDefinition/plan.md`
- `ProductDefinition/specs/spec-definition.md`
- `ProductDefinition/specs/spec-checklist.md`

### 8. UI/UX Decisions

**Purpose:** Make the UI/UX decisions for an approved specification and tell the developer which approach to follow, so the interface is not improvised during implementation.

`actions/uiux.md` sits between the specification and implementation. It reads the approved spec and checklist, inspects the existing design system, and writes `UIUXDecisions.md`: flows, screens and states, components, interaction rules, copy, accessibility target, layout and internationalization, the recommended TDD or direct mode and slice order for `dev`, and the UI acceptance checks `tdd` turns into tests. Product questions go back to the specification instead of being decided by design.

`UIUX/README.md` routes to one skill per section of the *UI/UX Design Guide* (Joel Parker Henderson, ed.), which `uiux` consults: foundations, design thinking, task analysis, ideation, product design, modeling diagrams, design systems, affordance and accessibility, implementation, internationalization, AI, testing, principles, and soft skills.

**Installed files:**

- `actions/uiux.md`
- `UIUX/` — the `README.md` entry point plus one skill folder per section.

### 9. DevOps and Cloud Infrastructure

**Purpose:** Guide how software gets built, deployed, operated, and observed, on whichever infrastructure the project runs.

`DevOps/README.md` routes to one folder per infrastructure, so the agent reads the platform-neutral practices plus only the platform the project uses:

- `DevOps/Practices/` — one skill per chapter of *DevOps na Prática: Entrega de Software Confiável e Automatizada* (Danilo Sato).
- `DevOps/AWS/` — one skill per chapter of *AWS Certified DevOps Engineer – Professional: Certification and Beyond* (Adam Book), grouped into `Fundamentals/`, `Delivery/`, `Monitoring/` and `Resilience/`.
- `DevOps/Azure/` — one skill per chapter of *Azure: Coloque suas plataformas e serviços no cloud* (Casa do Código).

They help AI agents:

- Build continuous integration and deployment pipelines, and deploy safely with blue/green, canary, and rollback.
- Write infrastructure as code and configuration management, and review plans before applying them.
- Monitor, log, and alert on what matters, and trace requests across services.
- Apply least privilege, keep secrets out of code, and protect data in transit and at rest.
- Choose and operate managed services on AWS or Azure, with notes where the books' services have since changed or been retired.

**Installed files:**

`DevOps/` — the `README.md` entry point, plus `Practices/`, `AWS/` and `Azure/`, each with its own `README.md` and one skill folder per chapter.

### 10. Behavior-Driven Development (BDD)

**Purpose:** Make the agreed behavior concrete with examples before code exists, and keep those examples running as acceptance tests.

`actions/bdd.md` sits between the specification and implementation. It discovers the rules and key examples behind each user story, writes them as declarative Gherkin scenarios in the domain's language, confirms them with the user, and automates them as failing acceptance tests. `dev` then makes one scenario pass at a time, with `tdd` driving the units inside. It owns feature files and step definitions, never production code.

`BDD/README.md` routes to one skill per chapter of John Ferguson Smart's *BDD in Action*, grouped into `FirstSteps/`, `DefiningRequirements/`, `CodingTheBddWay/` and `TakingBddFurther/`: feature injection, example discovery, Gherkin, step definitions, UI and API automation, the link to unit testing, living documentation, and BDD in CI.

**Installed files:**

- `actions/bdd.md`
- `BDD/` — the `README.md` entry point plus one skill folder per chapter.

### 11. Domain-Driven Design (DDD)

**Purpose:** Give features a domain model the code can express, in the language the business uses, before scenarios, screens, and code are written.

`actions/ddd.md` sits between the specification and the examples. It places the change in a bounded context, maintains the ubiquitous language glossary, and writes `DomainModel.md`: entities, value objects, aggregates and their invariants, domain services, domain events, factories, repositories, layer placement, and translation at context edges. `bdd` writes scenarios in those terms, `uiux` labels the interface with them, and `dev` implements the model with the same names and boundaries.

`DDD/README.md` routes to one skill per chapter of Eric Evans's *Domain-Driven Design: Tackling Complexity in the Heart of Software*, grouped into `ModelInPractice/`, `BuildingBlocks/`, `DeeperInsight/` and `StrategicDesign/`.

**Installed files:**

- `actions/ddd.md`
- `DDD/` — the `README.md` entry point plus one skill folder per chapter.

## Workflow order

When the workflow groups are installed together, a feature moves through them in this order, and the generated `AGENTS.md` lists the installed stages:

1. Product definition: `plan.md`, then `spec-definition.md`, then `spec-checklist.md`.
2. Domain model: `actions/ddd.md`, when the change touches domain concepts or rules.
3. Examples and scenarios: `actions/bdd.md`, when the change has business behavior to illustrate.
4. UI/UX decisions: `actions/uiux.md`, when the change has a user-facing surface.
5. Implementation: `actions/dev.md`, with BDD scenarios as the outer loop and `actions/tdd.md` as the inner loop, or in direct mode, as `uiux` recommends.
6. Review: `actions/review.md`.

Clean Code, database, data-intensive system, and DevOps skills apply wherever the task needs them.

## How installation works

1. Run `npx skills-code-kit` in your project.
2. Choose **Install everything** or select individual instruction groups.
3. Review the list of files the installer plans to create.
4. Confirm the installation.
5. Start using the installed instructions with your AI coding agent.

The installer copies instruction templates into your project and generates an `AGENTS.md` file that acts as an entry point for the selected instructions.

No repository clone is required.

## The role of `AGENTS.md`

`AGENTS.md` provides the AI agent with an entry point to the installed instructions.

It identifies the relevant instruction files and establishes working expectations, including:

- Understand the codebase before modifying it.
- Read the applicable instructions before starting a task.
- Prioritize correctness, security, simplicity, and maintainability.
- Run relevant tests and checks when possible.
- Report completed changes and verification results honestly.

The generated file references the instruction groups selected during installation.

AI tools vary in how they discover and interpret instruction files. Check your tool's documentation if additional configuration is required.

## Existing files and conflicts

The installer checks for existing destination files before writing.

If conflicts are found, it asks whether you want to overwrite the listed files.

- **Confirm overwrite:** Existing files in the conflict list may be replaced.
- **Decline overwrite:** Existing files are skipped to protect your current content.
- **Manual merge:** Skipped files are not merged automatically; review and combine the content yourself when needed.

**Important:** If your project already contains a custom `AGENTS.md`, review the conflict list carefully before approving an overwrite.

## Updating the instructions

To run the latest published version:

```bash
npx skills-code-kit@latest
```

The installer may encounter files from a previous installation. Review its conflict prompts before proceeding so you do not accidentally replace project-specific instructions.

## Repository structure

The repository separates its working instruction documents from the templates distributed through npm.

```text
.
├── AGENTS.md
├── CleanCode_Uncle_Bob/
│   └── README.md
├── ProductDefinition/
│   ├── plan.md
│   └── specs/
│       ├── spec-checklist.md
│       └── spec-definition.md
├── actions/
│   ├── dev.md
│   └── review.md
├── bin/
│   └── cli.ts
├── dist/
│   └── cli.js
├── templates/
│   ├── BDD/
│   ├── CleanCode/
│   ├── DBA/
│   ├── DDD/
│   ├── DataSystems/
│   ├── DevOps/
│   ├── ProductDefinition/
│   ├── TDD/
│   ├── UIUX/
│   └── actions/
├── package.json
└── tsconfig.json
```

| Location | Responsibility |
|---|---|
| `bin/cli.ts` | TypeScript source code for the installer. |
| `dist/cli.js` | Compiled executable invoked by npm. |
| `templates/` | Instruction files distributed to users. |
| `templates/DBA/` | Database skills, one folder per engine. `Oracle/` and `PostgreSQL/` each hold one skill per chapter of their book. |
| `templates/DataSystems/` | Data-intensive system design skills, one per chapter of *Designing Data-Intensive Applications*. |
| `templates/UIUX/` | UI/UX skill library, one skill per section of the *UI/UX Design Guide*, consulted by `actions/uiux.md`. |
| `templates/DevOps/` | DevOps skills, one folder per infrastructure: `Practices/`, `AWS/` and `Azure/`, each holding one skill per chapter of its book. |
| `templates/DDD/` | DDD pattern library, one skill per chapter of Evans's *Domain-Driven Design*, consulted by `actions/ddd.md`. |
| `templates/BDD/` | BDD pattern library, one skill per chapter of *BDD in Action*, consulted by `actions/bdd.md`. |
| `templates/TDD/` | TDD test pattern library, one skill per chapter of Kent Beck's book. |
| `CleanCode_Uncle_Bob/` | Working copy of the core Clean Code standards. |
| `ProductDefinition/` | Planning and specification documents. |
| `actions/` | Development, review, TDD, BDD, DDD, and UI/UX workflows. |
| `AGENTS.md` | Repository-level entry point for AI coding instructions. |

Keep the distributed templates synchronized with their corresponding working copies whenever you update an instruction.

## Contributing and publishing

When changing the instructions distributed through npm, update the corresponding files under `templates/` as well.

Publish with the release script. It checks your npm login, bumps the version when the current one is already on npm, installs dependencies, validates every skill's YAML frontmatter, builds, checks the package contents, and publishes:

```bash
npm run release
```

Pass `minor` or `major` instead of the default patch bump, or `--dry-run` to run every check without changing the version or publishing:

```bash
npm run release -- minor
npm run release -- --dry-run
```

Run `npm run check:frontmatter` to validate skill frontmatter on its own. A `description` that contains `: ` must be quoted, or GitHub and agent tools reject the whole file.

Use a patch version for fixes, a minor version for backward-compatible features, and a major version for breaking changes. The script does not commit; commit and tag the version change after publishing.

## Guiding principle

Generate code quickly, but judge it by the quality of the result.

Code should communicate intent clearly, solve the right problem, handle failure thoughtfully, and remain understandable and maintainable long after its initial implementation.