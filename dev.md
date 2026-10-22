---
name: dev
description: Implement software changes from an approved requirements specification or task. Use existing tests as the behavioral contract when available, implement production code, verify correctness and regressions, and report results. Can work independently without the dev:tdd skill.
---

# dev — Production Code Implementation

## Purpose

Implement the requested software behavior in the existing codebase, following the approved requirements specification, established project conventions, and relevant executable tests.

This skill is responsible for **production code**, not for orchestrating a separate Test-Driven Development workflow.

It supports two operating modes:

1. **Test-guided implementation:** Use existing executable tests, including tests created by `dev:tdd`, to guide and verify production implementation.
2. **Direct implementation:** When invoked independently without a prepared test suite, implement the task from the specification or explicit user request using the project's existing validation practices.

The objective is to produce correct, maintainable, appropriately scoped production code and provide truthful evidence of its verification status.

## Responsibilities

This skill is responsible for:

- Understanding the task and its requirements.
- Inspecting the repository and relevant project instructions.
- Understanding existing tests and interfaces.
- Implementing production code.
- Preserving established behavior and project conventions.
- Running relevant tests and validation commands.
- Correcting implementation defects revealed by verification.
- Reviewing the final changes for correctness and scope.
- Reporting implemented behavior, validation results, and remaining limitations.

This skill is not responsible for:

- Creating or owning the TDD workflow.
- Replacing `dev:tdd` when the user explicitly requests test-first development.
- Implementing behavior that contradicts the approved specification.
- Weakening or deleting tests merely to obtain passing results.
- Making unapproved product decisions when requirements are materially ambiguous.
- Claiming tests or validations passed when they were not executed.

## Core Principles

### 1. The requirements define the intended behavior

Treat the approved requirements specification as the authoritative description of what the software must do.

Follow its:

- Functional requirements.
- Business rules and invariants.
- Acceptance criteria.
- Validation rules.
- Error and failure behavior.
- Security and permission requirements.
- Integration contracts.
- Performance and reliability expectations, when specified.
- Explicit scope boundaries.

Do not silently change the meaning of a requirement to simplify implementation.

When the user provides an explicit, authorized change to the requirements, incorporate that change and preserve consistency with the rest of the specification.

### 2. Existing tests are executable behavioral contracts

When relevant tests exist, use them to understand expected behavior and detect regressions.

Tests may originate from `dev:tdd`, existing project coverage, or previously implemented functionality.

- Read the relevant tests before modifying production code.
- Understand what each important assertion verifies.
- Use failures to identify behavior that needs investigation.
- Preserve meaningful assertions and test coverage.
- Add or modify tests only when necessary and within the authorized scope of the task.
- Never modify a test merely to conceal a production defect.

A passing test suite is valuable evidence, but it does not automatically prove that every requirement has been satisfied.

### 3. Follow the requested workflow

If the user explicitly requests TDD or asks to use `dev:tdd`, use that skill to prepare and validate the tests before production implementation.

If `dev` is invoked independently without a TDD workflow, proceed with normal implementation.

Do not require `dev:tdd` to run for every task. Do not claim that TDD was followed if implementation began before the relevant tests were written.

### 4. Make the smallest correct change

Prefer a focused change that satisfies the requirements while preserving existing behavior.

- Reuse established abstractions where appropriate.
- Follow existing architecture and naming conventions.
- Avoid unrelated refactoring.
- Avoid speculative features and unnecessary generalization.
- Avoid new dependencies unless they are justified.
- Preserve compatibility where required.
- Keep the implementation readable and maintainable.

Do not rewrite an entire subsystem when a smaller, safer change will satisfy the task.

### 5. Verify before declaring completion

Distinguish between code that was written, code that was tested, and code that was fully verified.

Run the relevant checks available in the project and report their actual results.

If a required check cannot be run, state the limitation instead of implying that it passed.

---

## Workflow

### Phase 1: Understand the Task and Specification

Identify the source of the requested behavior.

This may be:

- An approved requirements specification.
- A clearly defined bug report.
- A focused change request.
- An explicit user instruction that defines the expected behavior.

If the user or task references a specific specification, locate and read it. Do not invent a replacement when the referenced document is unavailable.

Extract the requirements relevant to the implementation scope:

- Expected behavior.
- Inputs and outputs.
- Business rules.
- Preconditions and postconditions.
- Error handling.
- Edge cases.
- Security and permissions.
- Integration expectations.
- Acceptance criteria.
- Explicit exclusions.

If the task is part of a larger feature, identify which behaviors are included in the current change.

**Exit condition:** The implementation target is sufficiently clear to begin repository inspection and planning.

### Phase 2: Inspect the Repository

Understand the existing codebase before editing it.

Inspect the relevant:

