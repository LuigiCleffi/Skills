---
name: tdd
description: Prepare and validate tests before production implementation. Translate scoped requirements into focused executable tests, verify meaningful RED results when applicable, and leave production code unchanged.
---

# tdd — Test-First Preparation

## Purpose and ownership

Prepare or maintain executable tests for a requested behavior using a test-first workflow.

**This skill owns test code only. It must not create, modify, or delete production code.** `dev` owns production implementation and invokes this skill when TDD is requested or appropriate.

Keep work incremental and focused. Prefer actual test files and a concise handoff over lengthy planning prose.

## Workflow

### 1. Understand the scoped behavior

Use the user's request and approved requirements as the source of truth. Preserve requirement IDs where available. If a `spec-checklist` exists, use its resolved checklist as the coverage guide; do not treat unresolved product decisions as settled.

Inspect applicable project instructions, relevant production interfaces, existing tests and fixtures, test framework, and the narrowest useful test command.

If expected behavior is materially ambiguous, requirements conflict, or an external contract is unknown, ask `dev` to obtain clarification before writing tests for the affected behavior. Do not invent product requirements.

### 2. Assess existing coverage

Inspect relevant tests before adding anything.

- Reuse meaningful, current coverage when it already verifies the requirement.
- Add tests for missing behavior, important boundaries, and specified failure cases.
- Avoid duplicate tests, speculative edge cases, and abstractions that add little value.
- Prefer observable behavior over private implementation details.
- Mock external boundaries only when useful; do not mock away the behavior under test.

Choose the simplest test level that credibly verifies the contract: unit, integration, contract, or end-to-end.

### 3. Write or update tests only

Create focused executable tests derived from requirements or an explicitly authorized defect correction. Each test should have clear setup, action, and meaningful assertions.

Cover success, boundary, validation, authorization, failure, and recovery scenarios when they are relevant to the specified behavior and risk.

Do not modify production code. Do not weaken existing assertions or change expected behavior simply to make tests pass.

### 4. Verify RED when applicable

Run the narrowest practical test command for each new or materially changed behavior.

- Confirm the test fails because the required behavior is missing or incorrect.
- A syntax error, test setup failure, missing dependency, or environment failure is not a valid RED result.
- If the test unexpectedly passes, determine whether the behavior already exists, existing coverage is sufficient, or the test is ineffective.
- Never force a test to fail artificially.

When behavior is already implemented and a useful test passes, report that accurately. If a meaningful RED result cannot be established, explain why and leave implementation decisions to `dev`.

### 5. Handoff to `dev`

Leave production files unchanged. Point to actual repository paths rather than copying test contents into the response.

Use a compact handoff:

- **Scope:** behavior or requirement IDs covered.
- **Tests:** added/updated test paths and important test names.
- **Command/result:** actual command and observed result (expected RED, passed because behavior already exists, or unable to run).
- **Coverage gaps/blockers:** material unresolved items only.

Do not duplicate the specification, repository analysis, full test code, or logs. `dev` can inspect the files directly.

## Guardrails

- Never edit production code, even to make a test compile or pass.
- Never delete or weaken a meaningful test to accommodate current behavior.
- Never claim RED, GREEN, or successful verification without observing the result.
- Preserve unrelated user changes.
- Do not repeatedly rerun failures without investigating their cause.
- Report pre-existing failures and environment limitations that affect confidence.
- Report out-of-scope defects instead of silently expanding the task.

## Completion criteria

Test preparation is complete when existing coverage has been assessed, necessary tests have been written or updated, observed results are understood, production files remain unchanged, and `dev` has a concise handoff.
