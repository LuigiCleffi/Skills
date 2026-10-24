---
name: uiux-product-design
description: "How to turn an approved spec into concrete screen-level design decisions: the research-to-launch product design loop, design canvas, choosing wireframe, mockup, low-fidelity or high-fidelity prototype fidelity, use cases versus user stories (main, alternate and exception flows), MoSCoW prioritization of UI scope, WYSIWYG editor trade-offs, Kaizen and Plan-Do-Check-Act iteration, intrinsic, extraneous and germane cognitive load, usability friction areas and fixes, and Nielsen's ten usability heuristics, based on the Product design section of UI/UX Design Guide. Use when planning screens or flows for a feature, deciding whether to wireframe or prototype, converting user stories or use cases into UI states, splitting UI scope into Must/Should/Could/Won't, choosing a rich text or WYSIWYG editor, a form or onboarding feels long, users drop off at checkout or sign-up, an interface is cluttered or confusing, error messages are unhelpful, running a heuristic evaluation, or the user mentions design canvas, persona, user journey, wireframe, mockup, lo-fi, hi-fi, prototype, MoSCoW, PDCA, Kaizen, cognitive load, progressive disclosure, friction, or usability heuristics."
---

# Product Design

Product design turns what the spec decided into screens, flows, and states that users can complete without effort, then improves them by testing and iterating. Start from the spec's users, goals, and acceptance criteria; choose the lowest fidelity that answers the open question; remove extraneous load and friction; and write every resulting choice down as something dev can build and tdd can check.

## The product design loop

Research and understand -> frame (personas, stories, use cases) -> explore (sketches, wireframes) -> converge (mockups, prototypes) -> test with users -> iterate -> launch -> keep improving.

- In this repo, research and framing are owned by product (`plan.md`, `spec-definition`). `uiux` consumes them; it does not invent personas, goals, or priorities.
- If a design choice depends on who the user is, what they are trying to achieve, or what success means, and the spec does not say, record it as an open question for product. Do not guess.
- Engineering, product, marketing, and support are collaborators: surface constraints (platform, performance, data availability, legal copy) before a direction is approved, not after.

## Design canvas: one page per feature

Use a canvas to check that the design covers every angle before hand-off. Each row points back to a spec source or becomes an open question.

| Canvas element | Question to answer | Source in this workflow |
|---|---|---|
| Problem statement | What problem does this screen/flow solve? | Spec: Problem Statement |
| Personas | Who uses it, with what needs and constraints (device, ability, expertise)? | Spec: users, scenarios |
| Journeys | What steps and touchpoints lead to and away from it? | Spec: user stories, journeys |
| Information architecture | What content, in what hierarchy, reached through what navigation? | `uiux` decision |
| Visual design | Layout, components, which design-system parts | `uiux` decision + design system |
| Interaction design | Flows, states, controls, feedback | `uiux` decision |
| Testing | How will we know it works (usability test, analytics, acceptance tests)? | Spec success criteria + `uiux` |

## Choosing fidelity

Pick the cheapest artifact that resolves the current uncertainty; raise fidelity only when the cheaper one can no longer answer the question.

| Artifact | What it shows | Use it to decide | Not good for |
|---|---|---|---|
| Sketch / lo-fi prototype (paper, whiteboard, boxes) | Rough structure and flow | Which approach, which steps, what goes on each screen | Visual polish, timing, real content length |
| Wireframe | Layout, placement, hierarchy, navigation in grayscale | Content priority, flow, navigation | Brand, color, motion |
| Mockup | Static visual design with real styling | Look, typography, spacing, component choice | Interaction behavior |
| Hi-fi prototype (clickable, near-final) | Look, feel, interactions, realistic content | Usability testing, stakeholder sign-off, motion, edge-state behavior | Fast exploration of many options (too costly) |

- Explore several options at low fidelity; commit to one before going hi-fi.
- Use realistic content (long names, empty lists, translated strings, error text) once layout matters; placeholder text hides overflow and truncation problems.
- For an agent, a wireframe can be text: a component tree or annotated outline in the decisions record is often enough for dev.

```text
OrderHistoryPage
  Header: "Your orders" (h1)
  Filters: status select, date range        [Could]
  OrderList (newest first, 20 per page)
    OrderRow: date | number | total | status badge | "View" link
  EmptyState: "No orders yet" + "Start shopping" link
  ErrorState: message + "Try again" button
```

## Use cases and user stories as UI inputs

