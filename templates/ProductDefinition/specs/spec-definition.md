---
name: spec-definition
description: Analyze a feature request, bug report, task, or issue; clarify the underlying problem; and produce a precise, implementation-ready, testable specification in SpecifyRequirements.md. Use before implementation whenever requirements are unclear, incomplete, or need formalization.
---

# Specify Requirements

## Purpose

Transform an issue, feature request, bug report, or rough idea into a clear, complete, and verifiable specification that a developer or coding agent can implement.

The primary responsibility is to understand **what the system must do and why**, not to decide prematurely how it should be implemented.

A specification is a representation of the required behavior that a machine must ultimately execute through a program. Requirements must therefore be precise enough to guide implementation and verification, while remaining independent of unnecessary technical decisions.

The quality of the specification matters more than the speed at which it is produced.

## Core Principles

### 1. Understand before specifying

Never treat the user's initial description as a complete statement of the requirements.

Identify:
- The problem being solved.
- Who or what experiences the problem.
- The current behavior or situation.
- The desired behavior or outcome.
- Why the change is necessary.
- The constraints and conditions under which the behavior must hold.

Distinguish the underlying problem from the solution initially proposed by the user.

Do not reject the proposed solution automatically. Determine whether it actually satisfies the underlying need.

### 2. Specify behavior, not implementation

Requirements describe observable system behavior, business rules, constraints, and externally meaningful state changes.

Prefer:
- "The system rejects an expired invitation."
- "The user can retry an operation after a temporary failure."
- "A submitted order cannot be modified after confirmation."

Avoid prescribing implementation details unless they are necessary requirements:
- Specific classes, methods, or file structures.
- Database schemas or table designs.
- Frameworks, libraries, or architectural patterns.
- Algorithms or internal abstractions.
- API endpoint designs or technology choices.

Existing architecture, technical constraints, compatibility requirements, security requirements, or explicit user decisions may make certain implementation details necessary. Preserve these constraints when justified.

### 3. Make requirements unambiguous

Each functional requirement must express a specific capability or rule that can be verified.

Avoid vague terms such as:
- Fast.
- Easy.
- Appropriate.
- User-friendly.
- Secure, without defining the relevant security behavior.
- Handle errors gracefully.
- Work correctly.

Replace them with observable behavior, explicit conditions, and measurable thresholds where applicable.

For example:

Vague: "The system should process requests quickly."

Specified: "Under the defined normal operating load, 95% of requests must complete within 500 milliseconds."

Do not invent performance targets when no evidence supports them. Ask for clarification or document a proposed assumption.

### 4. Separate facts, assumptions, and unknowns

Classify important information as:

- **Confirmed:** explicitly stated by the user or established by reliable project evidence.
- **Inferred:** strongly supported by the issue or existing behavior, but not explicitly confirmed.
- **Assumed:** a reasonable default adopted to make progress.
- **Unknown:** information that could materially change the specification.

Never present an assumption or inference as a confirmed fact.

Use `[NEEDS CLARIFICATION: ...]` for unresolved requirements that materially affect implementation, scope, or acceptance.

Not every missing detail requires a question. Use reasonable defaults for low-risk decisions, document them, and avoid unnecessary interruptions.

### 5. Every requirement must be verifiable

A developer and a tester should be able to determine whether the implementation satisfies each requirement without relying on subjective judgment.

For every important behavior, identify:
- The initial conditions.
- The triggering action or event.
- The expected result.
- Relevant state changes.
- Observable failure behavior.
- Applicable boundaries and constraints.

Use Given/When/Then scenarios when they make the behavior clearer.

### 6. Minimize unnecessary scope

Specify the smallest coherent change that solves the problem.

Do not expand an issue into unrelated improvements, speculative features, broad refactoring, or future enhancements.

Keep the core solution separate from optional improvements.

Prioritize requirements according to user value, business impact, risk, and dependencies—not implementation convenience alone.

---

## Workflow

Follow the phases below in order. Adapt the amount of investigation to the complexity of the issue.

### Phase 1: Understand the input

Accept one or more of the following:
- A feature request.
- A bug report.
- An issue description.
- A user story.
- A task from an issue tracker.
- A conversation describing a problem.
- An existing specification requiring improvement.

Extract the information already available before asking questions.

Create an internal problem model containing:

1. **Problem:** What is wrong, missing, or needed?
2. **Actor:** Who or what interacts with the system?
3. **Context:** When and under what conditions does the problem occur?
4. **Current behavior:** What happens today?
5. **Expected behavior:** What should happen instead?
6. **Value:** What outcome makes the change worthwhile?
7. **Constraints:** What must remain true?
8. **Scope:** What is included and excluded?

