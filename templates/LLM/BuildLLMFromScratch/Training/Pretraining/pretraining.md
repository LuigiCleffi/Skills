---
name: llm-scratch-pretraining
description: "Pretraining a GPT-style model on unlabeled text: next-token cross-entropy loss over flattened logits, perplexity, train/validation split and loader-level loss, a simple training loop with AdamW, periodic evaluation and sample generation, tokens-seen tracking, overfitting and memorization on small corpora, decoding with temperature scaling, top-k sampling and an end-of-sequence stop, saving and loading model and optimizer state_dict, and loading OpenAI GPT-2 weights with shape-checked assignment, based on Chapter 5 (Pretraining on unlabeled data) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when writing an LLM training or evaluation loop, computing language-model loss or perplexity, diagnosing diverging train and validation loss, choosing temperature or top-k, checkpointing and resuming training, or loading pretrained weights into a custom architecture."
---

# Pretraining on Unlabeled Data

Pretraining minimizes next-token cross-entropy on raw text; track it on a held-out split, look at generated samples as you go, and checkpoint both model and optimizer. For anything beyond learning, load open pretrained weights instead of paying for pretraining.

## Loss and perplexity

- Logits are `(b, T, vocab)`, targets `(b, T)`. Flatten to `(b*T, vocab)` and `(b*T,)` and call `F.cross_entropy`: it applies log-softmax, picks the target token's log-probability, averages and negates.
- **Perplexity** = `exp(loss)`: roughly the number of tokens the model is choosing among at each step. An untrained GPT-2-sized model sits near the vocabulary size; lower is better.
- Compare losses only between runs using the same tokenizer and evaluation text.

```python
import torch
import torch.nn.functional as F

def calc_loss_batch(inputs, targets, model, device):
    inputs, targets = inputs.to(device), targets.to(device)
    logits = model(inputs)
    return F.cross_entropy(logits.flatten(0, 1), targets.flatten())

def calc_loss_loader(loader, model, device, num_batches=None):
    if len(loader) == 0:
        return float("nan")
    num_batches = min(num_batches or len(loader), len(loader))
    total = 0.0
    for i, (x, y) in enumerate(loader):
        if i >= num_batches:
            break
        total += calc_loss_batch(x, y, model, device).item()
    return total / num_batches

perplexity = lambda loss: torch.exp(torch.tensor(loss)).item()
```

## Splits and the training loop

- Split the text (for example 90% train, 10% validation) **before** windowing so no window spans both. Check each split has at least one full `context_length` window.
- The loop is standard deep learning: `train()`, forward, loss, `zero_grad`, `backward`, `step`; every `eval_freq` steps, compute train and validation loss on a few batches under `eval()` and `no_grad()`, then print a short generated sample.
- Track **tokens seen** alongside epochs; it is the natural x-axis for LLM training curves.
- Use **AdamW** (Adam with decoupled weight decay); the book's small run uses `lr=4e-4, weight_decay=0.1`.

```python
def train(model, train_loader, val_loader, optimizer, device, num_epochs, eval_freq, eval_iter):
    history, tokens_seen, step = [], 0, 0
    for epoch in range(num_epochs):
        model.train()
        for x, y in train_loader:
            optimizer.zero_grad()
            loss = calc_loss_batch(x, y, model, device)
            loss.backward()
            optimizer.step()
            tokens_seen += x.numel()
            step += 1
            if step % eval_freq == 0:
                model.eval()
                with torch.no_grad():
                    tr = calc_loss_loader(train_loader, model, device, eval_iter)
                    va = calc_loss_loader(val_loader, model, device, eval_iter)
                model.train()
                history.append((step, tokens_seen, tr, va))
    return history
```

## Reading the curves

| Pattern | Meaning | Action |
|---|---|---|
| Both losses fall together | learning | continue |
| Train keeps falling, validation flattens or rises | overfitting; on tiny corpora the model memorizes passages verbatim | more data, fewer epochs, more dropout or weight decay |
| Loss flat from the start | broken loop, learning rate too low, or labels not shifted | overfit one batch to debug |
| Loss spikes or NaN | learning rate too high, bad batch | lower LR, warmup, gradient clipping |

## Decoding strategies

