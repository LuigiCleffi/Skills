---
name: uiux-soft-skills
description: The people side of making and handing off UI/UX decisions, covering communication, collaboration, stakeholder mapping and alignment, asking product open questions instead of guessing, user interviews (discussion guide, open non-leading questions, probing, silence), focus groups (purpose, recruiting, facilitation, group dynamics, reporting), giving and running demos honestly, leading decision meetings (agenda, timebox, decision log, action items), giving and receiving design feedback and critique, sketching and annotating UI ideas, conflict resolution, adaptability, time management, and a short note on UI/UX portfolios and case studies, based on the Soft skills section of UI/UX Design Guide. Use when preparing a user interview or focus group, writing an interview guide or consent text, synthesizing research notes, preparing a stakeholder demo or sprint review, running a design review or critique, writing feedback on a design or PR, handling disagreement between product, design and engineering, escalating an ambiguous requirement, writing a decision record or meeting summary, presenting UI options for sign-off, sketching wireframes for discussion, or when the user mentions soft skills, stakeholder management, RACI, active listening, leading questions, "5 whys", design critique, feedback, demo script, meeting agenda, facilitation, or portfolio case study.
---

# Soft Skills

UI/UX decisions are only as good as the conversations that produced them. Gather intent from the right people with neutral questions, make options and trade-offs visible, record who decided what and why, and route every gap in product intent back to product as an explicit open question; never fill it with your own preference and never present a staged demo as proof.

## Communication for decisions

- Lead with the decision or question, then context, then options: "Decision needed: should guests be able to check out? Options A/B, trade-offs, recommendation, deadline."
- One question per item; make each answerable (yes/no, pick an option, give a number).
- Separate facts (what research or data showed) from interpretation and from recommendation.
- Use the users' and the spec's vocabulary; define any design jargon you must use.
- Adapt depth to the audience: executives need impact and risk, engineers need states and constraints, support needs edge cases.

Open-question template for product/spec:

```markdown
### OQ-07: Guest checkout
- Context: spec R4 requires an account; task analysis shows 38% abandon at sign-up.
- Question: Is guest checkout allowed for first purchase?
- Options: A) required account (current spec) B) guest checkout with optional account after payment
- UI impact: B adds a post-purchase "save details" step; A keeps current flow.
- Blocking: checkout screen layout. Needed by: <date>. Owner: <product owner>.
```

## Working with stakeholders

| Step | What to do | Output |
|---|---|---|
| Identify | List everyone affected: users, product owner, sponsor, engineering, support, legal/compliance, accessibility, regulators | Stakeholder list |
| Prioritize | Rank by influence and impact; mark who decides vs who is consulted vs informed (RACI) | Decision owners per topic |
| Understand | Ask for goals, success measures, constraints and fears; note conflicts between them | Expectations notes |
| Involve | Bring decision owners into workshops and reviews at the points where their input changes the outcome | Review calendar |
| Communicate | Regular, short updates: progress, decisions made, open questions, risks | Update log |
| Adapt | Priorities shift; when they do, update the record and re-confirm affected decisions | Versioned decisions record |

- A stakeholder preference is input, not a requirement, until the product owner accepts it into the spec.
- Requests that are outside the approved scope are named as "out of scope" and logged as change requests, not absorbed silently.
- Legal, privacy and accessibility constraints are not negotiable by preference; escalate conflicts rather than trading them away.

## Interviewing users

1. **Define**: objectives, the decisions the interview should inform, participant criteria, a discussion guide, logistics.
2. **Consent first**: explain purpose, how notes and recordings are used and stored, that participation is voluntary and can stop anytime; get explicit consent before recording. Minimize personal data in notes; pseudonymize.
3. **Rapport**: introduce yourself and the purpose; make clear you are testing the design, not them.
4. **Open, non-leading questions**: "Tell me about the last time you..." rather than "Would you like a faster way to...?".
5. **Listen actively**: let them talk; note tone and hesitation; do not defend the design.
6. **Probe**: "What happened next?", "Why was that important?", "Can you show me?" (asking "why" repeatedly, gently, reaches root goals).
7. **Respect silence**: wait a few seconds before filling a pause.
8. **Close**: summarize what you heard, confirm it, thank them, offer follow-up.

