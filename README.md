# Skills Code Kit

Reusable instructions for AI coding agents to help developers build software that is clear, correct, maintainable, and aligned with product requirements.

**Skills Code Kit** provides focused instruction sets for Clean Code, development workflows, code reviews, test-driven development (TDD), behavior-driven development (BDD), domain-driven design (DDD), JavaScript, LLMs and machine learning systems, databases, data-intensive system design, DevOps and cloud infrastructure, marketing, product definition, and UI/UX decisions. Install the instructions you need directly into an existing project without cloning this repository.

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

### Without questions (agents and CI)

Every question has a flag, and `--yes` takes the default for the ones left, so an AI agent or a CI job can install the kit without a terminal:

```bash
npx skills-code-kit install --groups dev,review,tdd,harness --yes
```

- `--all` or `--groups a,b` picks the groups (`npx skills-code-kit list` shows them and what each requires).
- `--harness warn|block|none`, `--harness-helpers` / `--no-harness-helpers`, `--update-notice` / `--no-update-notice`, `--guards` / `--no-guards`, `--checks` / `--no-checks`, `--worktree-hook` / `--no-worktree-hook`, `--playwright` / `--no-playwright`, `--agents claude,codex,opencode`, and `--mcp claude,codex,opencode` answer the other questions (`none` for an empty list).
- Under `--yes` the defaults are: the harness hook warns, the harness helpers, guards, checks, worktree, and update notice hooks are on, Playwright only if it is configured, Scrum agents for the AI tools found in the project, no MCP server.
- Files you edited since the last install are kept unless you add `--overwrite`.

Without a terminal and without `--yes`, the installer stops with exit code 2 instead of waiting for an answer. `npx skills-code-kit --help` lists every command and option.

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

`tools/rules-check.mjs` keeps the "Project Rules" tables honest: unique IDs, retired IDs never reused, one-line rules, known "Enforced by" values, a "Why" on every row, no pointers to a context file by line number, cited paths that exist (paths workflows create later are listed in `tools/rules-check.json`), line budgets per `AGENTS.md`, and a `CLAUDE.md` that imports `AGENTS.md`. The generated `AGENTS.md` also says where a rule goes (nowhere, a check, a workflow, or a row), when a rule enters and leaves, and has an Exceptions section whose legacy list only shrinks.

**Installed files:**

`actions/review.md`, `tools/review-context.mjs`, `tools/rules-check.mjs`, `tools/rules-check.json`

Both reviews start from the project rules the diff reaches. Rules live once, as rows of the "Project Rules" table in an `AGENTS.md` (`| ID | Rule | Applies to | Enforced by | Checkable | Why |`), and a rule in `api/AGENTS.md` applies only under `api/`. `node tools/review-context.mjs <fixed-point>` (or `--worktree`) lists the rules the changed files fall under, separating the ones a linter, test, or hook already enforces, so the reviewer reads those rules instead of every convention file and cites them by ID.

`actions/code-review.md` is a separate, standalone review of the committed diff between `HEAD` and a fixed point you name (a commit, branch, tag, `main`, `HEAD~5`). It runs two axes in separate sub-agents. Standards checks the code against the repository's own documented conventions first, then against the installed knowledge base: the Clean Code heuristic catalog as the smell baseline, plus the JavaScript, LLM, TDD, BDD, DDD, DBA, DataSystems, DevOps, and UI/UX skills that match what the diff touches. Spec checks it against the originating issue or `SpecifyRequirements.md` and its companion records (`DomainModel.md`, feature files, `UIUXDecisions.md`, `StrategyBrief.md`). Every finding cites a rule, a heuristic code, or a spec line. The report keeps the two axes apart and never gives one blended verdict. Run it from a fresh session, not the one that wrote the code.

It reads the review comments already on the pull request and their replies, so a finding the author refuted is not raised again. A diff over about 15 files or 800 lines is split by unit and risk, and the report says what was reviewed in depth, lightly, or not at all. Only findings that change the merge decision stay (cost later, a pattern others will copy, data or security risk, a concrete failure, code that need not exist, text that lies), merged by fix and capped at about five per axis; each says which layer its fix belongs to, a guardrail that let it through first.

**Installed files:**

`actions/code-review.md`, `tools/review-context.mjs`

### 4. Architecture Decision Records (ADR)

**Purpose:** Give agents the project memory architects rely on, so a decision made once is followed everywhere instead of being re-decided in each session.

`actions/adr.md` keeps every architectural decision as its own file in `docs/adr/NNNN-short-title.md`: context, options considered, the decision, consequences, and a Compliance section concrete enough for an agent to follow and a reviewer to check. Accepted ADRs are never rewritten; a changed decision gets a new ADR that supersedes the old one.

`docs/adr/README.md` is the **ADR gate**. It is organized by what the agent is looking for ("add or change how data is stored", "authenticate a user", "call an external service"), with keywords and paths, and routes each intent to the ADRs that govern it. Before designing or implementing, the agent states what the task is about to decide or touch, reads the gate, and opens only the ADRs it points to. `ddd`, `uiux`, and `dev` consult the gate and record new decisions through `adr`. `review` and `code-review` check diffs against the routed ADRs and flag architectural decisions made without one.

**Installed file:**

`actions/adr.md`. The project's `docs/adr/` folder and its gate are created the first time a decision is recorded.

### 5. Test-Driven Development (TDD)

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
- `docs/qa/edge-cases.md` — the project's edge-case battery (also installed with BDD and QA).

The battery lists the cases the project's tests must cover whenever they apply: empty and oversized input, time zones, rounding, double submit, another tenant's ID, a 390 px screen, and so on. It starts with common defect classes marked `seed`; every escaped defect adds a row in the change that fixes it. `tdd` adds the matching rows to its test list, `bdd` turns the user-visible ones into scenarios, and `review` reports an applicable row without a test.

### 6. Databases (DBA): Oracle and PostgreSQL

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

### 7. Data-Intensive Systems

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

### 8. Product Definition

**Purpose:** Clarify what should be built and how success should be evaluated before implementation begins.

This group includes planning and specification documents to help define:

- Product goals and scope.
- Functional requirements and constraints.
- Acceptance criteria.
- Specification completeness and readiness.
- The relationship between product expectations and implementation work.

The specification step splits before it writes: a request that names an area, has several operations or roles, or needs "and" in its title is cut into vertical slices, and only the first is specified. It asks in rounds of up to four questions, each with a recommended answer, and turns what nobody can answer into an open question with an owner.

**Installed files:**

- `ProductDefinition/plan.md`
- `ProductDefinition/specs/spec-definition.md`
- `ProductDefinition/specs/spec-checklist.md`

### 9. UI/UX Decisions

**Purpose:** Make the UI/UX decisions for an approved specification and tell the developer which approach to follow, so the interface is not improvised during implementation.

