---
name: llm-scratch-lora
description: "Parameter-efficient fine-tuning with LoRA (low-rank adaptation): approximating the weight update as the product of two small matrices A and B, rank and alpha scaling, zero-initializing B so training starts from the pretrained model, wrapping nn.Linear layers with a LoRA branch, recursively replacing linear layers in a frozen GPT, counting trainable parameters, merging adapters for inference, and fine-tuning a classifier with LoRA, based on Appendix E (Parameter-efficient fine-tuning with LoRA) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when full fine-tuning is too slow or memory-hungry, adding LoRA adapters to attention or feed-forward layers, choosing rank and alpha, storing many task-specific adapters for one base model, or reviewing PEFT code for frozen-weight and initialization bugs."
---

# Parameter-Efficient Fine-Tuning with LoRA

LoRA keeps the pretrained weights frozen and learns the update as a low-rank product: instead of training `delta W` (`d_in x d_out`), train `A` (`d_in x r`) and `B` (`r x d_out`) with a small rank `r`. You train a few percent of the parameters, store tiny per-task adapters, and can merge them into the base weights for inference at no extra latency.

## The idea

- Full fine-tuning updates `W` to `W + delta W`. LoRA assumes the useful update has low rank and factorizes it: `delta W ~ A @ B`.
- Forward pass: `y = x @ W + alpha * (x @ A @ B)`; the frozen path and the adapter path are summed.
- Parameter count per layer drops from `d_in * d_out` to `r * (d_in + d_out)`.
- Because the layer is linear, the adapter can be merged after training (`W' = W + alpha * A @ B`) so inference uses one matrix.

## Implementation

- Initialize `A` randomly and `B` to **zeros**, so `A @ B = 0` at step 0 and the model starts exactly as the pretrained one.
- `alpha` scales the adapter's contribution. The book multiplies by `alpha` directly; many libraries scale by `alpha / r`, so a value tuned in one convention does not transfer to the other.
- Freeze the whole model first, then wrap the linear layers: the new `A` and `B` are the only trainable parameters (plus any new task head).

```python
import math
import torch
import torch.nn as nn

class LoRALayer(nn.Module):
    def __init__(self, in_dim, out_dim, rank, alpha):
        super().__init__()
        self.A = nn.Parameter(torch.empty(in_dim, rank))
        nn.init.kaiming_uniform_(self.A, a=math.sqrt(5))
        self.B = nn.Parameter(torch.zeros(rank, out_dim))
        self.alpha = alpha

    def forward(self, x):
        return self.alpha * (x @ self.A @ self.B)

class LinearWithLoRA(nn.Module):
    def __init__(self, linear, rank, alpha):
        super().__init__()
        self.linear = linear
        self.lora = LoRALayer(linear.in_features, linear.out_features, rank, alpha)

    def forward(self, x):
        return self.linear(x) + self.lora(x)

def replace_linear_with_lora(module, rank, alpha):
    for name, child in module.named_children():
        if isinstance(child, nn.Linear):
            setattr(module, name, LinearWithLoRA(child, rank, alpha))
        else:
            replace_linear_with_lora(child, rank, alpha)

def count_trainable(model):
    return sum(p.numel() for p in model.parameters() if p.requires_grad)

# Usage on a GPT classifier (see the classification skill):
# for p in model.parameters(): p.requires_grad = False
# replace_linear_with_lora(model, rank=16, alpha=16)
```

## Applying it to the GPT classifier

- The book reuses the spam-classification setup: load GPT-2, replace the output head with a two-class head, freeze all weights, then wrap every linear layer (attention projections, feed-forward layers and the new head) with LoRA.
- Trainable parameters drop from over a hundred million to a few million, and accuracy comes out close to full fine-tuning of the top layers, with a faster, lighter training run.
- Use the same loop, loss and last-token readout as ordinary classification fine-tuning.

## Choosing rank, alpha and targets

| Knob | Effect | Guidance |
|---|---|---|
| Rank `r` | capacity of the update | start around 8 to 16; raise if underfitting, lower to save memory |
| Alpha | step size of the adapter path | tune together with rank and learning rate; keep the convention fixed |
| Target layers | where adaptation happens | attention projections at minimum; adding feed-forward layers often helps |
| Learning rate | adapters tolerate higher LRs than full fine-tuning | tune on validation |

## Merging and serving

```python
@torch.no_grad()
def merge(layer: LinearWithLoRA) -> nn.Linear:
    merged = nn.Linear(layer.linear.in_features, layer.linear.out_features,
                       bias=layer.linear.bias is not None)
    delta = layer.lora.alpha * (layer.lora.A @ layer.lora.B)        # (in, out)
    merged.weight.copy_(layer.linear.weight + delta.T)              # nn.Linear stores (out, in)
    if layer.linear.bias is not None:
        merged.bias.copy_(layer.linear.bias)
    return merged
```

- Keep adapters unmerged when serving many tasks from one base model; merge when serving one task with minimal latency.

**Current note:** in practice LoRA is usually applied through a PEFT library rather than hand-written, and variants are common, notably QLoRA (LoRA on a quantized frozen base to cut memory further). The mechanics above are what those libraries implement; verify which layers they target and which alpha convention they use.

## Workflow

1. Get the full fine-tuning pipeline working (data, head, loss, metric) without LoRA.
2. Freeze every base parameter.
3. Wrap target `nn.Linear` layers with LoRA; zero-initialize `B`.
4. Assert the model's outputs are unchanged right after wrapping, and count trainable parameters.
5. Train with the same loop; tune rank, alpha and learning rate on validation.
6. Save only adapter (and head) weights; merge for single-task serving and verify equal outputs.

## Red flags

- Base weights left trainable (no memory saving, risk of forgetting), or LoRA parameters frozen by freezing after wrapping.
- `B` initialized randomly, so the model is perturbed before training starts.
- Alpha convention mixed between implementations; rank and alpha changed together without a baseline.
- Merging with the wrong transpose (`nn.Linear` stores `(out, in)`).
- Recursive replacement that wraps a layer twice or skips nested modules.
- Saving the full model when only adapters changed.

## Testing notes

- tdd: after wrapping with `B = 0`, `torch.testing.assert_close(lora_model(x), base_model(x))` on a fixed input.
- Trainable-count test: equals `sum(r * (d_in + d_out))` over wrapped layers plus the head.
- Gradient test: after one backward pass only LoRA (and head) parameters have gradients; base weights have `grad is None`.
- Merge test: merged layer output equals the unmerged `LinearWithLoRA` output within tolerance, using random non-zero `A` and `B`.
- Eval: compare LoRA vs full or top-layer fine-tuning on the same golden set, reporting accuracy, training time and trainable parameters.

## Related

- `../ClassificationFineTuning/classificationFineTuning.md` — the pipeline LoRA plugs into.
- `../InstructionFineTuning/instructionFineTuning.md` — LoRA for instruction tuning (the book's suggested exercise).
- `../../Architecture/AttentionMechanisms/attentionMechanisms.md` — the projections LoRA usually targets.
- `../../Training/TrainingLoopExtras/trainingLoopExtras.md` — schedules for adapter training.
- `../../../HandsOnLLM/TrainingAndFineTuning/FineTuningGenerationModels/fineTuningGenerationModels.md` — LoRA and QLoRA with libraries.
- `../../../AIEngineering/Adaptation/Finetuning/finetuning.md` — PEFT trade-offs and memory math.
