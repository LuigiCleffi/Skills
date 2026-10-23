---
name: uiux-ideation
description: How to generate and then narrow UI/UX solution options for an approved spec, covering divergent vs convergent thinking, brainstorming rules (quantity first, no judgment, build on ideas, equal airtime, timebox, capture), creative techniques (SCAMPER, Six Thinking Hats, random word and image association, analogies, provocation and Oblique Strategies-style prompts, mindful observation, mind maps), active listening in stakeholder and user conversations, futurespectives and pre-mortems, storyboards of user flows, mental models and matching the user's vocabulary, card sorting and dendrograms for information architecture, "the map is not the territory", and mood or vision boards, based on the Ideation section of UI/UX Design Guide. Use when exploring design alternatives for a screen or flow, the team is stuck on the first idea, choosing between layout or interaction concepts, running a brainstorm or design workshop, interviewing users or stakeholders, grouping navigation or menu items, naming things in the UI, sketching a storyboard or user journey, or when the user mentions ideation, brainstorming, SCAMPER, thinking hats, mind map, crazy eights, how might we, storyboard, mental model, card sort, dendrogram, information architecture, futurespective, pre-mortem, mood board, vision board, or Oblique Strategies.
---

# Ideation

Ideation produces several genuinely different ways to satisfy what the spec already decided, then narrows them with explicit criteria. Generate wide first (no judging), converge second (judge against the spec, constraints and users' mental models), and record both the chosen option and why the others lost; anything that changes scope or product intent goes back to product as an open question.

## Diverge, then converge

| Phase | Goal | Rules | Output |
|---|---|---|---|
| Diverge | Many distinct options | No criticism, wild ideas welcome, build on others, timebox | Raw list or sketches, all captured |
| Cluster | See the shape of the space | Group duplicates, name themes | 3–6 concept families |
| Converge | Pick one to build | Score against stated criteria only | Chosen concept + rejected alternatives with reasons |

- Never merge the phases: judging while generating collapses the list to the first familiar idea.
- Criteria for converging come from the spec (requirements, success criteria, constraints) plus non-negotiables: accessibility (WCAG 2.2 AA), consistency with the existing design system, feasibility. Taste is a tiebreaker, not a criterion.
- An idea that needs a new requirement, a new user role, or a different success metric is outside ideation's authority: log it as an open question for product/spec, do not design it in.

## Brainstorming that works

- Frame a single prompt as "How might we <outcome from the spec> for <user from the spec>?"
- Set a quantity target and a timebox (e.g. 20 ideas in 10 minutes; Crazy Eights: 8 sketches in 8 minutes).
- Equal airtime: silent individual generation first, then round-robin sharing, so the loudest voice does not anchor everyone.
- Build with "yes, and", combine ideas, then capture everything somewhere visible and persistent (board, doc, issue).
- For an agent working alone: produce at least 3 options that differ in structure (not just styling), label each with its main trade-off, and do not silently drop the unusual one.

## Technique picker

| Situation | Technique | How to apply to UI/UX |
|---|---|---|
| Improving an existing screen | SCAMPER | Substitute a control (dropdown to segmented buttons), Combine steps, Adapt a known pattern, Modify density or order, Put to another use (reuse a list view), Eliminate a field or step, Reverse the order (preview before configure) |
| Group discussion keeps circling | Six Thinking Hats | Run hats in sequence: White (facts, analytics, research), Red (gut reactions), Black (risks, failure states, accessibility gaps), Yellow (benefits), Green (new options), Blue (process, next step) |
| Everyone proposes the same thing | Random association, analogies | Pick a random word or image, or ask "how does a boarding pass / recipe / checkout line solve this?" |
| Stuck or over-polished | Provocation prompts | Oblique Strategies-style cards: "remove the most important element", "what would a first-time user do?", "emphasize the flaw" |
| Ideas are disconnected | Mind map | Central problem, branches for user goals, constraints, content, interactions |
| Need grounded ideas | Mindful observation | Watch real usage (session notes, support tickets, a contextual walk-through) before generating |
| Need to show a flow | Storyboard | See below |

## Listening to users and stakeholders

Ideation inputs are only as good as what you heard. Use active listening in interviews and reviews:

- Give full attention; do not interrupt or jump to solutions.
- Ask open questions ("walk me through the last time you…"), then clarify specifics.
- Reflect back: "So if I understand, the export matters because finance reconciles weekly?"
- Separate what users do from what they say they want; record verbatim quotes and the words they use for things.
- Hold back judgment and empathize; you are collecting evidence, not defending a design.

Recording participants needs their consent; strip personal data from notes shared beyond the research team.

## Futurespective and pre-mortem

- Futurespective: imagine the feature six months after launch in a best case and a worst case; list what led to each. Useful when uncertainty is high.
- Pre-mortem variant: "It shipped and users hate it. Why?" Typical answers become design requirements or test cases: confusing empty state, slow on mobile, unusable by keyboard, error messages that blame the user.
- Each risk found either maps to an existing requirement, becomes a UI/UX decision with an acceptance check, or is raised to product as a new open question.

## Storyboards for flows

A storyboard is a short panel sequence of a user achieving a goal, including context (where, on what device, under what pressure).

1. Start from one user story or scenario in the spec.
2. Thumbnail each step: trigger, screens, decisions, outcome. Keep it rough.
3. Add detail only where it matters: what the user sees, the system feedback, friction or emotion.
4. Annotate each panel: the data shown, the action taken, timing (waits, timeouts).
5. Order panels and check continuity: no step appears from nowhere, every branch ends.
6. Review with stakeholders and revise.

Each panel converts naturally into an acceptance scenario that tdd can automate:

```gherkin
Scenario: Returning user reorders a past purchase
  Given I am signed in and have a past order
  When I open "Orders" and choose "Buy again" on that order
  Then I see the cart with the same items at current prices
  And price changes since the original order are highlighted
```

## Mental models and information architecture

- Users predict how the UI works from their existing mental model. Match it: use their words (from interviews and the domain glossary), familiar patterns, and expected groupings (Nielsen: match between system and the real world; consistency and standards).
- When a mental model is wrong or missing, teach it with clear labels, previews and reversible actions, not documentation.
- Card sorting reveals groupings: open sort (users create and name groups) for discovery, closed sort (fixed groups) for validation. Hierarchical clustering of co-occurrence results gives a dendrogram; choose the cut height that yields a sensible number of top-level groups and inspect items that join late, since they are ambiguous and need better labels or cross-links.
- The map is not the territory: personas, journey maps, diagrams and your own assumptions are simplifications. Treat them as hypotheses and validate with real users or data before locking them in.

## Mood and vision boards

A mood board (images, typography, color, reference products) aligns visual direction before high-fidelity work. It is input to visual design, not a spec: any chosen colors still have to pass contrast checks and live as design tokens. Personal-practice methods (vision boards for personal goals, presence and focus exercises) can help facilitators but produce nothing to hand off.

## Decisions to hand off

| Decide | Dev implements | tdd / acceptance verifies |
|---|---|---|
| Chosen concept for the screen or flow, with rejected alternatives and reasons | Builds the chosen layout and interaction only | Acceptance scenarios from the storyboard pass |
| Flow steps and branches (storyboard) | Routes, screens and transitions per panel | One scenario per panel path, including error and empty branches |
| UI vocabulary from users' mental model | Labels, headings and messages use the agreed terms (via i18n keys) | Copy assertions on labels; terms match the glossary |
| Navigation grouping from card sort / dendrogram | Menu and IA structure | Items exist under the agreed groups; tree-test success target only if the spec defines one |
| Risks from the pre-mortem turned into requirements | Handles each (empty state, slow network, keyboard path) | One test per mitigated risk |
| Ideas that change scope | Nothing | Listed as open questions for product/spec |

## Workflow

1. Read the approved spec: users, goals, requirements, success criteria, constraints.
2. Frame one "How might we" prompt per problem the spec leaves to design.
3. Diverge with a timebox, using one or two techniques from the picker; capture everything.
4. Cluster into concept families; storyboard the top 2–3 for the main scenario.
5. Run a pre-mortem on the leading concept; add risks as decisions or open questions.
6. Converge by scoring against spec criteria, accessibility and design-system fit; record the winner and why the others lost.
7. Validate key assumptions (mental model, groupings, wording) with users or data where the spec allows; send scope changes back to product.
8. Write the decisions above into the UI/UX decisions record for dev and tdd.

## Red flags

- The first idea is the only idea; alternatives were never generated.
- Criticism during divergence, or the most senior person always speaking first.
- Choosing by taste with no criteria tied to the spec.
- New features or user roles invented during ideation and designed in without product approval.
- Labels in internal jargon that users never used.
- Personas or journey maps treated as facts with no validation.
- A storyboard that only covers the happy path.
- Mood board colors adopted without contrast checks.
- Ideas that manipulate users (dark patterns) kept "because they convert".

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records its decisions.
- `../DesignThinking/designThinking.md` — where ideation sits among empathize, define, ideate, prototype, test.
- `../TaskAnalysis/taskAnalysis.md` — the task structure that ideas must support.
- `../NorthStar/northStar.md` — the outcome and guardrail metrics used to converge.
- `../ModelingDiagrams/modelingDiagrams.md` — turning storyboards into activity and state diagrams.
- `../ProductDesign/productDesign.md` — prototyping and refining the chosen concept.
- `../Testing/testing.md` — validating mental models, card sorts and concepts with users.
- `../SoftSkills/softSkills.md` — facilitation and communication during workshops.
- `../../actions/tdd.md` — turning storyboard scenarios into tests.
- `../../ProductDefinition/specs/spec-definition.md` — where scope-changing ideas go as open questions (when installed).
