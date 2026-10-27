---
name: aieng-building-ai-applications
description: "Deciding whether and how to build an application on a foundation model: use case evaluation, the role of AI and humans (critical vs complementary, reactive vs proactive, crawl-walk-run automation), defensibility, usefulness thresholds and success metrics, milestone planning and the last mile, maintenance under fast model change, the three-layer AI engineering stack, and how AI engineering differs from ML and full-stack engineering, based on Chapter 1 (Introduction to Building AI Applications with Foundation Models) of Chip Huyen's AI Engineering. Use when scoping a new LLM or generative AI feature, writing the product brief or success metrics for a chatbot, copilot, or agent, deciding build vs buy, choosing how much to automate, planning milestones after a promising demo, or explaining which layer of the stack a task belongs to."
---

# Building AI Applications

Decide why the feature should exist and how success is measured before touching a model. A demo built in a weekend proves little; plan for the slow climb from "impressive" to "reliable enough to ship", and design the human's role so automation grows only as measured quality earns it.

## Is this worth building?

Classify the motive, because it sets priority and the build/buy answer:

| Motive | Typical signal | Implication |
|---|---|---|
| Existential threat | Competitors with AI could make the core business obsolete (document processing, aggregation, creative work) | Highest priority; keep it in-house |
| Profit or productivity | Cheaper acquisition, better retention, faster support, internal tooling | Prefer buying or composing existing services |
| Exploration | Unsure where AI fits yet | Time-boxed R&D, not a roadmap commitment |

- Check whether a foundation model provider or a large platform could ship the same thing as a feature. Moats come from technology, data, or distribution; with shared foundation models, technology rarely differentiates, so look for proprietary usage data or distribution.
- Prefer use cases whose outcomes can be measured (see Evaluation skills). Unmeasurable features are hard to justify and hard to take down.

## Define the AI's role

- **Critical vs complementary:** if the product breaks without the model, the accuracy bar is far higher. Complementary features tolerate more mistakes.
- **Reactive vs proactive:** reactive features answer a request and usually need low latency; proactive ones (alerts, suggestions) can be precomputed but need a higher quality bar, because unrequested output that is wrong feels intrusive.
- **Dynamic vs static:** decide whether behavior adapts per user (memory, per-user finetuning) or changes only when the shared model is upgraded.
- **Human-in-the-loop:** pick one: AI drafts for a human; AI handles only simple requests and routes the rest; AI responds directly.
- Grow automation in stages: humans mandatory, then AI facing internal staff, then AI facing external users. Promote a request class only when data supports it, e.g., agents accept AI drafts for that class nearly verbatim at a high rate.

## Set expectations before building

Write down, per feature:

1. **Business metrics:** share of requests automated, throughput gain, response-time reduction, labor saved, plus user satisfaction (more answers does not mean happier users).
2. **Usefulness threshold:** the minimum quality at which the feature helps at all.
3. **Quality metrics:** task-specific (see `evaluateAISystems.md`).
4. **Latency metrics:** time to first token (TTFT), time per output token (TPOT), total latency. Compare against the current baseline; if humans answer in an hour, seconds may be plenty.
5. **Cost metrics:** cost per request at expected volume.
6. **Other:** fairness, interpretability, compliance.

## Plan milestones honestly

- Evaluate off-the-shelf models first; the gap between their score and the goal sizes the effort.
- Expect fast early progress and slow late progress. Teams routinely report reaching most of the target experience in weeks and needing months for the last few points, mostly spent on edge cases and hallucinations. Budget for that.
- Re-run the cost-benefit check after evaluation; dropping the project is a valid outcome.

## Plan maintenance

- Models get cheaper, faster, and longer-context quickly. A self-hosting decision made for cost can flip when API prices drop; a vendor can disappear.
- Swapping model APIs is mechanically easy but behaviorally not: prompts, data, and quirks change. Versioned prompts and a fixed evaluation suite make swaps safe.
- Track regulatory and IP exposure (data protection, compute export rules, training-data provenance) as product risks.

## The AI engineering stack

| Layer | Contents | Where to start |
|---|---|---|
| Application development | Prompts, context construction, evaluation, AI interface | Start here |
| Model development | Modeling and training, finetuning, dataset engineering, inference optimization | Move down only when needed |
| Infrastructure | Serving, data and compute management, monitoring | Mostly unchanged from classic ML |

- Compared with classic ML: less training, more **adaptation** (prompt-based without weight changes, or finetuning with weight changes); bigger models, so inference cost and latency matter more; open-ended outputs, so **evaluation** is the hardest part.
- Compared with full-stack work: you can build the product first and invest in data and models only once it shows promise. Interfaces (chat, plug-ins, extensions, voice) and feedback capture now matter as much as the model.

## Workflow

1. State the motive (threat, opportunity, exploration) and the build/buy stance it implies.
2. Define the AI's role, the human's role, and the automation stage you start at.
3. Write business metrics, the usefulness threshold, and quality, latency, and cost targets.
4. Evaluate two or three off-the-shelf models against a small realistic set to size the gap.
5. Plan milestones with explicit time for the last mile; set a go/no-go checkpoint.
6. Start at the application layer (prompting and context); descend to finetuning or self-hosting only with evidence.
7. Put versioning and evaluation in place before the first model swap.

## Red flags

- A roadmap justified by a demo, with no usefulness threshold or business metric.
- Full automation for external users from day one in a critical or high-stakes flow.
- Proactive AI suggestions shipped at the same quality bar as reactive answers.
- No baseline latency or cost per request; "fast" and "cheap" undefined.
- Building in-house infrastructure for a commodity capability a provider is likely to absorb.
- Hard-coded provider calls and prompts with no versioning, making model swaps risky.

## Testing notes

- bdd: write scenarios at the business level ("a simple billing question is answered without a human"), with the usefulness threshold as the acceptance criterion measured on an evaluation set, not on one example.
- tdd: keep model calls behind an interface so product logic (routing, escalation, human handoff) is unit-tested with stubbed model responses.
- Track acceptance rate of AI drafts by request class; it is the evidence for moving a class to the next automation stage.
- **Current note:** model price and capability shifts have continued since the book; re-run the build/buy and model choice analysis on a schedule rather than once.

## Related

- `../../Foundations/FoundationModels/foundationModels.md` — what the model can and cannot do.
- `../../Evaluation/EvaluateAISystems/evaluateAISystems.md` — criteria, model selection, evaluation pipeline.
- `../../Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` — architecture growth and feedback.
- `../../../DesigningMLSystems/Foundations/MLSystemsInProduction/mlSystemsInProduction.md` — framing ML problems and business objectives.
- `../../../HandsOnLLM/UnderstandingLanguageModels/IntroductionToLLMs/introductionToLLMs.md` — LLM basics in code.
- `../../../../UIUX/ArtificialIntelligence/artificialIntelligence.md` — designing AI features for users.
