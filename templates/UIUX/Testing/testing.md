---
name: uiux-testing
description: How to choose and run UI/UX tests so every UI/UX decision has evidence before and after it ships, covering user testing (task-based sessions, think-aloud), split testing (A/B tests, hypothesis, metrics, randomization, sample size, statistical significance), surveys and questionnaires (SUS, SEQ), heatmaps, click tracking and session analytics, eye-tracking, expert evaluation (heuristic evaluation, cognitive walkthrough), end-to-end testing, acceptance testing (functional and non-functional, Gherkin), localization testing (pseudo-localization, RTL, formats), accessibility testing (WCAG, automated, manual, users with disabilities), screen reader testing (NVDA, JAWS, VoiceOver, TalkBack), benchmark, performance, load, stress and compatibility testing, and shift-left testing, based on the UI/UX testing section of UI/UX Design Guide. Use when planning how to validate a design or prototype, writing acceptance criteria or E2E tests for a screen, setting up an A/B test or experiment, deciding sample size or when to stop a test, adding analytics, heatmaps or session replay, running a usability study or survey, doing a heuristic review, checking accessibility or screen reader support, testing translations, RTL or locale formats, setting performance budgets or a browser and device matrix, or moving UI checks earlier into CI, or when the user mentions usability testing, user testing, A/B test, split test, experiment, conversion rate, statistical significance, survey, SUS, heatmap, click tracking, eye tracking, heuristic evaluation, Nielsen heuristics, end-to-end, E2E, Playwright, Cypress, acceptance test, UAT, BDD, Gherkin, localization testing, pseudo-localization, accessibility testing, axe, Lighthouse, screen reader, benchmark, load test, stress test, compatibility, cross-browser, or shift-left.
---

# UI/UX Testing

Pick the cheapest test that can answer the question the decision depends on: expert review and automated checks catch known problems early, observing real users finds the problems nobody predicted, and controlled experiments measure which option performs better. Every UI/UX decision handed to dev should name the test that proves it, and every test with real users needs consent, privacy protection and an ethical goal.

## Choose the method by question

| Question | Method | When |
|---|---|---|
| Can people complete the task? Where do they struggle? | User testing (task-based, think-aloud) | Prototype onward; repeat each iteration |
| Does it meet known usability principles? | Expert evaluation (heuristics, cognitive walkthrough) | Any time; cheapest first pass |
| Which variant moves the agreed metric? | Split (A/B) test | Live product with enough traffic |
| What do users think and feel? | Survey, questionnaire (SUS, SEQ) | After tasks or periodically |
| Where do users click, scroll, ignore? | Heatmaps, click tracking, funnels | Live product or study sessions |
| Where does attention go? | Eye-tracking | Specialist study; high-stakes layouts |
| Does the whole flow work as the user would use it? | End-to-end tests | Every change, in CI |
| Does it satisfy the spec? | Acceptance tests (functional and non-functional) | Before release; derived from the spec |
| Does it work in every target locale? | Localization testing | Once i18n exists; every new string |
| Can people with disabilities use it? | Accessibility and screen reader testing | Every change (automated) plus manual and user sessions |
| Is it fast and robust enough? | Benchmark, performance, load, stress, compatibility | Budgets in CI; load/stress before launch |

## User testing

- Write realistic tasks from the spec's user goals, not instructions that name the UI ("Find last month's invoice", not "Click Billing").
- Recruit participants who match the target users, including people who use assistive technology; small rounds (about five per user group) find most major issues, then iterate.
- Observe and record success, time, errors and quotes; ask participants to think aloud; do not help or lead.
- Get informed consent for recording, store recordings securely, and delete them on schedule.
- Report findings by severity with evidence; feed fixes back into the design.

## Expert evaluation

- Heuristic evaluation: two to five evaluators independently check the UI against Nielsen's ten heuristics (visibility of status, match with real world, user control and freedom, consistency, error prevention, recognition over recall, flexibility, minimalist design, error recovery, help), then merge and rate severity.
- Cognitive walkthrough: step through a task asking whether the user would know what to do, see the control, connect it to the goal, and understand the feedback.
- Expert review complements, never replaces, testing with users.