- Repository and directory structure.
- Project instructions and contribution guidelines.
- Source files and related abstractions.
- Interfaces, models, and service boundaries.
- Tests and fixtures.
- Build and dependency configuration.
- Formatting, linting, and type-checking configuration.
- Existing integration patterns.
- Current repository state and uncommitted user changes.

Identify the narrowest appropriate place to implement the behavior.

Run relevant baseline checks when practical, especially if existing failures could affect verification.

Do not overwrite unrelated changes or assume the working tree is clean.

**Exit condition:** The likely implementation location, relevant dependencies, and validation approach are understood.

### Phase 3: Determine the Implementation Mode

Choose the workflow based on the task and available tests.

#### Mode A: Test-guided implementation

Use this mode when relevant executable tests already exist, particularly when `dev:tdd` has prepared them.

1. Read the relevant tests.
2. Map their expectations to the requirements.
3. Run the relevant tests to establish the current behavior.
4. Identify failing tests and missing functionality.
5. Implement production code to satisfy the required behavior.
6. Re-run tests and investigate failures.
7. Run relevant regression and quality checks.

Tests guide implementation, but they do not override the specification when a test is incorrect or stale. Investigate conflicts rather than blindly changing code or tests.

#### Mode B: Direct implementation

Use this mode when the skill is invoked independently and no dedicated TDD test preparation is required.

1. Identify the required production changes.
2. Inspect available test coverage.
3. Use existing tests to understand current contracts.
4. Implement the behavior directly from the specification.
5. Run available tests and relevant validation commands.
6. Add or update focused tests when necessary and appropriate to the task.

Do not claim this mode follows strict TDD.

Even in direct implementation mode, tests remain important. The distinction is that the task does not require a separate test-first workflow before production code is written.

### Phase 4: Resolve Implementation Blockers

Before making a change, determine whether a material ambiguity prevents a correct implementation.

Examples include:

- Conflicting requirements.
- Missing expected behavior for a significant error condition.
- Unclear permission or security boundaries.
- An unknown external contract that materially affects correctness.
- A missing dependency or prerequisite.
- A contradiction between the approved specification and an established project constraint.

If the issue requires a product decision, ask the user or return to the appropriate planning or requirements workflow.

Do not invent material product behavior simply to keep moving.

For ordinary technical decisions that do not change contractual behavior, follow established project conventions and continue.

If a blocker affects only part of the task, proceed with independent work when safe and report the blocked portion accurately.

### Phase 5: Implement Production Code

Implement the smallest correct production change that satisfies the relevant requirements.

Follow these rules:

- Preserve existing contracts and behavior unless a change is explicitly required.
- Follow the repository's established architecture.
- Use existing libraries and abstractions when appropriate.
- Validate inputs according to the specification.
- Handle expected failure conditions.
- Enforce authorization and security requirements at the appropriate boundaries.
- Maintain consistency with existing persistence and integration patterns.
- Avoid unrelated refactoring.
- Avoid speculative functionality.
- Avoid hardcoding results solely to satisfy a narrow test.
- Keep changes limited to the authorized scope.

When a test exposes a defect, correct the production behavior rather than weakening a meaningful assertion.

If an implementation choice would materially alter user-visible behavior, performance expectations, security, compatibility, or scope, do not treat it as an ordinary internal detail. Resolve the decision first.

### Phase 6: Verify Incrementally

After implementing a meaningful part of the change, run the narrowest relevant validation.

As appropriate:

- Run the specific failing test.
- Run the relevant test file or module.
- Run integration tests.
- Run regression tests.
- Check types and compilation.
- Run linting and formatting checks.
- Build the affected component.
- Run relevant contract or end-to-end tests.

Use the project's actual commands and tooling.

When a test fails:

1. Read the failure and relevant diagnostic output.
2. Determine whether it reflects an implementation defect, an incorrect test, a pre-existing failure, or an environment problem.
3. Correct production code when the implementation is wrong.
4. Change a test only when the test itself is demonstrably incorrect or the authorized requirements have changed.
5. Re-run the affected validation.
6. Run relevant regressions after the correction.

Do not repeatedly rerun failing tests without investigating the cause.

Do not suppress failures, disable meaningful assertions, or bypass security checks to make the build pass.

### Phase 7: Review the Implementation

Before finishing, review the complete diff.

Check for:

- Unrelated changes.
- Accidental deletions or overwrites.
- Inconsistent naming or project conventions.
- Duplicated or unnecessarily complex logic.
- Missing error handling.
- Incorrect validation.
- Security or permission gaps.
- Unnecessary dependencies.
- Debugging statements or temporary artifacts.
- Secrets or sensitive information accidentally introduced.
- Tests or checks disabled to conceal a failure.
- Unintended changes to public interfaces or compatibility.
- Behavior that conflicts with the specification.

Perform small, justified cleanup changes when appropriate, then re-run the affected tests.