- **Greedy** (`argmax`) is deterministic and repetitive.
- **Temperature**: divide logits by `T` before softmax and sample with `torch.multinomial`. `T < 1` sharpens toward greedy; `T > 1` flattens and increases odd outputs.
- **Top-k**: keep the `k` largest logits, set the rest to `-inf`, then apply temperature and sample. It cuts the long tail of nonsense tokens.
- Stop early on an end-of-sequence token.

```python
def generate(model, idx, max_new_tokens, context_size, temperature=0.0, top_k=None, eos_id=None):
    model.eval()
    for _ in range(max_new_tokens):
        with torch.no_grad():
            logits = model(idx[:, -context_size:])[:, -1, :]
        if top_k is not None:
            kth = torch.topk(logits, top_k).values[:, -1:]
            logits = logits.masked_fill(logits < kth, float("-inf"))
        if temperature > 0.0:
            probs = torch.softmax(logits / temperature, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
        else:
            idx_next = logits.argmax(dim=-1, keepdim=True)
        if eos_id is not None and (idx_next == eos_id).all():
            break
        idx = torch.cat([idx, idx_next], dim=1)
    return idx
```

## Checkpoints and pretrained weights

- Save `model.state_dict()`; to resume training also save `optimizer.state_dict()` (AdamW keeps per-parameter moments; losing them disrupts training). Load with `map_location=device`, then call `eval()` for inference or `train()` to continue.
- To use OpenAI GPT-2 weights: match the architecture exactly (context length 1,024, `qkv_bias=True`, the size's dims), then copy each tensor with a helper that raises on shape mismatch. The checkpoint stores fused QKV weights and transposed matrices that must be split and transposed, and the output head is tied to the token embedding.
- Proof of a correct load is coherent generated text and a sensible validation loss; a single mistake produces gibberish.

**Current note:** real pretraining now runs on trillions of tokens with mixed precision, distributed training and data-quality filtering; the loop shape is the same. Most projects load weights from a model hub (often via Hugging Face libraries) rather than the original GPT-2 files; safetensors is the common safe format. Prefer `torch.load(..., weights_only=True)` for checkpoints you did not create.

## Workflow

1. Split raw text into train and validation; build loaders; confirm both are non-empty.
2. Compute initial losses; expect roughly `ln(vocab_size)` for an untrained model.
3. Overfit a single batch to near-zero loss to prove the loop.
4. Train with AdamW, periodic eval, sample generation and tokens-seen tracking; plot both curves.
5. Pick decoding settings (temperature, top-k) on validation prompts, not training text.
6. Checkpoint model and optimizer; for real use, load pretrained weights with shape-checked assignment.

## Red flags

- Loss computed on unflattened tensors or with targets not shifted.
- Evaluation without `eval()`/`no_grad()`; validation reused for hyperparameter tuning and reported as final.
- Judging success only by training loss; samples that are verbatim training passages.
- Sampling with `temperature=0` through softmax (division by zero) instead of switching to argmax.
- Checkpoints without optimizer state when training will resume; loading untrusted pickles.
- Pretrained weights assigned without shape checks, or with config mismatches (bias, context length, tying).

## Testing notes

- tdd: loss of a model that outputs uniform logits equals `ln(vocab_size)`; perplexity equals `vocab_size`.
- Hand-check `cross_entropy` on a 2-token, 3-word example against `-log(p_target)`.
- `generate` tests: `temperature=0` is deterministic; with `top_k=1` sampling equals greedy; output never exceeds `prompt + max_new_tokens`; stops at `eos_id`.
- Seeded sampling test: same `torch.manual_seed` gives the same sample.
- Checkpoint round trip: save, load into a fresh model, assert identical logits on a fixed input.
- Regression eval: fixed validation text and seed; alert when loss rises beyond a tolerance between commits.

## Related

- `../../Architecture/GPTModel/gptModel.md` — the model being trained.
- `../TrainingLoopExtras/trainingLoopExtras.md` — warmup, cosine decay, gradient clipping.
- `../../Foundations/WorkingWithTextData/workingWithTextData.md` — the windowed loaders.
- `../../FineTuning/InstructionFineTuning/instructionFineTuning.md` — reusing this loop on instruction data.
- `../../../AIEngineering/Foundations/FoundationModels/foundationModels.md` — sampling and pretraining at scale.
- `../../../HandsOnLLM/UsingPretrainedModels/AdvancedTextGeneration/advancedTextGeneration.md` — generation in practice.
- `../../../DesigningMLSystems/Modeling/ModelDevelopment/modelDevelopment.md` — experiment tracking and evaluation.