| Leading (avoid) | Neutral (use) |
|---|---|
| "Don't you find this confusing?" | "What did you expect to happen when you clicked that?" |
| "Would you use a dark mode?" | "Tell me about when and where you usually use the app." |
| "Is this button easy to find?" | "How would you save your changes?" (then observe) |

Report findings as observations with frequency ("4 of 6 looked for Save at the bottom"), quotes kept anonymous, and the design implication, marked as evidence strength (one interview is an anecdote).

## Focus groups

- Good for attitudes, language and reactions to concepts; poor for usability (people say what they would do, groups converge). Use usability tests for behavior.
- Define the purpose and research questions; recruit participants matching the target segment; state time commitment and incentive; get consent, including for recording.
- Use a discussion guide with a logical flow and room to explore; a neutral moderator plus a separate note-taker.
- Manage dynamics: invite quiet participants by name, redirect dominant ones, keep it respectful and on topic.
- Report themes, representative quotes and disagreements, not a vote count presented as a decision.

## Demos

- Know the audience and the decision the demo should enable (approve, choose, give feedback).
- Script it: a storyboard tied to user goals and spec requirements, using realistic data, including at least one error or edge state.
- Be honest about limits: say what is stubbed, mocked or not yet accessible (the Law of Demos: rehearsed paths hide flaws). A demo is never verification.
- Invite questions at defined points; capture each concern as feedback or an open question.
- End with the explicit ask ("Approve layout B for checkout by Friday") and follow up in writing with what was decided.

```gherkin
# A demo script step doubles as an acceptance scenario for tdd
Scenario: Guest pays and is offered to save details
  Given a guest with items in the cart
  When they complete payment with a valid card
  Then they see the order confirmation
  And they see an optional "Save my details" action that is not pre-selected
```

## Leading decision meetings

- Purpose and agenda with timeboxes, shared in advance with materials; invite the decision owner, or do not call it a decision meeting.
- Start on time; restate the goal; facilitate so each perspective is heard; park tangents in a visible list.
- Handle conflict by returning to user evidence and spec goals; if unresolved, record options and escalate to the owner rather than forcing consensus.
- Close with decisions, owners, due dates and open questions; send the summary to all participants and update the UI/UX decisions record.

```markdown
## Decision log: 2026-10-23 checkout review
| ID | Decision | Rationale / evidence | Decided by | Affects |
|---|---|---|---|---|
| D-12 | Single-column address form | Task analysis T3; Forms principles | PO (A. Silva) | AddressForm |
| OQ-07 | Guest checkout | Pending legal input | — | Checkout flow |
```

## Feedback and critique

**Getting feedback**: ask specific questions tied to goals ("Does the step order match how agents process a claim?"), from varied sources (users, support, engineering, accessibility), listen without defending, thank people, reflect, and follow up on anything unclear.

**Giving feedback** on a design, prototype or implementation:

- Private and timely for personal matters; public critique only on the work.
- Tie each point to a goal, requirement, principle or observation, not taste: "The error appears only in red; WCAG 1.4.1 needs a non-color cue" beats "this feels off".
- Use "I" statements and observable facts; offer a concrete suggestion; separate blocking from optional.
- Invite the other person's reasoning; they may know a constraint you do not (Chesterton's fence).
- Model it: ask for feedback on your own decisions and act on it.

## Sketching for alignment

- Start from requirements and constraints; sketch rough layouts and flows in low fidelity so people critique structure, not pixels.
- Show multiple variations, get feedback early, iterate; do not polish.
- Annotate interactions, states (empty, loading, error, success, no permission) and open questions directly on the sketch.
- Move to wireframes or prototypes once structure is agreed; carry the annotations forward as the state list dev and tdd will use.