## Split (A/B) testing

1. Hypothesis tied to a spec goal: "Showing total price on the cart page increases completed checkouts."
2. One primary metric, plus guardrail metrics that must not get worse (errors, refunds, support contacts, accessibility complaints, unsubscribes).
3. Variants differ in the thing being tested; both are accessible and honest.
4. Random, consistent assignment per user; check the observed split matches the planned one (sample ratio mismatch means a bug).
5. Compute sample size and duration up front from baseline rate, minimum detectable effect, significance level (commonly α = 0.05) and power (commonly 80%); run full weekly cycles.
6. Do not stop early when a result looks significant ("peeking") unless the analysis was designed for sequential testing.
7. Decide on the pre-registered metric; report effect size with a confidence interval, not just a p-value.

Ethics: never test dark patterns, deceptive prices or anything that harms a user group; disclose experimentation in the privacy notice, honor consent and do-not-track choices, and exclude vulnerable contexts where the spec requires.

```json
{ "experiment": "cart-total-visible", "primaryMetric": "checkout_completed",
  "guardrails": ["payment_error_rate", "refund_rate"], "alpha": 0.05, "power": 0.8,
  "mde": 0.02, "allocation": { "control": 0.5, "variant": 0.5 } }
```

## Surveys, heatmaps, analytics and eye-tracking

- Surveys: short, neutral wording, one idea per question, consistent scales. The System Usability Scale (10 items, 0–100 score) and the Single Ease Question (1–7 after a task) allow comparison over time.
- Heatmaps and click tracking: show clicks, taps, scroll depth and ignored areas; use them to ask why, then confirm with user testing. Rage clicks and dead clicks point at false affordances.
- Privacy: load analytics, heatmaps and session replay only after consent where the law or policy requires it; mask all form inputs and personal data by default; minimize retention; never capture passwords, payment or health data.
- Eye-tracking needs specialist hardware or validated software and explicit consent for biometric data; use it for specific layout questions, not as a default.

## End-to-end and acceptance testing

- E2E tests drive the real UI as a user would: locate elements by role, label and visible text (which also checks accessibility) rather than CSS classes or test-only IDs.
- Keep E2E to critical journeys; push detail down to component and unit tests.
- Acceptance tests come straight from the spec's acceptance criteria, both functional (behavior) and non-functional (performance, security, accessibility, localization).

```gherkin
Scenario: Card is declined
  Given I am on the payment step with a cart total of "€42.00"
  When I pay with a card that the provider declines
  Then I see the error "Your card was declined. Try another card or payment method."
  And focus moves to the error summary
  And my cart is unchanged
```

```ts
await page.getByLabel("Email").fill("ana@example.test");
await page.getByRole("button", { name: "Create account" }).click();
await expect(page.getByRole("status")).toHaveText("Check your inbox to confirm.");
```

## Localization testing

- Pseudo-localization in CI: expand strings by about 30–40% and add accents and brackets to reveal truncation, hard-coded text and concatenation.
- Test right-to-left locales (Arabic, Hebrew) for mirrored layout, icons and mixed-direction text.
- Check dates, times, time zones, numbers, currencies, plurals, sorting, names and addresses per locale (CLDR data), and text in images.
- Have native speakers from the target region review meaning and cultural fit; route legal and regulatory content to local experts.

## Accessibility and screen reader testing

- Target WCAG 2.2 Level AA unless the spec sets a higher bar or a specific law applies.
- Automated checks (axe-core, Lighthouse, linters such as eslint-plugin-jsx-a11y) find only a portion of issues; run them on every build.
- Manual checks: keyboard-only (tab order, visible focus, no traps, focus not hidden), 200% zoom and 320 px reflow, contrast, reduced motion, forced colors, captions, error identification.
- Screen reader passes with common pairings: NVDA with Firefox or Chrome and JAWS with Chrome on Windows, VoiceOver with Safari on macOS and iOS, TalkBack with Chrome on Android. Verify headings, landmarks, names, roles, states, form errors, live announcements and media controls.
- Include users with disabilities in usability rounds; also check screen magnifiers, voice control and switch access where the audience needs them.

