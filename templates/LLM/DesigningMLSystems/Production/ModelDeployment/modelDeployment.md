---
name: dmls-model-deployment
description: "Deploying ML models to production: deployment myths, exporting models, batch (asynchronous) vs online (synchronous) prediction, batch and streaming features, unifying training and serving pipelines, model compression (low-rank factorization, distillation, pruning, quantization), cloud vs edge inference, compilers and intermediate representations, operator fusion and autotuning, and ML in the browser with WebAssembly, based on Chapter 6 (Model Deployment) of Chip Huyen's Designing Machine Learning Systems. Use when choosing how a model or LLM feature serves predictions, precomputing outputs vs calling the model per request, a model is too slow or too expensive to serve, quantizing or distilling a model, deciding between a hosted API and on-device inference, or reviewing a serving pipeline that differs from the training pipeline."
---

# Model Deployment

Deployment is an engineering problem, not a modeling one: decide how predictions are produced (batch or online), where they are computed (cloud or edge), and how fast the model must be, then shape the model and pipeline to fit. Treat batch prediction as a workaround for a model that is not yet fast or cheap enough, and keep one feature pipeline for training and serving.

## Drop the deployment myths

- **One or two models.** Real products run many models: one per feature, often one per market or per customer. Design registries, serving, and monitoring for dozens or hundreds, not one.
- **Performance stays put.** Models rot: they are best right after training and degrade as production data drifts away from training data.
- **Rare updates.** Ask how often you *can* update, not how often you should. Aim for the deploy cadence software teams already have.
- **Scale is someone else's problem.** Most ML engineers work at companies big enough that latency, throughput, and cost matter.
- **LLM note:** an LLM application usually has several model calls (router, retriever embeddings, generator, judge or guard). Version, monitor, and roll out each one as its own model.

## Batch vs online prediction

| | Batch (asynchronous) | Online (synchronous) |
|---|---|---|
| When | Periodically or on a trigger; results stored in a table or cache | As each request arrives |
| Features | Batch features only (computed from historical data) | Batch plus streaming features (computed from live events) |
| Optimized for | Throughput | Latency |
| Fits | Known, enumerable inputs; results not needed instantly (recommendations, lead scoring) | Unpredictable inputs or real-time stakes (translation, fraud, voice, unlock) |
| Costs | Compute wasted on users who never show up; stale when preferences change | Must meet a latency budget per request |