For bugs, distinguish the observed behavior from the suspected root cause. Do not assume the user's explanation of the cause is correct without evidence.

If project files or repository context are available, inspect the relevant issue, documentation, tests, and existing behavior when doing so is useful and authorized. Use this evidence to understand the existing contract, not to turn the specification into an implementation plan.

If the user has supplied enough information, proceed without asking redundant questions.

### Phase 2: Identify ambiguity and risk

Review the problem model and identify missing information.

Pay particular attention to:

- Conflicting statements.
- Undefined business rules.
- Unclear actor permissions.
- Missing preconditions or postconditions.
- Ambiguous terminology.
- Unspecified behavior for invalid inputs.
- Empty, missing, duplicated, or malformed data.
- Boundary conditions.
- Failure and recovery behavior.
- Data consistency and persistence.
- Security, authorization, and privacy.
- Compatibility with existing behavior.
- External dependencies.
- Acceptance criteria that cannot be objectively verified.

Classify each ambiguity by its impact:

**Critical:** Different interpretations would produce materially different behavior, violate a constraint, create a security risk, or make the implementation incorrect.

**Important:** The answer would change acceptance criteria, scope, or significant user-visible behavior.

**Minor:** A safe, conventional default can be adopted without materially changing the solution.

Ask questions about critical and important ambiguities. Resolve minor ones with documented assumptions where reasonable.

### Phase 3: Conduct a focused clarification conversation

When clarification is necessary, enter clarification mode before generating the final specification.

Ask concise, specific questions that resolve meaningful uncertainty.

Rules for the conversation:

1. Ask one question at a time by default.
2. Ask the highest-impact unresolved question first.
3. Explain the relevant ambiguity briefly when context helps.
4. Offer concrete alternatives when they make answering easier.
5. Allow the user to provide a different answer from the alternatives.
6. Do not ask questions whose answers are already available.
7. Do not ask about implementation details unless they are actual constraints.
8. Do not force the user to answer every low-risk unknown.
9. Update the problem model as answers arrive.
10. Reassess whether each answer introduces new ambiguities or conflicts.

For complex issues, group related questions into a compact set only when answering them together is more efficient.

If the user does not know an answer, propose a reasonable default and explain its consequences. Mark it as an assumption rather than silently converting it into a requirement.

If the user explicitly requests a draft without further discussion, generate the best possible draft, preserve unresolved questions in the specification, and state which decisions remain open.

Do not begin implementation during this phase.

### Phase 4: Define the behavioral contract

Translate the understood problem into explicit system behavior.

For each required behavior, determine:

- **Trigger:** What action or event initiates it?
- **Preconditions:** What must be true beforehand?
- **Input:** What information is supplied or available?
- **Rules:** What decisions or validations apply?
- **Outcome:** What must happen when the operation succeeds?
- **Failure:** What must happen when it cannot succeed?
- **State:** What information changes, persists, or remains unchanged?
- **Visibility:** What can the actor observe?
- **Constraints:** What limits or invariants must always hold?

Include only the dimensions relevant to the requirement.

Explicitly distinguish:
- Required behavior from optional behavior.
- Validation failures from system failures.
- Expected outcomes from side effects.
- User-visible requirements from internal implementation choices.
- New behavior from existing behavior that must be preserved.

When a requirement is not applicable, do not manufacture a corresponding rule.

### Phase 5: Define independently testable user journeys

Organize user stories by value and priority.

Use the following priority levels:

- **P1:** Essential for the minimum viable solution or the primary problem being solved.
- **P2:** Important additional value that can be delivered independently after P1.
- **P3:** Lower-priority enhancement that can be deferred without invalidating the core solution.

Add more stories only when the problem warrants them.

Each story should:
- Describe a meaningful actor goal.
- Explain why the outcome matters.
- Define an independently testable slice of functionality.
- Include acceptance scenarios for the main success path.
- Include relevant alternative and failure paths.

Prefer end-to-end user value over stories organized around technical layers.

A story is not independently testable if it requires unrelated future stories to exist before any meaningful outcome can be demonstrated. If dependencies are unavoidable, state them explicitly and reassess the story boundaries.

For a small bug fix, do not invent artificial user stories merely to fill the template. Define the smallest meaningful journey or behavioral contract that can demonstrate the fix.

### Phase 6: Specify functional requirements

Write numbered functional requirements using stable identifiers:

`FR-001`, `FR-002`, `FR-003`, and so on.

Each requirement should:
- Describe one coherent obligation.
- Use normative language such as MUST for mandatory behavior.
- Identify the relevant actor or system when necessary.
- State conditions and expected behavior explicitly.
- Be testable through observable outcomes or defined state.
- Avoid redundant or contradictory obligations.
- Avoid embedding implementation details without justification.

Split compound requirements when their clauses can be implemented or verified independently.

Use separate requirements for distinct validation rules, permissions, state transitions, persistence obligations, and failure behaviors when that improves traceability.

Use `[NEEDS CLARIFICATION: ...]` only when a genuine unresolved decision affects the requirement.

Do not use placeholders merely because a detail is not relevant to the feature.

### Phase 7: Define edge cases and invariants

Identify meaningful edge cases based on the actual domain.

Consider, when applicable:

- Missing, empty, malformed, or oversized inputs.
- Minimum and maximum allowed values.
- Duplicate requests or repeated actions.
- Invalid state transitions.
- Missing or deleted referenced resources.
- Expired credentials, permissions, or time limits.
- Concurrent updates.
- Partial failures.
- External service unavailability.
- Retries and duplicate processing.
- Interrupted operations.
- Data integrity and consistency.
- Time zones and date boundaries.
- Existing records created under previous rules.

Do not include every conceivable edge case. Focus on cases that can change correctness, security, data integrity, or user outcomes.

Explicitly identify invariants: conditions that must remain true across all relevant operations.

For every important failure scenario, define the required outcome rather than merely stating that an error should be handled.

### Phase 8: Define success criteria

Write measurable success criteria using identifiers such as `SC-001`, `SC-002`, and `SC-003`.

Each criterion should define:
- The outcome being measured.
- The measurement method or observable signal.
- The threshold or condition for success.
- Relevant operating conditions, when applicable.

Prefer criteria based on:
- Successful completion of a user journey.
- Correctness of outputs and state transitions.
- Error rates.
- Response times under defined workloads.
- Data integrity.
- Reduction of a documented problem.
- Compatibility with existing required behavior.

Distinguish between:

**Behavioral acceptance:** Whether the specified behavior is correct. This belongs primarily in acceptance scenarios and functional requirements.

**Outcome measurement:** Whether the solution achieves a broader objective. This belongs in success criteria.

Do not invent business metrics, traffic estimates, performance targets, or satisfaction percentages without supporting evidence.

When a numeric target is unknown, propose a target only if there is a defensible basis; otherwise mark the criterion for clarification or define an objectively verifiable outcome.

### Phase 9: Document assumptions, dependencies, and scope

Record assumptions that affect interpretation or acceptance.

Record dependencies on existing systems, external services, data, permissions, or other capabilities.

Define exclusions when they prevent likely misunderstandings or scope expansion.

Do not include speculative assumptions that have no bearing on implementation or testing.

Do not treat a dependency as proof that the dependency's implementation must change.

### Phase 10: Validate the specification

Before finalizing the document, conduct a specification review.

#### Problem alignment
- Does the specification solve the original problem?
- Is the underlying need clearly explained?
- Does the scope contain unnecessary work?

#### Completeness
- Are all primary user journeys represented?
- Are required business rules explicit?
- Are important failure paths and edge cases covered?
- Are state changes and persistence obligations clear where applicable?
- Are existing behaviors that must remain unchanged identified?

#### Consistency
- Do the user stories, functional requirements, acceptance scenarios, and success criteria agree?
- Are there contradictory rules or duplicated requirements?
- Are priorities coherent?
- Are assumptions consistent with the stated constraints?

#### Testability
- Can each functional requirement be verified?
- Does each acceptance scenario define a clear expected outcome?
- Are boundary conditions explicit where relevant?
- Are success criteria objectively measurable?

#### Implementation independence
- Does the document avoid unnecessary technology and architecture decisions?
- Are necessary technical constraints documented explicitly?
- Can a developer make reasonable implementation choices without changing the required behavior?

#### Traceability
- Can each important requirement be traced to a user need, business rule, or explicit constraint?
- Can important requirements be verified through acceptance scenarios or other defined tests?
- Are unresolved decisions clearly marked?

Resolve defects in the specification before declaring it ready. If critical questions remain unanswered, do not falsely label the document complete.

---

## Output Format

Create a Markdown document named `SpecifyRequirements.md` using the following structure.

# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft | Ready for Implementation | Blocked on Clarification

**Input**: User description: [Original issue or request]

## 1. Problem Statement

