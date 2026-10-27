---
name: aieng-inference-optimization
description: "Making foundation model inference faster and cheaper: compute-bound vs memory bandwidth-bound workloads, prefill vs decode, online vs batch APIs and streaming, performance metrics (latency, TTFT, TPOT, time between tokens, percentiles, throughput, goodput against an SLO, cost per request, MFU and MBU utilization), AI accelerators (FLOP/s, memory size and bandwidth, power), model-level optimization (quantization, distillation, pruning, speculative decoding, inference with reference, parallel decoding, attention and KV cache optimization, grouped-query attention, PagedAttention, kernels and compilers), and service-level optimization (static, dynamic and continuous batching, disaggregated prefill and decode, prompt and prefix caching, replica, tensor, pipeline, context and sequence parallelism), based on Chapter 9 (Inference Optimization) of Chip Huyen's AI Engineering. Use when setting latency SLOs, measuring or reducing TTFT and TPOT, estimating serving cost or GPU memory and KV cache size, choosing between batch and online APIs, configuring an inference server, enabling prompt caching, or evaluating speculative decoding and quantization."
---

# Inference Optimization

Optimize against explicit service objectives: measure TTFT, TPOT, throughput, and cost per request on your real prompt distribution, find whether prefill (compute-bound) or decode (bandwidth-bound) is the bottleneck, and apply the cheapest fix first. Service-level techniques keep outputs unchanged; model-level ones can change quality and must be re-evaluated.

## Bottlenecks and modes

- **Prefill** processes input tokens in parallel and is compute-bound; it sets TTFT. **Decode** generates one token at a time and is memory bandwidth-bound; it sets TPOT. Output tokens cost far more latency than input tokens.
- **Online APIs** optimize latency; **batch APIs** trade hours of turnaround for large discounts. Use batch for synthetic data, periodic reports and summaries, backfills, reindexing, migrations, and bulk onboarding.
- **Streaming** cuts perceived wait but means users see tokens before output guardrails can judge the whole response; plan retroactive removal.

## Metrics

| Metric | Definition | Notes |
|---|---|---|
| TTFT | Time from request to first token | Grows with input length; for agents and hidden reasoning, track time to first *visible* token |
| TPOT | Time per output token after the first | Streaming only needs to beat reading speed (around 6–8 tokens/s is enough for most readers) |
| Total latency | TTFT + TPOT x output tokens | Shorter outputs are the cheapest latency win |
| Throughput | Output tokens/s across all requests (count input separately) | Also requests per minute; drives cost |
| Goodput | Requests/s that meet the SLO (e.g., TTFT under 200 ms and TPOT under 100 ms) | Prevents buying throughput with unacceptable latency |
| MFU / MBU | Achieved FLOP/s or bandwidth vs the chip's peak | Efficiency indicators, not goals |

- Report percentiles (p50, p90, p95, p99), never just means; one slow outlier distorts averages. Plot TTFT against input length.
- Compare servers by cost per request, not tokens/s, since tokenizers differ.

```python
def kv_cache_bytes(batch, seq_len, layers, model_dim, bytes_per_value=2):
    """Unoptimized KV cache: keys and values for every layer and position."""
    return 2 * batch * seq_len * layers * model_dim * bytes_per_value

def cost_per_1k_requests(hourly_cost, output_tps, avg_output_tokens, prefill_rpm):
    decode = hourly_cost / (output_tps * 3600) * avg_output_tokens * 1000
    prefill = hourly_cost / (prefill_rpm * 60) * 1000
    return decode + prefill
```

A 13B-class model (40 layers, dimension 5,120) at batch 32 and 2,048 tokens in 16-bit needs about 54 GB of KV cache before optimization: memory for the cache, not compute, often caps batch size.

## Choosing accelerators

- Decide on memory capacity (does model plus KV cache fit), memory bandwidth (decode speed), FLOP/s at the precision you will use (prefill and training), power, and price. Peak FLOP/s figures are rarely reached; benchmark your workload.

## Model-level optimization (re-evaluate quality after each)