`actions/uiux.md` sits between the specification and implementation. It reads the approved spec and checklist, inspects the existing design system, and writes `UIUXDecisions.md`: flows, screens and states, components, interaction rules, copy, accessibility target, layout and internationalization, the recommended TDD or direct mode and slice order for `dev`, and the UI acceptance checks `tdd` turns into tests. Product questions go back to the specification instead of being decided by design.

Screens are assembled, not drawn: before any markup it writes an inventory with one line per need and the component that serves it (design system first, then the app's shared components, then the prototype kit), and a component that does not exist becomes a candidate for design review instead of a one-off. It picks the surface by what each step asks of the user (toast, dialog, side panel, own route, or a row expanded in place), sends complex forms to their own page, and keeps controls honest: nothing disabled for a feature that does not exist, hidden instead of greyed out without permission, no form that pretends to save, destructive and bulk actions confirmed with their impact. Every state has its pattern (skeleton, empty state in place with its action, inline retry, specific error toast), interface text is label and value on the reader's clock while only an assistant converses, color has a function and comes from tokens, and motion uses two durations and stops traveling under reduced motion.

`UIUX/README.md` routes to one skill per section of the *UI/UX Design Guide* (Joel Parker Henderson, ed.), which `uiux` consults: foundations, design thinking, task analysis, ideation, product design, modeling diagrams, design systems, affordance and accessibility, implementation, internationalization, AI, testing, principles, and soft skills.

**Installed files:**

- `actions/uiux.md`
- `UIUX/` — the `README.md` entry point plus one skill folder per section.

### 10. DevOps and Cloud Infrastructure

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

### 11. Behavior-Driven Development (BDD)

**Purpose:** Make the agreed behavior concrete with examples before code exists, and keep those examples running as acceptance tests.

`actions/bdd.md` sits between the specification and implementation. It discovers the rules and key examples behind each user story, writes them as declarative Gherkin scenarios in the domain's language, confirms them with the user, and automates them as failing acceptance tests. `dev` then makes one scenario pass at a time, with `tdd` driving the units inside. It owns feature files and step definitions, never production code.

`BDD/README.md` routes to one skill per chapter of John Ferguson Smart's *BDD in Action*, grouped into `FirstSteps/`, `DefiningRequirements/`, `CodingTheBddWay/` and `TakingBddFurther/`: feature injection, example discovery, Gherkin, step definitions, UI and API automation, the link to unit testing, living documentation, and BDD in CI.

**Installed files:**

- `actions/bdd.md`
- `BDD/` — the `README.md` entry point plus one skill folder per chapter.

### 12. Domain-Driven Design (DDD)

**Purpose:** Give features a domain model the code can express, in the language the business uses, before scenarios, screens, and code are written.

`actions/ddd.md` sits between the specification and the examples. It places the change in a bounded context, maintains the ubiquitous language glossary, and writes `DomainModel.md`: entities, value objects, aggregates and their invariants, domain services, domain events, factories, repositories, layer placement, and translation at context edges. `bdd` writes scenarios in those terms, `uiux` labels the interface with them, and `dev` implements the model with the same names and boundaries.

`DDD/README.md` routes to one skill per chapter of Eric Evans's *Domain-Driven Design: Tackling Complexity in the Heart of Software*, grouped into `ModelInPractice/`, `BuildingBlocks/`, `DeeperInsight/` and `StrategicDesign/`.

**Installed files:**

- `actions/ddd.md`
- `DDD/` — the `README.md` entry point plus one skill folder per chapter.

### 13. Marketing and Product Strategy

**Purpose:** Give a marketing agent a knowledge base for strategy, positioning, the marketing program, and honest persuasion, and check every customer-facing spec against it before it is built.

`actions/strategy.md` sits between `spec-checklist` and `ddd`. It diagnoses the challenge a feature answers, names the best-fit customer and their real alternatives, checks value and positioning, recommends an approach and a first release with a hypothesis and a metric, and, when the product is itself a marketing tool, turns the relevant chapters into domain terms, rules, defaults, and honest-persuasion guardrails. It adds traced `STR` items to the checklist and writes `StrategyBrief.md`; product decisions go back to `spec-definition`.

`Marketing/README.md` routes to one folder per book, so the agent reads only the book that answers the task's question:

- `Marketing/GoodStrategyBadStrategy/` — one skill per chapter of *Good Strategy Bad Strategy* (Richard Rumelt), grouped into `GoodAndBadStrategy/`, `SourcesOfPower/` and `ThinkingLikeAStrategist/`.
- `Marketing/ObviouslyAwesome/` — one skill per chapter and positioning step of *Obviously Awesome* (April Dunford), grouped into `WhatIsPositioning/`, `PositioningProcess/` and `PuttingPositioningIntoPlay/`.
- `Marketing/MarketingManagement/` — one skill per chapter of *Marketing Management*, 16th Global Edition (Philip Kotler, Kevin Lane Keller and Alexander Chernev), grouped by the book's seven parts.
- `Marketing/Influence/` — one skill per chapter of *Influence: The Psychology of Persuasion* (Robert Cialdini), framed for honest use.

They help AI agents:

- Diagnose the challenge and write a strategy with a guiding policy and coherent actions, not a list of goals.
- Position a product against its real competitive alternatives and capture it in a canvas sales and marketing can use.
- Plan segmentation, value propositions, brands, pricing, communications, channels, and loyalty programs.
- Write copy, offers, and sales conversations that persuade with true claims and no dark patterns.

**Installed files:**

- `actions/strategy.md`
- `Marketing/` — the `README.md` entry point, plus `GoodStrategyBadStrategy/`, `ObviouslyAwesome/`, `MarketingManagement/` and `Influence/`, each with its own `README.md` and one skill folder per chapter.

### 14. JavaScript

**Purpose:** Teach agents to write idiomatic, correct JavaScript while they run the `dev`, `tdd`, `bdd`, and `review` workflows on a JavaScript or TypeScript project.

`JavaScript/README.md` routes to one skill per chapter of Marijn Haverbeke's *Eloquent JavaScript*, 4th edition, grouped into `Language/`, `Browser/` and `Node/`. Each skill gives the rules, idioms, a workflow, red flags, and testing notes for its topic; the project chapters are distilled into the design lessons they demonstrate.

They help AI agents:

- Avoid coercion, equality, floating-point, and mutation bugs, and choose the right data structure.
- Write small pure functions, use closures and higher-order functions, and design classes with private state.
- Handle errors, regular expressions, modules, promises, and `async`/`await` correctly.
- Work with the DOM, events, canvas, `fetch`, forms, and Node.js servers and file system safely.

**Installed files:**

- `JavaScript/` — the `README.md` entry point plus one skill folder per chapter.

### 15. LLMs and machine learning systems

**Purpose:** Teach agents to build, evaluate, and ship features that use large language models and other ML models, and to work on the models themselves.

`LLM/README.md` routes to one folder per book, each with its own `README.md` and one skill per chapter: Chip Huyen's *AI Engineering* (`AIEngineering/`), Jay Alammar and Maarten Grootendorst's *Hands-On Large Language Models* (`HandsOnLLM/`), Sebastian Raschka's *Build a Large Language Model (From Scratch)* (`BuildLLMFromScratch/`), and Chip Huyen's *Designing Machine Learning Systems* (`DesigningMLSystems/`).

They help AI agents:

- Choose between prompting, retrieval, agents, and fine-tuning, and evaluate every change against a versioned evaluation set.
- Use tokenizers, embeddings, semantic search, RAG, and pretrained models for classification, clustering, and generation.
- Understand and modify transformer internals: attention, the GPT architecture, pretraining, decoding, and LoRA.
- Build the data, features, deployment, and monitoring that keep a model working in production.

**Installed files:**

- `LLM/` — the `README.md` entry point, plus `AIEngineering/`, `HandsOnLLM/`, `BuildLLMFromScratch/` and `DesigningMLSystems/`, each with its own `README.md` and one skill folder per chapter.

### 16. Scrum Team of Role Agents

**Purpose:** Run a product request through Scrum with one agent playing each role, so the work is refined, planned, built, and accepted the way a real team would, with the user as the customer.

The roles say who works and when; each routes to the installed workflows and knowledge base for the how instead of repeating them:

- **PO:** the ordered Product Backlog, acceptance criteria, the Sprint Goal, and accepting the increment.
- **PM (Project Manager and Scrum Master):** the board, the ceremonies, impediments, and sprint metrics.
- **Tech Lead:** the bridge between PO and PM and the developers: design, tasks per role, the ADR gate, the Definition of Done, and review.
- **Dev:** full-stack production code and tests, including routine database work.
- **DBA:** schema, migrations with rollback, query performance, and data security.
- **DevOps:** CI/CD, infrastructure as code, environments, deployment, and monitoring.

Five ceremony playbooks (Backlog Refinement, Sprint Planning, Daily Scrum, Sprint Review, Retrospective) each end with a defined output. A sprint is bounded by scope (3 to 5 items by default) instead of days, and the Daily Scrum runs at the start of each session and whenever a task reaches Review. The board lives in the project at `docs/scrum/` (backlog, one file per sprint, Definitions of Ready and Done, working agreements), so a new session continues from the board alone.

The team stops for the user at four gates: the backlog and Sprint Goal, every new ADR, the Sprint Review, and every commit or merge.

Every time the team hands control back to the user, it ends with the same cycle handoff (`scrum/handoff.md`): what was implemented in this cycle, what is next and who owns it, and one question, such as whether to call the PO to plan the next step or let the team move on.

Selecting this group also installs the workflows it routes to: product definition, ADR, DDD, BDD, UI/UX, development, TDD, review, code review, and the pull request template. Clean Code, JavaScript, LLM, DBA, data-intensive systems, DevOps, and marketing are used when installed.

**Installed files:**

`scrum/` — the `README.md` entry point, `handoff.md` (the message that ends every cycle), `roles/` (one file per role), `ceremonies/` (one playbook per ceremony), and `board/` (the templates the PM copies to `docs/scrum/` on first use).

**Native agents per AI tool:** the installer looks for the tool the project uses and offers to install the six roles as that tool's own sub-agents, with the detected tools preselected. Each agent is a short wrapper that points to its role file, so the instructions live in one place.

| Tool | Detected by | Agents installed |
|---|---|---|
| Claude Code | `.claude/`, `CLAUDE.md` | `.claude/agents/scrum-<role>.md`, plus a `CLAUDE.md` that imports `AGENTS.md` when the project has none |
| OpenCode | `.opencode/`, `opencode.json`, `opencode.jsonc` | `.opencode/agents/scrum-<role>.md` (`mode: subagent`) |
| Codex | `.codex/` | `.codex/agents/scrum-<role>.toml` |

An existing `CLAUDE.md` is never replaced; the installer asks you to add `@AGENTS.md` to it when it does not mention `AGENTS.md`.

### 17. Pull Requests

**Purpose:** Give every pull request the same shape, so a reviewer sees what changed, why, how to try it, and what it looked like before and after, and make it arrive green.

`actions/pr.md` opens the pull request: it compares the change with its plan (`harness/gate.mjs scope`), runs the checks, writes the body from the template in the user's words (no process story, no terminal commands in the test steps, screenshots linked by commit SHA so they survive the branch's deletion, anything not done stated plainly), posts a **QA script** comment with what to run, watches CI until it settles and fixes failures from their logs, sorts review comments into change requests, suggestions, and questions, and checks the conditions before a merge, which stays the user's call.

