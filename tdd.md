---
name: tdd
description: Prepare and validate tests before production implementation. Translate the task's requirements into focused executable tests, verify meaningful RED results when applicable, and leave production code unchanged.
---

# tdd — Test-First Preparation

## Purpose and ownership

Prepare or maintain executable tests for a requested behavior using a test-first workflow.

**This skill owns test code only. It must not create, modify, or delete production code.** The `dev` skill owns production implementation and may invoke this skill when TDD is requested or appropriate.

Keep the work incremental and focused. Do not produce long planning reports when concise notes and actual test files are sufficient.

## Workflow

### 1. Understand the scoped behavior

Use the user's task or approved specification as the source of truth. Identify only the requirements relevant to this change, preserving requirement IDs where available.

Inspect the applicable project instructions, relevant production interfaces, existing tests and fixtures, test framework, and the narrowest useful test command. Reuse established conventions.

If the expected behavior is materially ambiguous, requirements conflict, or a necessary external contract is unknown, ask for clarification before writing tests for the affected behavior. Do not invent product requirements.

### 2. Check existing coverage

Inspect relevant tests before adding anything.

- Reuse meaningful, current coverage when it already verifies the requested behavior.
- Add tests for missing behavior, important boundaries, and specified failure cases.
- Avoid duplicate tests, exhaustive speculative edge cases, and test-only abstractions that add complexity without value.
- Prefer observable behavior over private implementation details.
- Use mocks only to isolate appropriate external boundaries; do not mock away the behavior being tested.

Choose the simplest test level that credibly verifies the contract: unit, integration, contract, or end-to-end.

### 3. Write or update tests only

Create focused executable tests derived from the requirements or an explicitly authorized defect correction.

Tests should have clear setup, action, and meaningful assertions. Cover relevant success behavior, boundaries, and failure behavior based on the actual requirements and risk.

Do not modify production code. Do not weaken existing assertions or alter expected behavior simply to make tests pass.

### 4. Verify RED when applicable

Run the narrowest practical test command for each new or materially changed behavior.

- Confirm that the test fails because the required behavior is missing or incorrect.
- If it fails because of syntax, test setup, dependencies, or the environment, fix the test-side issue when within scope; that failure is not a valid RED result.
- If it unexpectedly passes, determine whether the behavior already exists, existing coverage is sufficient, or the test is ineffective.
- Do not force a test to fail artificially just to satisfy the process.

When the behavior is already implemented and a useful test passes, report that accurately instead of inventing a failing test. When a meaningful RED result cannot be established, explain why and leave implementation decisions to `dev`.

### 5. Handoff to `dev`

Leave production files unchanged and return a concise handoff. Point to actual repository paths rather than copying test contents into the response.

Use this format:

- **Scope:** brief behavior or requirement IDs covered.
- **Tests:** added/updated test paths and important test names.
- **Command/result:** actual command and whether it showed expected RED, passed because behavior already exists, or could not be run.
- **Gaps/blockers:** only material unresolved items.

Do not duplicate the full specification, repository analysis, test code, or logs in the handoff. `dev` can inspect the files directly.

## Guardrails

- Never edit production code, even to make a test compile or pass.
- Never delete or weaken a meaningful test to accommodate current behavior.
- Never claim RED, GREEN, or successful verification without observing the relevant test result.
- Preserve unrelated user changes.
- Do not repeatedly rerun failures without investigating their cause.
- Report pre-existing failures and environment limitations when they affect confidence.
- If a defect outside the requested scope is found, report it instead of silently expanding the task.

## Completion criteria

Test preparation is complete when the relevant existing coverage has been assessed, necessary tests have been written or updated, their observed execution result is understood, production files remain unchanged, and `dev` has enough concise information to proceed.
