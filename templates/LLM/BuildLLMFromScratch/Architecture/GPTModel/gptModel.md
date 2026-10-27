---
name: llm-scratch-gpt-model
description: "Implementing a GPT-2-style decoder-only model: the config dictionary (vocab, context length, embedding size, heads, layers, dropout, qkv bias), layer normalization with scale and shift, GELU feed-forward with 4x expansion, shortcut (residual) connections, the Pre-LayerNorm transformer block, the full GPTModel with token and positional embeddings and an output head, parameter counts, weight tying, memory footprint, and greedy text generation with context cropping, based on Chapter 4 (Implementing a GPT model from scratch to generate text) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when building or reviewing a transformer block or GPT architecture, sizing a model's parameters or memory, debugging vanishing gradients or unstable training, writing a basic generation loop, or comparing GPT-2 small, medium, large and XL configurations."
---

# Implementing a GPT Model

A GPT model is embeddings, a stack of identical transformer blocks, a final norm and a linear head that produces one logit per vocabulary entry at every position. Build it from small, separately tested parts and drive every size from one config dictionary.

## Configuration

```python
GPT_CONFIG_124M = {
    "vocab_size": 50257, "context_length": 1024, "emb_dim": 768,
    "n_heads": 12, "n_layers": 12, "drop_rate": 0.1, "qkv_bias": False,
}
```

| GPT-2 size | emb_dim | n_layers | n_heads |
|---|---|---|---|
| small (124M) | 768 | 12 | 12 |
| medium (355M) | 1024 | 24 | 16 |
| large (774M) | 1280 | 36 | 20 |
| XL (1558M) | 1600 | 48 | 25 |

## Building blocks

- **LayerNorm** normalizes each token's vector over the embedding dimension to mean 0 and variance 1, then applies a trainable scale and shift. Add a small `eps` to the variance; the book uses the biased variance (`unbiased=False`), matching GPT-2. It stabilizes deep training.
- **GELU** is a smooth activation (small non-zero output for negative inputs) that optimizes better than ReLU here.
- **Feed-forward**: `Linear(emb, 4*emb) -> GELU -> Linear(4*emb, emb)`; expand, apply nonlinearity, contract back.
- **Shortcut connections** add a sublayer's input to its output. Without them, gradients in deep stacks shrink toward zero in early layers (vanishing gradients).
- **Transformer block (Pre-LayerNorm)**: `x = x + drop(attn(norm1(x)))`, then `x = x + drop(ff(norm2(x)))`. Normalizing before each sublayer trains better than the original transformer's Post-LayerNorm. Shape is preserved: `(b, T, emb)` in and out.

```python
import torch
import torch.nn as nn
# MultiHeadAttention as defined in the attention skill

class LayerNorm(nn.Module):
    def __init__(self, emb_dim, eps=1e-5):
        super().__init__()
        self.eps = eps
        self.scale = nn.Parameter(torch.ones(emb_dim))
        self.shift = nn.Parameter(torch.zeros(emb_dim))

    def forward(self, x):
        mean = x.mean(dim=-1, keepdim=True)
        var = x.var(dim=-1, keepdim=True, unbiased=False)
        return self.scale * (x - mean) / torch.sqrt(var + self.eps) + self.shift

class FeedForward(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        d = cfg["emb_dim"]
        self.layers = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(approximate="tanh"), nn.Linear(4 * d, d))

    def forward(self, x):
        return self.layers(x)

class TransformerBlock(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.att = MultiHeadAttention(cfg["emb_dim"], cfg["emb_dim"], cfg["context_length"],
                                      cfg["drop_rate"], cfg["n_heads"], cfg["qkv_bias"])
        self.ff = FeedForward(cfg)
        self.norm1, self.norm2 = LayerNorm(cfg["emb_dim"]), LayerNorm(cfg["emb_dim"])
        self.drop = nn.Dropout(cfg["drop_rate"])

    def forward(self, x):
        x = x + self.drop(self.att(self.norm1(x)))
        return x + self.drop(self.ff(self.norm2(x)))

class GPTModel(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.tok_emb = nn.Embedding(cfg["vocab_size"], cfg["emb_dim"])
        self.pos_emb = nn.Embedding(cfg["context_length"], cfg["emb_dim"])
        self.drop_emb = nn.Dropout(cfg["drop_rate"])
        self.trf_blocks = nn.Sequential(*[TransformerBlock(cfg) for _ in range(cfg["n_layers"])])
        self.final_norm = LayerNorm(cfg["emb_dim"])
        self.out_head = nn.Linear(cfg["emb_dim"], cfg["vocab_size"], bias=False)

    def forward(self, idx):
        T = idx.shape[1]
        x = self.tok_emb(idx) + self.pos_emb(torch.arange(T, device=idx.device))
        x = self.trf_blocks(self.drop_emb(x))
        return self.out_head(self.final_norm(x))      # (b, T, vocab_size) logits
```

