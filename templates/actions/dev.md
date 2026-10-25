---
name: dev
description: Implement software changes from an approved task or specification. Coordinate spec-checklist, ddd, bdd, uiux, tdd, and review when appropriate. Own production code, verification, and final reporting.
---

# dev — Implementation Orchestrator

## Purpose and ownership

Implement the requested behavior in the existing repository with the smallest correct change.

`dev` owns production-code changes and coordinates the workflow. Delegate requirement analysis to `spec-checklist` when applicable, domain modeling to `ddd` when the change adds or alters domain concepts or rules, examples and executable scenarios to `bdd` when the change has business behavior worth illustrating, UI/UX decisions to `uiux` when the change has a user-facing surface, test-first preparation to `tdd` when appropriate, and independent code-quality analysis to `review`.

## Skill boundaries

- `spec-checklist`: expands a specification into a detailed, feature-specific requirements checklist and identifies ambiguities. It does not implement or test the code.
- `ddd`: turns the approved requirements into a domain model record (`DomainModel.md`) and maintains the ubiquitous language glossary: bounded context, entities, value objects, aggregates and their invariants, services, events, repositories, and layer placement. It does not implement or test the code.
- `bdd`: turns the approved requirements into confirmed examples and executable Gherkin scenarios, automates them as failing acceptance tests, and owns feature files and step definitions. It does not modify production code.
- `uiux`: turns the approved requirements into a UI/UX decisions record (`UIUXDecisions.md`): flows, screens and states, components, accessibility, copy, the recommended implementation mode and slice order, and UI acceptance checks. It does not implement or test the code.
- `tdd`: writes or updates tests before the corresponding production implementation and reports the observed test result. It must not modify production code.
- `dev`: implements production code, runs validation, decides how to address review findings, and reports completion.
- `review`: independently analyzes changed code for security, quality, and architecture. It reports findings but does not fix them unless explicitly asked to take on implementation.

Do not copy another skill's full workflow into this skill. Invoke it and use its output.

## Workflow

### 1. Understand the task and requirements

Identify the source of truth: user request, approved specification, bug report, or existing contract.

If a specification is provided, named, or required for a substantial feature, invoke `spec-checklist` before implementation. Pass the task and the relevant specification/context.

- If the checklist identifies unresolved product decisions, contradictions, or material ambiguity, ask the user before implementing the affected behavior.
- Do not block on ordinary engineering choices that can be resolved consistently with repository conventions.
- If no specification exists and the task is small or clear, derive a concise internal scope from the request rather than inventing a specification.

Use the checklist as a requirements-quality gate, not as a progress tracker for implementation.

If the change adds or alters domain concepts, rules, or boundaries and `ddd` is available, invoke it after `spec-checklist`, or use the existing `DomainModel.md` and glossary for the scope.

- Implement the model as recorded: the same names, the same aggregate boundaries (one aggregate per transaction), invariants enforced inside the aggregate root or value object, repositories per aggregate root, and domain code free of persistence and framework concerns.
- If the code shows the model is wrong or awkward, stop on that item and return to `ddd` and the user; the model and the code change together.
- When the change does not touch the model, note "DDD: not applicable" and continue.

If the change has business behavior worth illustrating and `bdd` is available, invoke it after `ddd` (or after `spec-checklist` when DDD does not apply), or use the existing feature files for the scope. Treat its confirmed scenarios as acceptance criteria, and do not implement behavior whose scenarios are held back by open questions. When BDD does not apply, note "BDD: not applicable" and continue.

If the change adds or alters a user-facing surface and `uiux` is available, invoke it after `bdd` (or after `spec-checklist` when BDD does not apply) and before implementation, or use an existing `UIUXDecisions.md` for the scope.

- Treat its recorded decisions as requirements for the UI: components, states, interaction rules, copy, accessibility, layout, and internationalization.
- Do not implement UI behavior whose decisions are still open in the record.
- If a decision proves infeasible or conflicts with the codebase, stop on that item and return to `uiux` and the user instead of improvising a different design.
- When the change has no user-facing surface, note "UI/UX: not applicable" and continue.

### 2. Inspect the repository

Inspect only the context needed for the task:

- Applicable repository instructions and contribution conventions.
- Relevant source files, abstractions, interfaces, and integration boundaries.
- Tests, fixtures, and the narrowest useful test commands.
- Build, dependency, lint, type-check, and formatting configuration as needed.
- Working-tree state and existing user changes.

Preserve unrelated work. Run baseline checks when practical if existing failures could affect confidence.

### 3. Select the implementation mode

When a `uiux` handoff exists, use its recommended mode and slice order unless the user overrides them.

When `bdd` scenarios exist, they are the outer loop: take one failing scenario at a time, build what it needs through the inner loop below (TDD mode) or directly, and re-run the scenario. A slice is done when its scenarios pass. Do not edit feature files or step definitions to make them pass; disagreements go back to `bdd` and the user.

