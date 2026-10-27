---
name: aieng-architecture-and-user-feedback
description: "Production architecture and feedback loops for foundation model applications: growing the architecture step by step (context enhancement, input and output guardrails, PII masking, retries and human fallback, model router and intent classifier, model gateway with access control, fallbacks and cost limits, exact and semantic caching with eviction and data-leak risks, agent patterns and write actions), monitoring and observability (MTTD, MTTR, change failure rate, failure-driven metrics, format, quality, safety, latency and cost metrics, logs and traces, drift in prompts, users and provider models), AI pipeline orchestration, and user feedback (explicit vs implicit, conversational signals such as early termination, error correction, complaints, sentiment, regeneration, conversation length; when and how to collect feedback; leniency, position, preference and randomness biases; degenerate feedback loops and sycophancy), based on Chapter 10 (AI Engineering Architecture and User Feedback) of Chip Huyen's AI Engineering. Use when designing the system around an LLM, adding guardrails, a router, a gateway, or a response cache, instrumenting logging and tracing, detecting silent model or prompt drift, or designing thumbs up/down, regenerate, and other feedback capture."
---

# Architecture and User Feedback

Start with query in, model, response out, and add components only when a measured need appears: context, then guardrails, then routing and a gateway, then caches, then agentic logic and write actions. Make every step observable, and design feedback capture into the product, because production feedback is the data advantage competitors cannot copy.

## Grow the architecture in steps

1. **Enhance context:** retrieval and information-gathering tools (see RAG and agents). Compare provider-hosted file and tool support against a dedicated retrieval stack on limits and configurability.
2. **Guardrails:**
   - *Input:* detect and block or mask sensitive data before it leaves for an external API (IDs, phone numbers, accounts, faces, internal IP keywords); mask with placeholders and restore from a reverse map in the response. Screen for prompt attacks.
   - *Output:* catch format failures, empty responses, factual inconsistency, toxicity, PII, unintended tool or code execution, and brand risk; define a policy per failure type.
   - *Handling:* retry probabilistic failures (or send parallel requests and pick the valid one to save latency); escalate to humans on trigger phrases, detected frustration, or too many turns.
   - Trade-offs: guardrails add latency; in streaming mode output guardrails see partial text. Track false refusals as well as blocked harms.
3. **Router and gateway:**
   - *Router:* a fast, cheap intent classifier sends queries to specialized models, cheaper models for simple requests, static pages, or humans; rejects out-of-scope topics with stock replies; asks clarifying questions for ambiguous inputs; can also predict the next action or memory source. Common order: route, retrieve, generate, score.
   - *Gateway:* one interface to all models (hosted and self-hosted) with centralized keys, per-user and per-app access control, usage limits and budgets, fallback on rate limits or outages, load balancing, and logging. Applications never hold provider keys.
4. **Caches:**
   - *Exact cache* for repeated queries, expensive retrieval, SQL, or multistep work; choose eviction (LRU, LFU, FIFO) and TTLs. Do not cache user-specific or time-sensitive answers; key caches by everything that changes the answer (user, tenant, permissions), or one user's data leaks to another.
   - *Semantic cache* (embedding similarity above a threshold) raises hit rate but can return wrong answers; adopt only after measuring hit rate, threshold accuracy, and added vector-search latency.
5. **Agent patterns and write actions:** loops, parallel branches, conditional retrieval. Write actions (email, orders, payments, deploys) need approval gates, least privilege, and audit logs.

## Monitoring and observability

- Judge observability by MTTD (time to detect), MTTR (time to resolve), and change failure rate; a high change failure rate means the evaluation pipeline should catch more before deploy.
- Design metrics from the failures you fear, not from what is easy to count:
  - format failures (invalid JSON rate, and how many were auto-fixable);
  - quality (factual consistency, relevance, conciseness via judges on samples);
  - safety (toxicity, PII in inputs and outputs, guardrail trigger and refusal rates, abnormal queries);
  - user signals (stopped generations, turns per conversation, input and output token lengths, output diversity);
  - component metrics (retrieval precision, vector DB latency and storage);
  - latency (TTFT, TPOT, total, per user) and cost (requests, input and output tokens, cache hit rate, rate-limit headroom).
- Break every metric down by user segment, release, prompt or chain version, and time. Correlate metrics with the north-star business metric.
- Mix spot checks (sampled, cheap) with exhaustive checks where risk demands.
- **Logs:** log everything needed to reproduce a request: model endpoint and name, sampling settings, prompt template version, user query, final rendered prompt, intermediate outputs, tool calls and outputs, timings, errors, each tagged with request and component IDs. Respect privacy and retention rules.
- **Traces:** link a request's steps end to end (retrieval results, prompts, model calls, tools, per-step time and cost) so a failure can be pinned to one step.
- **Drift:** detect changes to the system prompt (hash it), shifts in user behavior, and silent provider model updates behind an unchanged API name; pin model versions where possible.
- Read samples of production traffic daily; teams' sense of good and bad outputs evolves as they see real data.

