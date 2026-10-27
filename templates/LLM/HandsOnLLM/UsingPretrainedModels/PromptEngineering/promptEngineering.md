---
name: hollm-prompt-engineering
description: "Using generative models through prompts: choosing and loading an instruct model, chat templates, sampling controls (do_sample, temperature, top_p, top_k), prompt components (persona, instruction, context, format, audience, tone, data, output indicators), specificity, hallucination guards and instruction placement, in-context learning (zero, one and few-shot), prompt chaining, reasoning techniques (chain-of-thought, zero-shot CoT, self-consistency, tree-of-thought), and output verification with examples, guardrail libraries and grammar-constrained JSON sampling, based on Chapter 6 (Prompt Engineering) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when writing or debugging a prompt, picking temperature or top_p, adding few-shot examples, splitting a task into chained calls, improving reasoning on multi-step problems, or forcing valid JSON or a fixed label set from an LLM."
---

# Prompt Engineering

A prompt is a modular program for a prediction machine: build it from explicit components, change one component at a time, and measure the effect. When the output feeds software, constrain and verify it rather than trusting instructions alone.

## Model and template

- Start with a small instruct model and scale up when evaluation demands it; scaling up is easier than down.
- Chat models were trained on a specific template with role and end tokens. Always format messages with `tokenizer.apply_chat_template` (pipelines do this for you); the end token is what tells the model to stop.

## Sampling controls

| Use case | temperature | top_p | Effect |
|---|---|---|---|
| Brainstorming | High | High | Diverse, surprising |
| Email, extraction, classification | Low (or greedy) | Low | Predictable, focused |
| Creative writing | High | Low | Creative but coherent |
| Translation | Low | High | Accurate with varied vocabulary |

- Temperature and top_p only apply with `do_sample=True`; `do_sample=False` is greedy.
- top_p keeps the smallest set of tokens whose cumulative probability reaches p; top_k keeps exactly k tokens.
- Sampling makes outputs differ run to run; log the parameters with every result.

## Prompt components

Build up from instruction + data, then add only what helps:

| Component | Purpose |
|---|---|
| Persona | Role and expertise to adopt |
| Instruction | The task, as specific as possible |
| Context | Why the task exists, constraints |
| Format | Exact output shape (critical for automation) |
| Audience | Level of the reader |
| Tone | Register of the output |
| Data | The input, clearly delimited |
| Output indicator | A trailing cue such as `Sentiment:` |

- Specificity matters most: state length, tone and scope ("two sentences, formal").
- Reduce hallucination by allowing "I don't know" when the answer is not known.
- Put the instruction at the start or end; models attend less to the middle of long prompts.
- Prompts that work on one model may not transfer to another; re-evaluate when switching models.

## In-context learning

- Zero-shot (no examples), one-shot, few-shot. Show the task instead of only describing it.
- Encode examples as alternating user/assistant turns so the model sees them as prior answers.
- Examples shape format as much as content; use them to pin the output structure.

## Chaining

- Split a complex task into sequential calls (name, then slogan, then pitch), each with its own parameters and token limits.
- Patterns: generate then validate, parallel generation then merge, outline then expand.
- Each link is a testable unit with its own input and output contract.

## Reasoning techniques

| Technique | How | Cost |
|---|---|---|
| Chain-of-thought | Few-shot examples that show reasoning before the answer | Longer outputs |
| Zero-shot CoT | Append a cue like "Let's think step-by-step" | Longer outputs |
| Self-consistency | Sample n answers (with CoT), majority-vote the final answers | n times the calls |
| Tree-of-thought | Explore and score intermediate steps, prune weak branches | Many calls; a single-prompt "panel of experts" variant approximates it |

- Reasoning helps multi-step problems (math, logic, planning) because each generated token adds compute; it is wasted on simple lookups.
- Parse the final answer separately from the reasoning text.
- **Current note:** many current models are trained to reason before answering (sometimes with separate reasoning output or a reasoning-effort setting); explicit CoT prompts matter less for them, but self-consistency and verification still apply.

## Output verification

Verify for structure, validity (allowed values only), ethics/safety (PII, profanity, bias) and accuracy. Three levers: examples, grammar, fine-tuning (ch12).

- Examples guide format but cannot forbid outputs; the model may still truncate or drift (e.g. JSON cut off at `max_new_tokens`).
- Guardrail libraries validate or fill in structure around generation.
- Grammar-constrained sampling restricts which tokens can be chosen, guaranteeing syntax:

```python
import json
from llama_cpp.llama import Llama
llm = Llama.from_pretrained(repo_id="microsoft/Phi-3-mini-4k-instruct-gguf",
                            filename="*fp16.gguf", n_gpu_layers=-1, n_ctx=2048, verbose=False)
out = llm.create_chat_completion(
    messages=[{"role": "user", "content": "Create a warrior for an RPG in JSON format."}],
    response_format={"type": "json_object"}, temperature=0)
data = json.loads(out["choices"][0]["message"]["content"])
```

- Grammar guarantees syntax, not schema or truth: still validate fields against a schema and check content.
- **Current note:** most hosted APIs and serving engines now offer JSON-schema structured outputs and tool-call schemas; prefer those native features over hand-rolled parsing.

## Workflow

1. Write the task as instruction + data + format; set greedy decoding.
2. Build a small evaluation set with expected outputs before iterating.
3. Add components one at a time (context, persona, examples) and keep only those that improve the metric.
4. Split into a chain if one prompt does too much.
5. Add CoT or self-consistency for multi-step reasoning; measure cost.
6. Constrain output (schema/grammar), validate, and define a fallback for failures.
7. Version prompts with their parameters and evaluation scores.

## Red flags

- Prompts built by string concatenation without the chat template.
- Format described in prose only, parsed with fragile regexes, no validation or retry.
- Temperature > 0 in tests that assert exact output.
- Instructions buried in the middle of long context.
- User input inserted into prompts without delimiting (prompt injection risk).
- Self-consistency or tree-of-thought on latency-critical paths without a budget.

## Testing notes

- Treat prompts as code: store them in files, review diffs, and run a regression eval on a golden set when they change.
- Assert properties (valid JSON, schema match, label in allowed set, length bounds) rather than exact text.
- Unit-test chain wiring with a stubbed model returning canned outputs, including malformed ones.
- For sampled outputs, run k samples and assert a pass rate threshold.

## Related

- `../AdvancedTextGeneration/advancedTextGeneration.md` — templates, memory, agents built on these prompts.
- `../TextClassification/textClassification.md` — prompting for labels.
- `../../UnderstandingLanguageModels/LookingInsideLLMs/lookingInsideLLMs.md` — how sampling chooses tokens.
- `../../TrainingAndFineTuning/FineTuningGenerationModels/fineTuningGenerationModels.md` — when prompting is not enough.
- `../../../AIEngineering/Adaptation/PromptEngineering/promptEngineering.md` — prompt engineering in production, defenses against injection.
- `../../../AIEngineering/Evaluation/EvaluateAISystems/evaluateAISystems.md` — evaluating prompt changes.
