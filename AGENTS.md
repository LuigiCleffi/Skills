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

Follow the applicable workflow for the task. Consult multiple workflows when necessary.

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