Both describe needs from the user's side; they differ in detail.

| | User story | Use case |
|---|---|---|
| Form | "As a <user>, I want <capability>, so that <outcome>." | Actor, goal, preconditions, main flow, alternate flows, exception flows |
| Detail | Short, a placeholder for conversation | Step-by-step, comprehensive |
| UI use | Defines the goal and who; prioritized in the backlog | Defines every screen state and transition |

- Turn each story into a use-case-style flow before designing: the main flow gives the happy-path screens; alternate flows give branches (filters, optional steps); exception flows give error, empty, timeout, and permission states.
- Every flow step needs a defined UI state. Missing states are the most common hand-off gap.
- State each state as Given/When/Then so tdd can test it directly.

```gherkin
Scenario: Customer with no orders opens order history
  Given I am signed in and have placed no orders
  When I open "Your orders"
  Then I see the message "No orders yet"
  And I see a link "Start shopping"
```

## MoSCoW for UI scope

- **Must**: without it the story fails (core flow, error recovery, accessibility conformance). **Should**: valuable, deferrable. **Could**: nice to have if time allows. **Won't (this time)**: explicitly out.
- Priority is a product decision. `uiux` may propose a split for UI elements (e.g. filters as Could), but the spec's priorities win; flag conflicts back to product.
- Accessibility, error states, and keyboard support are never "Could": they are part of every Must.
- Record Won'ts so dev does not build them and review does not flag their absence.

## WYSIWYG editors

Choose a WYSIWYG (rich text) editor only when non-technical users must format content and see it as it will be published.

- Decide: allowed formats (bold, lists, links, headings, images, tables), storage format (sanitized HTML, Markdown, or structured JSON), and paste behavior.
- Risks: bloated or inconsistent markup, output that renders differently on other devices, and XSS. Sanitize on the server with an allowlist; never trust editor output.
- Accessibility: the editor must be keyboard operable, give toolbar buttons accessible names and pressed state, and announce formatting changes.
- Prefer a plain textarea or Markdown when users are technical or formatting is not needed.

## Cognitive load

| Type | Meaning | Design response |
|---|---|---|
| Intrinsic | The task's inherent complexity | Cannot remove; break into steps, give clear instructions and defaults |
| Extraneous | Load added by poor design (clutter, unclear labels, inconsistent patterns) | Remove: this is the main target |
| Germane | Effort spent usefully learning the system | Support with consistent patterns, clear organization, onboarding where needed |

Reduce load by: simplifying and removing steps; using familiar patterns and the user's vocabulary; a clear hierarchy (one primary action per screen, headings, grouping); immediate feedback; progressive disclosure (advanced options behind "More options"); and prioritizing content so the relevant thing is obvious.

## Usability friction

| Friction area | Typical fix |
|---|---|
| Cluttered UI, information overload, too many choices | Prioritize, remove, progressive disclosure, sensible defaults |
| Slow loading or running | Performance budget, compressed images, CDN, lazy/async loading, skeleton or progress feedback |
| Long onboarding or sign-up | Ask only what is needed now, defer the rest, allow guest paths where the spec permits |
| Unclear navigation | Clear labels, visible current location, consistent menu |
| Long or complex forms | Fewer fields, correct input types, `autocomplete` attributes, inline validation, input hints |
| Poor errors or no feedback | Plain-language message next to the field: what happened and how to fix it |
| Payment with too many steps | Fewer steps, saved details only with consent, clear total before confirm |
| Inaccessibility | Meet WCAG 2.2 AA |
| Weak mobile experience | Responsive layout, targets at least 24x24 CSS px (WCAG 2.5.8), no horizontal scroll at 320 px (WCAG 1.4.10) |
| Wasted steps | Remove steps that do not serve the user's goal |

Friction is sometimes intentional and good: a confirm step before an irreversible delete is deliberate friction. Friction that works against users (hidden cancel, pre-checked consent, forced continuity) is a dark pattern and never acceptable.

## Nielsen's ten heuristics as a checklist

1. Visibility of system status: loading, saving, success, and failure are always shown promptly.
2. Match the real world: user vocabulary, not internal jargon or codes.
3. User control and freedom: cancel, back, and undo are visible.
4. Consistency and standards: same word, same meaning, same pattern everywhere; follow platform conventions.
5. Error prevention: constrain inputs, confirm destructive actions, explain why an action is unavailable.
6. Recognition over recall: show options and recent values instead of making users remember them.
7. Flexibility and efficiency: shortcuts for experts that do not get in novices' way.
8. Aesthetic and minimalist design: every element earns its place.
9. Help users recover from errors: plain language, the precise problem, a constructive fix.
10. Help and documentation: only where the design cannot explain itself; keep it task-focused and searchable.