## Benchmark, performance and compatibility

- Performance: budgets for LCP, INP, CLS, bundle size; lab checks in CI (Lighthouse CI) plus field data (RUM) at the 75th percentile.
- Performance regression: compare each build against the baseline and fail on agreed thresholds.
- Load and stress: verify the UI degrades gracefully (clear messages, retry, no data loss) when the back end is slow or overloaded.
- Compatibility: a browser, device, OS and assistive-technology matrix agreed with product from real usage data.
- Benchmarks are only meaningful under comparable conditions; record device, network and data size.

## Shift-left

Move checks to the earliest point that can catch them: accessibility and copy review on designs, accessibility lint and component tests with every commit, pseudo-localization and visual regression in CI, acceptance tests written by tdd before dev implements.

## Decisions to hand off

| Decide | dev implements | tdd / acceptance verifies |
|---|---|---|
| Test level per UI requirement | Testable hooks: roles, labels, stable copy keys | tdd maps each requirement to unit, component, E2E or acceptance test |
| Critical journeys for E2E | Deterministic test data and stubs for external services | E2E suite covers each journey including the main error path |
| Accessibility target and checks | Semantic markup; axe in CI; keyboard support | Automated scan clean; manual keyboard and screen reader checklist signed off |
| Supported locales and pseudo-localization | i18n catalog; pseudo-locale build | Pseudo-locale run shows no truncation or hard-coded strings; RTL screenshots |
| Performance budgets and device matrix | Budgets in CI config | CI fails on budget breach; matrix run before release |
| Experiment design (if any) | Flagged variants, consistent assignment, event tracking | Pre-registered metric, sample size and guardrails met before deciding |
| Analytics and heatmap scope | Consent gating, input masking, retention settings | Test no tracking fires before consent; masked fields never captured |
| Usability study plan | Prototype or staging build with seeded data | Task success and severity-rated findings recorded; fixes tracked |

Metric definitions, experiment goals, supported locales, browser matrix and the accessibility conformance target come from product/spec; if missing, return them as open questions instead of choosing them.

## Workflow

1. List the UI/UX decisions in the spec and the question each one leaves open.
2. Choose the cheapest credible method per question from the table.
3. Shift left: expert review and automated accessibility, localization and performance checks first.
4. Plan studies and experiments with consent, privacy and ethics written in.
5. Write acceptance criteria and E2E scenarios with tdd before implementation.
6. Run, record evidence, rate severity, and feed results back into design decisions.
7. Re-test after fixes; keep the automated checks as regression guards.

## Red flags

- Shipping a redesign with no task-based testing.
- A/B test without a hypothesis, sample size or guardrails; stopping when it looks good.
- Experimenting with deceptive variants or without consent.
- Heatmaps or session replay recording form inputs or loading before consent.
- "Accessible" claimed from an automated score alone; no keyboard or screen reader pass.
- E2E tests selecting by CSS class, flaky timing waits, or covering every detail.
- Localization tested only in English or only by translators who never see the UI.
- Benchmarks from one fast laptop presented as user experience.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records these decisions.
- `../Implementation/implementation.md` — the states, copy and budgets these tests verify.
- `../Affordance/affordance.md` — WCAG and ARIA criteria behind accessibility tests.
- `../Internationalization/internationalization.md` — what localization testing checks.
- `../ArtificialIntelligence/artificialIntelligence.md` — testing AI features with stubbed models and eval sets.
- `../TaskAnalysis/taskAnalysis.md` — tasks that become user-testing scenarios.
- `../../actions/tdd.md` — writes the acceptance and E2E tests first.
- `../../actions/review.md` — checks that the tests exist and cover the decisions.
- `../../TDD/Patterns/TDDPatterns/tddPatterns.md` — test lists and evident data for acceptance tests (when installed).
- `../../CleanCode/UnitTests/unitTests.md` — keeping UI tests clean and focused (when installed).