## Orchestration

- An orchestrator defines components (models via the gateway, retrievers, tools, evaluators) and chains them, validating each step's output format. Prefer simple code first; adopt a framework only if it supports your components, scales, and lets you inspect its internals. AI pipeline orchestrators differ from batch workflow schedulers.

## User feedback

Uses: evaluation (monitoring metrics), development (training data, prioritization), personalization. Feedback is user data; disclose and protect its use.

| Signal | Kind | Reading |
|---|---|---|
| Thumbs, stars, "did this solve it" | Explicit | Clear but sparse and biased |
| Stopping a generation, leaving mid-task | Implicit | Likely bad response |
| Corrections ("No, I meant..."), rephrasing, edits to output | Implicit | Error; the edit is a free label |
| Complaints, frustration, sentiment | Implicit | Escalation trigger and quality metric |
| Regenerate | Implicit | Dissatisfaction or wanting options; check context |
| Share, bookmark, copy, rename, delete conversation | Implicit | Value or failure, application-dependent |
| Conversation length and diversity | Implicit | Engagement for companions; failure loops for support bots; repeated similar turns suggest being stuck |

**When to ask:** at onboarding only if calibration is required (else default and learn later); when something goes wrong (downvote, regenerate, switch model, edit, hand off to a human); when the model is unsure (show alternatives side by side, ask which is the same person); occasionally for delight, rate-limited to a small sample of users.

**How to ask:** inside the workflow, easy to ignore, no extra work, with actions that double as signals (upscale, vary, regenerate). Make clear how feedback is used.

**Limitations:**

- Leniency bias: ratings cluster high; use descriptive options instead of bare numbers and inspect distributions.
- Randomness: low-effort clicks on long side-by-side comparisons.
- Position bias: first options get chosen more; randomize order or correct for position.
- Preference bias: longer answers and the last-seen option look better.
- Degenerate feedback loops: you only get feedback on what you show, so early preferences get amplified (popularity bias, drifting audience); training on approval can make models sycophantic.

## Workflow

1. Ship the simplest pipeline behind a gateway with full logging and tracing.
2. Define failure modes and their metrics before adding components; add guardrails for the riskiest ones.
3. Add a router when query types diverge in cost or required expertise.
4. Add exact caching with correct keys and TTLs; evaluate semantic caching before enabling it.
5. Add write actions last, each with approval, least privilege, and audit.
6. Design explicit and implicit feedback capture; log it with the trace ID of the response it refers to.
7. Review feedback biases before using it for evaluation or training; feed confirmed failures into the eval sets.

## Red flags

- Provider API keys embedded in applications instead of a gateway.
- Cache keys that ignore user, tenant, or permissions.
- No record of the final rendered prompt, model version, or sampling settings for a response.
- Output guardrails assumed to work in streaming mode without retroactive removal.
- Feedback buttons whose data is never joined to traces or reviewed.
- Training directly on thumbs-up data without bias analysis.
- Unpinned model aliases with no drift detection.

## Testing notes

- tdd: unit-test guardrail functions (PII detection and masking round-trip, schema checks), router decisions with fixed classifier outputs, cache key construction (two users never collide), and gateway fallback using fake providers that fail or rate-limit.
- bdd: scenarios for escalation ("after a frustrated message the user is offered a human") and refusal of out-of-scope topics.
- Test that every request produces a trace with the required fields; fail CI on missing prompt version or model ID.
- Replay a sampled production log against a new prompt or model offline before rollout; compare metrics per slice.
- **Current note:** observability tooling for LLM apps has matured, and OpenTelemetry has published generative-AI semantic conventions (still evolving); prefer standard trace formats over bespoke logging so traces move between tools.

## Related

- `../../Production/InferenceOptimization/inferenceOptimization.md` — KV and prompt caching, latency metrics.
- `../../Adaptation/PromptEngineering/promptEngineering.md` — prompt attack defenses.
- `../../Adaptation/RAGAndAgents/ragAndAgents.md` — context construction and agents.
- `../../Evaluation/EvaluateAISystems/evaluateAISystems.md` — evaluation that monitoring mirrors.
- `../../../DesigningMLSystems/Production/WhyMLSystemsFail/whyMLSystemsFail.md` — drift and degenerate feedback loops.
- `../../../../DevOps/Practices/Monitoring/monitoring.md` — monitoring practice.
- `../../../../UIUX/ArtificialIntelligence/artificialIntelligence.md` — feedback and AI interaction design.
