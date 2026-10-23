---
name: uiux-design-management
description: How to keep UI work consistent and aligned with strategy by reusing and extending a design system: design management (strategic alignment, design planning, cross-functional collaboration, design methods, resources), design systems (principles, visual style guide, design tokens, component library, interaction patterns, accessibility guidelines, documentation), style guides (typography, color, grid and spacing, imagery, voice and tone, writing conventions), pattern libraries, the UK Government Design Principles, Apple Human Interface Guidelines (HIG) and Google Material Design, based on the Design management section of UI/UX Design Guide. Use when starting UI work in a codebase that may already have components or tokens, deciding whether to reuse, extend or create a component, a new screen looks inconsistent with the rest of the product, colors, spacing or fonts are hard-coded, copy tone or capitalization varies, choosing platform conventions for iOS, macOS, Android or web, adding a pattern to a shared library, or the user mentions design system, design tokens, style guide, brand guidelines, voice and tone, pattern library, component library, Storybook, GOV.UK, HIG, Dynamic Type, VoiceOver, Material, or "consistent, not uniform".
---

# Design Management

Design work serves the product strategy and stays consistent by building on shared foundations: a design system, a style guide, and a pattern library. Before designing anything, find what the product already has and the platform conventions it follows; reuse first, extend deliberately, and create new patterns only when nothing fits, documenting them so the next feature can reuse them.

## Design management, applied to a feature

The guide frames design management as running the design function in service of business strategy. For an agent working one spec at a time, that reduces to:

| Aspect | What it means for `uiux` |
|---|---|
| Strategic alignment | Every design decision traces to a goal in the plan or spec; no decoration without purpose |
| Design planning | Scope the UI deliverables (screens, states, components) and note dependencies before dev starts |
| Cross-functional collaboration | Confirm constraints with engineering (existing components, platform limits), and copy/legal where needed |
| Design leadership and methods | Follow the project's process (UCD, iteration, testing); do not skip steps because a deadline looms |
| Resource management | Prefer existing components and libraries over new builds; flag skill or tooling gaps to the user |

Strategy, brand, and priorities belong to product. If the spec does not say which brand, platform, or design system applies, ask; do not choose one.

## Discover what already exists

Search the repository before proposing any UI:

- Tokens and theme: `tokens.json`, `theme.ts`, CSS custom properties on `:root`, Tailwind config, SCSS variables.
- Components: `components/`, `ui/`, a shared package, Storybook stories (`*.stories.tsx`), an installed library (MUI, Radix, Chakra, shadcn/ui, SwiftUI or Jetpack Compose components).
- Guidelines: `DESIGN.md`, `STYLEGUIDE.md`, docs sites, content or copy guides, an accessibility statement.
- Conventions in use: how existing screens handle forms, errors, empty states, navigation, and dialogs.

Record what you found (or that nothing exists) in the decisions record. That is the baseline every later decision cites.

## Design system

A design system is the single source of truth for how the product looks and behaves.

| Part | Contents | Agent check |
|---|---|---|
| Design principles | A few rules that settle trade-offs (e.g. "clarity over density") | Cite the principle when a choice is close |
| Visual style guide | Typography, color, iconography, spacing, imagery | Use tokens, never raw values |
| Component library | Buttons, inputs, menus, cards, dialogs, tables | Reuse; extend through props/variants |
| Interaction patterns | Navigation, gestures, motion, wizards, validation timing | Same interaction for the same job everywhere |
| Accessibility guidelines | Contrast, focus, keyboard, ARIA usage, motion reduction | Components ship accessible by default (WCAG 2.2 AA) |
| Documentation | Usage guidance, do/don't, code examples | New or changed components are documented |

### Design tokens

Tokens are named design decisions; code references the name, not the value, so themes, dark mode, and rebrands change in one place.

```json
{
  "color": {
    "text": { "default": "#1a1a1a", "muted": "#5c5c5c" },
    "action": { "primary": "#0b57d0", "danger": "#b3261e" }
  },
  "space": { "1": "4px", "2": "8px", "3": "16px", "4": "24px" },
  "font": { "body": { "size": "1rem", "lineHeight": "1.5" } }
}
```