The template has five sections: **What was implemented**, **Why**, **How to test it?** (the steps a person would follow in the browser), **How it was**, and **How it is** (one screenshot per test step).

The screenshots come from Playwright. The installer asks whether the project uses it:

- **Yes:** the generated `AGENTS.md` tells the agent to map each test step to a Playwright step and take the before and after screenshots with it. If the project has no `playwright.config` yet, the installer prints how to add one (`npm init playwright@latest`), and the agent asks you before setting it up.
- **No:** Playwright is not installed. The agent takes the screenshots only if its own tools can open the application in a browser; otherwise it leaves the two screenshot sections out.

The Scrum team installs this group, and the Tech Lead uses it when opening the sprint's pull request.

**Installed files:**

`actions/pr.md`, `.github/pull_request_template.md`

### 18. Business Knowledge Base

**Purpose:** Keep the business's memory the way ADRs keep the architecture's, so a rule learned once is followed everywhere instead of being rediscovered or broken in the next session.

`actions/knowledge.md` keeps `docs/knowledge/`: the ubiquitous language glossary, one file per business rule (`rules/BR-NNNN-*.md`) with its statement, examples, source, status, and where the code enforces it, and the research notes behind them. Only a decider moves a rule to **Confirmed**; rules harvested from code or found in research stay **Proposed** until the user confirms them.

`docs/knowledge/README.md` is the **knowledge gate**. It routes a business subject ("refunds", "customer tiers"), with keywords and paths, to the rules and notes that govern it. `spec-definition`, `ddd`, `bdd`, `dev`, `review`, and `code-review` consult it, and capture every rule they learn. **Harvest mode** reads one module of the existing code at a time for the rules it already enforces, and asks the user to confirm them: the project teaches the knowledge base.

The knowledge base is plain files in git, found through a routing table and `grep`, so every piece of context an agent uses can be read and reviewed. No vector database or embeddings are involved.

