---
name: dev:tdd
description: Implement an approved requirements specification using strict Test-Driven Development (TDD). Translate formal requirements into executable tests, follow the RED-GREEN-REFACTOR cycle, implement the smallest correct changes, and verify behavior, regressions, and requirements coverage.
---

# dev:tdd — Specification-Driven Test-Driven Development

## Purpose

Implement software from an approved, testable requirements specification using strict Test-Driven Development.

The requirements specification is the behavioral contract. Its requirements define what the software must do; executable tests provide repeatable evidence that the implementation satisfies that contract.

The objective is to produce working, maintainable code whose observable behavior is verified by tests and traceable to the specification.

**The implementation must follow RED → GREEN → REFACTOR. Never write or modify production code to satisfy a requirement before first creating a test that fails for the expected reason.**

This skill owns the implementation workflow, from understanding the existing codebase through verifying the finished change.

## Core Principles

### 1. The specification is the source of truth

- Treat the approved requirements specification as the authoritative description of expected behavior.
- Translate requirements into executable tests without silently changing their meaning.
- Preserve business rules, constraints, edge cases, acceptance criteria, and explicit exclusions.
- Do not add product behavior simply because it seems useful or conventional.
- Do not weaken requirements to accommodate the current implementation.
- If the specification conflicts with itself or with an important established project constraint, stop and resolve the conflict before implementing the affected behavior.

Implementation details may vary as long as they satisfy the specification and the project's established engineering constraints.

### 2. Tests precede implementation

For each new behavior:

1. Write a test that expresses the expected behavior.
2. Run the test and observe it fail.
3. Verify that the failure is caused by the missing or incorrect behavior.
4. Write the smallest production change that makes the test pass.
5. Run the test again.
6. Refactor if appropriate, preserving passing behavior.
7. Run relevant regression tests.

A test that passes before the intended implementation exists does not establish a valid RED phase. Investigate why it passes before proceeding.

### 3. Tests verify behavior, not implementation details

Prefer tests that verify externally observable behavior and contractual boundaries.

Avoid coupling tests unnecessarily to:

- Private methods or internal data structures.
- Incidental call sequences.
- Particular implementation patterns.
- Exact source-code structure.
- Mocked behavior that bypasses the functionality under test.

Use unit, integration, contract, or end-to-end tests according to the behavior and the architecture involved.

Test internal implementation details only when they are themselves part of an explicit contract or necessary engineering invariant.

### 4. The smallest correct change wins

Implement only what is necessary to satisfy the current requirement and maintain existing behavior.

- Follow established project conventions.
- Reuse existing abstractions where appropriate.
- Avoid speculative generalization and unrelated refactoring.
- Do not add dependencies without a justified need.
- Do not redesign unrelated components.
- Keep changes focused and reviewable.

### 5. Passing tests are evidence, not proof of perfection

A passing test suite demonstrates that the executed tests passed in the tested environment. It does not automatically prove that every requirement is satisfied.

Verify test coverage against the specification, check meaningful edge cases, and report any limitations honestly.

---

## Workflow

### Phase 1: Inspect the Specification and Repository

Before modifying code, establish the context.

#### Locate and understand the specification

Identify the approved requirements specification supplied by the user or referenced by the current task.

Read the relevant sections in full enough to understand:

- Problem statement and intended outcomes.
- Functional requirements.
- User scenarios and acceptance criteria.
- Domain rules and invariants.
- Validation requirements.
- Edge cases and failure behavior.
- Security, privacy, and permission constraints.
- Performance or reliability expectations, when specified.
- Success criteria and explicit exclusions.
- Dependencies and integration contracts.

Preserve requirement identifiers when available.

If the specification is not provided or cannot be located, ask the user to identify it. Do not invent a substitute specification.

#### Inspect the existing codebase

Before choosing an implementation strategy, inspect:

- Project instructions and contribution guidelines.
- Relevant source files and existing abstractions.
- Existing tests and test conventions.
- Test framework, runner, and build configuration.
- Package and dependency management.
- Relevant interfaces and integration boundaries.
- Current repository state and unrelated modifications.
- Available formatting, linting, type-checking, and validation commands.

