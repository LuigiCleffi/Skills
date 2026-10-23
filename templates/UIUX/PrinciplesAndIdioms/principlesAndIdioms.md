---
name: uiux-principles-and-idioms
description: A working library of named UI/UX principles and laws to justify, check and test design decisions, covering discoverability, signifiers, feedback, mapping, constraints and conceptual models (Norman), aesthetic-usability effect, Fitts's law, Hick's law, visual hierarchy, progressive disclosure, simplicity and error prevention (Lidwell et al.), data-ink ratio and graphical integrity (Tufte), scannability, conventions and form design (Krug, Jarrett), modeless interfaces and undo (Raskin), Tesler's law of conservation of complexity, the Pareto 80/20 rule, Chesterton's fence, the Law of Demos, "perfect is the enemy of good", "learn early, learn often", "make mistakes faster", "data beats emotions", quick wins, out of scope, over the horizon, and why idioms and aphorisms must not leak into UI copy, based on the Books about UI/UX, UI/UX quotations, Idioms and Aphorisms sections of UI/UX Design Guide. Use when justifying or challenging a UI decision with a named principle, reviewing a screen for usability heuristics, sizing or placing click and touch targets, deciding how much to show at once, simplifying a crowded form or settings page, designing charts or dashboards, deciding who absorbs complexity (user or system), prioritizing which flows to polish first, removing a "pointless" field, step or confirmation, preparing for a demo, scoping an MVP, arguing taste versus evidence, writing UI copy with idioms or slang, or when the user mentions Don Norman, Design of Everyday Things, Universal Principles of Design, Don't Make Me Think, Forms that Work, The Humane Interface, Tufte, chartjunk, Fitts, Hick, Tesler, Pareto, 80/20, Chesterton's fence, Kapor's law, modes, affordance, signifier, mental model, or "design principles".
---

# Principles and Idioms

Use a named principle to make a decision concrete and testable, never as decoration or as a substitute for user evidence. For each UI decision, cite the principle it applies, state the observable behavior that follows from it, and name the check that proves it; when a principle and the spec pull in different directions, the spec wins and the tension goes back to product as an open question.

## How to use principles (and how not to)

- A principle is a hypothesis about people, not a law of physics. Pair it with evidence from the spec, research, analytics or a usability test before it overrides a stated requirement.
- Translate every principle into a property dev can build and tdd can assert: "Fitts's law" becomes "primary action target is at least 44x44 CSS px and sits next to the last field".
- Quotations and aphorisms (the guide collects many from designers and founders) are reminders, not arguments. "Simplicity" decides nothing; "remove the optional `fax` field because 0.2% of submissions use it and it adds a tab stop" does.
- Never use a principle to justify a dark pattern: "reduce friction" is not a reason to hide cancellation, pre-tick consent, or skip confirmation of an irreversible action.

## Interaction principles (Norman, Raskin)

| Principle | Decision it drives | Implementable property |
|---|---|---|
| Discoverability | Can users find what the product can do without instructions? | Primary actions visible without hover or gesture-only access; icon-only controls have an accessible name and a tooltip |
| Affordance and signifier | Does the element look like what it does? | Buttons look pressable, links look like links, drag handles show a grip and `cursor: grab`; native `<button>` / `<a href>` over clickable `<div>` |
| Feedback | Does every action produce a visible result fast? | Acknowledge input within ~100 ms; show progress for anything over ~1 s; announce async results via `aria-live` |
| Mapping | Do controls sit near, and move like, what they affect? | Control placed beside its target; slider direction matches value direction; control order matches output order |
| Constraints | Can the UI make wrong input impossible? | `type="date"` or a picker instead of free text; `min`/`max`/`maxlength`; disabled options explain why |
| Conceptual model | Does the user's mental model match system behavior? | Terms from the user's domain (task analysis), same object names across screens, state visible (saved, draft, syncing) |
| Error prevention and recovery | Prevent slips; make recovery cheap | Undo instead of "are you sure?" for reversible actions; confirmation naming the object for irreversible ones; inputs preserved after an error |
| Modelessness | The same input should not do different things in hidden states | Avoid modes; if unavoidable (edit vs view), show the mode persistently and make exit obvious (`Esc`, visible button) |
| Direct manipulation | Act on the object, not via a distant form | Inline edit; drag to reorder with a single-pointer or keyboard alternative (WCAG 2.5.7) |