**Installed file:** `actions/knowledge.md`. The project's `docs/knowledge/` folder is created the first time something is captured.

### 19. Domain Research

**Purpose:** Bring outside knowledge (laws, regulations, standards, industry practice, competitor behavior) into a feature before it is specified, with a source for every claim.

`actions/research.md` runs after the plan and before `spec-definition` when the domain is unfamiliar, regulated, or rule-heavy. It frames the questions in business terms, searches online without revealing confidential project details, weighs sources by tier (primary law and standards first, forums never alone), and writes `docs/knowledge/research/RS-NNNN-*.md` with cited findings, conflicts, proposed rules, and the questions the user must answer. A finding becomes a requirement only after the user confirms it.

Selecting this group also installs the business knowledge base.

**Installed file:** `actions/research.md`.

### 20. Spec-Driven Harness

**Purpose:** Run every change through the workflow in order, as deep as its risk calls for, and keep the evidence, so an agent does not skip from the request straight to the code.

`actions/harness.md` classifies the request as a feature, fix, or chore, opens a run in `docs/harness/`, and runs the stages the run needs: plan, research, spec, checklist, strategy, DDD, BDD, UI/UX, the knowledge and ADR gates, then dev with TDD, review, and code review. Each stage is recorded as done with the record it produced, or skipped with a reason. The run record keeps the evidence and the user's approvals.

**Depth follows risk.** The run also declares the triggers the change hits: `schema`, `permission`, `public-contract`, `concurrency`, `new-entity`, `cross-module`. With none, the run stays light; with one, the mode's deeper stages join it (the domain model for a feature; the spec and the domain model for a fix whose cause is in the design). Triggers with paths are also detected: editing a migration in a run that did not declare `schema` is reported.

**Records are checked, not just present.** A stage counts as done only when its record passes the checks in `harness/config.json`: required headings, "Open Questions: None.", no leftover placeholders or `[NEEDS CLARIFICATION]` markers, and a word budget, because the agent reads every record before writing code. `node harness/gate.mjs validate <stage> <record>` runs them.

`harness/gate.mjs` reads `docs/harness/active.json` and checks changes to guarded paths (production code and tests, set in `harness/config.json`) against the run:

- **Claude Code:** the installer offers a `PreToolUse` hook in `.claude/settings.json`, merged with your existing settings. By default it **warns**: the agent and you see what is pending, once per session, and the edit goes through. Choose **block** to refuse the edit instead.
- **Any tool, git, or CI:** `node harness/gate.mjs check` reports guarded files changed before the run is ready, and fails only in block mode; `node harness/gate.mjs status` shows what is pending.

Why warn by default: a hook that blocks needs irreversible damage on the other side. Skipping a stage is recoverable, and a gate that blocks recoverable mistakes gets switched off by the first person it stops twice. Blocking is for the damage that does not come back, which is what the guards group does. The gate is not a security boundary.

**Risky changes become tasks; finished ones get QA.** With a trigger, the run adds a `tasks` stage before code: one task per object that changes, each with its files, its change, and the command that proves it, checked by the gate. After review, `qa` runs every acceptance criterion and applicable edge case for real and records the evidence; the gate accepts only a report whose verdict is PASS. A spec with more than three user stories is refused: split it.

**Escaped defects teach the battery.** A fix run opened for a defect that reached a user or QA records what shipped it, and closes only once `docs/qa/edge-cases.md` has the case that would have caught it. `node harness/gate.mjs escapes` counts them per month.

**Agents, models, and effort.** `actions/harness.md` sets how to spend: a factual check for docs and records, an adversarial fresh-context review for code, migrations, and ambiguous requirements; one reviewer by default and a second only for a distinct risk axis; never a reviewer on a weaker model than the author; and a miss diagnosed as "did not know" (give context or a stronger model) or "did not try" (raise the effort or add a check) before anything changes.

**Brief.** The installer offers two hooks that only inform (`--harness-helpers`, on by default). At each prompt, `node harness/gate.mjs brief` tells the agent, once per session and state, the active run, the next stage and its workflow, and how far the tasks are, so it does not answer a request from memory while a stage is pending. It also names the stage's effort tier from `context` in `harness/config.json` (`deep` stages decide and need the strongest model; `routine` stages carry out the records and a faster model is enough), and before `dev` and `code-review` it says to start from a fresh or compacted session, since the records are the handoff. The *Context budget* section of `actions/harness.md` covers the rest: read through the gates, keep command output short, brief sub-agents tightly. When an issue is saved through any issue tracker's MCP (`save_issue`, `create_issue`, `update_issue`), `node harness/gate.mjs issue` checks its body against `records.issue` (by default a Problem and an Acceptance criteria section, under 600 words) and warns.

**Territory.** Before a file is edited, the harness hook reminds the agent, once per session, of the knowledge gate, ADR gate, and interface rules rows whose `Paths` match it: "read BR-0003 before writing here", "read L, K, V, DONT".

**Coverage and the board.** `node harness/gate.mjs coverage [spec qa tasks]` checks that every criterion ID in the spec (`FR-001`, `US-1 AC-2`; `coverage.criteria` in the config) has a scenario in the QA report citing it, that the report cites nothing the spec lacks, and that no passed scenario has empty or placeholder evidence ("ok", "—"). Tasks must name files that exist (or are marked `(new)`), depend only on real tasks, and form no circle; the gate checks this once the tasks stage is done. `node harness/gate.mjs board` shows the tasks by status (`**Status:** todo | doing | done | blocked`) and the ones that can start now. Record checks ignore fenced code blocks, so an example in a record neither settles nor fails it.

**Scope.** `node harness/gate.mjs scope` lists the modules (the first two folders of a path) the branch touched that no record of the run names. A stray module usually comes from a merge resolved wrong or a fix committed to the wrong branch; it is a question, not a failure, so the command reports and exits 0. `node harness/gate.mjs status` also reads git, so code changed while the run was not ready shows up even if `active.json` says otherwise.

Selecting this group also installs product definition, domain research, the knowledge base, ADR, development, TDD, review, and QA. With the Scrum team installed, Sprint Planning opens one run per backlog item.

**Installed files:** `actions/harness.md`, `harness/gate.mjs`, `harness/config.json`.

### 21. Guards Against Irreversible Damage

**Purpose:** Refuse the few things an agent can do that cannot be undone, and nothing else.

`guards/guard.mjs` runs as a Claude Code `PreToolUse` hook on `Bash`, `Read`, `Edit`, and `Write`, configured in `guards/config.json`:

- **Secrets:** reading, copying, or sending `.env` files, keys, and credential files, by tool or in the shell (`cat .env`, `curl -d @.env`), and dumping the environment. `.env.example` and its kin stay readable.
- **Protected paths:** writing the folders your tools must own, such as migrations or generated code (`"protectedPaths": ["prisma/migrations/**"]`), by tool, redirect, copy, or in-place edit. Reading them is fine.
- **Destructive commands:** `rm -rf` on the root, home, or working folder, `git reset --hard`, `git clean -f`, a force push to main or master, piping a download into a shell, `chmod 777`, and `--no-verify` when the project has git hooks.
- **Protected branches:** on the branches you list in `"protectedBranches"` (empty by default), edits to files and the git commands that change the branch (commit, push, merge, rebase, cherry-pick, revert, pull). Reading and creating a new branch are fine.
- **Worktree isolation:** with `"worktreeIsolation": true`, a session may not write into another worktree of the same repository, which is another session's branch. Off by default.
- **One area per session:** in a repository of several apps or packages, `"sessionScope": { "units": ["apps/*", "packages/*"] }` keeps a session in the first unit it writes in, so "fix the button in app A" never rewrites app B; the root and everything outside the units stay writable. Folders listed in `"templates"`, which every future unit starts from, are refused unless the user asked (`GUARDS_ALLOW_TEMPLATES=1`). Off by default.
- **Queries against production:** `psql`, `mysql`, `mariadb`, `mongosh`, or `bq` against a target named by a production marker may run only one read-only statement given on the command line (`SELECT`, `WITH`, `EXPLAIN`, `SHOW`); a write, several statements, a script file, or an interactive session goes to the user.
- **Production cloud:** a `gcloud`, `aws`, `az`, `kubectl`, `helm`, or `terraform` command that changes something, when its arguments or environment name production by one of your `"production.markers"` (`--project=acme-prod`, `--profile prod`, `-var-file=production.tfvars`). Reading production (list, describe, get, logs, plan) passes, and a verb the guard does not know counts as a change. Set `"requireNonProduction": true` with `"nonProductionMarkers"` (`staging`, `dev`) to go further: a change passes only when the command proves its target is not production, because a command that names no target goes wherever the CLI's current project or context points. Empty by default.

It parses the command text, so it catches accidents, not an adversary. It follows `cd` and `pushd` inside a command, and forgets a `cd` made inside parentheses, so `cd db/migrations && echo x > m.sql` is checked where it runs. A heredoc body is treated as data, and a payload it cannot read is let through.

**Installed files:** `guards/guard.mjs`, `guards/config.json`.

### 22. QA That Runs and Proves

**Purpose:** Try to break a finished change before a person does, and keep the evidence.

`actions/qa.md` writes one scenario per acceptance criterion (from the spec, the feature files, or the UI acceptance checks) plus one per applicable row of the edge-case battery, then runs each for real: an existing test, a Playwright or browser run with a screenshot, an API call, or, only when nothing else can run, exact manual steps for a person. The report in `docs/qa/reports/` gives each scenario its result and evidence and an overall verdict; a failure goes back to `dev`. It never edits code or tests to make a scenario pass. A QA person can run it on a branch to get the scenarios to check by hand.

Before running anything, it checks the change against the tasks: MISSING CHANGE (a file a task names that the branch never changed) and UNEXPECTED CHANGE (a module the branch changed that no task names), from `node harness/gate.mjs scope` when the harness is installed. Every command it ran goes into `docs/qa/reports/<report>/run.sh`, so anyone can rerun the proof; the harness accepts a QA record only with its "Change against the tasks" section.

