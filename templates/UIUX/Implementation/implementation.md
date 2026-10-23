---
name: uiux-implementation
description: How to turn approved UI/UX designs into front-end code that dev can build and tdd can verify, covering semantic HTML and component structure, typography (type scale, line length, leading, contrast, hierarchy), copywriting and microcopy (labels, button text, error messages, tone), iconography (labels, consistency, cultural fit), grid systems and responsive layout, mobile-first design, reactive UI (declarative components, state, data binding, events, UI states), progressive enhancement and graceful degradation (feature detection, fallbacks), text-to-speech and speech-to-text, front-end performance (Core Web Vitals, assets, animation), the data schema and ORM behind forms and lists, and low-code/no-code trade-offs, based on the UI/UX implementation section of UI/UX Design Guide. Use when building or reviewing a screen, form, component or design system from a mockup, wireframe or Figma file, choosing fonts, sizes or a type scale, writing button labels, empty states, tooltips or error messages, adding icons or an icon-only button, setting up a 12-column grid, breakpoints or container queries, going mobile-first, handling loading, empty, error and success states in React, Vue, Angular or Svelte, making a page work without JavaScript, adding a fallback for an unsupported browser API, adding read-aloud or voice input, fixing slow LCP, INP or layout shift, aligning form validation with database columns, or deciding whether a low-code tool is enough, or when the user mentions typography, microcopy, UX writing, CTA, iconography, grid system, responsive design, mobile-first, reactive UI, state management, progressive enhancement, graceful degradation, feature detection, TTS, STT, ASR, Web Speech API, Core Web Vitals, data schema, ORM, low-code or no-code.
---

# UI/UX Implementation

Implementation is where design intent becomes behavior a user can actually reach, read and operate. Build the core task in semantic HTML that works for everyone, layer styling and interactivity on top, express every visual and textual choice as a named, testable rule (tokens, copy keys, states), and treat accessibility and performance as acceptance criteria rather than polish.

## Front-end structure

