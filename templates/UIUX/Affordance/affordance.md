---
name: uiux-affordance
description: How to make every interactive element announce what it does and how to use it, covering perceptible and hidden affordances, Gibson's affordance theory (perception-action coupling, context-dependent action), choosing UI patterns (accordion, drawer, ribbon, tree, wizard, progress indicator, header and footer, site map), ARIA roles, states and properties, screen readers, keyboard access and keyboard shortcuts, alternative text, WCAG 2.2 AA (perceivable, operable, understandable, robust), design for color blindness and contrast, paper cut bugs, keeping the view passive (MVC), cross-cultural communication styles in microcopy, and rejecting dark patterns, based on the Affordance section of UI/UX Design Guide. Use when deciding which control or pattern fits a spec, when users do not notice a button or think static text is clickable, when building an accordion, collapsible section, side drawer, hamburger menu, toolbar, ribbon, tree view, file explorer, multi-step form, onboarding wizard, stepper, spinner, progress bar, loading state, header, footer, navigation or site map, when adding aria-label, aria-expanded, aria-controls, aria-live, role="button", alt text or hotkeys, when auditing accessibility, WCAG, a11y, screen reader (NVDA, JAWS, VoiceOver, TalkBack), keyboard navigation, focus order, focus trap, color contrast, color-only status, colorblind palettes, when triaging small UI annoyances (paper cuts), or when someone proposes fake urgency, confirmshaming, pre-checked add-ons, hard-to-cancel subscriptions or other dark patterns.
---

# Affordance

An element's appearance, name and behavior must tell the user what it is, what it does and how to operate it, for every user: mouse, touch, keyboard and assistive technology. Choose the most conventional pattern that fits the task the spec describes, build it from native semantics first, and state each choice as a testable rule (role, name, state, keys, contrast, target size).

## Perceptible and hidden affordances

| Kind | Example | Risk | Rule |
|---|---|---|---|
| Perceptible | Raised button, text field with border, drag handle | Flat design removes the cue | Interactive things must look interactive: shape, border, fill or underline, plus hover/focus/pressed states |
| Hidden / learned | Underlined text = link, swipe to delete, long press | Invisible to new users and to keyboard/AT users | Never make a hidden gesture the only path; offer a visible control too |
| False affordance | Bold blue static text, card that looks clickable but is not | Users click and nothing happens | Remove the cue or make it work |

- Gibson's view applied to UI: people perceive what they can do in context, so the same icon can mean different things on different screens and for different cultures. Prefer text labels over icon-only controls unless the icon is universally established (close, search) and still has an accessible name.
- Feedback completes the affordance: every action produces a visible and announced response within about 100 ms (pressed state), and a progress cue for anything longer than about 1 s.

## Choosing a UI pattern

| Pattern | Use when | Avoid when | Accessibility essentials (WAI-ARIA APG) |
|---|---|---|---|
| Accordion | Many independent sections; users need one or two (FAQ, settings groups) | Users must compare sections or read everything | Heading containing a `<button aria-expanded aria-controls>`; or native `<details><summary>` |
| Drawer | Secondary navigation, filters or settings on small screens | Primary navigation on desktop with room to show it | Modal drawer = dialog: focus moves in, is trapped, `Esc` closes, focus returns to the trigger |
| Ribbon / toolbar | Dense command sets in productivity tools, grouped by task | A few actions (use buttons) | `role="toolbar"`, one tab stop, arrow keys between items, every command also reachable another way |
| Tree | Real parent-child hierarchy (files, org chart, categories) | Flat or two-level data (use a list or grouped list) | `role="tree"`/`treeitem`, `aria-expanded`, arrow keys; drag-and-drop needs a non-drag alternative (WCAG 2.5.7) |
| Wizard / stepper | A long task with dependent steps done rarely (signup, setup) | Frequent tasks or independent fields (use one form) | Step indicator with `aria-current="step"`, Back keeps entered data, validate per step, review before submit |
| Progress indicator | Any wait over ~1 s | Instant operations (flicker) | Determinate `<progress value max>` when measurable, indeterminate otherwise; status via `aria-live="polite"` |
| Header / footer | Site-wide identity and navigation | Repeating page-specific actions | `<header>`, `<nav aria-label>`, `<main>`, `<footer>` landmarks; skip link to main content |
| Site map | Planning information architecture; large sites | As a substitute for usable navigation | Keep it in sync with routes; an HTML sitemap page plus `sitemap.xml` for crawlers |

Progressive disclosure (accordion, drawer, wizard) hides complexity but also hides content: never hide information the user needs to make the decision in front of them, such as price, terms or the consequences of an action.

## Native semantics first, ARIA second