## Personal effectiveness

- **Adaptability**: when evidence or priorities change, update decisions openly instead of defending earlier work.
- **Emotional intelligence**: notice when a stakeholder's objection is a fear (risk, workload, blame) and address it.
- **Time management**: timebox exploration; prioritize decisions that block dev; flag slipping dependencies early.
- **Creativity**: diverge before converging; record rejected alternatives and why.
- **Portfolio** (career, not delivery): present case studies with problem, process, your role, evidence and outcome; respect confidentiality of client data.

## Decisions to hand off

| Decide | Dev implements | tdd / acceptance verifies |
|---|---|---|
| Decision owner per open topic (RACI) | Nothing until the owner decides; build only accepted decisions | Each record entry names who decided; tests cite the decision ID |
| Open questions blocking UI (OQ list) | Leaves the affected behavior unbuilt or behind a flag | No test asserts an unresolved behavior; OQs listed in the hand-off |
| Research findings that changed the design | The changed behavior, referencing the finding | Acceptance scenario derived from the observed task |
| Demo script for review | Realistic seed data and the scripted path, including an error state | Each script step exists as an acceptance scenario (Gherkin) |
| Annotated states from sketches | Every annotated state implemented | One test per state: empty, loading, error, success, no permission |
| Critique outcomes (blocking vs optional) | Blocking items fixed before hand-off | Blocking items have a check; optional items logged as follow-ups |
| Research consent and data handling | Consent capture and storage rules if research runs in-product | Privacy review recorded before sessions or in-product studies start |
| Change requests from stakeholders | Only after acceptance into the spec | Spec version referenced by the tests |

## Workflow

1. Map stakeholders and decision owners for the spec's UI topics.
2. List what you do not know; write each gap as an open question to product/spec with options and UI impact.
3. Gather evidence: interviews or focus groups with consent and a neutral guide, plus existing research and data.
4. Sketch options with annotated states; get early, specific feedback.
5. Present options in a decision meeting or demo with honest limits; capture decisions, owners and open questions.
6. Update the UI/UX decisions record and send the summary; hand dev and tdd only accepted decisions.
7. After release, ask for feedback from users, support and engineering and feed it into the next iteration.

## Red flags

- Filling a product gap with your own preference instead of an open question.
- A stakeholder's verbal request built without being accepted into the spec.
- Leading questions in interviews, or a focus group used to "validate" usability.
- Recording users without explicit consent, or keeping identifiable notes longer than needed.
- A demo on the happy path with fake data presented as "it works".
- Meetings without an agenda, decision owner or written outcome.
- Feedback that is taste only, personal, or mixed blocking and optional without saying which.
- Defending the design during research sessions instead of listening.
- Decisions with no recorded rationale, so nobody can tell later why the fence is there.
- Accessibility, privacy or legal constraints traded away to settle a disagreement.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and owns the decisions record.
- `../PrinciplesAndIdioms/principlesAndIdioms.md` — principles to ground feedback, Chesterton's fence and the Law of Demos.
- `../DesignManagement/designManagement.md` — design process, roles and governance around these conversations.
- `../TaskAnalysis/taskAnalysis.md` — turning interview findings into task models.
- `../Ideation/ideation.md` — divergent sessions and workshops with stakeholders.
- `../Testing/testing.md` — usability tests for behavior, as opposed to interviews and focus groups for attitudes.
- `../UiUxFoundations/uiUxFoundations.md` — user-centered design that these practices serve.
- `../../actions/review.md` — code review, where the same feedback discipline applies.
- `../../ProductDefinition/plan.md` — product goals and stakeholders to align decisions with (when installed).
- `../../ProductDefinition/specs/spec-checklist.md` — where open questions and ambiguities are tracked (when installed).
- `../../TDD/Patterns/RedBarPatterns/redBarPatterns.md` — Explanation Test and Another Test, the same habits applied to test conversations (when installed).
