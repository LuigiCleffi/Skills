---
name: spec-checklist
description: Analyze a feature specification and produce a detailed, feature-specific requirements checklist. Identify ambiguity, contradictions, omissions, constraints, and acceptance criteria before TDD or implementation.
---

# spec-checklist — Requirements Quality Gate

## Purpose and ownership

Turn a specification into a detailed checklist of what the feature must do and the conditions under which it is correct. Examine each requirement in depth, with enough specificity that `tdd` can derive tests and `dev` can implement the behavior without guessing.

This checklist evaluates **requirements quality and completeness**, not implementation progress. It does not write tests, implement code, or certify that the feature is complete.

## Inputs and source of truth

Use the supplied specification, user request, linked design notes, and explicitly identified repository contracts. Preserve the source's terminology, requirement IDs, constraints, and priorities.

Do not silently fill gaps with assumptions or replace the specification with general best practices. Clearly separate:
- Requirements explicitly stated by the source.
- Necessary implications directly supported by the source.
- Questions or gaps that require a product decision.
- Optional recommendations that are not requirements.

If no specification or sufficient source material is available, ask for it or state the limitation. Do not invent feature requirements.

## Workflow

### 1. Establish scope

Identify the feature, user or system actors, intended outcomes, affected workflows, explicit exclusions, dependencies, and source documents. Keep unrelated features out of scope.

### 2. Decompose every requirement

For each requirement, identify applicable details:

- Trigger and preconditions.
- Inputs, formats, allowed values, and validation.
- Expected outcomes and observable behavior.
- State changes and persistence.
- Success, failure, boundary, and recovery behavior.
- Authorization, roles, and permissions.
- Data handling, privacy, and security constraints.
- Integrations, external contracts, and dependency failures.
- Compatibility, migration, and performance constraints when specified.
- Acceptance criteria and testable examples.
- Explicit exclusions or non-goals.

Only include dimensions relevant to the feature. Do not inflate the checklist with generic cases that the source does not support.

### 3. Detect gaps and conflicts

Look for requirements that are:
- Ambiguous or not objectively testable.
- Contradictory with another requirement or existing stated contract.
- Missing a necessary outcome or failure behavior.
- Missing a decision that would materially change implementation.
- Impossible to validate from the available information.
- Unclear about scope, ownership, permissions, or compatibility.

Ask concise, specific questions for material product decisions. Do not block on ordinary implementation choices that can follow established repository conventions.

### 4. Produce the checklist

Organize checklist items by feature flow or requirement ID, not as a generic boilerplate list. Use stable IDs when helpful (for example, `REQ-01`, `REQ-02`) and include traceability to the source when available.

For each item, include:
- A concrete, testable statement of expected behavior.
- Acceptance condition or example, where supported.
- Source reference or requirement ID, when available.
- Status: **Ready**, **Needs clarification**, or **Out of scope**.

Do not mark an item as implemented or passed; this skill assesses requirements, not implementation.

### 5. Gate the handoff

End with:
- **Ready for implementation:** requirements sufficiently clear for the scoped work.
- **Blocked:** exact questions or contradictions that must be resolved first.
- **Assumptions:** only if explicitly authorized or unavoidable, clearly labeled and not presented as source facts.
- **Out of scope:** exclusions stated in the source.

If a material requirement remains unresolved, tell `dev` not to implement the affected behavior until clarified. Other independent, fully specified portions may proceed only if `dev` can isolate them safely.

When the ready scope adds or changes a user-facing surface and `uiux` is available, hand the checklist to `uiux` before `dev`, so UI/UX decisions are made from the approved requirements rather than improvised during implementation. Otherwise hand it to `dev`.

## Output principles

- Be specific to the supplied feature and source.
- Preserve original terminology and framing.
- Avoid generic checklists detached from the actual specification.
- Do not claim completeness beyond the available source.
- Keep the output concise enough to use, but detailed enough to derive tests and implementation.
