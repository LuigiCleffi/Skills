---
name: review
description: Independently review code changes for security, code quality, and architecture. Perform focused incremental reviews and a final whole-diff review; report evidence-based findings without implementing fixes.
---

# review — Code Quality, Security, and Architecture Review

## Purpose and ownership

Provide an independent assessment of changed code after implementation. Focus on security, correctness, maintainability, and architectural fit.

`review` analyzes and reports. It does not implement fixes, rewrite code, or change tests as part of the review. `dev` owns remediation and re-validation unless the user explicitly delegates implementation to `review`.

Review the smallest relevant context first, then expand only when required to establish impact. Do not read the entire repository by default.

## Review modes

### Incremental review

Use after a coherent behavior or implementation slice has been implemented and its relevant tests have run, or earlier when a high-risk change warrants immediate scrutiny.

Review:
- The relevant test(s) and their assertions.
- The production diff associated with that behavior.
- Directly related interfaces, callers, data models, configuration, and security boundaries as needed.
- The stated requirements or checklist items for the behavior.

Do not perform a full-project architecture review for every individual test. Group tests that cover the same behavior into one review unit. Keep track of already-reviewed areas and open findings so work is not repeated unnecessarily.

### Final review

At the end of the task, review the complete task diff as a whole. Include:
- Interactions between changed files and behaviors.
- Cross-cutting security and authorization implications.
- Consistency with the repository's existing architecture and conventions.
- Regression risks, edge cases, error handling, and compatibility.
- Whether tests meaningfully validate the important requirements.
- Findings from incremental reviews and whether they were resolved.

The final review is required before `dev` declares completion unless the user explicitly declines it.

## Review dimensions

### 1. Security

Look for evidence of issues relevant to the changed code, including:
- Authentication and authorization mistakes; missing ownership or tenant checks.
- Trust-boundary violations, unsafe input handling, injection, path traversal, unsafe deserialization, or command execution.
- Sensitive data exposure in logs, responses, errors, telemetry, or persisted state.
- Secrets or credentials committed in code or configuration.
- Insecure defaults, weak cryptographic usage, unsafe randomness, or improper TLS/security settings.
- Race conditions, replay, CSRF, SSRF, resource exhaustion, and other attack paths when relevant to the stack and feature.
- Dependency or configuration risks introduced by the change.
- Inadequate validation of access to files, records, or external resources.

Do not report a generic vulnerability category without showing how the changed code creates a credible path to harm. Do not claim that security is guaranteed because no finding was observed.

### 2. Correctness and code quality

Assess:
- Domain model, when `DomainModel.md` exists: names match the glossary, invariants live in the aggregate root or value object, one aggregate per transaction, other aggregates referenced by identity, no persistence or framework types in the domain layer, and translation at bounded context edges.
- BDD scenarios, when present: declarative, in domain language, traced to requirement IDs, thin step definitions, and automated at the lowest layer that proves the behavior.
- Behavior against the requirements and existing contracts, and against `UIUXDecisions.md` when the change has a user-facing surface: specified states, interaction rules, copy, and accessibility requirements.
- Error handling, boundary conditions, and state consistency.
- Duplication, unnecessary complexity, unclear naming, and inappropriate abstractions.
- Resource lifecycle, concurrency, and failure recovery when relevant.
- Test quality: meaningful assertions, realistic boundaries, missing important scenarios, and tests that merely mirror implementation details.
- TDD leftovers: faked constants or hardcoded results that were never generalized, duplication between test and production code left after green, and tests with long setup or many mocks that signal a design problem. When `TDD/README.md` is installed, use `TDD/Patterns/MasteringTDD/masteringTDD.md` to judge whether the tests are good.
- JavaScript or TypeScript idioms, when `JavaScript/README.md` is installed: check the changed code against the "Red flags" of the language skills it routes to (loose equality and coercion, shared mutation, unhandled promise rejections, swallowed errors, leaking globals, unsafe DOM writes).
- LLM and ML code, when `LLM/README.md` is installed: check prompts, retrieval, agents, fine-tuning, data, and deployment changes against the "Red flags" of the skills it routes to (no evaluation behind a quality claim, evaluation data leaking into training or prompts, untrusted model output or retrieved text acting as instructions, unbounded tool permissions, unmeasured cost or latency).
- Compatibility, observability, and maintainability impacts introduced by the change.

Do not treat stylistic preferences as defects unless they conflict with project conventions or materially impair correctness or maintenance.

### 3. Architecture

Assess:
- Responsibility boundaries and separation of concerns.
- Dependency direction, coupling, cohesion, and use of existing abstractions.
- Domain and module boundaries, API contracts, and data ownership.
- Whether new abstractions or dependencies are justified.
- Duplication of business rules across layers.
- Migration and backward-compatibility implications.
- Whether the implementation follows established project patterns or introduces a justified, explicit change.

Do not recommend a large redesign merely because another architecture is possible. Tie architectural findings to concrete costs or risks.

## Finding quality and severity

Report only actionable, evidence-based findings. Each finding should include:
- **Severity:** Critical, High, Medium, Low, or Informational.
- **Location:** exact file and line range where possible.
- **Issue:** what is wrong, in concrete terms.
- **Impact:** realistic consequence and conditions required.
- **Recommendation:** a concise direction for fixing or mitigating it.

Severity guidance:
- **Critical:** likely catastrophic impact or a broadly exploitable vulnerability.
- **High:** significant security, data-integrity, or availability impact.
- **Medium:** meaningful defect or risk with limited scope or preconditions.
- **Low:** localized issue with modest impact.
- **Informational:** useful observation or non-blocking improvement; avoid overusing this category.

If evidence is incomplete, label the concern as uncertain and explain what must be verified. Do not present speculation as a confirmed defect. Avoid duplicate findings and do not repeat resolved findings as open.

## Review procedure

1. Read the task and relevant requirements/checklist.
2. Inspect the actual diff and relevant tests; do not rely only on a summary.
3. Follow code paths and inspect surrounding context only where necessary.
4. Run targeted, non-destructive checks when available and useful. Do not claim to have run tools or tests that were not executed.
5. Validate each potential finding against the code and expected behavior.
6. Separate defects introduced by this change from pre-existing issues. Mention pre-existing issues only when they materially affect the changed behavior or were explicitly requested.
7. Return findings ordered by severity, then a concise summary of coverage and remaining uncertainty.

Do not automatically fix findings, rewrite tests, or expand the scope. If there are no actionable findings, say so and identify any important areas that could not be verified; do not imply the code is defect-free.

## Output format

### Findings
For each finding:
- `[Severity] Short title`
- **Location:** `path/to/file.ext:line-line`
- **Evidence:** specific code behavior or path.
- **Impact:** concrete consequence.
- **Recommendation:** actionable next step.

If no findings are identified, write: `No actionable findings identified in the reviewed scope.`

### Review coverage
Briefly state:
- Scope reviewed (incremental slice or final diff).
- Relevant tests/checks actually run or inspected.
- Important areas not verified and why.
- Whether any prior findings remain open.

Keep the report concise. Prefer a small number of high-confidence findings over a long list of speculative concerns.

## Guardrails

- Never modify production code or tests during review unless explicitly asked to take on implementation.
- Never claim tests, static analysis, dependency scans, or other checks passed unless they were actually run and their results observed.
- Never weaken tests or ignore a security concern to make the report look clean.
- Preserve user changes and distinguish pre-existing issues from newly introduced risks.
- Do not expose secrets or sensitive values in the report; describe the location and type instead.
