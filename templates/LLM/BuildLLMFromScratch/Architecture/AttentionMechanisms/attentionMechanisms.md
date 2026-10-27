---
name: llm-scratch-attention-mechanisms
description: "Attention in code: why attention replaced RNN encoder-decoders for long sequences, attention scores via dot products, softmax-normalized attention weights, context vectors, scaled dot-product self-attention with query, key and value projections, causal (masked) attention with an upper-triangular -inf mask, dropout on attention weights, register_buffer for masks, and multi-head attention with weight splits, transposes and an output projection, based on Chapter 3 (Coding attention mechanisms) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when implementing or reviewing self-attention or multi-head attention, adding a causal mask, debugging attention shapes, head_dim or d_out divisibility, future-token leakage, NaNs from masking, or device errors with mask tensors."
---

# Attention Mechanisms

Self-attention turns each token's embedding into a context vector: a weighted sum over the value vectors of the tokens it is allowed to see, with weights from scaled query-key similarity. For a GPT-style model, add a causal mask so no position sees the future, and split the work into heads with one batched matmul.

## Why attention

- RNN encoder-decoders squeeze the whole input into one hidden state; long inputs lose context.
- Attention lets every output position access every input position directly, weighted by relevance. *Self*-attention relates positions within one sequence.

## From scores to context vectors

1. **Scores**: dot product of a query with every key (`Q @ K.T`); a higher dot product means more similar.
2. **Scale**: divide by `sqrt(d_k)` (key dimension). Large dot products push softmax into regions with tiny gradients; scaling keeps training stable. Hence "scaled dot-product attention".
3. **Weights**: `softmax(dim=-1)` across keys so each row sums to 1. Use `torch.softmax`, not a naive `exp/sum`, which overflows.
4. **Context**: `weights @ V`.

- `W_query`, `W_key`, `W_value` are trainable projections; implement them as `nn.Linear(d_in, d_out, bias=qkv_bias)` for better initialization than raw `nn.Parameter(torch.rand(...))`. Note `nn.Linear` stores its weight transposed.
- Distinguish *weight parameters* (learned, fixed after training) from *attention weights* (computed per input).

## Causal masking

- Mask scores above the diagonal with `-inf` **before** softmax; softmax turns them into exact zeros and the remaining weights renormalize over allowed positions only. There is no leakage from masked positions.
- Masking after softmax with zeros and then renormalizing gives the same result but costs an extra step.
- Store the mask with `register_buffer` so it moves with the model to the right device and is saved with it, but is not trained.
- Slice the stored mask to the current sequence length: `mask[:T, :T]`.

## Dropout in attention

- Apply dropout to the attention weights (the common variant) during training only; surviving values are scaled by `1/(1-p)`. Use small rates such as 0.1 for GPT training; `model.eval()` disables it.

## Multi-head attention

- Several heads attend in parallel with separate projections, each learning different relationships; outputs are concatenated.
- Do not stack separate single-head modules (one matmul per head). Instead project once to `d_out`, view as `(b, T, num_heads, head_dim)`, transpose to `(b, num_heads, T, head_dim)`, attend batched, transpose back, flatten, then apply an output projection.
- `d_out` must be divisible by `num_heads`. GPT-2 small: 12 heads, 768 dims, context 1,024, and `d_in == d_out`.

```python
import torch
import torch.nn as nn

class MultiHeadAttention(nn.Module):
    def __init__(self, d_in, d_out, context_length, dropout, num_heads, qkv_bias=False):
        super().__init__()
        assert d_out % num_heads == 0, "d_out must be divisible by num_heads"
        self.d_out, self.num_heads = d_out, num_heads
        self.head_dim = d_out // num_heads
        self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_key = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.out_proj = nn.Linear(d_out, d_out)
        self.dropout = nn.Dropout(dropout)
        self.register_buffer(
            "mask", torch.triu(torch.ones(context_length, context_length), diagonal=1).bool())

    def forward(self, x):
        b, T, _ = x.shape
        def split(t):  # (b, T, d_out) -> (b, heads, T, head_dim)
            return t.view(b, T, self.num_heads, self.head_dim).transpose(1, 2)
        q, k, v = split(self.W_query(x)), split(self.W_key(x)), split(self.W_value(x))
        scores = q @ k.transpose(2, 3)                       # (b, heads, T, T)
        scores = scores.masked_fill(self.mask[:T, :T], float("-inf"))
        weights = torch.softmax(scores / self.head_dim ** 0.5, dim=-1)
        weights = self.dropout(weights)
        context = (weights @ v).transpose(1, 2).contiguous().view(b, T, self.d_out)
        return self.out_proj(context)

torch.manual_seed(123)
mha = MultiHeadAttention(d_in=768, d_out=768, context_length=1024, dropout=0.0, num_heads=12)
x = torch.randn(2, 6, 768)
assert mha(x).shape == (2, 6, 768)
```

**Current note:** production code calls a fused kernel (`torch.nn.functional.scaled_dot_product_attention` with `is_causal=True`) rather than materializing the `T x T` matrix, and many newer models share key/value heads across query heads (grouped-query attention) and cache keys and values during generation. Keep the explicit version as the reference implementation that tests compare against.

## Workflow

1. Write the single-query version by hand on a tiny input to understand scores, weights and context.
2. Vectorize to all positions with matrix multiplication.
3. Add trainable `nn.Linear` projections and `sqrt(d_k)` scaling.
4. Add the causal mask as a buffer, sliced to the sequence length; add dropout on weights.
5. Generalize to heads with view/transpose and an output projection; assert `d_out % num_heads == 0`.
6. Verify against a reference (a loop over heads, or the fused PyTorch function) on random input.

## Red flags

- No causal mask in a generative model, or a mask built with `diagonal=0` (hides the token itself).
- Masking with 0 before softmax instead of `-inf`; masking after softmax without renormalizing.
- Scaling by `d_out` or not at all instead of `sqrt(head_dim)`.
- Softmax over the wrong dimension (rows must sum to 1 over keys).
- Mask created as a plain attribute (wrong device, missing from `state_dict`), or created per forward call at full size.
- `.view` after `.transpose` without `.contiguous()`; heads concatenated in the wrong order.
- Dropout left active at inference.

## Testing notes

- Shape tests: `(b, T, d_in) -> (b, T, d_out)` for several `T` up to `context_length`; error for `T > context_length`.
- Causality test: change tokens after position `t` and assert outputs at positions `<= t` are unchanged (with dropout 0).
- Weights test: each row of the attention weights sums to 1 and is zero above the diagonal.
- Equivalence test: multi-head output equals a per-head loop, or `scaled_dot_product_attention(..., is_causal=True)` followed by the same output projection, within `torch.testing.assert_close` tolerance.
- Determinism: fixed seed and `dropout=0.0` give identical outputs across runs.

## Related

- `../../Foundations/WorkingWithTextData/workingWithTextData.md` — the embeddings attention consumes.
- `../GPTModel/gptModel.md` — attention inside the transformer block.
- `../../FineTuning/ClassificationFineTuning/classificationFineTuning.md` — why the last token sees the whole input.
- `../../FineTuning/LoRA/loRA.md` — adapting the attention projections cheaply.
- `../../../HandsOnLLM/UnderstandingLanguageModels/LookingInsideLLMs/lookingInsideLLMs.md` — attention variants and KV caching in real models.
- `../../../AIEngineering/Production/InferenceOptimization/inferenceOptimization.md` — attention cost at serving time.
