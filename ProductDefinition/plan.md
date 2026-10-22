## Mandatory Completion Gate: Zero Open Questions

**The product plan MUST NOT be finalized or handed off to `spec-definition` while any material question remains unanswered.**

The goal is to reach a state where the product's intent, behavior at the product level, boundaries, and constraints are sufficiently explicit that the requirements specification can be created without guessing the user's intent.

### 1. Identify every unresolved decision

Before completion, systematically review the plan for:
- Ambiguous goals or expected outcomes.
- Unclear target users or primary use cases.
- Undecided capabilities or release scope.
- Missing or conflicting business rules.
- Undefined behavior that could materially change the product.
- Unresolved permissions, security, privacy, or data-handling decisions where applicable.
- Unclear integrations or external dependencies.
- Missing constraints that materially affect the product.
- Unresolved success criteria.
- Contradictions between previously agreed decisions.
- Assumptions that have not been accepted by the user or otherwise validated.
- Any other decision that would force the requirements author or implementer to guess about product intent.

### 2. Resolve every material question conversationally

For each unresolved decision:

1. Determine the impact of the uncertainty.
2. Ask the user a focused question.
3. Offer a recommendation or concrete alternatives when useful.
4. Explain relevant trade-offs when they could affect the decision.
5. Record the user's decision.
6. Reassess the plan for contradictions or new questions introduced by the answer.

Continue this process until all material decisions are resolved.

Ask one question at a time by default. Group questions only when answering them together is clearly more efficient.

Do not invent answers, silently choose consequential defaults, or interpret silence as consent.

### 3. Resolve assumptions explicitly

Every assumption that materially affects the product must be handled in one of these ways:

- Confirmed by the user.
- Validated through reliable evidence.
- Explicitly accepted by the user as a working assumption, including its consequences where relevant.
- Removed from the plan because it is unnecessary.

Do not treat an unverified, consequential assumption as resolved merely by labeling it an assumption.

Low-impact implementation details that do not affect product intent may be deferred to requirements specification or technical planning.

### 4. Resolve risks and dependencies

For each material risk or dependency, establish an agreed response.

Depending on the situation, that response may be to:
- Verify the dependency before proceeding.
- Accept the risk knowingly.
- Define a fallback behavior.
- Reduce the scope.
- Perform a feasibility investigation.
- Establish a constraint or prerequisite for the release.

A risk does not necessarily have to disappear, but its handling must be clear enough that it does not leave the product definition ambiguous.

### 5. Perform a final consistency review

Before declaring completion, verify that:

- Every product goal has a clear intended outcome.
- Every essential capability supports an agreed goal.
- The MVP scope is explicit.
- Important business rules are decided.
- Relevant constraints and dependencies have defined treatment.
- Success criteria are agreed upon and evaluable.
- No decisions contradict one another.
- No material assumptions remain unapproved or unvalidated.
- No unresolved product-level question requires the next stage to guess the user's intent.

### 6. Enforce the completion gate

The plan may be finalized for handoff only when all the checks above pass.

The final plan MUST contain:

- **Open Questions: None.**
- Confirmed product decisions.
- Explicitly accepted assumptions, if any.
- Documented risks and their agreed handling.
- Clearly defined scope and success criteria.

Do not use `NEEDS CLARIFICATION` for a product decision that remains unresolved at handoff.

If the user is unavailable, refuses to decide, or a material question cannot be answered with available evidence, do not pretend the plan is complete. Keep it in progress and explain exactly what is preventing completion.

If the user explicitly authorizes a provisional decision, record that decision and its consequences as an accepted assumption. Do not use this exception to silently bypass the completion gate.

### 7. Invoke the requirements skill

Only after the completion gate passes:

1. Save or present the final product plan.
2. Invoke `specify-requirements`.
3. Pass the complete plan and relevant project context.
4. Require the requirements skill to formalize the agreed behavior into testable requirements and acceptance scenarios.
5. If the requirements skill discovers an unresolved product-level decision, return to product planning, resolve it with the user, and update the plan before continuing.

The product plan is complete only when there are no unresolved questions about what the user wants to accomplish or what the product must deliver.