- "Batch" here means *when* predictions are made, not how many samples go through the model at once. Online serving can still batch requests internally.
- Precompute when retrieval is faster than generation and the input space is known in advance. You need to know which requests to answer before they arrive.
- Go online when stale predictions hurt (the user's intent changed this session) or the inputs cannot be enumerated.
- Hybrid is normal: precompute for popular queries or list pages, compute online for the long tail or the detail page.
- Moving to online needs two things: a near-real-time pipeline that builds streaming features, and a model fast enough for the latency budget (milliseconds for most consumer apps).
- **LLM note:** free-text chat and generation are inherently online (inputs are unbounded). But many LLM features are batchable: nightly summaries, product descriptions, tagging a catalog, embedding documents, answers to the top FAQ queries. Precompute those, store them with the model and prompt version, and serve from a cache. Use asynchronous batch endpoints for offline jobs where a provider offers them.

## One pipeline for training and serving

- Separate batch (training) and streaming (inference) feature pipelines are a top source of production bugs: a change made in one is not mirrored in the other, so the model sees different features than it trained on.
- Share feature definitions as code used by both paths; when two teams own the two paths, the risk is highest.
- **LLM note:** the "feature pipeline" is prompt assembly: templates, retrieved context, chat history truncation, tool schemas. Build prompts with the same function in evaluation and in production, or offline scores will not predict live behavior.

## Make the model fast enough

Three levers: run inference faster, make the model smaller, or use faster hardware.

| Technique | Idea | Trade-off |
|---|---|---|
| Low-rank factorization | Replace large tensors with compact ones (e.g. depthwise separable convolutions) | Architecture-specific, needs design expertise |
| Knowledge distillation | Train a small student to mimic a large teacher | Needs a teacher; sensitive to task and architecture |
| Pruning | Zero out (or remove) the least useful weights | Gains depend on sparse-aware runtimes; debated whether to retrain the pruned shape |
| Quantization | Fewer bits per weight (fp32 to fp16/bf16, int8, lower) | Rounding and range errors can shift quality; most general and easiest |

- Start with post-training quantization: it is a few lines in most runtimes and usually gives the largest latency win. Use quantization-aware training only when post-training quantization loses too much quality.
- Always measure output quality after each optimization step, not only latency and throughput. A speedup reported without a quality check is incomplete.
- Local optimizations: vectorization, parallelization, loop tiling, operator fusion. Global: fuse across the computation graph. Optimizing compilers and autotuners search these choices per hardware target; the search is slow but its results can be cached and reused.
- Glue between libraries (dataframes, NumPy, framework calls) can cost more than the model; profile the whole request path.

```python
import torch

model = torch.nn.Sequential(torch.nn.Linear(512, 256), torch.nn.ReLU(), torch.nn.Linear(256, 2)).eval()
qmodel = torch.ao.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)

x = torch.randn(32, 512)
with torch.inference_mode():
    agree = (model(x).argmax(-1) == qmodel(x).argmax(-1)).float().mean()
assert agree > 0.95  # quality gate on a fixed sample, alongside a latency benchmark
```

- **LLM note:** LLM latency is dominated by memory bandwidth and output length. Weight quantization, distilling into a smaller model for a narrow task, and shorter outputs are the usual levers, alongside the serving techniques covered in the AI Engineering inference skill.

## Cloud vs edge

- **Cloud:** easiest start (managed endpoints), but cost grows with traffic and every request pays network latency and moves user data off the device.
- **Edge:** works offline, avoids network latency (often larger than inference latency), keeps data local, and lowers server bills. Requires enough compute, memory, and battery on the device, and still has its own security risks (a stolen device).
- Compilers lower framework code through intermediate representations to hardware-native code; check that your target runtime supports your model's operators before committing to a device.
- Browsers give one target for many devices; WebAssembly is far faster than plain JavaScript but still slower than native code.
- **LLM note:** hosted LLM APIs are the default "cloud" path. Small quantized models on device fit privacy-sensitive, offline, or high-volume simple tasks (autocomplete, classification, redaction); route hard requests to a larger cloud model.

## Workflow

1. List every model in the feature (including LLM calls) and the latency, cost, and freshness requirement of each.
2. For each, decide batch, online, or hybrid: can inputs be enumerated, how stale may results be, what is the latency budget at p90/p99?
3. Decide cloud, edge, or split, from connectivity, privacy, cost per request, and device capability.
4. Export the model (definition plus weights) to a format the target runtime supports; pin model, prompt, and preprocessing versions together.
5. Put training and serving features (or prompt assembly) behind one shared implementation.
6. If too slow or costly, apply quantization first, then distillation or a smaller model; re-run the quality eval after each step.
7. Ship through the same CI/CD path as other services so models can be updated as often as the data demands.

## Red flags

- Serving code reimplements feature engineering or prompt building separately from the training or eval code.
- Precomputing predictions for every user daily when only a small fraction visit.
- Batch predictions served without a timestamp, model version, or fallback for new users and unseen inputs.
- A speedup (quantized, distilled, smaller LLM) merged with latency numbers but no quality comparison.
- Latency reported as an average, not percentiles; network time ignored when comparing cloud and edge.
- Infrastructure that assumes a single model, with manual, rare, or undocumented updates.
- Online LLM calls for content that is identical for every user and could be generated once and cached.

## Testing notes

- Training/serving parity test: run the shared feature or prompt function on fixed inputs through both the offline and online code paths and assert identical outputs.
- Export round-trip test: load the exported artifact and assert outputs match the in-memory model within a tolerance on a fixed seed and fixed batch.
- Compression gate: compare the original and compressed model on a golden set; fail the build if agreement or the task metric drops beyond a set threshold.
- Shape and contract tests on the prediction endpoint: input schema, output schema, batch of one and batch of many, empty and oversized inputs.
- Latency benchmark in CI on representative hardware, asserting p95 under budget; keep it separate from correctness tests.
- For precomputed LLM outputs, test cache keys include model and prompt versions so a change invalidates stale entries.
- bdd: scenarios for staleness ("given recommendations generated before the user's session") and fallback ("given a user with no precomputed prediction").

**Current note:**
- Serving LLMs now commonly relies on dedicated inference servers with continuous batching and KV-cache management rather than generic model endpoints; the batch-vs-online decision still applies above them.
- Low-bit weight quantization (8-bit and 4-bit) is routine for open-weight LLMs, and small models increasingly run on phones and laptops; validate quality per task rather than trusting general benchmarks.
- The book's projection that systems move toward online, on-device prediction has partly held, but most capable LLMs still run in the cloud.

## Related

- `../WhyMLSystemsFail/whyMLSystemsFail.md` — drift and degradation that motivate frequent updates.
- `../../Data/DataEngineeringFundamentals/dataEngineeringFundamentals.md` — batch vs streaming data and dataflow between services.
- `../../Data/FeatureEngineering/featureEngineering.md` — features that must match between training and serving.
- `../../Modeling/ModelDevelopment/modelDevelopment.md` — model selection under latency constraints and offline evaluation.
- `../../../AIEngineering/Production/InferenceOptimization/inferenceOptimization.md` — LLM-specific inference optimization.
- `../../../AIEngineering/Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` — caching, routing, and gateways for LLM apps.
- `../../../BuildLLMFromScratch/FineTuning/LoRA/loRA.md` — small adapters when distilling or specializing models.
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` — streaming pipelines for real-time features.
- `../../../../DataSystems/DerivedData/BatchProcessing/batchProcessing.md` — batch jobs that precompute predictions.
- `../../../../DevOps/Practices/DeliveryPipeline/deliveryPipeline.md` — shipping model updates through CI/CD.
- `../../../../DevOps/Practices/Monitoring/monitoring.md` — latency percentiles and service health.
