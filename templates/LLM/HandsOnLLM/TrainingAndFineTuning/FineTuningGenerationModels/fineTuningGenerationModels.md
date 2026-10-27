---
name: hollm-fine-tuning-generation-models
description: "Fine-tuning generative LLMs: the pretraining, supervised fine-tuning (instruction tuning) and preference tuning stages, full fine-tuning versus parameter-efficient fine-tuning (adapters, LoRA rank, alpha and target modules), quantization for training (QLoRA with 4-bit NF4, blockwise and double quantization, paged optimizers), formatting instruction data with chat templates, SFTTrainer from TRL, merging adapters, evaluating generative models (perplexity, ROUGE, BLEU, BERTScore, public benchmarks and leaderboards, LLM-as-a-judge, human evaluation and Elo arenas, Goodhart's law), reward models and PPO, and DPO and ORPO preference tuning on chosen/rejected pairs, based on Chapter 12 (Fine-Tuning Generation Models) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when prompting and RAG are not enough, teaching a model a format, style, or domain behavior, instruction-tuning a base model, running LoRA or QLoRA on limited VRAM, building chosen/rejected preference data, choosing between PPO, DPO and ORPO, or designing an evaluation for a fine-tuned generator."
---

# Fine-Tuning Generation Models

A useful chat model comes from three stages: pretraining (a base model), supervised fine-tuning on instruction data (follows directions), and preference tuning (prefers better answers). Most teams only do the last two, cheaply, with LoRA or QLoRA, and must evaluate against their own use case because no single metric captures generation quality.

## The three stages

| Stage | Data | Result |
|---|---|---|
| Pretraining (language modeling) | Huge unlabeled corpora | Base/foundation model: completes text, may answer a question with more questions |
| Supervised fine-tuning (SFT) | Instruction → response pairs, multi-turn chats | Instruct/chat model |
| Preference tuning | Prompt + chosen + rejected generations | Aligned to preferences (helpfulness, safety, style) |

- SFT also nudges an existing chat model toward a task (specific SQL dialect, a JSON schema) when you have query–response examples.
- Fine-tune when evaluation shows prompting (ch6) and retrieval (ch8) cannot close the gap; fine-tuning teaches behavior and format better than it teaches fresh facts.

## Full fine-tuning versus PEFT

- Full fine-tuning updates every weight: best potential, but costly in compute, time and storage (one full copy per task).
- **Adapters** insert small trainable modules after attention and feedforward in every block; swappable per task.
- **LoRA** learns low-rank update matrices beside frozen weights (two thin matrices instead of a full one); works because fine-tuning updates have low intrinsic dimension.

| LoRA knob | Meaning | Guidance from the book |
|---|---|---|
| `r` | Rank of the update matrices | Typically 4–64; higher = more capacity, less compression |
| `lora_alpha` | Scale of the update relative to base weights | Rule of thumb: about 2 x `r` |
| `target_modules` | Which projections get adapters | All attention and MLP projections for quality; fewer for speed |
| `lora_dropout` | Regularization | Small value such as 0.1 |

## QLoRA: quantize the frozen base

- Load the base in 4-bit NF4 (normal-float bins match the roughly normal weight distribution), with blockwise and double quantization; compute in 16-bit; train LoRA adapters on top.
- Paged optimizers and gradient checkpointing further cut memory. The book's 1.1B model needed about a quarter of the VRAM to load.

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, prepare_model_for_kbit_training, get_peft_model

bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                         bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)
model = AutoModelForCausalLM.from_pretrained(base_id, device_map="auto", quantization_config=bnb)
model.config.use_cache = False                     # required with gradient checkpointing
model = get_peft_model(prepare_model_for_kbit_training(model),
                       LoraConfig(r=64, lora_alpha=32, lora_dropout=0.1, bias="none", task_type="CAUSAL_LM",
                                  target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                                                  "gate_proj", "up_proj", "down_proj"]))