## Kaizen: iterate after launch

Plan (pick a measured problem, e.g. form drop-off) -> Do (ship a small change) -> Check (measure against the baseline) -> Act (standardize if it worked, otherwise learn and retry). Measuring real users needs the consent and privacy handling that the spec and applicable law require.

## Decisions to hand off

| Decide | Dev implements | Tdd / acceptance verifies |
|---|---|---|
| Screens and flow for each story (main, alternate, exception) | Routes/views and transitions per the flow | One scenario per flow branch |
| UI states per screen: loading, empty, partial, error, success, no-permission | A component state for each, with the agreed copy | Test renders each state and asserts copy and available actions |
| Layout and hierarchy (component tree or wireframe) | Components in the agreed order and heading levels | Accessibility-tree / heading-order assertions |
| MoSCoW split of UI elements, including Won'ts | Builds Must (and agreed Should); skips Won't | Acceptance covers every Must; nothing tests a Won't |
| Primary action per screen and destructive-action confirmation | One primary button style; confirm dialog for irreversible actions | Test that delete requires confirmation and can be cancelled |
| Error message content and placement | Message next to the field, linked with `aria-describedby` | Test invalid input shows the exact message and focus moves to the first error |
| Progressive disclosure: what is hidden by default | Disclosure control with `aria-expanded` | Test default collapsed state and that toggling reveals content |
| Rich text: allowed formats, storage format, sanitization | Editor config plus server-side allowlist sanitizer | Test disallowed markup (e.g. `<script>`) is stripped |
| Friction and performance targets (steps, fields, load time) | Field count, step count, performance budget | Count assertions; performance check in CI where available |
| Open questions for product (unknown users, priorities, success metrics) | Not implemented until answered | Listed as blocked in the decisions record |

## Workflow

1. Read the approved spec and checklist; list users, stories, priorities, and success criteria. Record anything missing as an open question for product.
2. Fill the design canvas for the feature; every row cites the spec or a `uiux` decision.
3. Expand each story into main, alternate, and exception flows; list every UI state.
4. Explore options at low fidelity; pick one, with reasons tied to the spec.
5. Raise fidelity only as far as needed (a wireframe or component tree is often enough for dev).
6. Apply the cognitive load, friction, and heuristic checklists; fix findings in the design.
7. Propose a MoSCoW split for UI elements consistent with the spec's priorities.
8. Write the decisions table and Gherkin scenarios; hand off to dev/tdd through `uiux`.
9. After release, run PDCA on measured problems using consent-respecting measurement.

## Red flags

- Designing screens for a user or goal the spec never described.
- Only the happy path is designed; empty, error, loading, and permission states are missing.
- Hi-fi prototypes built before the flow is agreed.
- Placeholder-text layouts that break with real or translated content.
- Accessibility or error handling scheduled as "Could" or "later".
- More than one visually primary action on a screen.
- Errors shown as codes, in toasts that vanish, or far from the field.
- WYSIWYG output stored or rendered without server-side sanitization.
- Friction added to block cancellation or steer consent (dark patterns).
- "Improvements" shipped without a baseline or a way to check them.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records the decisions.
- `../UiUxFoundations/uiUxFoundations.md` — user-centered design principles behind this loop.
- `../TaskAnalysis/taskAnalysis.md` — breaking a goal into steps before designing the flow.
- `../ModelingDiagrams/modelingDiagrams.md` — journey maps and flow diagrams for the use cases.
- `../DesignManagement/designManagement.md` — design system and pattern library the screens should reuse.
- `../Affordance/affordance.md` — controls, ARIA, WCAG, and dark patterns in detail.
- `../Testing/testing.md` — usability testing and split tests for prototypes and launches.
- `../../ProductDefinition/specs/spec-definition.md` — where users, stories, and priorities come from (when installed).
- `../../ProductDefinition/specs/spec-checklist.md` — gaps to send back before designing (when installed).
- `../../TDD/Patterns/TDDPatterns/tddPatterns.md` — turning the UI states into a test list (when installed).
- `../../CleanCode/ErrorHandling/errorHandling.md` — code-side handling behind the error states (when installed).