- Use `<button>`, `<a href>`, `<input>`, `<select>`, `<dialog>`, `<details>` before any `role`. A native element brings focus, keyboard behavior and the accessible role for free.
- ARIA changes only what assistive technology is told, never behavior. `role="button"` on a `div` also requires `tabindex="0"`, `Enter` and `Space` handlers and a focus style. Incorrect ARIA is worse than none.
- Every control needs an accessible name (visible label preferred; `aria-label` or `aria-labelledby` for icon-only), a role, and its current state (`aria-expanded`, `aria-pressed`, `aria-checked`, `aria-selected`, `aria-invalid`, `aria-disabled`) kept in sync by script (WCAG 4.1.2).
- Announce asynchronous results (saved, 3 results, error) with a live region (WCAG 4.1.3) instead of moving focus unexpectedly.

```tsx
<h3>
  <button aria-expanded={open} aria-controls="shipping-panel" onClick={() => setOpen(!open)}>
    Shipping options
  </button>
</h3>
<div id="shipping-panel" hidden={!open}>…</div>
<p role="status" aria-live="polite">{saveMessage}</p>
```

## Screen readers and keyboard

- Structure carries meaning: one `<h1>`, nested headings in order, lists as lists, tables with `<th scope>`, form fields with `<label for>`, errors linked by `aria-describedby`.
- Everything operable by mouse is operable by keyboard (WCAG 2.1.1), in a logical focus order, with a visible focus indicator (2.4.7) that is not hidden behind sticky headers (2.4.11).
- Keyboard shortcuts accelerate experts but are never the only path. Follow platform conventions (`Ctrl/Cmd+Z`, `Ctrl/Cmd+K` for search), document them (a `?` help panel), avoid overriding browser and screen reader keys, and make single-character shortcuts possible to turn off or remap, or active only on focus (WCAG 2.1.4).
- Test with at least one real screen reader per platform in scope: VoiceOver (macOS/iOS), NVDA (Windows), TalkBack (Android).

## Alternative text

| Image role | `alt` value |
|---|---|
| Informative (chart, photo carrying content) | What it conveys, concisely; key data in adjacent text for complex charts |
| Functional (icon link or button) | The action or destination: "Search", "Download invoice PDF" |
| Decorative | `alt=""` (and no `title`), so screen readers skip it |
| Text in image | The same text; better, use real text |

Never use the file name, "image of", or keyword stuffing. Alt text exists for people first; SEO and broken-image fallback are side benefits.

## WCAG 2.2 AA as the baseline

Treat WCAG 2.2 level AA as a requirement unless the spec states a stricter one. Criteria most often missed in implementation:

| Principle | Criterion | Testable rule |
|---|---|---|
| Perceivable | 1.1.1 Non-text content | Every meaningful image/icon has a text alternative |
| Perceivable | 1.4.1 Use of color | Status, errors, required fields and chart series are not conveyed by color alone |
| Perceivable | 1.4.3 / 1.4.11 Contrast | Text 4.5:1 (large text 3:1); UI component boundaries, icons and focus rings 3:1 |
| Perceivable | 1.4.10 / 1.4.4 Reflow, resize | Usable at 320 CSS px width and at 200% text zoom without loss |
| Operable | 2.1.1 / 2.1.2 Keyboard | All functions by keyboard; no keyboard traps |
| Operable | 2.2.1 Timing | Time limits can be extended or turned off |
| Operable | 2.5.8 Target size | Pointer targets at least 24×24 CSS px or adequately spaced |
| Understandable | 3.3.1 / 3.3.3 Errors | Errors identified in text, with a suggestion to fix |
| Understandable | 3.3.8 Accessible authentication | No cognitive test (puzzle, transcription) as the only sign-in path |
| Robust | 4.1.2 Name, role, value | Custom widgets expose correct role, name and state |

## Color blindness and contrast

- Pair color with a second cue: icon plus text label for status, patterns or direct labels for chart series, underline for links inside text.
- Pick palettes that stay distinguishable under protanopia, deuteranopia and tritanopia; check with a simulator and a contrast checker, in light and dark themes.
- Respect user settings: `prefers-contrast`, `forced-colors` (Windows High Contrast), `prefers-reduced-motion` for drawer and progress animations.

## Paper cut bugs

Small defects that individually seem trivial but together erode trust: misaligned or inconsistent controls, mixed typography, vague labels, errors that do not say how to recover, validation that fires before the user finishes typing, missing pressed or loading feedback, tiny or crowded touch targets. Log them as real defects with a severity, batch them into regular fixes, and add a regression check (visual snapshot or assertion) when fixed.

## Passive view (MVC) and testability

Keep presentation passive: the view renders state and emits user intents; validation, rules and data access live in the model/controller layer. This lets tdd test behavior without a browser and test the view separately for roles, names and states.

## Communication style in microcopy

Labels, errors and confirmations land differently across cultures: direct vs indirect, high- vs low-context. Default to plain, explicit, polite language with no idioms, slang or jokes; state what happened and what to do next. Tone per market is a localization decision; see `../Internationalization/internationalization.md`.