```tsx
// Feedback + recovery instead of a blocking confirm for a reversible delete
function onDelete(item: Item) {
  removeLocally(item.id);
  toast.show({ message: `Deleted "${item.name}"`, action: { label: "Undo", onClick: () => restore(item) } });
  scheduleServerDelete(item.id, { delayMs: 5000, cancelOn: "restore" });
}
```

## Layout and attention principles (Lidwell et al., Krug)

- **Visual hierarchy**: one primary action per view; size, weight, contrast and position express importance. Testable: exactly one primary-styled element per form or dialog.
- **Fitts's law**: time to hit a target grows with distance and shrinks with size. Put frequent actions close to where attention already is and make them big. WCAG 2.2 AA (2.5.8) requires at least 24x24 CSS px or equivalent spacing; 44x44 is the comfortable touch size (2.5.5, AAA). Keep destructive actions away from frequent ones.
- **Hick's law**: decision time grows with the number and similarity of choices. Group, default sensibly, and cut options rather than adding a chooser.
- **Progressive disclosure**: show what most users need first and reveal advanced options on demand (`<details>`, or a button with `aria-expanded`). Never hide what is required to finish the task or to make an informed choice (price, terms, cancellation).
- **Simplicity**: every element must earn its place; remove before adding. Krug's check: a first-time visitor knows where they are, what the page is for, and what to do next.
- **Scannability**: meaningful headings in a correct `h1`-`h6` outline (WCAG 1.3.1, 2.4.6), short paragraphs, front-loaded labels, lists.
- **Conventions (Jakob's law)**: users spend most of their time in other products; follow platform and web conventions unless research shows a reason not to.
- **Aesthetic-usability effect**: polish raises perceived usability and tolerance of minor issues. Useful, but it also masks problems in tests; measure task success, not only stated satisfaction.

## Forms (Jarrett and Gaffney, Krug)

- Ask only what the spec needs; an optional field with no owner who uses the data goes back to product as "remove?".
- A visible `<label>` per field (never placeholder-only); instructions before the field, not after a failed submit.
- Validate on blur or submit, not on every keystroke; error text says what is wrong and how to fix it, is linked with `aria-describedby`, and focus moves to the first error or an error summary (WCAG 3.3.1, 3.3.3).
- Correct input types and `autocomplete` tokens (WCAG 1.3.5); never make people re-enter data already given in the same process (WCAG 3.3.7).
- Single column, in the order users think about the data; group related fields with `<fieldset>`/`<legend>`.

## Data display (Tufte)

- **Data-ink ratio**: drop heavy gridlines, 3D, gradients, and legends that could be direct labels.
- **Graphical integrity**: bars start at zero; axes labeled with units; no dual axes implying false correlation; area proportional to value. A misleading chart is a dark pattern.
- **Small multiples** for comparing many series instead of one tangled chart.
- Never encode meaning by color alone (WCAG 1.4.1); provide the numbers as a table or accessible text.

## Complexity and prioritization laws

| Law | Use it to decide | Watch out |
|---|---|---|
| Tesler's law (conservation of complexity) | Who absorbs unavoidable complexity: the system (defaults, inference, automation) or the user | Moving it into the system costs engineering; make it an explicit spec trade-off |
| Pareto (80/20) | Which flows, states and devices get polish first, from real usage data | A heuristic ratio; never a reason to drop accessibility or minority-locale users |
| Chesterton's fence | Before removing a field, step, confirmation or warning, learn why it exists (history, ticket, legal, support) | "Nobody uses it" is not "nobody needs it" (audit, compliance, rare critical cases) |
| Law of Demos (Kapor) | A demo rehearses the happy path; real use does not | A demo is never verification; acceptance needs tests with realistic data, errors and edge cases |

## Delivery aphorisms, made operational

- **Perfect is the enemy of good**: define "good enough" up front as acceptance criteria (task success, WCAG 2.2 AA, performance budget); ship when met and log the rest. It never licenses skipping accessibility, security or error states.
- **Learn early, learn often / make mistakes faster**: test the riskiest assumption with the cheapest artifact (sketch, clickable prototype, flagged slice) before building the polished version. Experiments on real users need consent and privacy review.
- **Data beats emotions**: prefer evidence over taste when choosing between options, but data only answers the question it measured; qualitative research explains why. A metric never justifies manipulation, such as conversion gained from a hidden opt-out.
- **Quick wins**: small, low-risk fixes with visible user value (label clarity, contrast, focus order) that build momentum alongside the plan, not instead of it.
- **Out of scope**: say it explicitly and record it; a UI decision that needs out-of-scope work becomes an open question for product, not a quiet expansion.
- **Over the horizon**: note anticipated needs (more locales, roles, themes) so today's structure does not block them, without building them now.
- **Think outside the box**: generate alternatives before converging (see Ideation), then return to the constraints.

## Idioms and aphorisms in the product itself

- Idioms mean something other than their words, so they do not translate, confuse non-native readers, and mislead people who read literally. Keep UI copy plain and literal (WCAG 3.1.5 reading level is AAA, but a sound target).
- Do not hardcode jokes or puns in strings that will be localized; if brand voice wants personality, give translators context in the string description.
- A witty empty state or error must still say what happened and what to do next.

## Decisions to hand off

| Decide | Dev implements | tdd / acceptance verifies |
|---|---|---|
| Principle cited for each non-obvious UI choice | Short note in the UI/UX decisions record next to the component | Reviewer can trace each choice to a principle or a spec line |
| Primary action per view and its placement (hierarchy, Fitts) | One primary-styled button, in the predictable position | Component test: exactly one primary action; target >= 24x24 CSS px (44x44 if the spec says touch-first) |
| Feedback timing and channel per async action | Pending state within 100 ms, progress over 1 s, result in a live region | Test asserts pending state appears and result is announced (`role="status"`) |
| Reversible vs irreversible actions | Undo for reversible; named confirmation for irreversible | E2E: delete then Undo restores the item; irreversible action requires a confirmation naming the object |
| What is disclosed progressively and what stays visible | Disclosure with `aria-expanded` for advanced options | Test that required fields, price and terms are visible without expanding |
| Who absorbs complexity (Tesler) | Defaults, inference or automation described in the spec | Tests for default values and the override path |
| Fields or steps removed (Chesterton check recorded) | Removal plus handling of any stored data | Regression tests on flows that used them; product sign-off in the record |
| Chart integrity rules | Zero-based bars, labeled axes, data-table alternative | Unit test on scale domain; a11y check that the table exists |
| Plain, idiom-free copy | Strings in the i18n catalog with translator notes | Copy review checklist; lint for a banned-phrase list if the team keeps one |
| "Good enough" bar for this release | Acceptance criteria in the spec | The criteria themselves, as acceptance tests |

When a decision depends on intent the spec does not state (who the primary user is, which action is primary, whether a step is legally required), record an open question for product/spec instead of choosing.

## Workflow

1. Read the approved spec, task analysis and any research; list the screens and actions in scope.
2. Walk each screen through the interaction principles table; note decisions and violations.
3. Apply the layout, forms and data-display checks; turn each finding into a property with a number or a selector where possible.
4. For any removal or simplification, run the Chesterton check and agree with product who absorbs the complexity.
5. Prioritize with real usage data (Pareto); list quick wins separately from structural work.
6. Write decisions into the UI/UX decisions record using the hand-off table; send intent gaps back as open questions.
7. Verify with a usability test or a walkthrough on realistic data, never with the demo path alone.

## Red flags

- A principle quoted with no observable property or test attached.
- A quotation or "best practice" used to overrule the spec or user evidence.
- Several primary-styled buttons competing in one view.
- Blocking "Are you sure?" for reversible actions, and no confirmation for irreversible ones.
- Hidden modes, or hover-only and gesture-only actions with no alternative.
- Removing a field or warning because it "looks pointless" without learning why it exists.
- "80/20" used to drop accessibility, error states or minority locales.
- A successful demo reported as verification.
- Charts with truncated axes, 3D effects, or color-only meaning.
- Idioms, puns or slang in strings headed for translation.
- "The data says so" used to justify a manipulative pattern.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records the decisions.
- `../Affordance/affordance.md` — affordances, signifiers, ARIA, WCAG and dark patterns in depth.
- `../UiUxFoundations/uiUxFoundations.md` — the user-centered basis for applying these principles.
- `../TaskAnalysis/taskAnalysis.md` — the user's vocabulary and mental model behind conceptual-model decisions.
- `../Ideation/ideation.md` — generating alternatives before converging.
- `../Testing/testing.md` — usability tests and experiments that confirm a principle actually held.
- `../Internationalization/internationalization.md` — why idiom-free, translatable copy matters.
- `../SoftSkills/softSkills.md` — presenting and defending principle-based decisions to stakeholders.
- `../../actions/dev.md` — implements the properties in the hand-off table.
- `../../actions/tdd.md` — turns the hand-off table into tests.
- `../../ProductDefinition/specs/spec-definition.md` — where intent gaps and "good enough" criteria belong (when installed).
- `../../CleanCode/SimpleDesign/simpleDesign.md` — the code-side counterpart of removing what does not earn its place (when installed).
