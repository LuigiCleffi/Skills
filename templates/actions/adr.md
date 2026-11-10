---
name: adr
description: "Keep the project's architecture decision records. Before any design or implementation work, pass the ADR gate: read docs/adr/README.md, match what the task is about to decide or touch against its routing table, and read only the ADRs it points to, so earlier decisions are followed instead of re-decided. After an architectural decision is made, write one ADR file for it (context, options, decision, consequences, how to comply) and add it to the gate. Owns docs/adr/ and its gate; never production code. Use from ddd, uiux, dev, review, and code-review whenever a change chooses or depends on structure, technology, boundaries, data, integration, security, or deployment."
---

# adr — Architecture Decision Records and the ADR Gate

## Purpose and ownership

Architects read a project's ADRs to learn why it is built the way it is. Agents need the same memory: without it, each session re-decides what an earlier session already settled, and the codebase drifts into several answers to one question.

`adr` keeps that memory in two parts:

- **The ADRs:** one file per architectural decision in `docs/adr/`, holding the whole decision: context, options considered, the decision, its consequences, and how code complies with it.
- **The gate:** `docs/adr/README.md`, the only ADR file an agent reads first. It routes the agent from *what it is looking for* to the ADRs that answer it, so the agent never has to read every record to find the one that applies.

`adr` owns `docs/adr/` (or the project's existing ADR folder). It does not change product intent, write production code, or write tests.

## Position in the workflow

```text
plan → spec-definition → spec-checklist → [strategy] → ddd → bdd → uiux → dev → review → code-review
                                                          │            │      │       │          │
                                                          └────────────┴──────┴───────┴──────────┘
                                                            consult the gate before deciding;
                                                            record every decision made
```

`adr` is not a stage that runs once. It has two modes, used by every stage that designs, builds, or judges structure:

- **Consult** — before designing or implementing, pass the gate. Always run it; it is cheap when nothing matches.
- **Record** — after an architectural decision is made, write its ADR and update the gate in the same change.

## Skill boundaries

- `spec-definition`: decides **what** the product does. A product question is never settled in an ADR; send it back.
- `ddd`: decides the domain model. Bounded contexts, context relationships, and layering choices that outlive the feature are recorded as ADRs; the per-feature model stays in `DomainModel.md`.
- `uiux`: decides the interface. Front-end architecture choices (state management, design system adoption, rendering strategy) are recorded as ADRs; screen-level decisions stay in `UIUXDecisions.md`.
- `dev`: consults the gate before implementing and asks `adr` to record any architectural decision it makes or the user confirms.
- `review` and `code-review`: check the diff against the accepted ADRs the gate routes to, and flag architectural decisions the diff makes without an ADR.

Do not copy another skill's full workflow into this skill. Invoke it and use its output.

## What counts as an architectural decision

Record a decision when it is **hard to reverse, shapes code beyond the current change, or would be made differently by the next person who does not know about it**. Typical areas:

| Area | Examples |
|---|---|
| Structure | Layering, modules, monolith vs services, ports and adapters, folder and package boundaries |
| Domain boundaries | Bounded contexts, context relationships, anti-corruption layers, which context owns which data |
| Technology | Language, framework, runtime, major libraries, build tooling |
| Data | Datastore choice, data model, schema evolution and migration policy, caching, consistency and isolation level |
| Integration | API style (REST, GraphQL, RPC, events), versioning, messaging, sync vs async, retries and idempotence |
| Security | Authentication, authorization model, tenancy isolation, secrets handling, encryption |
| Quality attributes | Performance budgets, scalability approach, availability targets, observability stack |
| Delivery | Deployment topology, infrastructure as code tool, CI/CD strategy, environments, cloud platform |
| Cross-cutting conventions | Error handling strategy, logging format, configuration, feature flags, testing strategy |
| AI and ML | Model provider and model choice, RAG vs fine-tuning, evaluation policy, prompt and tool boundaries |

Do **not** write an ADR for local implementation choices (a helper's name, a loop shape), styling, or anything a linter, formatter, or existing ADR already decides. When unsure, ask: *would a new engineer, or a new agent session, plausibly choose differently here?* If yes, record it.

## The ADR gate (`docs/adr/README.md`)

The gate answers one question for the agent: **"I am about to do X — which decisions already govern X?"** It is organized by what the agent is looking for, not by ADR number.

### Gate format

```markdown
# Architecture Decision Records — Gate

Read this file before designing or implementing. Find every row whose
"Looking for / about to" or "Paths" matches the task, then read only
those ADRs. Accepted ADRs are binding; follow them or propose a superseding ADR.

## Routing

| Looking for / about to… | Keywords | Paths | Read |
|---|---|---|---|
| Add or change how data is stored | database, schema, migration, ORM, table | `src/db/**`, `migrations/**` | [ADR-0002](0002-use-postgresql.md), [ADR-0005](0005-expand-contract-migrations.md) |
| Add an endpoint or change an API contract | API, endpoint, route, versioning, REST | `src/api/**` | [ADR-0003](0003-rest-with-url-versioning.md) |
| Authenticate or authorize a user | login, session, token, role, permission | `src/auth/**` | [ADR-0004](0004-oidc-with-rbac.md) |
| Put code in a layer or create a module | layer, module, domain, adapter | `src/**` | [ADR-0001](0001-hexagonal-architecture.md) |

## Register

| ADR | Title | Status | Date | Areas |
|---|---|---|---|---|
| [0001](0001-hexagonal-architecture.md) | Hexagonal architecture for the backend | Accepted | 2026-01-10 | Structure |
| [0002](0002-use-postgresql.md) | PostgreSQL as the primary datastore | Accepted | 2026-01-12 | Data |
```

Rules for the gate:

- **Every accepted or proposed ADR has at least one routing row.** An ADR the gate does not route to is invisible to agents.
- **Rows describe intent in task words**, the way an agent would phrase what it is doing ("add a background job", "call an external service"), not the ADR's title.
- **Keywords and paths widen the match.** List the terms and globs a task would mention or touch.
- **Superseded and deprecated ADRs leave the routing table** and stay in the register, marked with their status and successor, so history is kept without misleading anyone.
- Keep the gate short enough to read in one pass. Merge rows that route to the same ADRs; split a row when one intent routes to unrelated decisions.

## ADR file format

Store each decision as `docs/adr/NNNN-short-kebab-title.md`, numbered in sequence and never renumbered.

```markdown
# ADR-NNNN: [Decision in a short active phrase]

**Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-MMMM](MMMM-....md)
**Date:** YYYY-MM-DD
**Deciders:** [the user, product owner, team, or who confirmed it]
**Areas:** Structure | Domain boundaries | Technology | Data | Integration | Security | Quality attributes | Delivery | Conventions | AI and ML
**Related:** spec, DomainModel.md, UIUXDecisions.md, issues, other ADRs (supersedes, amends, depends on)

## Context
The problem, the forces, and the constraints that made a decision necessary: requirements (with IDs), quality attributes, existing code, team or platform limits. Facts, not the answer.

## Options considered
### Option A — [name]
How it works here; pros; cons; cost and risk.
### Option B — [name]
...
(At least two real options, one of which may be "keep doing what we do now".)

## Decision
The chosen option and the reason it wins against the forces above, in a few sentences. State the scope: what this applies to and what it does not.

## Consequences
- **Positive:** what becomes easier.
- **Negative:** what becomes harder, the debt accepted, and the risks.
- **Follow-up:** work this decision creates (migrations, docs, tickets).

## Compliance
How to follow this decision in code, concretely enough for an agent to act on and a reviewer to check:
- Rules: "Domain modules import nothing from `src/infrastructure/**`."
- Where it applies: paths, modules, or kinds of change.
- How it is enforced: lint rule, architecture test, review checklist, or "review only".
- Allowed exceptions, if any, and how to request a new one.

## Gate entries
The routing rows this ADR adds to `docs/adr/README.md`, so the gate and the record stay in step.
```

Omit sections that genuinely do not apply, except **Context**, **Decision**, **Consequences**, and **Compliance**, which every ADR needs.

## Workflow

### Consult mode — pass the gate

Run before designing or implementing, and before judging a diff.

1. **State what you are looking for.** In one line, write what the task is about to decide or touch: the intent ("add a webhook receiver"), the areas from the table above, and the paths you expect to change.
2. **Open the gate.** Read `docs/adr/README.md`. If it does not exist, look for an existing ADR folder (`docs/adr/`, `docs/decisions/`, `adr/`, `architecture/decisions/`) and use it; if there is none, note "ADR gate: no records yet" and continue.
3. **Match.** Select every routing row whose intent, keywords, or paths match your line from step 1. When in doubt, include the row; reading one extra ADR is cheaper than violating one.
4. **Read only the matched ADRs.** Do not read the rest.
5. **Apply them.**
   - **Accepted:** binding. Follow its Compliance section.
   - **Proposed:** not yet binding; tell the user it affects the task and ask whether to follow it.
   - **Superseded or deprecated:** follow the successor instead.
6. **Handle conflicts.** If the task cannot be done within an accepted ADR, stop on that item. Explain the conflict and either adapt the approach or propose a superseding ADR in record mode. Never silently deviate.
7. **Report.** List the ADRs consulted and how each constrains the work, or "ADR gate: no matching records".

### Record mode — write the decision

Run when an architectural decision is made: by the user, in `ddd` or `uiux`, during `dev`, or when a review finds an undocumented one already in the code.

1. **Check it is new.** Search the gate's register for an ADR on the same question. If one exists, amend nothing: write a new ADR that supersedes it.
2. **Gather the context.** Requirements and their IDs, the existing code and patterns, constraints, and the quality attributes at stake. When the installed knowledge base covers the area (`DataSystems/`, `DBA/`, `DevOps/`, `DDD/`, `LLM/`, `JavaScript/`), read the skills its README routes to and use them to frame the options and trade-offs.
3. **Lay out the options.** At least two real options with their trade-offs in this project, not in general.
4. **Confirm the decision.** An architectural decision belongs to the user or the people they name. Recommend one option with its reason and ask; mark the ADR **Proposed** until it is confirmed, then **Accepted** with the deciders recorded. A decision the user already gave is recorded as given.
5. **Write the ADR** with the next free number, in the format above. Make the Compliance section specific enough to check.
6. **Update the gate in the same change:** add the routing rows from the ADR's *Gate entries* and a register row.
7. **Supersede cleanly.** When the new ADR replaces an old one, set the old one's status to `Superseded by ADR-NNNN` (the only edit an accepted ADR ever receives), remove its routing rows, and point the register at the successor.
8. **Hand off.** Give the ADR path, its status, and the Compliance rules the current task must follow.

### Retroactive records

When the code already embodies an undocumented architectural decision that the current task depends on, record it as it is: the context as far as it can be reconstructed, the options that were plausibly available, and the decision as the code shows it. Mark it **Proposed** and ask the user to confirm it. Do not invent history; write "Rationale not recorded" where the reason is unknown.

## Guardrails

- One decision per ADR. Split a record that decides two independent things.
- Accepted ADRs are immutable apart from their status line. Change a decision by superseding it.
- Never record a product decision, a business rule, or a guess about domain knowledge as an ADR.
- Never mark an ADR **Accepted** without a decider's confirmation.
- Never leave an ADR out of the gate, or a gate row pointing to a missing or superseded ADR.
- Do not write ADRs for decisions that are not architectural; noise in the gate makes agents skip it.
- Do not write production code or tests.
- Preserve unrelated user changes in the repository.

## Completion criteria

Consult mode is complete when the task's intent, areas, and paths were stated, the gate was read, every matching ADR was read and applied or its conflict raised, and the consulted ADRs were reported.

Record mode is complete when the decision has its own ADR with Context, Options, Decision, Consequences, and Compliance; its status reflects whether a decider confirmed it; the gate routes to it from every intent that should find it; any superseded ADR is marked and removed from the routing table; and the caller has the Compliance rules to follow.
