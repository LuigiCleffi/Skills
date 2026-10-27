---
name: aieng-foundation-models
description: "How foundation models are built and why they behave as they do: training data coverage (languages, domains), transformer architecture and model size (parameters, tokens, FLOPs, Chinchilla scaling), post-training (supervised finetuning, RLHF, DPO, reward models), sampling (temperature, top-k, top-p, stop conditions, logprobs), test time compute (best-of-N, verifiers, majority vote), structured outputs (prompting, post-processing, constrained decoding, finetuning), and the probabilistic nature behind inconsistency and hallucination, based on Chapter 2 (Understanding Foundation Models) of Chip Huyen's AI Engineering. Use when picking sampling parameters, getting reliable JSON or SQL out of a model, debugging inconsistent or hallucinated answers, judging whether a model's training data fits a language or domain, sampling several candidates and selecting one, or reading logprobs."
---

# Foundation Models

A model is shaped by its training data, its post-training, and how you sample from it. Most application-level control lives in sampling and output handling: choose sampling settings per task, enforce structure in layers, and design for the fact that any output with non-zero probability can appear.

## Training data sets the ceiling

- A model is weak on languages and domains under-represented in its training data, and tokenizes those languages less efficiently (more tokens, higher cost and latency for the same text). Test non-English and specialized-domain inputs explicitly.
- Web-scale data is noisy; general models reflect that. Domain-specific models help when the domain data is scarce on the web (e.g., some biomedical or proprietary formats), but check that a strong general model does not already beat them.
- Model size is described by parameters, training tokens, and training compute (FLOPs). Compute-optimal training scales tokens with parameters (roughly 20 tokens per parameter in the Chinchilla study). A sparse mixture-of-experts model activates only part of its parameters per token, so its cost is not its total parameter count.
- **Current note:** many recent models are trained far beyond compute-optimal token counts so they are cheaper to serve; parameter count alone is a weak quality proxy.

## Post-training explains behavior

- Pre-training optimizes next-token prediction; post-training makes the model conversational and aligned. Supervised finetuning (SFT) uses demonstration (prompt, response) data; preference finetuning (RLHF with a reward model, or DPO) uses (prompt, preferred, rejected) data.
- A reward model scores (prompt, response) pairs; the same idea works at inference as a verifier to pick among candidates.
- Base (pre-trained only) models complete text; instruct/chat models follow instructions. Use the right one for the job and its exact chat template.
- **Current note:** reinforcement learning against automatically verifiable rewards (math answers, unit tests) became a prominent post-training approach after the book, producing reasoning models that spend extra tokens thinking before answering.

## Sampling settings by task

| Setting | Effect | Practical guidance |
|---|---|---|
| Temperature | Divides logits before softmax; lower is more deterministic | 0 for extraction, classification, evaluation; moderate (around 0.7) for creative text; tune on your eval set |
| Top-k | Sample only among the k most likely tokens | Smaller k is safer and blander |
| Top-p (nucleus) | Smallest token set whose cumulative probability reaches p | Common 0.9–0.95; adapts to how peaked the distribution is |
| Stop conditions | Max tokens or stop sequences | Cap cost and latency, but a hard cut can truncate JSON |

- Use logprobs when the API exposes them: confidence for classification, perplexity checks, and debugging (uniform-looking probabilities mean the model has not learned the pattern).

## Test time compute

- Generate several outputs and select one: highest average logprob (normalize by length), a reward model or verifier, a task heuristic (valid SQL, shortest), or majority vote for exact-answer tasks.
- Vary sampling settings across candidates for diversity. Cost scales roughly linearly with the number of samples; gains flatten after a point.
- For latency, fire several requests in parallel and return the first valid one.
- The less robust a model is to small input changes, the more retries and voting help.

## Structured outputs, in escalating strength

1. **Prompt** for the format with an example; optionally validate with a second model call (adds cost and latency).
2. **Post-process**: models repeat the same small mistakes, so a defensive parser that fixes them (missing brackets, trailing text) can recover most failures cheaply.
3. **Retry / test time compute** until the output parses.
4. **Constrained sampling**: mask tokens that violate a grammar or schema. Strong guarantees, but each format needs a grammar and it can add latency.
5. **Finetune** on correctly formatted examples, or add a classifier head for closed label sets.

- JSON mode guarantees syntax, not the right keys or values; still validate against a schema. Set max tokens high enough to avoid truncation.
- Prefer less verbose formats when tokens matter; YAML can need fewer output tokens than JSON.

```python
import json
from pydantic import BaseModel, ValidationError

class Ticket(BaseModel):
    intent: str
    priority: int

def parse_ticket(raw: str) -> Ticket | None:
    text = raw.strip().removeprefix("```json").removesuffix("```")
    try:
        return Ticket.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError):
        return None  # caller retries or falls back
```

## Inconsistency and hallucination

- **Same input, different output:** fix temperature, top-p, top-k, and seed; cache answers to repeated questions. Even then, hardware and provider changes can alter outputs, so never promise bit-identical results from a hosted API.
- **Slightly different input, very different output:** fixed settings do not help; use clearer prompts, examples, and memory of prior answers.
- **Hallucination** has two leading explanations: the model cannot distinguish what it was given from what it generated, so one wrong early claim snowballs; and post-training can teach it to answer beyond its knowledge. Mitigate with grounding context (RAG), instructions to answer only from context or to say "I don't know", shorter responses, and verification.

## Workflow

1. Check the model's language and domain coverage on your real inputs, including token counts.
2. Choose a base or instruct model and use its exact chat template.
3. Set sampling per task type and record the settings with the prompt version.
4. Choose a structured-output strategy at the weakest level that meets your validity target; always validate.
5. Decide whether best-of-N or voting is worth its cost for this task.
6. Measure consistency (repeat runs) and hallucination (grounded vs ungrounded claims) on an eval set.

## Red flags

- Default temperature on extraction, classification, or judge prompts.
- Parsing model output with `json.loads` and no schema validation or retry.
- Max tokens set so low that structured outputs are truncated.
- Assuming the model knows recent or private facts without supplying context.
- Treating a seed as a determinism guarantee for a hosted model.
- Selecting among candidates by raw summed logprob, which favors short outputs.

## Testing notes

- tdd: unit-test parsers and repair functions with recorded malformed outputs (truncated JSON, prose before JSON, wrong keys); these are deterministic.
- Stub the model client in tests; reserve live calls for a small, tagged evaluation suite.
- Measure format validity rate and self-consistency (run each eval prompt several times) as metrics, not single pass/fail checks.
- For selection logic (majority vote, best-of-N), test with fixed candidate lists and known scores.

## Related

- `../../Foundations/BuildingAIApplications/buildingAIApplications.md` — scoping the application.
- `../../Adaptation/PromptEngineering/promptEngineering.md` — chat templates and instructions.
- `../../Evaluation/EvaluationMethodology/evaluationMethodology.md` — perplexity, logprobs, AI judges.
- `../../../BuildLLMFromScratch/Training/Pretraining/pretraining.md` — decoding strategies from the inside.
- `../../../BuildLLMFromScratch/Architecture/GPTModel/gptModel.md` — the transformer architecture.
- `../../../HandsOnLLM/UnderstandingLanguageModels/LookingInsideLLMs/lookingInsideLLMs.md` — sampling and inference in code.
