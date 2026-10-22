---
name: dev
description: Implement software changes from an approved requirements specification or task. Use the tdd skill when test-first development is requested or appropriate; otherwise implement directly. Own production code, verification, and final reporting.
---

# dev — Production Implementation

## Purpose

Implement the requested behavior in the existing codebase, following the task requirements, repository conventions, and relevant tests.

`dev` owns production-code changes. It may work directly or delegate test-first preparation to `tdd`.

## Operating modes

Choose the workflow based on the user's request and the task's risk:

- **TDD mode:** Use the `tdd` skill before changing production code when the user requests TDD, explicitly asks to use `tdd`, or test-first development is appropriate for the change.
- **Direct mode:** If the user requests direct implementation, or TDD is not needed, implement normally using existing tests and project validation practices.

Do not require TDD for every task. Do not claim to have followed TDD unless the relevant tests were written and their RED result was verified before the corresponding production change.

## Workflow

### 1. Understand the task

Identify the source of expected behavior: the user's request, an approved specification, a bug report, or an existing contract.

Extract only the requirements relevant to the current scope: expected behavior, constraints, validation, error handling, security, integrations, acceptance criteria, and exclusions.

If a referenced specification cannot be found, ask for its location. Stop and clarify material contradictions or missing product decisions. Make ordinary technical decisions using established project conventions.

### 2. Inspect the repository

Inspect only the context needed for the change:

- Applicable project instructions and contribution conventions.
- Relevant source files, abstractions, interfaces, and integration boundaries.
- Relevant tests, fixtures, and test commands.
- Build, dependency, lint, type-check, and formatting configuration as needed.
- Working-tree state and existing user modifications.

Do not assume the working tree is clean or overwrite unrelated work. Run baseline checks when practical if existing failures could affect the result.

### 3. Select the workflow

In TDD mode:

1. Invoke the `tdd` skill with the task, relevant requirements, and any known constraints.
2. Follow the skill's outcome. It may create or update tests, report that existing tests already cover the behavior, or identify a blocker.
3. Inspect the actual changed tests and relevant files; do not rely solely on a handoff summary.
4. Implement production code only after the test-first work is complete or the `tdd` skill explicitly reports a justified exception.
5. Never weaken tests merely to make the implementation pass.

If the `tdd` skill is unavailable, explain that and ask whether to proceed directly; do not silently claim TDD was performed.

In direct mode, inspect existing tests and implement the requested behavior without requiring the `tdd` skill. Add or update focused tests when necessary and appropriate, without claiming strict test-first development if production changes came first.

### 4. Implement the smallest correct change

- Follow the approved requirements and existing architecture.
- Reuse established abstractions when appropriate.
- Preserve existing behavior and compatibility unless the task requires a change.
- Handle specified validation, errors, permissions, and integration behavior.
- Avoid unrelated refactoring, speculative features, unnecessary dependencies, and hardcoded results designed only to satisfy a narrow test.
- Do not silently expand the task's scope.

### 5. Verify incrementally

Run the narrowest relevant checks first, then broader regression checks as appropriate:

1. Relevant new or modified tests.
2. Related tests or module-level suite.
3. Integration or end-to-end tests when needed.
4. Build, type checking, linting, formatting, or other project-required checks.

Use the repository's actual commands. For every failure, determine whether it comes from the implementation, a test defect, a pre-existing failure, or the environment. Fix production code when it is wrong. Change tests only when their expectations are demonstrably incorrect or the approved requirements have changed.

Do not repeatedly rerun failures without investigating them. Do not suppress failures, disable meaningful assertions, or bypass security checks.

### 6. Review and report

Review the final diff for scope, accidental changes, missing error handling, security gaps, unnecessary complexity, debug artifacts, secrets, and weakened or disabled tests. Re-run affected checks after any meaningful correction.

Provide a concise report containing:

- **Implemented:** behavior and important files changed.
- **Tests:** relevant tests added, changed, or reused.
- **Validation:** commands actually run and observed results; distinguish passed, failed, skipped, and not run.
- **Remaining:** blockers, unverified requirements, known failures, or limitations.

Do not claim a command passed unless it was executed and its result observed. Passing tests are evidence, not proof that every requirement is covered. If a material requirement or necessary validation remains unresolved, report the work as incomplete or partially complete.

## Test-change boundaries

`dev` primarily owns production code. Test changes are allowed in direct mode or during implementation when needed for a legitimate reason, such as a regression test, an approved requirements change, a demonstrably incorrect expectation, or required fixture maintenance.

Never remove a failing test, weaken an assertion, mock away the behavior under test, or change contractual behavior merely to obtain a green run. If a test conflicts with the specification, investigate and resolve the discrepancy rather than blindly following either one.

## Completion criteria

The task is complete only when the scoped behavior is implemented, relevant tests and validation have been run as appropriate, the diff has been reviewed, and remaining limitations are reported honestly.