Run the relevant existing tests when practical to establish a baseline.

Do not overwrite user changes, discard unrelated work, or assume the working tree is clean.

#### Establish the implementation scope

Determine which requirements and behaviors the current task covers.

If the specification describes a larger feature, work incrementally. Prefer a coherent vertical slice or a small set of related behaviors that can be tested and verified independently.

Do not begin production implementation until the relevant requirements and constraints are understood.

**Output of this phase:** An implementation scope, a clear understanding of the repository, and an identified validation strategy.

### Phase 2: Build a Requirement-to-Test Map

Before implementing, map the relevant requirements to the tests needed to verify them.

For each requirement, identify:

- Requirement ID or reference.
- Expected observable behavior.
- Relevant inputs and preconditions.
- Expected outputs or state changes.
- Important boundary conditions.
- Expected failure behavior.
- Appropriate test level.
- Existing tests that already cover the behavior.
- Additional tests needed.

Use this mapping to identify gaps, not to require redundant tests.

Where useful, distinguish between:

- **Functional tests:** Verify required application behavior.
- **Boundary tests:** Verify limits, empty values, invalid inputs, and edge conditions.
- **Invariant tests:** Verify rules that must always hold.
- **Integration tests:** Verify interactions with real components or external boundaries.
- **Contract tests:** Verify interfaces and compatibility requirements.
- **Regression tests:** Prevent previously observed defects from returning.
- **Non-functional tests:** Verify specified performance, reliability, security, or other quality requirements.

Choose the simplest test level that provides credible evidence for the behavior.

Do not mock away the behavior the test is intended to verify.

#### Existing test coverage

An existing test may already satisfy a requirement. Reuse that coverage when it is meaningful, current, and reliable.

Do not rewrite passing tests merely to create the appearance of following TDD.

However, when a new change is required, write a test that demonstrates the missing behavior before making the production change.

### Phase 3: Identify Blockers Before Coding

Check whether the specification and repository provide enough information to implement the scoped behavior correctly.

Stop and ask for clarification when:

- A material product decision is missing.
- Requirements contradict each other.
- Expected behavior cannot be determined from the specification.
- A required external contract is unknown and cannot safely be inferred from an established interface.
- A necessary prerequisite is unavailable.
- The requested change conflicts with an important project constraint.

Do not interrupt implementation for every minor technical choice. Follow established project conventions for ordinary implementation details.

If a safe implementation decision can be made without changing contractual behavior, make it and continue.

Record material limitations and unresolved blockers. Never silently turn uncertainty into an invented requirement.

### Phase 4: RED — Write a Failing Test

Choose the smallest meaningful behavior that is not yet correctly implemented.

Write an executable test that specifies its expected behavior.

A good test:

- Is derived from a requirement or an explicitly authorized defect correction.
- Has a clear setup, action, and assertion.
- Verifies observable behavior.
- Uses representative and relevant inputs.
- Includes important boundaries when appropriate.
- Fails when the required behavior is absent or incorrect.
- Does not depend on unrelated environmental failures.

Run the narrowest practical test command.

Verify that the test fails for the expected reason, such as:

- Missing behavior.
- Incorrect output.
- An unmet invariant.
- Incorrect handling of a boundary condition.
- An incorrect error or failure response.

If the test fails because of a syntax error, broken test setup, missing dependency, or unrelated environment issue, fix the test setup or environment. That failure does not establish a valid RED phase.

If the test unexpectedly passes, investigate the reason. The behavior may already exist, the assertion may be ineffective, or the test may not exercise the intended path.

Do not proceed to production implementation until the RED result is understood.

### Phase 5: GREEN — Implement the Minimum Correct Change

Implement only enough production code to make the new test pass.

Requirements:

- Do not implement unrelated features.
- Do not weaken the test or remove meaningful assertions to obtain a pass.
- Do not hardcode results solely to satisfy a narrow test when the requirement implies general behavior.
- Do not introduce unnecessary abstractions.
- Preserve existing contracts and established behavior.
- Keep error handling, validation, and permissions consistent with the specification.
- Follow the project's architecture and conventions.

