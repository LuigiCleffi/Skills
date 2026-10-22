---
name: spec-checklist
description: Expand existing feature specifications into detailed, requirement-by-requirement checklists that examine completeness, clarity, edge cases, acceptance criteria, dependencies, and consistency before tests or implementation begin.
---

# spec-checklist — Specification Deep-Dive Checklist

## Purpose

Read the existing feature specification and expand its requirements into a detailed, feature-specific checklist. Each checklist item must examine a concrete aspect of the specification in depth, helping identify missing details, ambiguities, contradictions, edge cases, and unverified assumptions before development begins.

This skill does not replace or rewrite the original specification by default. It uses the specification as its source and creates a checklist that makes every requirement easier to inspect, validate, and prepare for implementation.

## Core Responsibilities

- Read the existing `spec.md` and relevant planning artifacts.
- Break down each requirement and user scenario into specific review points.
- Examine expected behavior, inputs, outputs, validation, error handling, edge cases, permissions, dependencies, and acceptance criteria where applicable.
- Identify missing, ambiguous, contradictory, or insufficiently detailed requirements.
- Link checklist items to the relevant specification sections.
- Resolve gaps by updating source artifacts when authorized and unambiguous, or request clarification when a product or behavior decision is required.
- Ensure the checklist is reviewed and passes its quality gate before test creation or production implementation.

## Workflow Position

`product-planning` → `specify-requirements` → `spec-checklist` → `dev:tdd` → `dev`

The `spec-checklist` gate must pass before `dev:tdd` writes tests or `dev` modifies production code.

## Boundaries

- **`specify-requirements`** creates the specification.
- **`spec-checklist`** expands and deeply reviews the specification through a detailed checklist.
- **`dev:tdd`** creates and validates test code.
- **`dev`** implements production code.

The checklist verifies the quality and completeness of the requirements. Checking an item as complete means the reviewer has confirmed that the requirement is sufficiently specified—not that the corresponding functionality has been implemented or tested.
