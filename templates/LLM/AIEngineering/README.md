## AI Skills

Before building, adapting, evaluating, or operating an application on a
foundation model (a chatbot, copilot, RAG system, agent, or any LLM
feature), find the skills that apply to the task in the tables below and
read them. This is the primary library for LLM-powered applications: it
decides between prompting, retrieval, agents, and finetuning, and covers
evaluation, latency and cost, guardrails, and user feedback.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed. For a new feature, the usual order is chapter 1 (scope
and success metrics), chapter 4 (evaluation pipeline), chapter 5 (prompt),
then chapters 6–8 only as failures demand, then chapters 9–10 for
production.

Each skill comes from one chapter of Chip Huyen's *AI Engineering:
Building Applications with Foundation Models* (O'Reilly, 2025). Where the
field has moved on since the book, skills carry a "Current note".

### Foundations

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./Foundations/BuildingAIApplications/buildingAIApplications.md` | Scoping an LLM feature, writing its success metrics and usefulness threshold, choosing how much to automate and where humans stay in the loop, judging defensibility or build vs buy, or planning milestones after a promising demo. |
| 2 | `./Foundations/FoundationModels/foundationModels.md` | Choosing temperature, top-p or stop conditions, getting reliable JSON or SQL, sampling several candidates and selecting one, reading logprobs, or debugging inconsistent and hallucinated answers. |

### Evaluation

| Ch | Skill | Use when |
|---|---|---|
| 3 | `./Evaluation/EvaluationMethodology/evaluationMethodology.md` | Choosing a metric for generated text or code, writing or reviewing an LLM-as-judge prompt, controlling judge bias, using perplexity, or ranking models with pairwise comparisons. |
| 4 | `./Evaluation/EvaluateAISystems/evaluateAISystems.md` | Selecting a model or provider, API vs open weights, building a golden eval set and rubric, sizing an eval set, checking hallucination and safety, or setting up regression evaluation for prompts, RAG, or agents. |

### Adaptation

| Ch | Skill | Use when |
|---|---|---|
| 5 | `./Adaptation/PromptEngineering/promptEngineering.md` | Writing or reviewing system prompts and few-shot examples, splitting a bloated prompt into a chain, versioning prompts, or defending against prompt injection, jailbreaks, and prompt or data extraction. |
| 6 | `./Adaptation/RAGAndAgents/ragAndAgents.md` | Building or debugging RAG (chunking, BM25 vs embeddings, hybrid search, reranking, query rewriting), evaluating retrieval, adding tools or function calling, designing an agent loop, or diagnosing agent failures. |
| 7 | `./Adaptation/Finetuning/finetuning.md` | Someone proposes finetuning, choosing RAG vs finetuning, estimating GPU memory, configuring LoRA or QLoRA, choosing a quantization level, merging models, or reading finetuning loss curves. |
| 8 | `./Adaptation/DatasetEngineering/datasetEngineering.md` | Assembling finetuning or eval data, writing annotation guidelines, generating and verifying synthetic data, distilling a model, deduplicating or cleaning a corpus, or deciding how much data to collect. |

### Production

| Ch | Skill | Use when |
|---|---|---|
| 9 | `./Production/InferenceOptimization/inferenceOptimization.md` | Setting latency SLOs, measuring or reducing TTFT and TPOT, estimating serving cost or KV cache memory, choosing batch vs online APIs, enabling prompt caching, or evaluating speculative decoding and quantization. |
| 10 | `./Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` | Designing the system around the model: guardrails, router, gateway, response caches, write actions, logging and tracing, drift detection, orchestration, and collecting and interpreting user feedback. |

# Context for AI: AI Engineering

## 1. Evaluation Comes First

Define what good means, the usefulness threshold, and how it will be
measured before building. Every prompt, retrieval, model, or finetuning
change is judged on the same versioned evaluation sets, sliced by the
cases that matter, with enough examples to trust the difference.

## 2. Climb the Adaptation Ladder Only as Far as Needed

Start with clear prompts and examples on a strong model. Add retrieval
when failures are about missing or outdated information, finetuning when
they are about behavior and format, and agents when the task needs
actions. Each step adds cost and maintenance; justify it with evidence.

## 3. Treat Model Output as Probabilistic

Any output with non-zero probability can appear. Fix sampling settings,
validate structured output, verify facts against context, retry or vote
where it pays, and never let correctness rest on a single sample.

## 4. Trust Nothing the Model Reads

Retrieved documents, tool outputs, emails, and user input can carry
instructions. Defend at the model, prompt, and system levels: isolate
code execution, grant least privilege, require approval for write
actions, and guard inputs and outputs.

## 5. Optimize Against Explicit Service Objectives

Latency is TTFT, TPOT, and percentiles; cost is per request. Take cheap
wins first (shorter outputs, prompt caching, batch APIs, routing to
smaller models) and re-evaluate quality after any change to the model
itself.

## 6. Observe Everything and Close the Loop

Log the rendered prompt, model version, settings, tool calls, and outputs
with traces. Detect drift in prompts, users, and provider models. Design
feedback into the product, correct for its biases, and turn confirmed
failures into new evaluation cases.

## How the AI Should Apply It

- When asked to build an LLM feature, first ask for or propose success
  metrics, a usefulness threshold, and a small evaluation set; do not
  start with finetuning or a vector database.
- When a prompt, model, or retrieval change is proposed, require an eval
  run on the same data and report the difference per slice.
- When reviewing code, check for unvalidated model output, prompts mixed
  into code without versions, missing logging of prompt and model
  version, cache keys that ignore the user, and write actions without
  approval or least privilege.
- When choosing between prompting, RAG, and finetuning, classify the
  observed failures (information vs behavior) and cite the evidence.
- State which numbers are measured and which are assumed; never present
  a single successful example as proof that the system works.
