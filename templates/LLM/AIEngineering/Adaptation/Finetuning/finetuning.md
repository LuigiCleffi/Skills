---
name: aieng-finetuning
description: "Deciding when and how to finetune foundation models: reasons to finetune (task quality, formats and DSLs, smaller distilled models, bias mitigation) and reasons not to (capability regression, data, talent, serving and maintenance cost), prompting vs RAG vs finetuning by failure type (information vs behavior), the adaptation ladder, memory math for inference and training (weights, activations, KV cache, gradients, Adam optimizer states, gradient checkpointing), numerical formats and quantization (FP32, FP16, BF16, INT8, INT4, post-training vs quantization-aware), parameter-efficient finetuning (adapters, soft prompts, LoRA rank, alpha and target modules, QLoRA, serving merged vs multi-LoRA adapters), model merging and multi-task finetuning, and finetuning hyperparameters (learning rate, batch size, gradient accumulation, epochs, prompt loss weight), based on Chapter 7 (Finetuning) of Chip Huyen's AI Engineering. Use when someone proposes finetuning, choosing between RAG and finetuning, estimating GPU memory for serving or training, configuring LoRA or QLoRA, picking a quantization level, merging adapters, or debugging a finetuning run's loss curves."
---

# Finetuning

Finetune only after systematic prompting has plateaued and the remaining failures are about behavior, not missing knowledge. In the book's words, "finetuning is for form, and RAG is for facts." When you do finetune, start with a parameter-efficient method on the best base model you can serve, and budget for the data, evaluation, serving, and re-finetuning every time a better base model ships.

## Decide by failure type

| Observed failure | First remedy | Escalation |
|---|---|---|
| Unclear or inconsistent behavior with a decent model | Better prompts, examples, decomposition | Finetune if still failing after systematic prompt experiments |
| Missing, private, or outdated facts | RAG (start with BM25) | Better retrieval (embeddings, hybrid) |
| Wrong format, style, rare syntax or DSL, irrelevant but correct output | More examples, structured-output tools | Finetune on well-formed examples |
| Too slow or expensive at quality target | Smaller model, caching, routing | Distill into a finetuned small model |
| Both information and behavior issues | RAG first | Add finetuning; combine both |

Adaptation ladder: prompt, then add examples (roughly 1–50), then RAG for information failures, then advanced RAG or finetuning by failure mode, then both. Keep the same evaluation pipeline at every step.

- Finetuning one task can degrade others; finetune on all the query types you serve, or use separate models (and merge them if serving one is required).
- Check whether a general model already beats the specialized one: strong general models have repeatedly outperformed costly domain-specific models on their own domains.
- Prompt caching has removed much of the old argument that finetuning saves prompt tokens; the context limit on examples still applies.

## Memory math

- Inference: weights = parameters x bytes per parameter; add roughly 20 percent for activations and KV cache at modest context and batch sizes (much more for long contexts or big batches). A 13B model in 16-bit needs about 26 GB of weights, about 31 GB total.
- Training adds gradients and optimizer states for each **trainable** parameter: SGD none, momentum one value, Adam two values, so Adam needs about three extra values per trainable parameter. Full finetuning a 13B model in 16-bit needs about 78 GB just for those; with 1B trainable parameters, about 6 GB.
- Activations can dominate in training; gradient checkpointing recomputes them to save memory at the cost of time.
- Reducing trainable parameters (PEFT) and bits per value (quantization) are the two main memory levers.

## Numerical formats and quantization

