---
name: ui-review
description: "Gate a change to the screen before it reaches review: force every state of each screen it touches (full, empty, loading, error, no permission), check for horizontal overflow at five widths and with side panels open, a short window, every theme, check that a reload keeps the screen, its filters, and its tab, run an accessibility scan and a keyboard pass, check reduced motion, click every new control (no dead, disabled, or fake controls), check the surface and components chosen, and look for hard-coded colors, sizes, and spacing in the added lines. Reports findings as Critical, Improvement, or Suggestion with screenshots. Use from qa or dev whenever the diff touches UI files; or when the user says \"review the UI\", \"check the screen\", \"is this responsive\"."
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

### 2. Sizes and themes

At 390, 820, 1180, 1440, and 2560 pixels wide, and again at 1440 with any side panel or chat the product opens beside the page, check that the page does not scroll sideways: `document.documentElement.scrollWidth === document.documentElement.clientWidth`. A side panel is where headings collapse to one word per line. Then check a short window (640 pixels tall) and every theme the product ships (light and dark at least): nothing reflows, nothing disappears, contrast holds. Any overflow is **Critical** on the sizes the product supports. Look at the screenshots for clipped text, overlapping elements, and controls too small to tap.

### 3. Reload

Change filters, tabs, sorting, and pagination, then reload. The screen must come back the same (state in the URL or stored). Losing it is an **Improvement**, or **Critical** when it loses what the user typed.

### 4. Accessibility and motion

Run an automated scan (axe-core through Playwright, or the browser's tools). `serious` and `critical` violations are **Critical**. Tab from the top to the end of the page: every control is reachable, in a sensible order, with visible focus. Turn on reduced motion (`prefers-reduced-motion: reduce`): nothing travels across the screen, only fades remain.

### 4b. Honest controls and composition

- Click every control the change adds: each one leads to a real screen or a dialog in context. A disabled button for a feature that does not exist yet, a greyed-out item the user has no permission for, or a save that does not save is **Critical**.
- Destructive and bulk actions ask first and show their impact.
- The surface fits what it asks of the user (dialog for a short answer, panel for work beside a list, page for a complex form): no dialog that scrolls, no navigation or pagination inside a panel, no dialog opened from a dialog. A mismatch is an **Improvement**.
- Every component comes from the design system or the app's shared components; a second look for a job an existing component already does, or a shared component restyled for one screen, is an **Improvement** (**Critical** when it breaks another screen).
- Interface text is label and value, short, on the reader's clock ("2 days late"), and never explains itself. Long explanatory lines in cells, tooltips, or empty states are an **Improvement**.

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

`ui-review` is complete when every screen the diff reaches was seen in each state, at each width and height, in each theme, after a reload, with an accessibility scan, a keyboard pass, reduced motion, every new control clicked, and the added lines checked, and every finding is in the report with its severity and evidence.
