# Interface Rules

Read this file before generating or changing any screen. Each rule has a stable ID: cite it in decisions, reviews, and fixes ("violates L03"). A rule changes only through `actions/design-rules.md`.

**Precedence:** what is shipped and verified > this file > prose docs. When they disagree, fix the docs or propose a rule change; do not follow the stale one silently.

**How to use it**

1. Read the laws (`L`) in full; they decide most questions.
2. Find the rows in the routing table below that match what you are building, and read those groups.
3. Assemble from the components the project already has (`K`).
4. Before saying done, run the verification (`V`) and scan the defects list (`DONT`).

Starter rules: keep the ones that fit this product, change the rest, and add the product's own groups. Write the reason of a rule in `BEHAVIOR.md` when it is not obvious.

## Routing

| Building or changing… | Paths | Read |
|---|---|---|
| Any screen | `src/**/*.tsx`, `src/**/*.vue`, `src/**/*.svelte`, `app/**` | L, K, V, DONT |
| Colors, type, spacing, themes | `**/*.css`, `**/tokens/**`, `**/theme/**` | T, Z |
| Animations and overlays | `**/*.css`, `**/*Dialog*`, `**/*Drawer*`, `**/*Modal*` | M |
| Interface text | `**/locales/**`, `**/i18n/**` | W |
| Tables, charts, numbers | `**/*Table*`, `**/*Chart*` | D |

## L — Laws (on conflict, the lower number wins)

- **L01 Never overflow.** Content never spills past the screen or its container. In order: shrink to the legible minimum, reflow, then hide what would add more.
- **L02 What needs action comes first.** A screen opens with what the person must do or decide; analysis and history come after.
- **L03 No bare numbers.** Every number carries a reference (unit, target, change, or base) and, when it can be bad, a way to act on it.
- **L04 Color has a function.** State colors mean state; the accent marks the primary action and links. State is never shown by color alone.
- **L05 Every action has four states.** Rest, hover, visible focus, and pressed. When a whole component is clickable, hover shows on the whole component.
- **L06 Small screens are a redesign.** Tables become cards; summaries stay visible; nothing is just shrunk.
- **L07 No dead controls.** Every control leads to a real screen or a dialog in context. Not built yet: a non-clickable label, never a disabled button.
- **L08 The chart must not lie.** Bars fill toward the good; when lower is better, show the threshold; a fall in a bad direction is never green.
- **L09 Size sets contrast.** Body text at least 4.5:1, large text and graphics at least 3:1, measured in every theme.

## K — Components

- **K01 Assemble, never draw.** Every screen is built from the design system and the app's shared components; only content changes.
- **K02 One job, one component.** A component that almost fits is the one to use. Never a second look for the same job.
- **K03 New components are candidates.** A missing component is proposed for design review and used on official screens only after approval.

## T — Tokens and type

- **T01 Only tokens.** Colors, sizes, spacing, radii, and shadows come from tokens; no literal values in components.
- **T02 A small type scale.** A fixed set of sizes, each with a role (title, section, body, caption, data); never a size chosen for one screen.
- **T03 Brand through one slot.** A customer's or tenant's brand enters through one set of tokens, never per screen.

## M — Motion

- **M01 Movement explains.** Only to show where something came from, that work is happening, or what changed.
- **M02 Two durations.** A short one for feedback, a longer one for surfaces entering; exits are faster than entrances.
- **M03 Reduced motion.** With reduced motion requested, nothing travels; fades only.

## D — Data honesty

- **D01 Loading is a skeleton** shaped like the content, never a generic spinner.
- **D02 Empty says why** and carries the action that fills it, in the place of the content.
- **D03 Errors are specific**: a failed read inline with a retry, a failed write in a toast that says what to do.

## W — Writing

- **W01 Label and value.** Interface text is short fragments, label and value ("Last login: 12+ days ago"); the interface never explains itself.
- **W02 The reader's clock.** Status in the reader's terms ("2 days late", "due today"), never the database's ("Pending").
- **W03 One voice converses.** Only an assistant or agent, when the product has one, speaks in sentences.

## P — Permissions

- **P01 Hide, do not grey.** Without permission, the control or item is not shown.

## Z — Accessibility

- **Z01 Keyboard first.** Everything is reachable and usable with the keyboard, in a sensible order, with visible focus.
- **Z02 Names for everything.** Every control and image has an accessible name in the interface's language.

## V — Verification (run before saying done)

- **V01** No sideways scroll at 390, 820, 1180, 1440, and 2560 pixels, and with any side panel open.
- **V02** A short window (640 pixels tall) and every theme: nothing reflows or disappears.
- **V03** Tab from top to end: every control reachable, focus visible.
- **V04** Every new control clicked: it leads somewhere real.
- **V05** Reduced motion: nothing travels.
- **V06** Reload: the screen, its filters, and its tab come back.

## DONT — Defects that came back as bugs

Each entry is a defect found in this product, written so it is not repeated. Add one whenever QA or a review finds a defect a rule did not prevent.

| ID | Never | Found in | Rule |
|---|---|---|---|
| DONT-01 | A grid child without `min-width: 0`, which pushes the page wider | (example) | L01 |
| DONT-02 | A disabled button for a feature not built yet | (example) | L07 |