- FP32 (4 bytes), FP16 and BF16 (2 bytes; BF16 keeps FP32's range with less precision), INT8 (1 byte), INT4 (half a byte). Loading a model in the wrong 16-bit format can silently hurt quality; use the format it was trained or released in.
- Inference is commonly run in 16, 8, or 4 bits with weight-only post-training quantization. Training is precision-sensitive and usually uses mixed precision; quantization-aware training reduces the quality drop of low-bit inference.

## Parameter-efficient finetuning

- PEFT families: adapter-based (add trainable modules, e.g., LoRA) and soft-prompt based (trainable prompt vectors). LoRA dominates because it adds no inference latency once merged and works with little data.
- LoRA factorizes the weight update into two low-rank matrices. Apply it to attention projections (query and value are the best pair if limited; all four is better at the same budget), and adding feedforward layers often helps more. Ranks of 4–64 usually suffice; higher rank rarely helps and can overfit. Choose alpha so alpha:r sits roughly between 1:8 and 8:1, then tune.
- Serving: merge adapters into the base weights for one model (no extra latency), or keep adapters separate to serve many finetunes on one base model (small per-adapter storage, quick swaps, slight latency).
- QLoRA stores the frozen base in 4-bit and trains LoRA adapters in higher precision, fitting large models on one GPU; quantize and dequantize steps slow training.

```python
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],  # names depend on the architecture
    task_type="CAUSAL_LM",
)
model = get_peft_model(base_model, config)
model.print_trainable_parameters()  # sanity check: a small fraction of the total
```

## Model merging

- Combine models instead of (or after) finetuning. Three families: summing (weighted averaging, spherical linear interpolation, task vectors with pruning of redundant parameters before summing), layer stacking (building a model from layers of others, usually followed by more training), and concatenation (e.g., joining adapters, which saves nothing in size).
- Uses: multi-task models without catastrophic forgetting (finetune per task in parallel, then merge), combining adapters on the same base, reducing serving footprint, on-device deployment. Merging itself needs little or no GPU.

## Method and hyperparameters

- Few hundred to few thousand examples: LoRA on a strong base. Tens of thousands to millions: full finetuning becomes worthwhile. Start with LoRA; try full finetuning later if needed.
- Use a finetuning API for speed, a framework for control; distributed training needs dedicated tooling.
- **Learning rate:** search roughly 1e-7 to 1e-3; a jumpy loss means too high, a slow, flat decline means too low; use a schedule.
- **Batch size:** too small (under about 8) is unstable; use gradient accumulation when memory limits batch size.
- **Epochs:** millions of examples may need 1–2; thousands may benefit from 4–10. Training loss falling while validation loss rises means overfitting: stop earlier.
- **Prompt loss weight:** learn mostly from response tokens (a small weight such as 10 percent on prompt tokens is a common default).

## Workflow

1. Prove prompting is exhausted with versioned prompts and a real eval set.
2. Classify remaining failures as information or behavior; add RAG first for information.
3. Run a small finetune (50–100 good examples) with LoRA; expect visible improvement or revisit data and hyperparameters.
4. Estimate memory for training and serving; choose precision and PEFT settings that fit.
5. Train with held-out validation, logging loss curves and eval scores per checkpoint.
6. Compare against the base model and the prompted baseline on every task you serve, not just the target task.
7. Plan serving (merged vs multi-adapter) and a policy for re-finetuning when new base models arrive.

## Red flags

- "Prompting doesn't work" with no versioned prompts, eval set, or metrics.
- Finetuning to inject frequently changing facts that belong in retrieval.
- Evaluating the finetuned model only on the target task, ignoring regressions elsewhere.
- No validation split; choosing epochs without watching validation loss.
- Memory estimate that counts weights only and ignores optimizer states and activations.
- Data in a different chat template than the one used at inference.

## Testing notes

- tdd: unit-test data formatting (template rendering, label masking of prompt tokens) and the memory estimator with known model sizes.
- Smoke-train on a tiny dataset with a fixed seed and assert the loss decreases and the model can overfit a few examples.
- Shape tests: adapter parameter counts match r and target modules; merged weights equal base plus scaled update within tolerance.
- Keep the regression eval across all served tasks as a release gate for each finetuned checkpoint.
- **Current note:** preference and reinforcement-style post-training (DPO variants, RL with verifiable rewards) is now offered by more finetuning frameworks and APIs; the decision rules above still decide whether to finetune at all.

## Related

- `../../Adaptation/DatasetEngineering/datasetEngineering.md` — building the finetuning data.
- `../../Adaptation/RAGAndAgents/ragAndAgents.md` — the retrieval alternative.
- `../../Production/InferenceOptimization/inferenceOptimization.md` — quantization and serving.
- `../../../BuildLLMFromScratch/FineTuning/LoRA/loRA.md` — LoRA implemented by hand.
- `../../../BuildLLMFromScratch/FineTuning/InstructionFineTuning/instructionFineTuning.md` — instruction tuning in PyTorch.
- `../../../HandsOnLLM/TrainingAndFineTuning/FineTuningGenerationModels/fineTuningGenerationModels.md` — SFT, QLoRA, and preference tuning in code.