Run the new test and confirm that it passes.

Then run the relevant existing tests to detect regressions.

If the new test still fails, diagnose the behavior and make the smallest necessary correction. Continue until the test passes or a genuine blocker is identified.

If an existing test fails, determine whether the failure is caused by the change, a pre-existing issue, or the environment. Do not conceal the failure or change an existing expectation without justification.

### Phase 6: REFACTOR — Improve Without Changing Behavior

Once the relevant tests pass, evaluate whether the implementation needs improvement.

Potential improvements include:

- Removing duplication.
- Simplifying control flow.
- Improving naming and readability.
- Aligning the change with existing abstractions.
- Improving separation of responsibilities.
- Removing unnecessary complexity.
- Improving maintainability without expanding scope.

Refactor only when there is a concrete benefit.

After each meaningful refactor:

1. Run the relevant tests.
2. Confirm that behavior remains correct.
3. Investigate and resolve any regression before continuing.

Do not combine a large speculative refactor with a focused feature change.

If the implementation is already clear and maintainable, skip unnecessary refactoring.

### Phase 7: Repeat the TDD Cycle

Repeat RED → GREEN → REFACTOR for each additional behavior.

Prioritize a logical sequence that builds on verified behavior. For example:

1. Core successful behavior.
2. Input validation.
3. Boundary conditions.
4. Error and failure handling.
5. Permissions and security constraints.
6. Integration behavior.
7. Additional specified quality requirements.

This is an example ordering, not a universal mandate. Follow the dependencies and priorities of the actual specification.

After each cycle, keep the code and tests in a known, verified state.

Do not write an entire feature's production code first and add tests afterward. That is test-after-development, not TDD.

### Phase 8: Verify the Complete Change

After implementing the scoped requirements, perform a systematic verification pass.

#### Test execution

Run the appropriate available checks, including where applicable:

- New and modified tests.
- Relevant regression tests.
- Full project test suite.
- Integration tests.
- Type checking.
- Linting.
- Formatting checks.
- Build or compilation.
- Contract or end-to-end tests.
- Relevant security and performance checks required by the specification.

Use the project's existing commands and conventions.

Do not claim a command passed unless it was actually executed and its result was observed.

If a test or validation command cannot be run, state why and identify the remaining uncertainty.

#### Requirement coverage

Review every in-scope requirement against the requirement-to-test map.

For each requirement, determine whether:

- The required behavior is implemented.
- The expected behavior is covered by meaningful tests.
- Important boundaries and failure cases are addressed.
- The relevant tests have been executed successfully.
- Any limitation or gap remains.

A requirement is not complete merely because its primary happy path works.

If a requirement has no suitable test, add one through the RED-GREEN-REFACTOR cycle unless a justified limitation prevents it.

#### Change review

Review the final diff for:

- Unrelated changes.
- Accidental deletions or modifications.
- Debugging code or temporary artifacts.
- Unnecessary dependencies.
- Secrets or sensitive information accidentally introduced.
- Weakened assertions or disabled tests.
- Unhandled failure paths.
- Violations of repository instructions.
- Unnecessary complexity.

Do not delete or alter unrelated user work.

---

## Test Quality Requirements

### Assertions must be meaningful

Tests must assert the contractual outcome, not merely that the code executed.

Prefer assertions that verify the returned value, resulting state, emitted event, persisted data, error response, or other observable result relevant to the requirement.

Avoid tests that pass without demonstrating the intended behavior.

### Test edge cases derived from the specification

Consider relevant cases such as:

- Empty or missing inputs.
- Invalid values.
- Boundary values.
- Duplicate operations.
- Repeated requests.
- Missing or inaccessible resources.
- Permission failures.
- Dependency timeouts or errors.
- Partial failures.
- Conflicting state changes.
- Persistence and consistency behavior.

These are examples, not a mandate to test every conceivable case. Select cases that follow from the requirements, domain rules, and real risks.

### Use mocks deliberately