```css
.button-primary {
  background: var(--color-action-primary);
  padding: var(--space-2) var(--space-3);
}
```

- Name tokens by purpose (`action-primary`), not appearance (`blue-600`), at the level components consume.
- Every text/background token pair used together must meet contrast: 4.5:1 for normal text, 3:1 for large text and for UI component boundaries and focus indicators (WCAG 1.4.3, 1.4.11).
- Provide dark-mode and high-contrast values through the same names rather than new tokens.

## Reuse, extend, or create

| Situation | Decision |
|---|---|
| An existing component meets the need | Reuse it as is |
| Close, but needs a variant (size, tone, icon) | Extend it with a documented prop/variant; keep its accessibility contract |
| Same job, different look requested | Push back: consistency beats novelty unless the spec gives a reason |
| No component fits and the need will recur | Create a new shared component with docs, states, tokens, and tests |
| No component fits and the need is one-off | Build locally from tokens and primitives; note it as a candidate pattern |
| No design system exists | Use the platform's standard controls and a minimal token set; propose a system as a separate decision for product |

Do not fork a shared component to change one screen; that is how systems drift.

## Style guide: visual and written consistency

- **Visual elements**: type scale, palette, logo use, iconography style. Icons that carry meaning need a text label or accessible name.
- **Layout and grid**: columns, breakpoints, spacing scale, margins; align to the grid instead of nudging pixels.
- **Imagery**: style, resolution, aspect ratios, and alt-text rules (informative images described, decorative images `alt=""`).
- **Voice and tone**: personality stays constant; tone shifts by situation (calm and specific in errors, brief in confirmations).
- **Writing conventions**: capitalization (sentence case vs title case for buttons and headings), punctuation, numbers, dates, terminology list. Button labels are verbs that say what happens ("Save changes", not "OK").
- **Usage examples**: do/don't pairs for the common cases.

If the product has no voice guide, do not invent a brand personality. Use plain, neutral language and list "voice and tone" as an open question.

## Pattern library

A pattern library documents reusable solutions to recurring UI problems (form validation, empty states, pagination, confirmation, search with filters), alongside the components that implement them.

Each entry should state: the problem it solves, when to use and when not to, anatomy, states (default, hover, focus, active, disabled, loading, error), keyboard and screen-reader behavior, content guidance, code example, and related patterns. Allow new patterns when a real need appears, but add them to the library rather than leaving them in one feature.

## External guidelines to align with

### UK Government Design Principles (paraphrased)

Useful as a decision checklist for any service:

1. Start with user needs, from research, not assumptions; what users ask for is not always what they need.
2. Do less: reuse what works and share what you build.
3. Design with data: prototype, test, and measure (with privacy and consent built in).
4. Do the hard work to make it simple, even when the system behind it is complex.
5. Iterate: release small, test with real users, refine.
6. This is for everyone: accessibility comes before elegance.
7. Understand context: where users are, what device, how experienced.
8. Build services, not websites: the whole task, including offline steps.
9. Be consistent, not uniform: same language and patterns where possible; when not, consistent reasoning.
10. Make things open: share code, designs, and lessons.

### Platform guidelines

| Topic | Apple HIG (iOS, iPadOS, macOS, watchOS, visionOS) | Google Material Design (Android, web) |
|---|---|---|
| Character | Platform-specific themes; content first | Material metaphor of surfaces, elevation, and depth |
| Layout | Hierarchy, safe areas, consistent spacing and alignment | Responsive grid and breakpoints |
| Navigation | Tab bars, sidebars, navigation stacks, standard menus | Navigation bar, rail, drawer, top app bar |
| Type | System fonts; support Dynamic Type | Type scale with clear hierarchy |
| Color and motion | Purposeful animation; respect Reduce Motion | Color roles; motion that explains change |
| Accessibility | VoiceOver, Dynamic Type, AssistiveTouch, sufficient contrast | TalkBack, contrast, touch targets at least 48x48 dp |
| Distribution | App Store Review Guidelines, including privacy disclosures | Google Play policies |