## Size and memory

- With separate embedding and output matrices, the 124M config has about 163M parameters; GPT-2 reaches 124M by **weight tying** (reusing the token embedding matrix as the output head, both `50257 x 768`).
- Tying saves memory; the book found separate layers train better, and many modern models keep them separate. Tie when loading weights that were trained tied.
- Memory for weights alone is `params x bytes per param`: about 620 MB for 163M parameters in float32. Training needs several times more (gradients, optimizer state, activations).

## Greedy generation

- Generation loops: crop the context to the last `context_length` tokens, run the model, take logits of the **last** position, pick the next token, append, repeat.
- Greedy decoding takes `argmax`; softmax is unnecessary for argmax because it preserves order. Sampling strategies come in the pretraining skill.
- An untrained model produces gibberish; that proves plumbing, not quality.

```python
def generate_greedy(model, idx, max_new_tokens, context_size):
    model.eval()
    for _ in range(max_new_tokens):
        with torch.no_grad():
            logits = model(idx[:, -context_size:])[:, -1, :]
        idx = torch.cat([idx, logits.argmax(dim=-1, keepdim=True)], dim=1)
    return idx
```

**Current note:** recent open decoder-only models keep this skeleton but commonly swap LayerNorm for RMSNorm, GELU feed-forward for gated variants such as SwiGLU, learned absolute positions for rotary embeddings, and drop biases and dropout. Treat those as config-level swaps of the same block structure.

## Workflow

1. Write the config; derive all dimensions from it.
2. Implement and shape-test LayerNorm, FeedForward and attention separately.
3. Assemble the Pre-LN block; assert the block preserves shape.
4. Assemble GPTModel; assert logits are `(b, T, vocab_size)`.
5. Count parameters and estimate memory; compare with the known size for the config.
6. Run greedy generation on a prompt to verify the loop end to end, then train.

## Red flags

- Post-LN ordering by accident, or a missing residual around either sublayer.
- Normalizing over the batch or sequence dimension instead of the last (embedding) dimension.
- Softmax inside `forward`; the model should return logits.
- `torch.arange` positions created on CPU while the model runs on GPU.
- No context cropping in generation, so inputs exceed `context_length` and position lookup fails.
- Hard-coded sizes instead of config values; weight tying assumed when loading untied weights (or the reverse).

## Testing notes

- Shape tests per module with a tiny config (for example `emb_dim=32, n_heads=4, n_layers=2, vocab_size=100, context_length=16`) so tests run in milliseconds.
- LayerNorm test: output mean about 0 and variance about 1 along the last dimension (before scale and shift change).
- Parameter-count test against a hand-computed formula for the tiny config.
- Residual/gradient test: after one backward pass, the first block's parameters have non-zero gradients.
- Generation test: with a fixed seed, greedy output is deterministic and has length `prompt + max_new_tokens`.
- Causality end to end: altering a later token does not change logits at earlier positions in `eval()` mode.

## Related

- `../AttentionMechanisms/attentionMechanisms.md` — the MultiHeadAttention used here.
- `../../Training/Pretraining/pretraining.md` — training this model and sampling with temperature and top-k.
- `../../FineTuning/ClassificationFineTuning/classificationFineTuning.md` — replacing `out_head` with a classifier.
- `../../Foundations/IntroductionToPyTorch/introductionToPyTorch.md` — nn.Module and parameter counting.
- `../../../HandsOnLLM/UnderstandingLanguageModels/LookingInsideLLMs/lookingInsideLLMs.md` — the forward pass of production models.
- `../../../AIEngineering/Foundations/FoundationModels/foundationModels.md` — model size, architecture and scaling choices.