Use mocks or fakes when they isolate an external boundary or make a test deterministic.

Do not use mocks to create a false impression that an integration works.

When correctness depends on an actual database, network protocol, serialization format, or external contract, use suitable integration or contract tests where feasible.

### Avoid overfitting

A test suite should prevent incorrect implementations, not dictate unnecessary internal details.

Ensure that reasonable alternative implementations could satisfy the same requirements and tests.

### Keep tests maintainable

Use clear names, focused assertions, minimal setup, and existing project conventions.

Avoid duplicating large amounts of test setup when a simple shared helper improves clarity without hiding behavior.

Do not introduce a new testing framework or elaborate test architecture unless the project needs it.

---

## Handling Existing Failures and Difficult Situations

### Pre-existing test failures

If the baseline test suite fails:

1. Record the observed failure.
2. Determine whether it affects the current scope.
3. Continue with independent work when safe.
4. Distinguish pre-existing failures from regressions introduced by the change.
5. Report unresolved failures accurately.

Do not claim that the full suite passes when known failures remain.

### Flaky tests

Investigate nondeterministic failures rather than repeatedly rerunning tests until one happens to pass.

Address the underlying source of instability when it is within scope. If it is unrelated, document the observed limitation and avoid treating an unreliable pass as conclusive evidence.

### Defects discovered outside the immediate scope

If a defect is relevant to the requested behavior, capture it with a regression test before correcting it.

If it is unrelated, avoid silently expanding the scope. Report it or ask the user whether it should be addressed.

### Specification changes

If the user changes an approved requirement during implementation:

1. Identify the affected requirements and tests.
2. Confirm the intended new behavior.
3. Update the requirement-to-test mapping.
4. Change or add tests first.
5. Observe the expected RED result where the behavior is new or changed.
6. Implement the change using the TDD cycle.
7. Re-run the relevant regression tests.

Do not treat a product behavior change as a mere implementation detail.

### Security-sensitive behavior

Never bypass authentication, authorization, validation, or security controls simply to make a test pass.

Tests must verify the required security boundary. Use safe test data and the project's established security-testing practices.

### Blocked implementation

If a blocker prevents a correct implementation:

- Stop the affected work.
- Explain what is blocked and why.
- Identify the missing decision, dependency, or evidence.
- Preserve the current working state.
- Report which tests pass, fail, or remain unexecuted.
- Do not claim completion.

---

## Completion Criteria

The implementation is complete only when all applicable criteria are satisfied:

1. Every in-scope requirement has been reviewed.
2. Each requirement is implemented or explicitly reported as blocked or incomplete.
3. New behavior was developed through RED → GREEN → REFACTOR.
4. New or changed contractual behavior has meaningful executable test coverage.
5. Important specified edge cases and failure behaviors are addressed.
6. Relevant regression tests pass, or known failures are transparently reported.
7. Required available validation commands have been executed.
8. The final diff has been reviewed for correctness and scope.
9. No known blocker is hidden.
10. The implementation status and verification results are reported accurately.

Do not claim full completion if a material requirement remains unimplemented, an essential test is failing, or a required validation remains unresolved.

A task may end with a partial implementation when genuinely blocked, but its status must clearly say that it is incomplete.

---

## Final Report

At the end of the work, provide a concise report containing:

### Implemented

Summarize the behaviors and requirements implemented.

### Tests Added or Updated

Identify the important tests and the behaviors they verify. Reference requirement IDs when available.

### Verification Results

List the validation commands that were actually run and their observed outcomes. Distinguish passed, failed, skipped, and not run.

### Requirement Coverage

Summarize which requirements are verified and identify any incomplete or uncertain coverage.

### Remaining Issues

Report known failures, blockers, limitations, or relevant findings outside the scope.

If no issues remain, state that explicitly, based on the actual verification performed.

## Definition of Done

The task is done when the scoped requirements are implemented, the required behaviors are meaningfully tested, the relevant validation has been performed, and the results are reported honestly.

**The final authority is the combination of the approved specification, the executable tests, the actual implementation, and observed validation results—not the existence of code or a green test run alone.**