## Dark patterns are never an option

Deceptive design is rejected outright, even when requested, even when "only an experiment". Replace it with the honest equivalent:

| Dark pattern | Honest requirement |
|---|---|
| Misdirection (visually burying the decline option) | Equal visual weight for accept and decline |
| Fake urgency or scarcity timers | Only real, verifiable deadlines and stock levels |
| Forced continuity, roach motel | Cancel as easy as signup, in the same channel; reminder before a trial converts |
| Hidden costs | Full price including fees shown before the final step |
| Sneak into basket, pre-checked add-ons | Nothing added or opted in without an explicit user action |
| Friend spam | Contacts used only with explicit, specific consent per invite |
| Confirmshaming ("No, I like paying more") | Neutral decline wording |

If a spec requires one of these, send it back to product as a blocking issue with the honest alternative; do not implement it.

## Decisions to hand off

| Decide | Dev implements | tdd / acceptance verifies |
|---|---|---|
| Pattern per interaction (accordion, drawer, wizard, tree, …) tied to the spec's task | Component from the design system or native element, following the APG keyboard model | Gherkin per pattern: open/close, keys, focus return |
| Accessibility target (default WCAG 2.2 AA) and supported AT/browser matrix | Semantics, labels, states, landmarks | Automated axe/Lighthouse in CI with zero serious violations, plus a manual screen reader script |
| Accessible name and visible label per control | `<label>`, `aria-label` for icon-only | Query by role and name (`getByRole('button', { name: 'Save' })`) |
| Keyboard map and shortcuts | Handlers, focus management, shortcut help panel, opt-out for single keys | Keyboard-only E2E of the main flow; no traps; focus visible |
| Feedback and loading states with thresholds | Pressed state, `<progress>` or spinner after ~1 s, live region messages | Tests for loading, success, error and empty states and their announcements |
| Color tokens meeting contrast; non-color cues for status | Design tokens, icons plus text | Contrast check on tokens; status readable in a grayscale snapshot |
| Alt text policy per image type | `alt` content or `alt=""` | Lint rule (jsx-a11y) and review of informative images |
| Honest-design checks on pricing, consent, cancel and opt-ins | Equal-weight choices, no pre-checked boxes, full price up front | Acceptance: cancel in no more steps than signup; totals equal at every step |

Open questions go back to product/spec rather than being guessed: unclear target users or assistive technology needs, whether a flow is frequent or rare (form vs wizard), legal accessibility obligations (for example EAA, ADA, Section 508), and any requirement that reads as a dark pattern.

## Workflow

1. Read the approved spec and list each user task and the information or action it needs.
2. For each task, choose the most conventional pattern from the table; justify any custom widget.
3. Define for each control: role, accessible name, states, keyboard behavior, feedback, error and loading states.
4. Set the accessibility target and test matrix; record contrast tokens and target sizes.
5. Review the flow for false or hidden affordances, color-only meaning and paper cuts.
6. Screen every persuasive element (pricing, consent, cancel, upsell) against the dark pattern table; reject or send back.
7. Write the decisions table into the UI/UX decisions record for dev and tdd, with open questions flagged.

## Red flags

- `div` or `span` with a click handler and no role, tab stop or key handling.
- Icon-only buttons with no accessible name; `placeholder` used as the only label.
- `outline: none` with no replacement focus style.
- Status, validation or chart meaning expressed only by color.
- A gesture, hover or shortcut as the only way to reach a function.
- Drawer or modal that does not trap focus, close on `Esc` or return focus.
- Spinners with no text alternative, or that never time out into an error.
- Accessibility deferred to "after launch" or verified only by an automated score.
- Pre-checked opt-ins, hidden fees, fake countdowns, or cancel flows longer than signup.

## Related

- `../../actions/uiux.md` — the workflow that consults this skill and records the decisions.
- `../Implementation/implementation.md` — turning these decisions into components and design tokens.
- `../Testing/testing.md` — usability, accessibility and screen reader testing of the chosen patterns.
- `../Internationalization/internationalization.md` — RTL mirroring, text expansion and culturally appropriate icons.
- `../TaskAnalysis/taskAnalysis.md` — the user tasks that each pattern choice must serve.
- `../ModelingDiagrams/modelingDiagrams.md` — site maps and flow diagrams for navigation decisions.
- `../UiUxFoundations/uiUxFoundations.md` — user-centered principles behind these choices.
- `../../actions/dev.md` — implements the components and semantics decided here.
- `../../actions/tdd.md` — writes role/name/state and keyboard tests first.
- `../../ProductDefinition/specs/spec-checklist.md` — where open questions about users and obligations go back (when installed).
- `../../CleanCode/ErrorHandling/errorHandling.md` — structuring the error states surfaced to users (when installed).