**TDD mode:** Use when the user requests TDD, explicitly asks to use `tdd`, or test-first development is appropriate for the risk and scope.

1. Invoke `tdd` with the scoped requirements, the UI acceptance checks from `UIUXDecisions.md` when present, and relevant repository context.
2. Inspect the actual changed tests and the reported execution result.
3. Implement production code only after test-first preparation is complete, or after `tdd` documents a justified exception (for example, meaningful RED is not possible because the behavior already exists).
4. Do not claim strict TDD unless a meaningful failing test was observed before the corresponding production change.
5. Work red, green, refactor for each test: make the failing test pass with the smallest change, run the tests, then remove the duplication the change introduced (including duplication between test and code) while everything stays green. Only then ask `tdd` for the next test from the test list.

When `TDD/README.md` is installed, use `TDD/Patterns/GreenBarPatterns/greenBarPatterns.md` to choose how to get to green (Fake It, Triangulate, Obvious Implementation, One to Many), `TDD/Patterns/Refactoring/refactoring.md` for the refactoring step, and `TDD/Patterns/DesignPatterns/designPatterns.md` when a design pattern emerges from removing duplication.

**Direct mode:** Use when the user asks for direct implementation or TDD is unnecessary for a small/low-risk change. Inspect existing tests, implement directly, and add or update focused tests when appropriate. Do not describe this as strict TDD.

If `tdd` is unavailable, explain the limitation and ask whether to proceed directly rather than silently claiming it was used.

### 4. Implement the smallest correct change

When the project is JavaScript or TypeScript and `JavaScript/README.md` is installed, read the language skills it routes to for the code you are about to write (functions, data structures, objects and classes, errors, modules, async, DOM and events, HTTP, Node.js) and follow their idioms and red flags.

- Follow approved requirements and established architecture.
- Reuse existing abstractions where appropriate.
- Preserve compatibility and existing behavior unless the task requires a change.
- Implement specified validation, error handling, permissions, and integration behavior.
- Avoid unrelated refactors, speculative features, unnecessary dependencies, and hardcoded behavior designed only to satisfy a test. In TDD mode a faked constant is an acceptable intermediate step to reach green, but it must be generalized away during the refactor step before the behavior is reported as done.
- Do not silently expand scope.

### 5. Verify incrementally

Run the narrowest relevant checks first, then broader checks as warranted:

1. New or modified tests.
2. Related module or regression suite.
3. Integration or end-to-end tests when relevant.
4. Build, type checking, linting, formatting, security checks, or other project-required validation.

Investigate failures instead of rerunning them blindly. Distinguish implementation defects, test defects, pre-existing failures, and environment problems. Never suppress failures or weaken meaningful assertions merely to get a green run.

### 6. Review incrementally and at completion

Invoke `review` after a coherent behavior or meaningful implementation slice has passed its relevant tests, especially for security-sensitive or architecturally significant changes. Keep each incremental review scoped to the test, production diff, and relevant context; do not trigger a full-project review after every individual test.

Always invoke `review` once on the complete task diff before declaring completion, unless the user explicitly declines review. The final review must assess the changes together, including cross-file interactions, architecture, and regressions. Pass the task requirements/checklist, relevant test results, and changed-file context.

Review is independent analysis, not automatic approval. For each finding:
- Fix confirmed, in-scope issues.
- For disputed or uncertain findings, inspect the evidence and resolve deliberately.
- Do not expand scope for unrelated issues without authorization.
- Re-run relevant tests and re-review affected changes after fixes.
- Report unresolved findings and accepted risks honestly.

### 7. Final report

Provide a concise report containing:

- **Implemented:** behavior and important files changed.
- **Requirements:** checklist status or unresolved items, when applicable.
- **DDD:** model elements and `DM` invariants implemented, glossary terms added, model changes agreed with the user, or "not applicable".
- **BDD:** scenarios passing, failing, or held back, with the command and result, or "not applicable".
- **UI/UX:** UX decision IDs implemented and how each was verified, deviations agreed with the user, or "not applicable".
- **Tests and validation:** commands actually run and observed results; distinguish passed, failed, skipped, and not run.
- **Review:** material findings fixed, accepted, or still open.
- **Remaining:** blockers, unverified requirements, known failures, and limitations.

Never claim a command passed or a review occurred unless the result was observed. Passing tests do not prove complete requirement coverage or guarantee security.

## Test-change boundaries

Test changes are allowed in direct mode or during implementation when justified by a regression, an approved requirements change, a demonstrably incorrect expectation, or necessary fixture maintenance.

Never delete a failing test, weaken an assertion, mock away the behavior under test, or change the contract merely to obtain a green run. Investigate discrepancies between tests, requirements, and existing behavior.

## Completion criteria

The task is complete only when scoped behavior is implemented, relevant validation has been run as appropriate, the complete diff has been reviewed, and unresolved requirements or risks are reported honestly.
