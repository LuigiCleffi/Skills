---
name: hollm-looking-inside-llms
description: "How a decoder-only Transformer LLM produces text: autoregressive token-by-token generation, the tokenizer to Transformer blocks to LM head forward pass, decoding strategy (greedy versus sampling), parallel token streams and context length, the KV cache, attention (query, key, value, relevance scoring, multi-head), the feedforward network as memory, and recent improvements (sparse and sliding-window attention, multi-query and grouped-query attention, Flash Attention, pre-normalization with RMSNorm, SwiGLU, rotary positional embeddings, sequence packing), based on Chapter 3 (Looking Inside Large Language Models) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when reasoning about generation latency or memory, choosing generate() options like use_cache or max_new_tokens, inspecting a model's architecture or logits, explaining why streaming is needed, comparing models by attention variant or context length, or debugging shapes of hidden states and LM head outputs."
---

# Looking Inside Large Language Models

A generative LLM is a loop: tokenize, run one forward pass, score every vocabulary token, pick one, append it, repeat. Latency, memory and output quality all follow from this loop, so reason about it explicitly when building or operating LLM features.

## The forward pass

| Stage | What it does | Shape (batch 1, n tokens) |
|---|---|---|
| Tokenizer + embedding lookup | Text to IDs to vectors | `[1, n]` to `[1, n, d_model]` |
| Stack of Transformer blocks | Attention + feedforward per block, repeated tens of times | `[1, n, d_model]` |
| LM head | Linear layer from `d_model` to vocabulary scores | `[1, n, vocab]` |

- Only the last position's scores choose the next token; earlier positions matter because attention reads their intermediate states.
- The LM head is one possible head; sequence-classification and token-classification heads reuse the same body (ch4, ch11).
- `print(model)` shows embedding size, block count, attention projections and the head; inspect it before fine-tuning or quantizing.

```python
ids = tokenizer("The capital of France is", return_tensors="pt").input_ids.to(model.device)
hidden = model.model(ids)[0]            # [1, n, d_model]
logits = model.lm_head(hidden)          # [1, n, vocab]
next_id = logits[0, -1].argmax(-1)
print(tokenizer.decode(next_id))
```

## Decoding

- Greedy (always argmax, equivalent to temperature 0) is deterministic and good for extraction and tests; it often reads flat or repetitive in open-ended writing.
- Sampling picks tokens in proportion to their probability; tune it with temperature and top-p (ch6).
- Generation stops at an end-of-sequence token or `max_new_tokens`; truncated outputs usually mean the cap was hit, not that the model finished.

## Context length and the KV cache

- Context length is the maximum number of token streams; prompt plus generated tokens must fit.
- Keys and values from earlier positions are cached so each new token needs only one new stream. In `transformers` the cache is on by default (`use_cache=True`); disabling it made the book's 100-token example several times slower.
- Even cached generation takes seconds for long outputs, which is why chat UIs stream tokens. Stream user-facing output.
- The cache grows with context length, layers and batch size; it is a main driver of serving memory.

## Inside a Transformer block

- **Feedforward network**: holds most of the parameters; stores and interpolates learned knowledge (completing a famous film title). Memorization is not a database: facts can be wrong or stale, so ground factual tasks with retrieval (ch8).
- **Attention**: mixes context into the current token's representation (resolving what "it" refers to). Two steps: score relevance (query of the current token against keys of previous tokens, softmax) and combine (weighted sum of values).
- **Multi-head**: several attention heads run in parallel with their own projections, capturing different patterns; outputs are concatenated and projected.
- Decoder attention is causal (only previous tokens); encoders like BERT are bidirectional.

## Architecture improvements worth recognizing

| Improvement | Effect | Why it matters to you |
|---|---|---|
| Sparse / sliding-window attention | Attend to a subset of positions | Longer context at lower cost; often interleaved with full attention |
| Multi-query attention | All heads share one K and V | Smaller KV cache, faster inference, some quality loss |
| Grouped-query attention (GQA) | Groups of heads share K/V | Most of MQA's savings with better quality; common in modern open models |
| Flash Attention | IO-aware exact attention on GPU memory hierarchy | Big speed and memory wins; enable when the backend supports it |
| Pre-norm + RMSNorm | Normalize before sublayers, cheaper norm | Faster, more stable training |
| SwiGLU activation | Replaces ReLU in the feedforward | Better quality per parameter |
| RoPE | Rotary positions applied to queries and keys in attention | Encodes relative position; works with sequence packing; basis of many context-extension methods |

- Sequence packing puts several short documents into one training context; positional schemes and attention masks must prevent cross-document leakage.
- **Current note:** these components remain the common core of open decoder models; mixture-of-experts feedforward layers and further KV-cache compression are now widespread, and serving engines add paged KV caches and continuous batching. Check a model card rather than assuming its internals.

## Workflow

1. Load the model and print it; record block count, hidden size, vocabulary size, attention type and maximum context.
2. Estimate token budget per request (prompt + `max_new_tokens`) against the context limit.
3. Keep `use_cache=True`; stream output for interactive use.
4. Choose decoding: greedy for deterministic tasks, sampling for creative ones.
5. When latency or memory is the problem, prefer models with GQA and backends with Flash Attention before buying hardware.
6. When facts matter, do not rely on the feedforward memory; add retrieval.

## Red flags

- `use_cache=False` left in production code, or hand-written generation loops that recompute the full prefix each step.
- Prompts that silently exceed the context window and get truncated.
- Treating model recall of facts as reliable without grounding.
- Taking logits from the wrong position (not `[:, -1]`) when scoring next tokens.
- Assuming a model is bidirectional (or causal) without checking its architecture.
- Non-streamed responses for long user-facing generations.

## Testing notes

- Shape tests on hidden states and logits (`[batch, seq, d_model]`, `[batch, seq, vocab]`) catch wiring mistakes cheaply; use a tiny randomly initialized config for fast unit tests.
- With greedy decoding, assert `generate` with and without cache produce the same tokens (equivalence test for cache code).
- Assert generation stops at `max_new_tokens` and that prompt plus output length never exceeds context.
- Measure latency per output token and time to first token as performance tests, on fixed hardware.

## Related

- `../TokensAndEmbeddings/tokensAndEmbeddings.md` — the first and last steps of the loop.
- `../../UsingPretrainedModels/PromptEngineering/promptEngineering.md` — temperature and top-p.
- `../../UsingPretrainedModels/AdvancedTextGeneration/advancedTextGeneration.md` — quantization and memory.
- `../../../BuildLLMFromScratch/Architecture/AttentionMechanisms/attentionMechanisms.md` — implementing attention.
- `../../../BuildLLMFromScratch/Architecture/GPTModel/gptModel.md` — implementing the block stack and generation loop.
- `../../../AIEngineering/Production/InferenceOptimization/inferenceOptimization.md` — KV cache and serving optimizations.