Describe the problem, its context, the affected actor, the current behavior, and the desired outcome.

Clearly distinguish observed facts from suspected causes when relevant.

## 2. Goals and Scope

### Goals

List the outcomes this change must achieve.

### In Scope

List the behavior included in this specification.

### Out of Scope

List relevant exclusions that prevent misunderstandings or scope expansion.

## 3. User Scenarios & Testing

Order user stories by priority and value.

### User Story 1 — [Brief Title] (Priority: P1)

**Story:** As a [actor], I want [capability], so that [outcome].

**Why this priority:** Explain the value and importance.

**Independent Test:** Describe how this story can be tested in isolation and what value that test demonstrates.

**Acceptance Scenarios:**

1. **Given** [initial conditions], **When** [action], **Then** [expected outcome].
2. **Given** [alternative conditions], **When** [action], **Then** [expected outcome].

Repeat as necessary for P2, P3, and additional stories.

For bug fixes or tasks that do not naturally require multiple user stories, use only the scenarios needed to describe and verify the change.

## 4. Functional Requirements

Use unique, stable identifiers.

- **FR-001:** The system MUST [specific, testable behavior].
- **FR-002:** The system MUST [specific, testable behavior].

Include the relevant validation, authorization, persistence, state-transition, compatibility, and failure requirements.

Use `[NEEDS CLARIFICATION: question]` for material unresolved decisions.

## 5. Domain Rules and Invariants

Describe the business rules, state constraints, and conditions that must remain true throughout the relevant operations.

Omit this section's detailed rules if the feature has none beyond those already defined in the functional requirements.

## 6. Edge Cases and Failure Scenarios

Describe relevant boundary conditions, invalid inputs, unavailable dependencies, recovery behavior, and other meaningful failure scenarios.

State the expected system behavior for each important case.

## 7. Key Entities

Include only when the feature involves meaningful domain data.

Describe each entity, its meaning, relevant attributes, relationships, and lifecycle constraints without prescribing a database schema. Use the terms domain experts use; `ddd` refines these entities into the domain model and glossary.

## 8. Success Criteria

### Measurable Outcomes

- **SC-001:** [Objective outcome and measurement method].
- **SC-002:** [Objective outcome and measurement method].

Use observable, technology-agnostic criteria wherever possible.

## 9. Assumptions and Dependencies

### Assumptions

List reasonable defaults that have not been confirmed but are necessary to interpret the specification.

### Dependencies

List relevant existing capabilities, external systems, permissions, or prerequisites.

### Open Questions

List unresolved decisions using `[NEEDS CLARIFICATION: ...]` and explain their impact.

Omit empty subsections where appropriate.

## 10. Traceability and Verification

Provide a compact mapping between important functional requirements and the acceptance scenarios or verification methods that demonstrate compliance.

Identify any material requirements that do not yet have adequate verification coverage.

Do not invent test results. This section defines how compliance should be verified, not whether the implementation has already passed.

---

## Completion Rules

After generating the specification:

1. Ensure every section reflects the actual issue rather than generic boilerplate.
2. Remove all instructional placeholders and template examples that are not part of the actual specification.
3. Preserve unresolved material decisions explicitly.
4. Ensure identifiers are unique and consistent.
5. Check that the specification addresses the original problem without unnecessary scope.
6. Report the document path and a concise summary of the scope, key decisions, and remaining blockers.

Use the following status rules:

- **Draft:** The specification is still being developed or reviewed.
- **Ready for Implementation:** The requirements are sufficiently clear, internally consistent, and testable for implementation to begin.
- **Blocked on Clarification:** A material unresolved decision prevents a reliable implementation.

A specification can be ready for implementation while retaining documented low-risk assumptions. Do not require every conceivable detail to be settled.

## Interaction Contract

When this skill is invoked:

1. Understand the supplied issue and available context.
2. Investigate material ambiguity.
3. Ask focused clarification questions when necessary.
4. Define the expected behavior and verification strategy.
5. Generate and validate the specification.
6. Save the resulting `SpecifyRequirements.md` in the location requested by the user or appropriate to the current project context.
7. Summarize the specification and identify any remaining decisions.
8. Name the next stage: `spec-checklist`, then `ddd` when the feature adds or changes domain concepts or rules, then `bdd` when the feature has business behavior to illustrate with examples, then `uiux` when it has a user-facing surface, then `dev`.

Do not implement the feature, modify production code, or generate an implementation plan unless the user explicitly requests those additional activities.

The primary deliverable is a specification that communicates the required behavior clearly enough for implementation and objective verification.
