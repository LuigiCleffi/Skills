---
name: llm-scratch-training-loop-extras
description: "Stabilizing LLM training loops: linear learning-rate warmup, cosine decay to a minimum learning rate, gradient clipping by global norm, combining them in one per-step schedule, and logging learning rate and gradient norms, based on Appendix D (Adding bells and whistles to the training loop) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when a transformer's loss spikes or diverges early, gradients explode or produce NaN, choosing a learning-rate schedule for pretraining or fine-tuning, adding clip_grad_norm_, setting warmup steps, or reviewing a training loop that only uses a constant learning rate."
---

# Training Loop Extras

Three small additions make LLM training markedly more stable: warm the learning rate up from a small value, decay it along a cosine curve, and clip the global gradient norm. Implement them as a per-step function of the step index so the schedule is explicit, logged and testable.

## Learning-rate warmup

- Early updates come from randomly initialized weights and noisy gradients; a full learning rate at step 0 can push the model somewhere it never recovers from.
- Increase the learning rate linearly from a small initial value to the peak over a warmup period (commonly a small fraction of total steps).
- Warmup matters most for large models, large peak learning rates and Adam-style optimizers.

## Cosine decay

- After warmup, lower the learning rate along half a cosine from the peak to a minimum. Large steps early explore; small steps late settle into a good region.
- Decay to a floor rather than zero so the last steps still learn.
- The schedule depends on the total number of steps: compute `total_steps = epochs * len(train_loader)` up front.

## Gradient clipping

- Rescale all gradients so their combined L2 norm does not exceed `max_norm` (1.0 is a common default). The direction is kept; only the size is capped.
- Clip **after** `loss.backward()` and **before** `optimizer.step()`.
- Clipping prevents a single bad batch from blowing up the weights; it does not fix a learning rate that is simply too high.

```python
import math
import torch

def lr_at(step, total_steps, warmup_steps, peak_lr, initial_lr, min_lr):
    if step < warmup_steps:
        return initial_lr + (peak_lr - initial_lr) * step / warmup_steps
    progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
    return min_lr + 0.5 * (peak_lr - min_lr) * (1 + math.cos(math.pi * progress))

def train_with_schedule(model, train_loader, optimizer, device, num_epochs,
                        peak_lr=5e-4, initial_lr=1e-5, min_lr=1e-5, warmup_frac=0.1, max_norm=1.0):
    total_steps = num_epochs * len(train_loader)
    warmup_steps = int(warmup_frac * total_steps)
    step, log = 0, []
    for _ in range(num_epochs):
        model.train()
        for x, y in train_loader:
            lr = lr_at(step, total_steps, warmup_steps, peak_lr, initial_lr, min_lr)
            for group in optimizer.param_groups:
                group["lr"] = lr
            optimizer.zero_grad()
            logits = model(x.to(device))
            loss = torch.nn.functional.cross_entropy(logits.flatten(0, 1), y.to(device).flatten())
            loss.backward()
            grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)
            optimizer.step()
            log.append((step, lr, loss.item(), grad_norm.item()))
            step += 1
    return log
```

- The book applies clipping only once warmup is over; clipping from step 0 is also common. Pick one and keep it consistent across runs.
- Log the learning rate and the pre-clipping gradient norm every step; most training incidents are visible there first.

## Choosing values

| Knob | Starting point | Adjust when |
|---|---|---|
| Warmup length | a few percent to about a tenth of total steps | early spikes persist: lengthen |
| Peak LR | the value that worked with a constant schedule, or a bit higher | divergence: lower; slow progress: raise |
| Minimum LR | about a tenth of peak or the initial warmup value | late loss plateaus high: lower |
| Clip norm | 1.0 | grad norms routinely clipped: investigate LR or data |

**Current note:** PyTorch ships schedulers (`torch.optim.lr_scheduler.LambdaLR`, `CosineAnnealingLR`, `LinearLR`, `SequentialLR`) and training frameworks expose warmup-plus-cosine as a setting; using them is fine, but keep the schedule a pure function you can unit test. Other schedules (for example warmup then constant, then a short decay) are also in use for long runs.

## Workflow

1. Compute total steps from epochs and loader length before training.
2. Choose initial, peak and minimum learning rates and the warmup length.
3. Implement the schedule as a pure function of the step; plot it before training.
4. Set the learning rate on every parameter group each step.
5. Add `clip_grad_norm_` between `backward` and `step`; log the returned norm.
6. Compare loss curves against the constant-LR baseline with the same seed.

## Red flags

- Constant learning rate for a transformer that spikes early.
- Clipping before `backward` (no effect) or after `step` (too late).
- Schedule computed per epoch when it should be per step, or `total_steps` that ignores gradient accumulation.
- Learning-rate scheduler stepped and manual LR assignment both active (double updates).
- Gradient norms or LR not logged, so instabilities cannot be diagnosed.
- Clipping so tight that every step is clipped (effectively a lower LR in disguise).

## Testing notes

- tdd: `lr_at(0)` equals `initial_lr`; `lr_at(warmup_steps)` equals `peak_lr`; `lr_at(total_steps)` equals `min_lr`; the sequence is monotonic within each phase.
- Clipping test: with huge synthetic gradients, the global norm after clipping is at most `max_norm` (within tolerance); with small gradients they are unchanged.
- Integration test: on a tiny model and batch, scheduled training with a fixed seed reaches lower loss than a deliberately too-high constant LR, and never produces NaN.
- Keep the step log as an artifact so regressions in the schedule are visible in review.

## Related

- `../Pretraining/pretraining.md` — the base training loop these extras plug into.
- `../../Foundations/IntroductionToPyTorch/introductionToPyTorch.md` — optimizer and gradient basics.
- `../../FineTuning/InstructionFineTuning/instructionFineTuning.md` and `../../FineTuning/LoRA/loRA.md` — loops that benefit from the same schedule.
- `../../../AIEngineering/Adaptation/Finetuning/finetuning.md` — fine-tuning hyperparameters in practice.
- `../../../DesigningMLSystems/Modeling/ModelDevelopment/modelDevelopment.md` — tracking experiments and debugging training.
