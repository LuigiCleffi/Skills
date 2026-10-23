## AI Skills

Before making UI/UX decisions for an approved specification, designing or
changing a screen, flow, component, form, or message, or writing UI tests,
find the skills that apply to the task in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

Each skill comes from one section of the *UI/UX Design Guide* (Joel Parker
Henderson, ed., 2024), a glossary with one topic per page. The skills turn
those topics into decisions an agent can record and hand off. They are the
reference library for `../actions/uiux.md`, which owns the workflow: it
takes the approved specification, writes `UIUXDecisions.md`, and tells
`dev` and `tdd` which approach to follow. Every skill ends its topic
sections with **Decisions to hand off**: what to decide, how `dev`
implements it, and how `tdd` verifies it.

### Understand users and tasks

| # | Skill | Use when |
|---|---|---|
| 1 | `./UiUxFoundations/uiUxFoundations.md` | Setting users and goals, usability and accessibility acceptance criteria, navigation and information architecture, or developer experience. |
| 2 | `./DesignThinking/designThinking.md` | Framing the user problem, personas or journey maps, research or workshops, decision-tree flows, or gamification. |
| 3 | `./TaskAnalysis/taskAnalysis.md` | Designing multi-step flows or workflows, step budgets, roles and handoffs, error paths, or smart defaults. |
| 4 | `./Ideation/ideation.md` | Generating and narrowing design options: brainstorming, SCAMPER, storyboards, mental models, card sorts, naming UI elements. |
| 5 | `./NorthStar/northStar.md` | Tying UI changes to spec metrics: input and guardrail metrics, consent-aware tracking, domain language, BDD acceptance scenarios. |

### Define the design

| # | Skill | Use when |
|---|---|---|
| 6 | `./ProductDesign/productDesign.md` | Turning a spec into screens, flows and UI states; wireframe vs prototype; MoSCoW scope; cutting cognitive load and friction. |
| 7 | `./ModelingDiagrams/modelingDiagrams.md` | Specifying flows, screen states, UI–API sequences, roles or timing with UML, Mermaid or PlantUML so dev builds and tdd tests them. |
| 8 | `./DesignManagement/designManagement.md` | Reusing or extending a design system, tokens, style guide or pattern library; matching platform conventions (HIG, Material, GOV.UK). |

### Build it right

| # | Skill | Use when |
|---|---|---|
| 9 | `./Affordance/affordance.md` | Choosing UI patterns or controls, ARIA, keyboard, screen reader, WCAG and contrast work, paper cuts, or rejecting dark patterns. |
| 10 | `./Implementation/implementation.md` | Building screens from decisions: type, microcopy, icons, grid, mobile-first, UI states, fallbacks, speech, performance, schema-aligned forms. |
| 11 | `./Internationalization/internationalization.md` | Multiple languages, locales, currencies or time zones: strings, plurals, Intl formatting, right-to-left text, pseudo-localization. |
| 12 | `./ArtificialIntelligence/artificialIntelligence.md` | Adding AI features (chatbot, recommendations, autofill, generated content, translation): trust, confirmation, states, consent, evals. |

### Verify it

| # | Skill | Use when |
|---|---|---|
| 13 | `./Testing/testing.md` | Picking UI/UX tests: usability, A/B, surveys, heatmaps, heuristics, E2E, acceptance, localization, accessibility, screen readers, performance. |

### Work with people and trade-offs

| # | Skill | Use when |
|---|---|---|
| 14 | `./PrinciplesAndIdioms/principlesAndIdioms.md` | Justifying or reviewing a UI choice with a named principle (Norman, Fitts, Tesler, Pareto, Chesterton) or scoping "good enough". |
| 15 | `./SoftSkills/softSkills.md` | Interviewing users, running demos, critiques or decision meetings, aligning stakeholders, or sending open questions to product. |

The guide's front matter and conclusion are not skills.

# Context for AI: Making UI/UX Decisions

## 1. Product Decides What, UI/UX Decides How

The product plan and specification decide what the feature must do and
why. UI/UX decides how people see and operate it. When a design choice
would change scope, business rules, permissions, data handling, or success
criteria, it is a product question: send it back to the specification
instead of deciding it here.

## 2. Reuse Before You Invent

Inspect the existing design system, components, tokens, and patterns first.
Consistency with the rest of the product beats local novelty. Create a new
component or style only when nothing fits, and record why.

## 3. Every State Is Part of the Design

Design the loading, empty, partial, error, disabled, permission-denied, and
success states, not only the happy path. Every failure the specification
names needs a visible state and a message that says how to recover.

## 4. Accessibility and Honesty Are Requirements

Accessibility is a requirement with an agreed target (WCAG level), checked
by tests and a manual keyboard and screen reader pass. Dark patterns are
never an acceptable decision, whatever metric they would improve.
Research, analytics, experiments, and AI features respect consent and
privacy.

## 5. Hand Off Decisions Dev Can Build and TDD Can Test

Write each decision with a stable ID, the requirement it serves, how `dev`
implements it, and the acceptance check that proves it. Recommend the
implementation mode and slice order. Untested design assumptions are
labeled as assumptions, not presented as validated.

## 6. Report Honestly

Say which decisions came from the specification, which from the user, and
which from existing conventions, and which questions remain open. Do not
claim usability was validated without evidence from real users.