- **Quantization:** weight-only 8-bit or 4-bit is the most popular, easiest win for memory and throughput.
- **Distillation:** a smaller student for a narrow task.
- **Pruning:** less common in practice; gains depend on hardware support for sparsity.
- **Speculative decoding:** a small draft model proposes several tokens; the target model verifies them in parallel and accepts the agreeing prefix. Output distribution is preserved; speedup depends on acceptance rate, so the draft must share the tokenizer and resemble the target.
- **Inference with reference:** copy spans from the input (code edits, document QA) instead of generating them.
- **Parallel decoding:** generate several future tokens at once with extra heads, then verify.
- **Attention and KV cache:** architectures with grouped-query or multi-query attention, local windowed attention, or cross-layer sharing shrink the cache (training-time choices; pick models that have them). At serving time, paged KV cache management, KV cache quantization, and compression raise feasible batch size.
- **Kernels and compilers:** fused attention kernels and model compilers speed up the same model on given hardware; usually you get them from the serving framework.

## Service-level optimization (output unchanged)

- **Batching:** static (wait for a full batch; bad latency), dynamic (full batch or time window, whichever first), continuous (return each finished sequence and admit a new one immediately). Use continuous batching for LLM serving.
- **Disaggregate prefill and decode** onto separate instances when they compete; tune the prefill:decode instance ratio to input length and whether TTFT or TPOT matters more.
- **Prompt (prefix) caching:** reuse processing of shared prefixes such as long system prompts, documents, few-shot blocks, and conversation history. Put stable content first and variable content last so prefixes match. Providers discount cached tokens and report large TTFT reductions for long cached contexts; some charge for cache storage.
- **Parallelism:** replicas for more concurrent requests; tensor parallelism to fit large models and reduce latency; pipeline parallelism for throughput (adds per-request latency, so prefer it for training); context and sequence parallelism for very long inputs. Placing models of several sizes on mixed GPUs is a bin-packing problem.

## Workflow

1. Write the SLO: TTFT and TPOT percentiles, cost per request, peak traffic.
2. Load-test the current setup with production-like prompt and output lengths; record percentiles, throughput, goodput, cost.
3. Cheap wins first: shorter outputs (instructions, stop sequences, max tokens), prompt caching with stable prefixes, batch API for offline work, smaller or routed models.
4. If self-hosting: use a serving engine with continuous batching and paged KV cache; quantize weights; size the GPU from weights plus KV cache.
5. Try speculative decoding or prefill/decode disaggregation when latency still misses the SLO.
6. Re-run quality evals after any model-level change; ship only if quality and SLO both hold.

## Red flags

- Latency reported as an average with no percentiles or SLO.
- Throughput improvements shipped without checking TTFT/TPOT (goodput falls).
- Variable content (timestamps, user IDs) at the start of the prompt, defeating prefix caching.
- Quantized or distilled model deployed without rerunning the eval suite.
- GPU sized from parameter count alone, ignoring KV cache at the target context and batch.
- Offline bulk jobs sent through low-latency online endpoints at full price.

## Testing notes

- tdd: unit-test the memory and cost estimators with worked examples; test that prompt builders keep the cacheable prefix byte-identical across requests.
- Run performance tests as a separate, reproducible suite: fixed prompt sets, warmed servers, fixed concurrency levels; record percentiles and compare against the SLO in CI or before release.
- For model-level optimizations, run the quality eval on the original and optimized model with identical sampling settings and compare per slice.
- Measure user-visible TTFT in the client, not just server-side.
- **Current note:** speculative decoding, prefix caching, continuous batching, and disaggregated prefill/decode are now standard features of mainstream serving engines and many APIs; verify what your provider or engine enables by default before building it yourself.

## Related

- `../../Adaptation/Finetuning/finetuning.md` — memory math and quantization formats.
- `../../Adaptation/DatasetEngineering/datasetEngineering.md` — distillation data.
- `../../Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` — system caches, routers, monitoring.
- `../../../BuildLLMFromScratch/Architecture/AttentionMechanisms/attentionMechanisms.md` — attention and why the KV cache exists.
- `../../../DesigningMLSystems/Production/ModelDeployment/modelDeployment.md` — batch vs online prediction, compression.
- `../../../../DevOps/README.md` — capacity planning and deployment practice.
