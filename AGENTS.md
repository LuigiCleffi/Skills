# AGENTS.md

## Purpose

This file is the entry point for AI agents working in this repository. It defines which project instructions to consult and how to apply them.

**Before starting a task, read this file and consult the relevant instruction files below.** Do not duplicate their contents here.

## Instruction Sources

### Clean Code Standards

`CleanCode_Uncle_Bob/README.md`

Read when writing, reviewing, refactoring, or modifying code. Apply its principles to clarity, simplicity, elegance, cohesion, error handling, maintainability, and attention to detail.

### Product Definition

- `ProductDefinition/plan.md` — product vision, goals, and planning context.
- `ProductDefinition/specs/spec-definition.md` — specification structure and requirements.
- `ProductDefinition/specs/spec-checklist.md` — specification completeness and validation.

Consult the relevant files when planning features, defining requirements, changing product behavior, or implementing functionality that depends on product specifications.

### Development Workflows

- `actions/dev.md` — development and implementation workflow.
- `actions/review.md` — code review workflow.
- `actions/tdd.md` — test-driven development workflow.
- `actions/uiux.md` — UI/UX decisions and design handoff from specs to dev and tdd.

Follow the applicable workflow for the task. Consult multiple workflows when necessary.

### Workflow Order

For a feature, follow the stages in this order: `ProductDefinition/plan.md`, then `spec-definition.md`, then `spec-checklist.md`, then `actions/uiux.md` when the change has a user-facing surface, then `actions/dev.md` (in TDD mode with `actions/tdd.md`), then `actions/review.md`. Apply the other instruction sources where the task needs them.

### UI/UX Design

`templates/UIUX/README.md`

Read when making UI/UX decisions for an approved specification: users and tasks, flows, screens and states, design system reuse, accessibility, copy, responsive layout, internationalization, AI-assisted features, and UI testing. It routes to one skill per section of the *UI/UX Design Guide*, consulted by `actions/uiux.md`.

### Databases (DBA): Oracle and PostgreSQL

`templates/DBA/README.md`

Read when writing SQL, designing or changing a schema, handling database security, loading or moving data, tuning queries, or administering a database. It routes to one folder per engine (`Oracle/`, `PostgreSQL/`); read only the folder for the engine the project uses.

### Data-Intensive Systems

`templates/DataSystems/README.md`

Read when choosing a data model or datastore, designing storage, encoding or schema evolution, replicating or partitioning data, picking transaction isolation, reasoning about faults, clocks, consistency or consensus, or building batch and stream pipelines. It routes to one skill per chapter of Martin Kleppmann's *Designing Data-Intensive Applications*.

### TDD Test Patterns

`templates/TDD/README.md`

Read when writing tests first, choosing the next test, getting a failing test to pass, or refactoring under green. It routes to one skill per chapter of Kent Beck's *Test-Driven Development: By Example*.

## Working Rules

1. **Understand before changing.** Inspect the relevant code, architecture, dependencies, existing conventions, and applicable instructions.
2. **Follow project context.** Treat existing, valid project patterns and product specifications as the default. Identify conflicts before making assumptions.
3. **Keep changes focused.** Implement the requested outcome without unrelated refactoring, unnecessary abstractions, or scope expansion.
4. **Preserve quality.** Prioritize correctness, security, clarity, simplicity, and maintainability. Do not sacrifice them merely to deliver faster.
5. **Verify changes.** Run appropriate tests and checks when possible. Never claim verification that was not performed.
6. **Report clearly.** Summarize what changed, relevant verification results, and any unresolved issues or limitations.

## Instruction Priority

When instructions conflict:

1. Follow applicable system and developer instructions.
2. Follow the most specific applicable project instructions and task requirements.
3. Use the general principles in `CleanCode_Uncle_Bob/README.md` and the established repository conventions.
4. If a material conflict remains unresolved, explain it rather than silently choosing an interpretation.

## Completion Standard

A task is complete when the requested outcome is implemented, relevant requirements are respected, appropriate verification has been performed where possible, and the result is maintainable.

**Read the relevant instructions, understand the problem, make the smallest appropriate change, and leave the codebase clear and reliable.**