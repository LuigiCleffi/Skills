---
name: ui-review
description: "Gate a change to the screen before it reaches review: force every state of each screen it touches (full, empty, loading, error, no permission), check for horizontal overflow at four widths, check that a reload keeps the screen, its filters, and its tab, run an accessibility scan, and look for hard-coded colors, sizes, and spacing in the added lines. Reports findings as Critical, Improvement, or Suggestion with screenshots. Use from qa or dev whenever the diff touches UI files; or when the user says \"review the UI\", \"check the screen\", \"is this responsive\"."
---

# ui-review — Check the Screen in Every State

## Purpose and ownership

Screens break in states nobody opens while building: the empty list, the slow request, the error, the user without permission, the phone. `ui-review` opens each of them on purpose. It reports; `dev` fixes.

## When it runs

From `qa` (or `dev`) when the diff touches UI files: components, pages, styles, templates. List the screens the diff reaches, from the routes and components it changes.

## Workflow

### 1. Force every state

For each screen, reach each state and take a screenshot:

| State | How to reach it |
|---|---|
| Full | realistic data, including the longest names and values the data allows |
| Empty | no records |
| Loading | slow the request (browser throttling, or a delayed mock) |
| Error | make the request fail (block it, or return 500) |
| No permission | a user whose role cannot see or do it |

A state the screen cannot be in is noted with the reason, not skipped silently.

### 2. Widths

At 390, 820, 1180, and 1440 pixels wide, check that the page does not scroll sideways: `document.documentElement.scrollWidth === document.documentElement.clientWidth`. Any overflow is **Critical** on the widths the product supports. Look at the screenshots for clipped text, overlapping elements, and controls too small to tap.

### 3. Reload

Change filters, tabs, sorting, and pagination, then reload. The screen must come back the same (state in the URL or stored). Losing it is an **Improvement**, or **Critical** when it loses what the user typed.

### 4. Accessibility

Run an automated scan (axe-core through Playwright, or the browser's tools). `serious` and `critical` violations are **Critical**. Check by hand that every control is reachable and visible with the keyboard alone.

### 5. Hard-coded values

In the added lines of the diff, look for colors, font sizes, spacing, and radii written as literals where the project has tokens or a theme (`#3366ff`, `14px`, `margin: 12px`). Each is an **Improvement**: it drifts from the design system and breaks the dark theme.

### 6. Report

Add to the QA report (or `docs/qa/reports/<report>/ui.md`):

| ID | Screen | State / width | Finding | Severity | Evidence |
|---|---|---|---|---|---|
| UI-01 | Orders | Empty, 390 | Button "New order" off-screen | Critical | ui-01.png |

- **Critical**: a user cannot see, reach, or use something; or data is lost. Blocks the pull request.
- **Improvement**: works, but worse than the project's standard.
- **Suggestion**: a matter of taste; the developer decides.

## Guardrails

- Never change code or styles; report to `dev`.
- Never test against production or with real customer data.
- Keep screenshots small and only of what proves the finding.

## Completion criteria

`ui-review` is complete when every screen the diff reaches was seen in each state and at each width, after a reload, with an accessibility scan and the added lines checked, and every finding is in the report with its severity and evidence.
