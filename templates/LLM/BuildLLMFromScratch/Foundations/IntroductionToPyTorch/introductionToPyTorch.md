---
name: llm-scratch-introduction-to-pytorch
description: "PyTorch essentials for building LLMs: tensors, dtypes and shapes, reshape vs view, matrix multiplication, computation graphs and autograd, nn.Module models returning logits, counting trainable parameters, Dataset and DataLoader (shuffle, drop_last, num_workers), and the standard training loop with train/eval modes, zero_grad, backward, optimizer step and no_grad evaluation, based on Appendix A (Introduction to PyTorch) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when writing or reviewing PyTorch model or training code, defining an nn.Module, building data loaders, debugging shape, dtype or device errors, gradients that are None or accumulate, dropout active at inference, or setting up reproducible seeds."
---

# Introduction to PyTorch

PyTorch gives you three things: a GPU-capable tensor library, automatic differentiation over a dynamic computation graph, and building blocks (modules, losses, optimizers, data loaders) for deep learning. An LLM is just these pieces composed at scale, so write small, shape-checked modules and a boring, correct training loop.

## Tensors

- Python floats become `float32` by default (a good precision/speed balance); Python ints become `int64`. Token IDs must be integer tensors; weights and activations are floating point.
- Change precision or device with `.to(dtype)` / `.to(device)`; every tensor in an operation must share a device.
- `x.shape` is the first thing to print when debugging. Reshape with `.view` (needs contiguous memory, no copy) or `.reshape` (copies when needed). After `.transpose`, call `.contiguous()` before `.view`.
- `x.T` transposes a matrix; `a @ b` (or `a.matmul(b)`) multiplies matrices and batches over leading dimensions.

## Computation graphs and autograd

- When any leaf tensor has `requires_grad=True`, PyTorch records operations into a graph as they run.
- `loss.backward()` fills `.grad` on every leaf parameter by the chain rule; you never write derivatives.
- Gradients **accumulate** across `backward` calls; reset them each step with `optimizer.zero_grad()`.
- Wrap inference and evaluation in `torch.no_grad()` so no graph is built (saves memory and time).

## Models as nn.Module

- Define layers in `__init__`, the computation in `forward`; call `model(x)`, not `model.forward(x)`.
- Return **logits** (no final softmax): PyTorch losses like `cross_entropy` combine log-softmax and negative log-likelihood for numerical stability. Apply `softmax` only when you need probabilities.
- Class labels for `cross_entropy` must be integers starting at 0.
- `nn.Sequential` is fine for straight stacks; use explicit `forward` when there are shortcuts or branches.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MLP(nn.Module):
    def __init__(self, num_inputs, num_outputs):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(num_inputs, 30), nn.ReLU(),
            nn.Linear(30, 20), nn.ReLU(),
            nn.Linear(20, num_outputs),          # logits
        )

    def forward(self, x):
        return self.layers(x)

torch.manual_seed(123)
model = MLP(50, 3)
num_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
assert num_params == (50*30 + 30) + (30*20 + 20) + (20*3 + 3)
```

## Data loading

- A `Dataset` defines `__len__` and `__getitem__` (one example); a `DataLoader` batches, shuffles and parallelizes.
- `shuffle=True` for training only; `drop_last=True` avoids a tiny final batch that destabilizes updates.
- `num_workers=0` loads in the main process: simplest and fine for small data or notebooks; raise it when the GPU waits on data, and beware of notebook crashes with worker processes.
- Seed with `torch.manual_seed` for reproducible shuffling and initialization.

## The training loop

```python
X = torch.randn(64, 50)
y = torch.randint(0, 3, (64,))
loader = torch.utils.data.DataLoader(
    torch.utils.data.TensorDataset(X, y), batch_size=16, shuffle=True, drop_last=True)
optimizer = torch.optim.SGD(model.parameters(), lr=0.5)

for epoch in range(3):
    model.train()                       # enable dropout etc.
    for features, labels in loader:
        logits = model(features)
        loss = F.cross_entropy(logits, labels)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

model.eval()                            # disable dropout for evaluation
with torch.no_grad():
    preds = model(X).argmax(dim=1)
accuracy = (preds == y).float().mean().item()
```

- Order per step: forward, loss, `zero_grad`, `backward`, `step`.
- `model.train()` / `model.eval()` toggle dropout and similar layers; forgetting `eval()` makes inference random.
- Compute accuracy over a whole loader with a helper, not one batch.
- Save `model.state_dict()` (and the optimizer state to resume training) rather than pickling the model object.

**Current note:** current PyTorch versions add conveniences the book's appendix only touches on or predates, such as mixed-precision training (bfloat16 autocast), `torch.compile`, and fused attention kernels. The core loop above is unchanged; check the installed version's documentation before using newer APIs.

## Workflow

1. Write the `Dataset` and check one item's shapes and dtypes.
2. Write the `nn.Module`; run one batch forward and assert the output shape.
3. Count trainable parameters and compare with a hand calculation.
4. Overfit a single small batch until loss is near zero to prove the loop and gradients work.
5. Train with seeded, shuffled loaders; evaluate under `eval()` and `no_grad()`.
6. Move model and batches to the same device; save `state_dict` checkpoints.

## Red flags

- Missing `zero_grad` (gradients pile up) or calling it after `backward`.
- Softmax applied before `cross_entropy`; labels starting at 1 or stored as floats.
- Evaluation without `model.eval()` or without `torch.no_grad()`.
- `.view` after `.transpose` without `.contiguous()`; silent broadcasting that hides a shape bug.
- Tensors on mixed devices; `.item()` or `.cpu()` inside the hot loop for every step.
- No seed, so results cannot be reproduced.

## Testing notes

- tdd: shape tests for every module (`assert out.shape == (batch, ...)`) with tiny dimensions so they run in milliseconds on CPU.
- Gradient check: after one `backward`, assert every trainable parameter has a non-None, finite `.grad`.
- Overfit-one-batch test: loss must fall well below its starting value within a few dozen steps.
- Determinism test: same seed, same data order and same first-step loss.
- Use `torch.testing.assert_close` for numeric comparisons, never exact float equality.

## Related

- `../WorkingWithTextData/workingWithTextData.md` — a Dataset for next-token windows.
- `../../Architecture/GPTModel/gptModel.md` — a full model built from these pieces.
- `../../Training/Pretraining/pretraining.md` — the LLM version of this loop.
- `../../Training/TrainingLoopExtras/trainingLoopExtras.md` — warmup, cosine decay, clipping.
- `../../../DesigningMLSystems/Modeling/ModelDevelopment/modelDevelopment.md` — experiment tracking and debugging models.
- `../../../../TDD/README.md` — test-first habits for the plumbing around models.
