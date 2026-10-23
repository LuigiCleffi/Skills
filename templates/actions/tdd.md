---
name: tdd
description: Prepare and validate tests before production implementation. Translate scoped requirements into focused executable tests, verify meaningful RED results when applicable, and leave production code unchanged.
---

# tdd — Test-First Preparation

## Purpose and ownership

Prepare or maintain executable tests for a requested behavior using a test-first workflow.

**This skill owns test code only. It must not create, modify, or delete production code.** `dev` owns production implementation and invokes this skill when TDD is requested or appropriate.

Keep work incremental and focused. Prefer actual test files and a concise handoff over lengthy planning prose.

## Test pattern library

When `TDD/README.md` is installed, it routes to one skill per chapter of Kent Beck's *Test-Driven Development: By Example*. Read only the skills that match the step you are on:

- Choosing and ordering tests: `TDD/Patterns/TDDPatterns/tddPatterns.md` (Test List, Test First, Assert First, Evident Data) and `TDD/Patterns/RedBarPatterns/redBarPatterns.md` (Starter Test, One Step Test, Learning Test, Regression Test).
- Writing the test itself: `TDD/Patterns/TestingPatterns/testingPatterns.md` (Child Test, Mock Object, Self Shunt, Log String, Crash Test Dummy) and `TDD/Patterns/XUnitPatterns/xUnitPatterns.md` (Assertion, Fixture, External Fixture, Exception Test).
- Step size, legacy code and judging test quality: `TDD/Patterns/MasteringTDD/masteringTDD.md`.

The skills under `TDD/MoneyExample/` and `TDD/XUnitExample/` show the same moves inside a worked session; consult them when a step needs an illustration.

## Workflow

### 1. Understand the scoped behavior

Use the user's request and approved requirements as the source of truth. Preserve requirement IDs where available. If a `spec-checklist` exists, use its resolved checklist as the coverage guide; do not treat unresolved product decisions as settled.

Inspect applicable project instructions, relevant production interfaces, existing tests and fixtures, test framework, and the narrowest useful test command.

If expected behavior is materially ambiguous, requirements conflict, or an external contract is unknown, ask `dev` to obtain clarification before writing tests for the affected behavior. Do not invent product requirements.

### 2. Write the test list

Before writing test code, list the tests the behavior needs: operations, boundaries, failure cases, and refactorings you expect. Keep it short and concrete. Order it so the first test is the one you can make pass easily and that teaches something; leave hard or uncertain items for later.

Work from this list one test at a time. Add new ideas to the list as they come up instead of chasing them immediately.

### 3. Assess existing coverage

Inspect relevant tests before adding anything.

- Reuse meaningful, current coverage when it already verifies the requirement.
- Add tests for missing behavior, important boundaries, and specified failure cases.
- Avoid duplicate tests, speculative edge cases, and abstractions that add little value.
- Prefer observable behavior over private implementation details.
- Mock external boundaries only when useful; do not mock away the behavior under test.

Choose the simplest test level that credibly verifies the contract: unit, integration, contract, or end-to-end.

### 4. Write or update tests only

Create focused executable tests derived from requirements or an explicitly authorized defect correction. Each test should have clear setup, action, and meaningful assertions.

- Write the assertion first, then the action, then the setup it needs.
- Use evident data: make the relationship between inputs and expected results visible in the test.
- Write the test against the interface you wish existed. A test that fails because a name or signature does not exist yet is a valid first RED for new behavior.
- Prefer the next test that moves one step: small enough that `dev` can make it pass quickly, big enough to teach something.

Cover success, boundary, validation, authorization, failure, and recovery scenarios when they are relevant to the specified behavior and risk.

Do not modify production code. Do not weaken existing assertions or change expected behavior simply to make tests pass.

### 5. Verify RED when applicable

Run the narrowest practical test command for each new or materially changed behavior.

- Confirm the test fails because the required behavior is missing or incorrect.
- A syntax error, test setup failure, missing dependency, or environment failure is not a valid RED result. A compile or type error caused only by the not-yet-existing production interface the test describes is acceptable, but report it as such.
- If the test unexpectedly passes, determine whether the behavior already exists, existing coverage is sufficient, or the test is ineffective.
- Never force a test to fail artificially.

When behavior is already implemented and a useful test passes, report that accurately. If a meaningful RED result cannot be established, explain why and leave implementation decisions to `dev`.

### 6. Handoff to `dev`

Leave production files unchanged. Point to actual repository paths rather than copying test contents into the response.

Use a compact handoff:

- **Scope:** behavior or requirement IDs covered.
- **Tests:** added/updated test paths and important test names.
- **Test list:** the items still pending, in the intended order, when the behavior is being built incrementally.
- **Command/result:** actual command and observed result (expected RED, passed because behavior already exists, or unable to run).
- **Coverage gaps/blockers:** material unresolved items only.

Do not duplicate the specification, repository analysis, full test code, or logs. `dev` can inspect the files directly.

For new behavior, prefer handing off one failing test (or a small group that one change will satisfy) at a time, so `dev` can go green and refactor before the next test is written. Hand off a larger batch only when the behavior is already designed and the tests are independent.

## Guardrails

- Never edit production code, even to make a test compile or pass.
- Never delete or weaken a meaningful test to accommodate current behavior.
- Never claim RED, GREEN, or successful verification without observing the result.
- Preserve unrelated user changes.
- Do not repeatedly rerun failures without investigating their cause.
- Report pre-existing failures and environment limitations that affect confidence.
- Report out-of-scope defects instead of silently expanding the task.
- Do not write many failing tests ahead of the implementation; a long red run hides which change broke what.

## Completion criteria

Test preparation is complete when existing coverage has been assessed, necessary tests have been written or updated, observed results are understood, production files remain unchanged, and `dev` has a concise handoff.