model.print_trainable_parameters()
```

## SFT in practice

- Format every example with the chat template the deployed model will use (`apply_chat_template`); training and inference templates must match exactly.
- Set a pad token and padding side explicitly for decoder tokenizers.
- Train with TRL's `SFTTrainer` (text field, max sequence length, `peft_config`); typical settings in the book: small per-device batch with gradient accumulation, learning rate around 2e-4 for LoRA with a cosine schedule, one epoch (more epochs tend to degrade).
- Save adapters, then reload the base in 16-bit and `merge_and_unload()` for deployment, or serve base + adapter.
- **Current note:** TRL and PEFT argument names have changed since the book (e.g. options moved into `SFTConfig`/`DPOConfig`, `tokenizer` renamed `processing_class`); consult the installed version's docs. Hyperparameter guidance above is a starting point, not a rule.

## Evaluating generative models

| Method | Measures | Limits |
|---|---|---|
| Perplexity | How well the model predicts reference text | Says nothing about correctness, fluency or usefulness |
| ROUGE, BLEU, BERTScore | Overlap or similarity with references | Penalize valid paraphrases; need references |
| Public benchmarks (MMLU, GSM8k, HellaSwag, TruthfulQA, HumanEval) | Broad capabilities | Contamination and overfitting; may not reflect your task; slow |
| Leaderboards | Aggregates of benchmarks | Optimized against, so inflated |
| LLM-as-a-judge, pairwise | Open-ended quality | Judge bias; validate against humans |
| Human evaluation, arena Elo | Real preference | Costly; crowd preference may not be yours |

- Pick evaluations by use case (code: code benchmarks, not math word problems), and write your own question set, including the languages and edge cases your users bring.
- Goodhart's law: once a metric becomes the target it stops measuring well. Track several metrics and read outputs.

## Preference tuning

- Preference data: prompt, chosen, rejected (rejected need not be bad, just less preferred); collected by having labelers compare two generations.
- **Reward model + PPO**: train a model (LLM copy with a scalar head) to score chosen above rejected, then optimize the LLM with PPO without drifting too far. Powerful but complex; multiple reward models (helpfulness, safety) are possible.
- **DPO**: no reward model; compares log-probabilities of chosen and rejected under the trainable model versus a frozen reference copy. More stable and simpler. Use a lower learning rate than SFT (the book uses 1e-5 with warmup) and `beta` around 0.1.
- **ORPO**: combines SFT and preference optimization in one training run.
- Filter preference data: drop ties, low-scored "chosen" answers, and anything overlapping evaluation sets.
- Stacking: merge the SFT adapter into the base, then train and merge the DPO adapter on top.

## Workflow

1. Write the target behavior and an evaluation set (prompts, references or rubrics, judge prompts) before training.
2. Baseline the best prompt/RAG setup on it.
3. Prepare SFT data in the exact chat template; deduplicate and hold out evaluation items.
4. Run QLoRA SFT with logged hyperparameters and seed; evaluate.
5. If answers are correct but not preferred, collect chosen/rejected pairs and run DPO (or ORPO).
6. Merge adapters, re-evaluate (task metrics, judge, human spot checks, safety prompts).
7. Version base model, adapters, data snapshot and evaluation results together.

## Red flags

- Fine-tuning to inject frequently changing facts that retrieval would handle.
- Training data formatted with a different template than inference.
- Multiple epochs on small SFT data without checking overfitting or loss of general ability.
- Reporting only perplexity or a public benchmark the training data may contain.
- Preference pairs where chosen and rejected are near-identical or mislabeled; eval prompts leaking into training.
- Merging adapters into a quantized base instead of reloading the base in higher precision.
- No safety or refusal checks after fine-tuning (alignment can regress).

## Testing notes

- Data tests: every example renders through the chat template, fits `max_seq_length`, contains exactly one assistant target, and does not overlap the eval set.
- Smoke training: a few steps on a tiny subset must lower loss; `print_trainable_parameters` matches the expected LoRA fraction.
- Regression suite: fixed prompts with greedy decoding; compare base, SFT and DPO models with task metrics and an LLM judge, plus human review of a sample.
- Capability-retention checks on a few general prompts to catch catastrophic forgetting.
- Record seeds, library versions and hardware; expect some nondeterminism on GPU and use thresholds, not exact matches.

## Related

- `../FineTuningRepresentationModels/fineTuningRepresentationModels.md` — fine-tuning encoders instead.
- `../../UsingPretrainedModels/PromptEngineering/promptEngineering.md` — try prompting first.
- `../../UsingPretrainedModels/AdvancedTextGeneration/advancedTextGeneration.md` — quantized models for inference.
- `../../../BuildLLMFromScratch/FineTuning/InstructionFineTuning/instructionFineTuning.md` — instruction tuning implemented by hand.
- `../../../BuildLLMFromScratch/FineTuning/LoRA/loRA.md` — LoRA from scratch.
- `../../../AIEngineering/Adaptation/Finetuning/finetuning.md` — when to fine-tune, memory math, model merging.
- `../../../AIEngineering/Evaluation/EvaluationMethodology/evaluationMethodology.md` — evaluation methods and AI judges.
