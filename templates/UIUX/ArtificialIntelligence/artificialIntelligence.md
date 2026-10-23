---
name: uiux-artificial-intelligence
description: How to decide whether and how AI belongs in a product's UI/UX and how to make AI features trustworthy, testable and humane, covering AI subfields at a product level (machine learning, NLP, computer vision), AI UI/UX patterns (personalization, conversational interfaces and chatbots, intelligent search and recommendations, predictive and anticipatory design, automation and smart assistants, emotion recognition), AI form fill and autocomplete, AI in the product development lifecycle (use case, data, model, evaluation, monitoring, ethics), AI content generators and AI image generation (disclosure, review, provenance, alt text), and AI-assisted internationalization (machine translation, cultural review), plus expectation setting, confidence and sources, correction and undo, human-in-the-loop for consequential actions, consent and privacy, bias, latency and streaming, and failure states, based on the Artificial Intelligence (AI) section of UI/UX Design Guide. Use when a spec adds a chatbot, assistant, copilot, LLM feature, recommendation engine, personalized feed, smart reply, summarization, AI search, autofill or autocomplete, generated text or images, machine translation, voice assistant, or sentiment or emotion detection, when deciding what the AI may do without confirmation, how to show uncertainty, citations or "why am I seeing this", how to label AI-generated content, how to handle hallucinations, wrong suggestions, slow or failed responses, or how to test non-deterministic output, or when the user mentions AI UX, human-AI interaction, explainability, transparency, bias, fairness, opt-out, training data consent, prompt injection, guardrails, evals, PAIR guidebook or HAX guidelines.
---

# Artificial Intelligence (AI)

Add AI to a product only where it serves a user task the spec already names, and design for the fact that it will sometimes be wrong. Every AI feature needs a stated job, an honest signal of what it is and how sure it is, a way for the user to check, correct, undo or opt out, a non-AI fallback, and a consent and privacy basis for the data it uses.

## Decide whether AI is the right tool

- Start from the user problem in the spec, not the technology. If a rule, a good default or a better form solves it, prefer that: it is cheaper, predictable and easy to test.
- AI fits when inputs are fuzzy (natural language, images, speech), the space of answers is large, and an occasional wrong answer is cheap to detect and fix.
- AI is a poor fit, or needs a human decision step, when errors are costly or hard to notice (money, health, legal, safety, access to services, hiring) or when users need a reproducible, explainable result.
- Write down the cost of each error type (false positive vs false negative) with product; that drives thresholds, confirmation steps and UI copy.

## Patterns for AI-driven UI

| Pattern | Do | Avoid |
|---|---|---|
| Personalization | Explain why ("Because you viewed X"); let users reset, edit interests or turn it off; keep a non-personalized view | Opaque feeds; using sensitive traits (health, religion, sexuality) without explicit consent; filter bubbles with no exit |
| Conversational UI / chatbot | Say it is an AI; state scope; suggest starter prompts; offer handoff to a human or a normal form for critical tasks | Pretending to be human; trapping users in a bot with no escape |
| Search and recommendations | Show sources and ranking cues; keep keyword search or filters as a fallback | Hiding sponsored or paid ranking (must be labeled) |
| Predictive / anticipatory | Offer, do not impose: suggestions the user accepts with one action and dismisses easily | Auto-applying predictions that change data or spend money |
| Automation / smart assistant | Preview the plan, require confirmation for irreversible or external actions, provide undo and an activity log | Silent background actions; acting on instructions found in untrusted content (prompt injection) |
| Emotion recognition | Treat as high risk: explicit opt-in, clear purpose, user-visible effect, easy off; check local law (the EU AI Act restricts emotion recognition in workplaces and education) | Inferring emotion from face, voice or biometrics covertly; using it to pressure users |

General human-AI interaction guidance (Microsoft HAX guidelines, Google PAIR guidebook) agrees on: make clear what the system can do and how well, time interventions to context, support efficient correction and dismissal, explain on request, remember and learn from feedback carefully, and notify users when behavior changes.

## Trust signals in the interface

- Label AI output ("AI-generated", "Suggested") and say what data it used when that matters.
- Show sources or citations for factual claims; link to the underlying record.
- Communicate uncertainty in words or categories users understand ("Low confidence: check the amount") rather than raw probabilities, and only where product agreed on what the levels mean.
- Provide feedback controls (helpful / not helpful, report a problem) that state what happens with the feedback.
- Never use AI to build dark patterns: persuasive personalization that exploits vulnerability, fake scarcity, or manipulative chat flows are not acceptable decisions.

## Latency, streaming and failure

- Show progress immediately; stream long text where useful; always offer Stop/Cancel.
- For screen readers, do not push every streamed token into a live region. Mark the region `aria-busy="true"` while generating and announce completion once (WCAG 4.1.3).
- Design explicit states: generating, partial, done, refused (out of scope or policy), failed (timeout, quota, offline), and empty (no good answer). Each has copy and a next step.
- Keep the non-AI path working when the model is unavailable.

```tsx
type AiResult =
  | { status: "idle" } | { status: "generating"; partial: string }
  | { status: "done"; text: string; sources: Source[] }
  | { status: "refused"; reason: string } | { status: "failed"; retry: boolean };
```

## AI form fill and autocomplete