- Native apps should follow their platform's conventions; users carry habits between apps. A cross-platform product can share tokens and content while adapting controls per platform.
- On the web, follow the project's system first, then WAI-ARIA Authoring Practices for widget behavior.
- Treat HIG and Material as references for conventions, not as a reason to copy another company's brand.

## Decisions to hand off

| Decide | Dev implements | Tdd / acceptance verifies |
|---|---|---|
| Which design system, library, and platform conventions apply (or that none exist) | Imports from the named system; no parallel component set | Review/lint check that UI imports come from the shared library |
| Components reused, extended (with which new variant), or created | Uses existing components; adds the documented variant or new shared component | Component tests for each new variant/state; story or example added |
| Tokens for color, spacing, type, radius, motion | References tokens/CSS variables, no hard-coded values | Lint rule or grep for raw hex/px in new code; visual regression where available |
| Contrast of every token pair used | Uses only compliant pairs; dark-mode values via same names | Automated contrast check (e.g. axe) on the rendered states |
| Copy conventions: case, terminology, button verbs, error tone | Strings follow the agreed wording, kept in the strings/i18n file | Tests assert exact visible labels and messages |
| Interaction pattern for the job (validation timing, confirm, pagination) | Uses the library pattern | Scenario tests match the pattern's documented behavior |
| Platform-specific adaptations (native controls, Dynamic Type, Reduce Motion) | Uses platform controls; honors system text size and motion settings | UI tests at largest text size and with reduced motion enabled |
| New pattern added to the library | Docs entry with states, keyboard behavior, example | Library tests and accessibility checks for the new pattern |
| Open questions (brand, voice, design system choice) | Not decided by dev | Listed as blocked in the decisions record |

## Workflow

1. Read the plan and spec for strategy, platform, brand, and audience constraints; anything missing becomes an open question.
2. Inventory existing tokens, components, guidelines, and conventions in the repository; record the baseline.
3. Identify the platform guidelines that apply (HIG, Material, web/WAI-ARIA).
4. For each UI element the spec needs, decide reuse, extend, or create using the table above.
5. Specify tokens, copy conventions, and interaction patterns by name, not by raw values.
6. Check accessibility of the chosen components and token pairs.
7. Document any new or extended component/pattern so it lands in the library.
8. Write the decisions table and hand off to dev/tdd through `uiux`.

## Red flags

- New UI designed without first looking for existing components or tokens.
- Hex colors, pixel values, or font names hard-coded in feature code.
- A forked or copy-pasted variant of a shared component for one screen.
- Two components for the same job (two date pickers, two modal styles).
- Buttons labelled "OK", "Submit", or "Click here" instead of the action.
- Mixed capitalization or terminology for the same thing across screens.
- Brand personality, voice, or a whole design system invented without product input.
- Android-style controls in an iOS app (or the reverse) with no reason in the spec.
- A design-system component that fails contrast, focus, or keyboard checks being reused anyway.
- New patterns left undocumented in a single feature.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records the decisions.
- `../ProductDesign/productDesign.md` — screens, flows, and states that should be built from these foundations.
- `../Affordance/affordance.md` — UI patterns, ARIA, WCAG, and dark patterns component by component.
- `../Implementation/implementation.md` — turning tokens and components into code.
- `../Internationalization/internationalization.md` — style-guide rules for text, dates, and numbers across locales.
- `../UiUxFoundations/uiUxFoundations.md` — user-centered design behind "start with user needs".
- `../SoftSkills/softSkills.md` — collaborating with stakeholders on design decisions.
- `../../ProductDefinition/plan.md` — strategy and brand constraints the design must align to (when installed).
- `../../CleanCode/SimpleDesign/simpleDesign.md` — no duplication: one component per job (when installed).
- `../../CleanCode/MeaningfulNames/namingRules.md` — naming tokens and components by intent (when installed).