- Start from semantic elements: `<button>` for actions, `<a href>` for navigation, `<label for>` on every input, one `<h1>` and an ordered heading outline, landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`). Native elements give keyboard and screen reader behavior for free; ARIA only patches gaps.
- Build reusable components that own their markup, states and styling, fed by design tokens (color, spacing, type, radius, motion) rather than literal values.
- Every component that fetches or mutates data has explicit states: idle, loading, empty, error, success, and (for lists) partial or paginated. A mockup that shows only the happy path is incomplete; ask for the other states.

## Typography

| Rule | Implementable default |
|---|---|
| Body size | 16px (1rem) minimum on the web; sizes in `rem` so browser zoom and user font settings work |
| Line length | about 45–75 characters (`max-inline-size: 70ch`) |
| Leading | body `line-height` around 1.4–1.6; tighter for headings |
| Contrast | WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text (≥24px, or ≥18.66px bold) |
| Text spacing | layout must survive WCAG 1.4.12 overrides (line-height 1.5, letter 0.12em, word 0.16em) without clipping |
| Hierarchy | a modular type scale (e.g. ratio 1.2–1.25) mapped to tokens `--font-size-sm`…`--font-size-3xl`; hierarchy by size and weight, never by color alone |
| Alignment | start-aligned body text; avoid justified text on the web (uneven word gaps) |
| Fonts | at most two families; `font-display: swap` and a metric-compatible fallback to avoid layout shift |

## Copywriting and microcopy

- Product copy persuades through clarity and an honest value statement, never through false urgency, confirmshaming ("No thanks, I like paying more") or hidden costs. Those are dark patterns and are not an acceptable decision.
- Button text names the outcome: "Save changes", "Send invoice", not "OK" or "Submit". Keep one primary call to action per view, visually distinct.
- Labels are visible and persistent; placeholders are examples, not labels.
- Error messages say what happened and how to fix it, next to the field, in plain language, without blaming the user: "Enter a date after 1 Jan 2024", not "Invalid input".
- Keep all strings in a message catalog with stable keys (`checkout.payment.cardDeclined`) so copy, tone and translation change without code edits and tests can assert on them.
- Tone and voice come from the brand or spec; if none is defined, ask product rather than inventing one.

## Iconography

- Pair icons with visible text unless the icon is unambiguous in context (close, search and menu are borderline; test them).
- Icon-only buttons need an accessible name: `<button aria-label="Delete draft">`; decorative icons get `aria-hidden="true"`.
- Use one icon set with consistent stroke, grid and metaphor; one icon means one action everywhere.
- Meaningful icons need 3:1 non-text contrast (WCAG 1.4.11); targets are at least 24×24 CSS px (WCAG 2.5.8), and 44×44 is a safer default for touch.
- Check the cultural meaning of symbols (hand gestures, mailbox, currency) for target locales; mirror directional icons in right-to-left layouts.

## Grid, responsive layout and mobile-first

- Use a column grid (often 12 columns, gutters and margins as tokens) with CSS Grid or Flexbox; align content to it so spacing is predictable.
- Write base styles for the narrowest viewport, then add `min-width` media queries or container queries for wider layouts. Starting small forces content prioritization.
- Content must reflow at 320 CSS px without two-dimensional scrolling (WCAG 1.4.10) and stay usable at 200% text zoom (WCAG 1.4.4).
- Breakpoints follow content, not device names. Never rely on hover for essential actions; support touch, mouse and keyboard.

```css
.layout { display: grid; gap: var(--space-4); grid-template-columns: 1fr; }
@media (min-width: 48rem) { .layout { grid-template-columns: 1fr 2fr; } }
```

## Reactive UI and state

- Describe the UI as a function of state; do not imperatively patch the DOM alongside a framework.
- Keep a single source of truth per piece of state and derive the rest. Model async status as a discriminated union so impossible combinations cannot render.
- Announce async results that do not move focus with a live region (WCAG 4.1.3 status messages).
- Move focus deliberately after route changes, dialogs and destructive actions; never leave focus on a removed element.

```tsx
type Load<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ok"; data: T };
// render each branch explicitly; tests assert each branch
```

## Progressive enhancement and graceful degradation

- Progressive enhancement: the core task (read content, submit the form, follow the link) works with HTML and a server round-trip; CSS and JavaScript enhance it.
- Graceful degradation: when a capability is missing (no WebGL, clipboard permission denied, offline, blocked third-party script), the user gets a clear message and an alternative path, not a blank area or a dead button.
- Use feature detection, not user-agent sniffing: `if ("share" in navigator)`, `@supports (display: grid)`.
- Respect user preferences: `prefers-reduced-motion`, `prefers-color-scheme`, `forced-colors`.

## Speech: text-to-speech and speech-to-text

- Do not build your own screen reader; structure content so real assistive technology works. Add read-aloud (TTS) only when the spec asks for it, with play, pause and speed controls.
- Speech input (STT/ASR) is an alternative to typing, never the only input. Show the transcript for review and editing before it triggers an action.
- Feature-detect speech APIs (support varies by browser), request the microphone only on user action, explain why, and state where audio is processed and whether it is stored.
- Captions are required for prerecorded video with audio (WCAG 1.2.2) and live media (1.2.4).

## Performance

- Budgets are acceptance criteria, measured at the 75th percentile of real users: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
- Reserve space for images and embeds (`width`/`height` or `aspect-ratio`); serve responsive, modern-format images with `loading="lazy"` below the fold.
- Split code by route, defer non-critical scripts, and keep input handlers off long main-thread tasks.
- Animate `transform` and `opacity`; keep transitions short and drop non-essential motion under `prefers-reduced-motion`.

## The data behind the UI

- UI field constraints must match the schema: max lengths, required/nullable, enums, ranges, date semantics. A form that accepts 500 characters into a `varchar(100)` is a defect.
- Validate on the client for feedback and on the server for truth; map server errors back to the field that caused them.
- Lists that show related data must not issue one query per row (the ORM N+1 problem); paginate large collections and show counts honestly.
- Schema and query design belong to the data skills; this skill only states what the UI requires of them.

## Low-code and no-code

Acceptable for internal tools and prototypes when the platform meets the same accessibility, security, data-residency and export requirements; verify those before choosing it and record the lock-in risk.

## Decisions to hand off

| Decide | dev implements | tdd / acceptance verifies |
|---|---|---|
| Type scale, fonts, line length, contrast | Tokens in CSS/theme; `rem` units; `max-inline-size` | Automated contrast check (axe); visual regression at 200% zoom |
| Copy for labels, CTAs, errors, empty states | Message catalog keys; copy matched to spec tone | Tests assert visible text per state; no generic "Invalid input" |
| Icon usage and accessible names | One icon set; `aria-label` or visible text; `aria-hidden` on decoration | `getByRole("button", { name })` finds every icon button; target size check |
| Layout grid and breakpoints | Mobile-first CSS, container/media queries | Screenshots at 320, 768, 1280 px; no horizontal scroll at 320 px |
| Component states per data view | Discriminated union state; explicit render branches | One test per state: loading, empty, error, success |
| Core task without JavaScript or a capability | Server-handled form/link; feature detection and fallback message | E2E with JS disabled or API stubbed absent still completes the core task |
| Speech features (if in spec) | Feature-detected API, consent prompt, editable transcript | Unsupported path shows typing fallback; transcript needs confirmation |
| Performance budgets | Image sizing, code splitting, deferred scripts | Lighthouse CI or RUM thresholds fail the build when exceeded |
| UI field constraints | Validation rules shared with or derived from the schema | Boundary tests at max length, empty, out-of-range; server error mapped to field |

Anything the spec does not settle (brand tone, supported browsers, offline needs, whether speech is in scope) goes back to product/spec as an open question.

## Workflow

1. Read the approved spec and design; list each screen's tasks, data and states, and raise any missing state as an open question.
2. Mark up the core task in semantic HTML that works without enhancement.
3. Apply tokens for type, color, spacing and grid, mobile-first.
4. Write copy into the message catalog for every label, CTA, empty, error and success state.
5. Add interactivity as reactive components with explicit state, focus management and live announcements.
6. Add feature detection and fallbacks for every optional capability.
7. Check performance budgets and align field constraints with the schema.
8. Record the decisions in the hand-off table so tdd can write tests before dev builds.

## Red flags

- `<div onClick>` for buttons, missing labels, placeholder used as label.
- Only the happy-path state designed or coded; spinners that never resolve to an error.
- Generic or blaming error messages; manipulative CTA copy.
- Icon-only buttons without accessible names; meaning carried by color alone.
- Fixed pixel font sizes, horizontal scroll at 320 px, layout breaking at 200% zoom.
- User-agent sniffing instead of feature detection; a dead button when an API is missing.
- Voice as the only input path, or the microphone requested on page load.
- Images without dimensions causing layout shift; animation ignoring reduced motion.
- UI limits that disagree with database constraints.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records these decisions.
- `../Affordance/affordance.md` — UI patterns, ARIA and WCAG detail behind these rules.
- `../Internationalization/internationalization.md` — message catalogs, text expansion, RTL and locale formats.
- `../Testing/testing.md` — how each hand-off decision is tested.
- `../ArtificialIntelligence/artificialIntelligence.md` — AI-driven UI such as form fill and generated content.
- `../../actions/dev.md` — implements the decisions recorded here.
- `../../actions/tdd.md` — writes the tests listed in the hand-off table first.
- `../../CleanCode/ErrorHandling/errorHandling.md` — error paths behind the error states (when installed).
- `../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — data model behind forms and lists (when installed).
- `../../DBA/PostgreSQL/TablesConstraintsIndexes/tablesConstraintsIndexes.md` — constraints the UI validation must match (when installed).