- Use the standard first: correct `autocomplete` tokens (`name`, `email`, `street-address`, `postal-code`, `cc-number`…) let the browser or password manager fill fields securely and satisfy WCAG 1.3.5 (identify input purpose). Do not block paste or browser autofill.
- AI suggestions are proposals: show them next to the field, require user confirmation, keep every field editable, and never auto-submit.
- Mark which fields were filled by AI until the user reviews them; reviewing should be quick (highlight, summary before submit).
- Do not reuse data across contexts the user would not expect, and exclude secrets and sensitive identifiers from AI prediction unless the spec and a privacy review allow it.
- Avoid asking again for data the user already gave in the same process (WCAG 3.3.7 redundant entry).

## AI in the product lifecycle

1. Use case: the user task and success metric from the spec; the error-cost table.
2. Data: provenance, consent and licensing for training or retrieval data; minimization; retention; access control; no personal data in prompts or logs without a basis.
3. Model: choose build, fine-tune or hosted API; record version and configuration.
4. Evaluation: a labeled eval set covering typical, edge, adversarial and fairness slices; pass thresholds agreed with product before launch.
5. UX: the patterns and states above.
6. Testing and release: guarded rollout (feature flag, staged percentage) with a kill switch.
7. Monitoring: quality, refusal and error rates, user corrections, drift, cost; a route for users to report harm.
8. Ethics: bias checks across user groups, transparency about AI use, privacy and security review, human oversight for consequential decisions.

## Generated content and images

- Disclose generated text and images where users or readers could be misled; follow platform and legal labeling rules that apply.
- Human review before publishing generated content that speaks for the organization, makes factual or legal claims, or reaches many people.
- Check rights and licensing of inputs and outputs; prefer tools that attach provenance metadata (e.g. C2PA Content Credentials) for images.
- Generated images still need meaningful alt text written or reviewed by a person; decorative ones get `alt=""`.
- Constrain tone, length and terminology with brand guidelines and a glossary; do not let generation override legal or required copy.

## AI for internationalization

- Machine translation speeds localization; human review is required for legal, safety, medical, financial and marketing copy, and for any locale that lacks quality data.
- Keep translations in the message catalog with ICU placeholders intact; validate that variables, plurals and markup survived translation.
- Use AI to flag potentially insensitive language or imagery, but have people from the target culture make the final call.
- Do not infer language, region or culture from a user's name, face or accent; use explicit settings with sensible defaults.

## Decisions to hand off

| Decide | dev implements | tdd / acceptance verifies |
|---|---|---|
| The AI feature's job, scope and error-cost table | Feature behind a flag; scope enforced in prompts/config and UI copy | Acceptance scenarios for in-scope, out-of-scope (refusal) and fallback paths |
| What the AI may do without confirmation | Confirmation step and undo for irreversible or external actions | Test that no irreversible action runs without an explicit confirm; undo restores state |
| Disclosure and labeling | "AI-generated" labels, sources, "why this" explanations | UI tests assert labels and source links render with AI output |
| Uncertainty display | Mapping from model score to agreed levels and copy | Unit tests on the mapping at each threshold boundary |
| States: generating, done, refused, failed, empty | Discriminated union state; Stop/Cancel; retry | Tests with a stubbed model for each state; screen reader announcement on completion |
| Form fill behavior | `autocomplete` tokens; suggestions require confirmation; AI-filled marker | Test fields stay editable, submit never auto-fires, markers clear on review |
| Personalization controls | Explanation, reset, opt-out, non-personalized view | Test opt-out removes personalization and persists |
| Data use, consent, retention | Consent capture, data minimization, log redaction | Tests that prompts/logs exclude flagged fields; consent required before use |
| Model quality gate | Eval set and thresholds in CI or release checklist | Eval run meets thresholds before rollout; regression blocks release |

Test the UI deterministically by stubbing the model; evaluate model quality separately with the eval set. If the spec does not say what the AI may decide alone, which data it may use, or what accuracy is acceptable, send it back to product/spec as an open question.

## Workflow

1. Confirm the user task and success metric in the spec; decide if AI is warranted; record error costs.
2. Pick the pattern(s) and define what the AI may do alone versus with confirmation.
3. Define disclosure, sources, uncertainty levels and feedback controls.
4. Define every state, including refusal, failure and non-AI fallback, with copy.
5. Settle data, consent, privacy and security requirements, including prompt injection exposure.
6. Define the eval set, thresholds, rollout and monitoring.
7. Record decisions in the hand-off table; raise unknowns as open questions.

## Red flags

- AI added because it is available, with no user task or metric in the spec.
- AI actions that send, buy, delete or publish without confirmation and undo.
- No label on AI output; a bot that claims or implies it is human.
- No fallback when the model fails; spinners with no Stop.
- Streaming text flooding a live region.
- AI form fill that auto-submits or hides which fields it changed.
- Personal or sensitive data used for training, personalization or emotion inference without consent.
- Tests that call a live model and assert exact text; no eval set.
- Machine translation shipped unreviewed for legal or safety copy.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records these decisions.
- `../Implementation/implementation.md` — component states, autocomplete and live regions in code.
- `../Testing/testing.md` — split tests, consent for analytics and acceptance tests for AI features.
- `../Internationalization/internationalization.md` — message catalogs and locale handling that AI translation must respect.
- `../Affordance/affordance.md` — dark patterns and accessibility requirements that apply to AI UI.
- `../ProductDesign/productDesign.md` — product goals the AI feature must serve.
- `../../actions/tdd.md` — writes the stubbed-model tests first.
- `../../ProductDefinition/specs/spec-checklist.md` — where open AI questions go back to product (when installed).
- `../../CleanCode/Boundaries/boundaries.md` — wrapping a third-party model API behind a boundary (when installed).