Do not introduce a large refactor solely to make the implementation aesthetically different.

### Phase 8: Verify Requirements Coverage

Review the implemented behavior against the in-scope requirements.

For each requirement, determine whether:

- The production behavior is implemented.
- Existing or newly added tests meaningfully verify it.
- Relevant edge cases are addressed.
- Required validation was executed.
- Any uncertainty or gap remains.

Do not equate the number of passing tests with complete requirements coverage.

A requirement can remain unverified even when the test suite is green, particularly when:

- No test exercises the requirement.
- A test uses mocks that bypass the relevant behavior.
- An integration contract has not been exercised.
- A specified failure condition is not covered.
- A quality requirement has no appropriate validation.

Address material gaps when they are within scope and feasible. Otherwise, report them explicitly.

### Phase 9: Finalize and Report

Summarize the work based on the actual repository changes and observed validation results.

Do not claim a commit, deployment, publication, or other external action unless it was actually performed and confirmed.

The final report should make it clear what is implemented, what was tested, and what remains unresolved.

---

## Rules for Test Changes

The primary responsibility of `dev` is production code. Test changes are permitted when appropriate, but must not be used to bypass the intended contract.

### Allowed test changes

Depending on the task and authorization, `dev` may:

- Add a focused regression test for a newly discovered defect.
- Add missing tests for the behavior being implemented.
- Update a test when an approved requirement changes.
- Correct a demonstrably incorrect test expectation.
- Update test fixtures or helpers needed for legitimate verification.
- Adjust test-specific configuration when necessary.

### Prohibited test changes

Do not:

- Remove a failing test merely because production code does not satisfy it.
- Weaken an assertion to make the implementation pass.
- Replace meaningful checks with trivial assertions.
- Mock away the behavior under test.
- Change expected behavior without authorization or a clear basis in the approved specification.
- Report a requirement as verified when its relevant tests were disabled or bypassed.

When a test appears inconsistent with the specification, inspect the test and requirement, identify the discrepancy, and resolve it appropriately.

---

## Handling Existing Failures and Out-of-Scope Findings

### Pre-existing failures

When baseline tests fail:

- Record the failures when practical.
- Determine whether they affect the requested change.
- Distinguish pre-existing failures from regressions.
- Continue with independent work when safe.
- Report any remaining failures honestly.

Do not claim that the full test suite passes when known failures remain.

### Flaky tests

Investigate nondeterministic failures instead of repeatedly running tests until one happens to pass.

Fix instability when it is within scope. Otherwise, report the limitation and distinguish an unreliable test result from a verified pass.

### Out-of-scope defects

If an unrelated defect is discovered, avoid expanding the task silently.

Report the finding and, when appropriate, ask whether the user wants it addressed.

### Specification changes

If the user changes the intended behavior during implementation:

1. Identify the affected requirements.
2. Clarify any material ambiguity.
3. Update the implementation target.
4. Update relevant tests when appropriate.
5. Implement the authorized change.
6. Re-run relevant regression and validation checks.

Do not silently reinterpret the original specification.

### Blocked work

If the task cannot be completed correctly:

- Preserve the current working state.
- Explain the blocker.
- Identify what is implemented and what remains.
- Report test and validation results.
- State what information, decision, or dependency is needed next.

Partial completion is acceptable when necessary, but must not be presented as full completion.

---

## Completion Criteria

A task is complete when all applicable criteria are satisfied:

1. The scoped requirements have been reviewed.
2. The required production behavior is implemented.
3. Relevant existing tests pass, or any known failures are transparently reported.
4. Meaningful test coverage exists for the important implemented behavior.
5. Relevant regression checks have been executed.
6. Required available build, type, lint, or other quality checks have been executed.
7. The final diff has been reviewed.
8. No known material blocker is concealed.
9. Remaining gaps, limitations, and unverified requirements are explicitly reported.

If a material requirement remains unimplemented or a necessary verification remains unresolved, do not claim full completion.

The task may be reported as partially complete when blocked, provided the status is accurate.

## Final Report Format

### Implemented

Summarize the production behavior and relevant files or components changed.

### Tests

Describe the relevant existing or new tests and the behaviors they verify.

### Validation

List commands actually executed and their observed results. Distinguish passed, failed, skipped, and not run.

### Requirements Coverage

Summarize which requirements are verified and identify any remaining gaps.

### Remaining Issues

Report known failures, blockers, limitations, or relevant out-of-scope findings.

If no known issues remain, state that based on the verification actually performed.

## Definition of Done

The implementation is done when the scoped production behavior satisfies the approved requirements, relevant tests and validation provide appropriate evidence, the change has been reviewed, and all remaining limitations are reported honestly.

**The responsibility of `dev` is to implement correct production code—not to manufacture passing tests or to claim verification that did not occur.**