Before the battery it answers three questions about the change (the worst value its input accepts, what changes between runs, who else goes through the code, including callers the diff does not touch). A passed scenario on something risky (permissions, another tenant's data, money, a migration, a deletion) must also be shown to fail on the base. Results say what the proof varied, a scenario not run is `NOT VERIFIED`, never `PASS`, and a fresh agent that saw only the request and the diff checks that the change is what was asked. When the diff touches screens, it runs the UI review gate.

`actions/test-guide.md` writes manual test steps for a merged change in `docs/qa/guides/`, with the exact labels the screens show (read from the code), for the developer to approve before it is shared.

**Installed files:** `actions/qa.md`, `actions/test-guide.md`, `docs/qa/edge-cases.md`.

### 23. Worktree Slots for Parallel Sessions

**Purpose:** Let several agent sessions run the app at the same time, each in its own git worktree, without fighting over ports or sharing a database.

`node tools/worktree-slot.mjs`, run inside a worktree, gives it a slot that stays the same while it exists (the main checkout is 0; a new worktree takes the lowest free number) and writes `.worktree-slot.env` with its ports (base + slot × step) and names such as `DATABASE_NAME=app_wt2`, from `tools/worktree.json`. `--print` shows the values, `--list` the slots of every worktree. It creates no database and starts nothing; the generated `AGENTS.md` tells agents to use the file.

In `tools/worktree.json`, `"include"` names a file in the main checkout (`.worktreeinclude`) listing the untracked files a new worktree needs, such as `.env.local` (one per line, `*` within a folder); they are copied when missing and never overwritten. `"linkDependencies"` lists folders such as `node_modules` to link from the main checkout instead of installing again (off by default: a dependency change on the branch then needs its own install). A slot's port never lands on a port browsers refuse or on 5000 and 7000, which macOS gives to AirPlay.

A worktree removed by hand frees its slot, but its database and other resources stay behind; the script remembers them, warns when a new worktree gets that slot, and `--orphans` lists them with the cleanup command from `"cleanup"` (`"dropdb --if-exists {DATABASE_NAME}"`), which `--orphans --yes` runs.

The installer offers a Claude Code `SessionStart` hook that runs it when a session starts (`--hook` mode), so each worktree has its slot before anything is launched and the agent is told its ports and database in one line (default on; `--no-worktree-hook` to skip). The hook never stops a session: outside git, or on any error, it says nothing.

**Installed files:** `tools/worktree-slot.mjs`, `tools/worktree.json`.

### 24. Checks Before a Pull Request

**Purpose:** Make "the checks passed on this commit" something a hook can verify, so an agent does not open a pull request it would see go red.

`node checks/checks.mjs` compares the branch with its base (`origin/main` by default), runs the checks in `checks/config.json` that the changed files reach (a check with `when` runs only for the paths it lists; files matching `ignore`, such as docs, reach nothing), and when they all pass, stamps the commit in the git directory. It refuses to stamp uncommitted work, and a new commit needs a new run. A stamp stands only while the branch starts from the same point of the base: after a rebase or a merge of the base into the branch, the same commit sits on different code and the checks run again. `--waive "<reason>"` stamps without running, with the reason in the stamp for the pull request body to repeat; `status` says whether `HEAD` is stamped.

As a Claude Code `PreToolUse` hook, `node checks/checks.mjs hook` refuses `gh pr create`, a `gh api` call that creates a pull request, and any MCP `create_pull_request` from a commit with no stamp. It is the one block outside the guards: an opened pull request notifies reviewers and runs CI, and the way past it is one command with a reason. It does not replace CI, which proves the change on a clean machine; a pull request opened in the browser never passes through it. Add `node checks/checks.mjs pre-push` to a git `pre-push` hook (`.git/hooks/pre-push` or `.husky/pre-push`) to check every push as well: it reads the commits git is about to push, checks each one landing on a branch (not HEAD, so `git push origin HEAD:refs/heads/x` counts; tags and deletes do not), does nothing for a commit already stamped against the same base, and runs the checks without git's hook variables, so a check that runs `git init` in a temporary folder cannot rewrite the repository. When a check reads files another check's paths do not cover (a test that reads a config file), list those files in its `when`.

A check with `when` runs whenever a changed file matches it, even a file `ignore` lists; a check without `when` runs when anything outside `ignore` changed. `tools/mermaid-check.mjs` comes with the group: it parses every `mermaid` block in the Markdown files (all, the ones given, or `--changed`) with the real Mermaid parser and fails with file, line, and message for a broken diagram. It needs the project's own `mermaid` and `jsdom` (`npm install -D mermaid jsdom`) and exits 2 without them; `checks/config.json` has it as an example check on `**/*.md`.

`tools/rulers.mjs` checks conventions on the lines the change added, never the whole repository, so a convention can start today without a cleanup of old code. Rulers in `tools/rulers.json` refuse a pattern per added line or a comment block longer than a limit (starters: long comments, fixed waits in tests, `any` in TypeScript). Untracked files count as all added and renames are not new. A line opts out with the ruler's marker and a reason (`// ruler:allow-any — the SDK types this as any`); a marker without a reason fails. A file in a ruler's `"legacy"` list is tolerated until it complies, and then fails until it leaves the list, so the list only shrinks. A diff too wide to be one change gets no verdict. The checks pass `CHECKS_BASE` to every check, so the rulers measure against the same base.

**Screenshots.** When the diff touches the files in `"screenshots.when"` (components, styles), the pull request hook also needs an image in the body (not inside the template's HTML comments) or `<!-- no-screenshot: <reason> -->`, and refuses a GitHub image linked by branch instead of a commit SHA.

**Installed files:** `checks/checks.mjs`, `checks/config.json`, `tools/mermaid-check.mjs`.

### 25. UI Review Gate

**Purpose:** Open the states nobody opens while building.

`actions/ui-review.md` runs from `qa` or `dev` when a diff touches screens: each screen in every state (full with the longest real values, empty, loading, error, no permission), at 390, 820, 1180, 1440, and 2560 pixels and with side panels open with no sideways scroll, in a short window and every theme, after a reload (filters, tabs, and typed text must survive), with an accessibility scan (`serious` and `critical` count as Critical), a keyboard pass, reduced motion, every new control clicked (no dead, disabled, or fake controls), the surface and components checked against `uiux`, and the added lines checked for hard-coded colors, sizes, and spacing where the project has tokens. Findings are Critical (blocks the pull request), Improvement, or Suggestion, with screenshots.

**Installed files:** `actions/ui-review.md`.

### 26. Pull Request Review Assistant

**Purpose:** Save a human reviewer's time for the decisions only a person can judge.

`actions/pr-review.md` summarizes someone else's pull request in three lines (with a diagram when a flow changed), points to the commits and files no automated check covered, walks the reviewer through each decision one at a time (file and line, the test that proves it, the command to try it), turns their notes into change requests, suggestions, and questions, drops what a written rule already decides, and drafts the review. It publishes only what the reviewer approves.

**Installed files:** `actions/pr-review.md`.

### 27. Plain Answers Writing Style

**Purpose:** Replies a busy person can act on.

A Claude Code output style, `.claude/output-styles/plain-answers.md`, turned on in `.claude/settings.json` unless the project already chose another style: answer first, behavior instead of internals, a number instead of an adjective, the result instead of the diary, what is not done stated plainly, size that follows the stakes, one question at a time, and a form chosen by what the reader will do with the reply. It keeps Claude Code's coding instructions.

**Installed files:** `.claude/output-styles/plain-answers.md`.

### 28. Explore an Idea

**Purpose:** Question an idea before it becomes a plan.

`actions/explore.md` reads what the repository, the knowledge base, and the ADRs already say, finds the problem behind the idea, raises the honest objection, and lays out two or three options (always including the smallest one, and "do nothing" when that is honest) with their cost, risk, and what each leaves out. It writes no plan, spec, or code, and ends in a decision: go ahead with an option, wait, or drop it.

**Installed files:** `actions/explore.md`.

### 29. Interface Rules With IDs

**Purpose:** Write the product's interface rules once, short enough to check and with IDs stable enough to cite, so screens stop re-deciding them and defects stop coming back.

`docs/design/RULES.md` starts with a routing table (what is being built, its paths, which groups to read) and starter rules by group: laws in priority order (never overflow, what needs action first, no bare numbers, color has a function, four states per action, small screens are a redesign, no dead controls, charts that do not lie, contrast by size), components, tokens, motion, data honesty, writing, permissions, accessibility, the verification to run before saying done, and `DONT`, the defects found in this product. `tools/palette-check.mjs` checks the chart palette from the project's own CSS custom properties in every theme (`tools/palette.json`): every series at 3:1 or more against every surface, no two series the same, every pair at least 15 apart in OKLab, and no pair that looks the same under simulated protanopia, deuteranopia, or tritanopia. `actions/design-rules.md` keeps the rules: rules written as checkable statements, IDs never renumbered, reasons in `docs/design/BEHAVIOR.md`, laws changed only with the user, and every UI defect a rule did not prevent added as a `DONT` entry. `uiux` follows and cites the rules, `ui-review` runs their verification and scans the defects, and the harness edit hook points to the groups that govern a path.

**Installed files:** `actions/design-rules.md`, `docs/design/RULES.md`, `tools/palette-check.mjs`, `tools/palette.json`.

### 30. Cycle Metrics

**Purpose:** The numbers of a sprint, defined once, next to the previous sprint's.

`node tools/cycle-metrics.mjs --since <start> --until <end> [--markdown]` reads git and GitHub (through `gh`) and reports, for the window and the window of the same length before it: pull requests merged, hours to merge (median and slowest 10%), hours to a first look by someone else (bots excluded), the share merged with nobody else looking, changed lines per pull request and the share over 400, CI runs that failed, reverts, releases, and escaped defects from the harness run records. A number it cannot read is `n/a` with the reason, never estimated. The Scrum sprint review uses the table, and the three numbers that got worst become questions for the retrospective.

**Installed files:** `tools/cycle-metrics.mjs`.

### 31. Help for Anyone Working Here

**Purpose:** Get a newcomer, or someone who is not a developer, from "I just cloned this" to working, through failures, and back from a change they do not like.

- `tools/doctor.mjs` checks the machine from `tools/doctor.json` (a runtime version, dependencies installed, a settings file, a sign-in, access) and prints the fix command or the ready-to-send request for each problem. It only reads.
- `actions/start-here.md`: a first session runs the doctor, fixes what one command can, shows the requests that depend on someone else, explains the project in five plain lines, and ends by asking what they want to do.
- `actions/diagnose.md`: probe the real state before theorizing, match the symptom against `docs/diagnose.md` (the project's symptom, cause, and fix table, which grows with each new cause), fix what is code or one command, and say in one or two sentences what it was and what was done.
- `actions/undo.md`: one step back at a time, recoverably (unsaved changes set aside with `git stash`, saved ones reversed with `git revert`, never `reset --hard`), confirmed with "no" as the default, and shown; it says plainly whether anything deployed changed.

**Installed files:** `actions/start-here.md`, `actions/diagnose.md`, `actions/undo.md`, `tools/doctor.mjs`, `tools/doctor.json`.

### 32. Kit Update Notice

**Purpose:** Hear about a new version of the kit at the moment it matters: before the first request of a session.

`tools/kit-update.mjs` runs as a Claude Code `SessionStart` hook (`--update-notice`, on by default). When a newer `skills-code-kit` is on npm than the version in `.skills-code-kit/lock.json`, it tells the agent, with the command that updates the same groups (`npx skills-code-kit@<new> install --groups <installed> --yes`). It asks npm at most once every 8 hours, never installs anything, and says nothing when offline. `node tools/kit-update.mjs --check` asks right away.

**Installed files:** `tools/kit-update.mjs`.

### 33. Finish After the Merge

**Purpose:** Close out a merged change without losing work.

`actions/finish.md` proves the merge reached the base branch (including squash merges) before deleting anything, closes the harness run with its result, removes the worktree (freeing its slot) and the merged branches without ever forcing, captures what the change taught (a knowledge rule, a battery case, a check, a routing case), and suggests a version tag for the user to push.

**Installed files:** `actions/finish.md`.

## Optional MCP server

At the end of installation, the installer asks whether to also install the **Skills Code Kit MCP server** (default: no). It is not a separate project to maintain: the server ships inside this package and runs with `npx -y skills-code-kit@<version> mcp`, pinned to the version you installed, so it always matches the installed templates. The installer only registers it with the AI tools you pick, preselecting the ones it detects, and merges into each tool's existing configuration:

| Tool | Configuration written |
|---|---|
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` (passes `--project ${workspaceFolder}`) |
| OpenCode | `opencode.json` (an `opencode.jsonc` is never rewritten; you get the entry to add) |
| Codex | `.codex/config.toml` (read in trusted projects) |

What any MCP client then gets:

- **Tools:** `knowledge_gate` and `adr_gate` (state what the task is about and the paths it touches; get back the matching routing rows and the records they point to), `capture_rule` (writes a `BR-NNNN` rule and its gate rows in one step, and refuses a Confirmed rule without a decider), and `harness_status`, `harness_open_run` (with the run's triggers), `harness_declare_triggers` (adds a trigger found later, and its stages), `harness_set_stage`, `harness_close_run` (refuses `done` when the stage's record is missing or fails its checks, `skipped` without a reason, and closing a run with unsettled stages). The harness tools use the project's own `harness/gate.mjs`, so they and the hook never disagree.
- **Prompts:** one per installed workflow in `actions/` (`harness`, `research`, `ddd`, `dev`, and the rest), so a client can start any workflow by name.
- **Resources:** `AGENTS.md`, the knowledge and ADR gates, and the glossary.

The server reads the project from its working directory, or from `--project <dir>` or `SKILLS_CODE_KIT_PROJECT` when a client starts it elsewhere.

## Workflow order

When the workflow groups are installed together, a feature moves through them in this order, and the generated `AGENTS.md` lists the installed stages:

0. Exploration: `actions/explore.md`, when the request is still an idea; it ends in a decision to go ahead, wait, or drop it.
1. Product plan: `plan.md`.
2. Domain research: `actions/research.md`, when the domain is unfamiliar, regulated, or rule-heavy.
3. Specification: `spec-definition.md`, then `spec-checklist.md`.
4. Strategy review: `actions/strategy.md`, when the change is customer-facing or the product is a marketing tool.
5. Domain model: `actions/ddd.md`, when the change touches domain concepts or rules.
6. Examples and scenarios: `actions/bdd.md`, when the change has business behavior to illustrate.
7. UI/UX decisions: `actions/uiux.md`, when the change has a user-facing surface.
8. Implementation: `actions/dev.md`, with BDD scenarios as the outer loop and `actions/tdd.md` as the inner loop, or in direct mode, as `uiux` recommends.
9. Review: `actions/review.md`.
10. QA: `actions/qa.md`, with `actions/ui-review.md` when screens changed.
11. Code review: `actions/code-review.md` on the committed diff from a fresh session.
12. Pull request: `actions/pr.md`, after `checks/checks.mjs` stamps the commit.
13. After the merge: `actions/finish.md`, and `actions/test-guide.md` when people test by hand.

Architecture decision records run alongside every stage: `ddd`, `uiux`, and `dev` pass the ADR gate (`docs/adr/README.md`) before deciding and record each new architectural decision through `actions/adr.md`, and both reviews check the diff against the ADRs the gate routes to.

The business knowledge base runs alongside them the same way: every stage that specifies, models, builds, or reviews behavior passes the knowledge gate (`docs/knowledge/README.md`) and captures each rule it learns through `actions/knowledge.md`.

With the harness installed, `actions/harness.md` runs these stages for you, records each one in `docs/harness/`, and `harness/gate.mjs` flags code edits (or blocks them, if you chose that) until the stages before implementation are settled.

Clean Code, JavaScript, LLM, database, data-intensive system, DevOps, and marketing skills apply wherever the task needs them.

With the Scrum team installed, the ceremonies run these stages instead: Backlog Refinement covers product definition, strategy, and BDD discovery; Sprint Planning covers DDD, UI/UX, and the ADR gate; the Daily Scrum covers implementation and review per task; the Sprint Review covers acceptance and code review. The generated `AGENTS.md` then points to `scrum/README.md` instead of listing the stage order.

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

The generated file references the instruction groups selected during installation, and starts an empty **Project Rules** table: each rule the project enforces, written once with an ID, the globs it applies to, what enforces it (lint, test, hook, or review), whether a tool could check it, and why. Docs link to the ID instead of restating the rule, and reviews cite it.

AI tools vary in how they discover and interpret instruction files. Check your tool's documentation if additional configuration is required.

## Existing files and conflicts

The installer records the sha256 of every file it writes in `.skills-code-kit/lock.json`. On the next run it uses the lock to sort existing files:

- **Unchanged since the last install:** updated without asking.
- **Already identical to the new version:** left alone.
- **Changed by someone, or installed before the lock existed:** listed, and you choose whether to overwrite them. Declined files are skipped; merge them yourself if needed.

**Important:** If your project already contains a custom `AGENTS.md`, review the conflict list carefully before approving an overwrite.

## Updating the instructions

To run the latest published version:

```bash
npx skills-code-kit@latest
```

A rerun can name fewer groups than the first install: the files of the groups you name are installed or updated, and `AGENTS.md` keeps listing every group installed before (recorded in `.skills-code-kit/lock.json`).

To see what changed since the last install, without installing anything:

```bash
npx skills-code-kit verify
```

It lists installed files that were edited or deleted (and exits with an error when there are any, for CI), and files whose template is newer in the version you ran.

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
│   ├── review.md
│   └── code-review.md
├── bin/
│   ├── agents.ts
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
│   ├── JavaScript/
│   ├── LLM/
│   ├── Marketing/
│   ├── ProductDefinition/
│   ├── TDD/
│   ├── UIUX/
│   ├── actions/
│   ├── scrum/
│   └── .github/
├── package.json
└── tsconfig.json
```

| Location | Responsibility |
|---|---|
| `bin/cli.ts` | TypeScript source code for the installer. |
| `bin/agents.ts` | Detects the project's AI tool and generates the Scrum role agents in its native format. |
| `bin/mcp.ts` | The optional MCP server (`skills-code-kit mcp`): gate, rule, and harness tools, workflow prompts, and gate resources. |
| `bin/gates.ts`, `bin/rules.ts`, `bin/harnessRuns.ts`, `bin/markdown.ts` | What the MCP tools do: consult the gates, capture rules, and run the harness, over the Markdown records. |
| `bin/mcpConfig.ts` | Registers the MCP server in each AI tool's configuration. |
| `bin/lock.ts` | The install lock (`.skills-code-kit/lock.json`) and `skills-code-kit verify`. |
| `dist/cli.js` | Compiled executable invoked by npm. |
| `templates/` | Instruction files distributed to users. |
| `templates/DBA/` | Database skills, one folder per engine. `Oracle/` and `PostgreSQL/` each hold one skill per chapter of their book. |
| `templates/DataSystems/` | Data-intensive system design skills, one per chapter of *Designing Data-Intensive Applications*. |
| `templates/UIUX/` | UI/UX skill library, one skill per section of the *UI/UX Design Guide*, consulted by `actions/uiux.md`. |
| `templates/DevOps/` | DevOps skills, one folder per infrastructure: `Practices/`, `AWS/` and `Azure/`, each holding one skill per chapter of its book. |
| `templates/Marketing/` | Marketing skills, one folder per book: `GoodStrategyBadStrategy/`, `ObviouslyAwesome/`, `MarketingManagement/` and `Influence/`, each holding one skill per chapter. |
| `templates/DDD/` | DDD pattern library, one skill per chapter of Evans's *Domain-Driven Design*, consulted by `actions/ddd.md`. |
| `templates/BDD/` | BDD pattern library, one skill per chapter of *BDD in Action*, consulted by `actions/bdd.md`. |
| `templates/JavaScript/` | JavaScript skill library, one skill per chapter of *Eloquent JavaScript*, consulted by `dev`, `tdd`, `bdd` and `review`. |
| `templates/LLM/` | LLM and ML skills, one folder per book: `AIEngineering/`, `HandsOnLLM/`, `BuildLLMFromScratch/` and `DesigningMLSystems/`, each holding one skill per chapter. |
| `templates/TDD/` | TDD test pattern library, one skill per chapter of Kent Beck's book. |
| `templates/scrum/` | Scrum team: `roles/`, `ceremonies/`, and the `board/` templates copied to a project's `docs/scrum/`. |
| `templates/.github/` | The pull request template installed into a project's `.github/`. |
| `templates/harness/` | The harness gate script (`gate.mjs`) and its default `config.json`, installed to a project's `harness/`. |
| `templates/guards/` | The guards hook (`guard.mjs`) and its default `config.json`, installed to a project's `guards/`. |
| `templates/tools/` | `review-context.mjs`, which lists the project rules a diff reaches (installed with the review groups), and `worktree-slot.mjs` with its `worktree.json` (the worktrees group). |
| `templates/docs/qa/` | The edge-case battery, installed with TDD, BDD, and QA. |
| `tests/` | `node --test` suites for the installed scripts and the compiled installer modules. |
| `evals/routing/` | The routing eval's corpus and baseline, run by `scripts/routing-eval.mjs`. |
| `CleanCode_Uncle_Bob/` | Working copy of the core Clean Code standards. |
| `ProductDefinition/` | Planning and specification documents. |
| `actions/` | Development, review, code review, TDD, BDD, DDD, strategy, UI/UX, ADR, knowledge base, research, and harness workflows. |
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

Run `npm test` to build and run the tests in `tests/` (the harness gate, the guards, the review context, the install lock, and harness runs); the release script runs them too. Run `npm run check:frontmatter` to validate skill frontmatter on its own. A `description` that contains `: ` must be quoted, or GitHub and agent tools reject the whole file.

Workflows are routed by their `description`, so a new workflow or a reworded description can steal requests from another one. When you change one, run the routing eval:

```bash
npm run eval:routing                       # compares with evals/routing/baseline.json
npm run eval:routing -- --write-baseline   # after a change you accept
```

It asks the Claude Code CLI (`claude -p`, one short request per case) to route each request in `evals/routing/corpus.json` using only the descriptions, and fails below 0.90 accuracy, below 0.80 on the cases that have a workflow, on any request sent to the wrong workflow, or on a drop of more than 0.05 from the baseline. Add a case for every routing mistake you see in real use. The eval has no baseline yet: the first `--write-baseline` run sets it.

Use a patch version for fixes, a minor version for backward-compatible features, and a major version for breaking changes. The script does not commit; commit and tag the version change after publishing.

### Publishing from CI

`.github/workflows/ci.yml` runs the frontmatter check and the tests on every pull request. `.github/workflows/release.yml` publishes when a `v*` tag is pushed, with npm provenance, so a release can be traced to the commit that built it. Set up npm trusted publishing for this repository on npmjs.com (or add an `NPM_TOKEN` secret), then release with:

```bash
npm version minor --no-git-tag-version
git commit -am "1.2.0" && git tag v1.2.0 && git push origin main v1.2.0
```

## Guiding principle

Generate code quickly, but judge it by the quality of the result.

Code should communicate intent clearly, solve the right problem, handle failure thoughtfully, and remain understandable and maintainable long after its initial implementation.