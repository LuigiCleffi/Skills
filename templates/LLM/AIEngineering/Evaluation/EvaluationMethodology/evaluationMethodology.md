---
name: aieng-evaluation-methodology
description: "Methods for evaluating open-ended foundation model outputs: why evaluation is harder for foundation models, language modeling metrics (cross entropy, perplexity, bits per byte) and their uses, exact evaluation (functional correctness, pass@k, execution accuracy), similarity against references (exact match, lexical metrics like BLEU and ROUGE, semantic similarity with embeddings), AI as a judge (prompt design, scoring scales, inconsistency, criteria ambiguity, self, position and verbosity bias, choosing judge models, reward models, reference-based and preference judges), and comparative evaluation (pairwise ranking, Elo, Bradley-Terry, arenas), based on Chapter 3 (Evaluation Methodology) of Chip Huyen's AI Engineering. Use when choosing a metric for generated text or code, writing or reviewing an LLM-as-judge prompt, comparing two prompts or models, using perplexity for contamination or anomaly checks, or deciding between pointwise and pairwise evaluation."
---

# Evaluation Methodology

Prefer evaluation that produces unambiguous judgments (does the code run, does the answer match), and use AI judges only where exact methods cannot reach, treating each judge as a versioned system (model plus prompt plus sampling settings) with known biases. Eyeballing a handful of favorite prompts is not evaluation.

## Why it is hard

- The smarter the model, the more expertise and time it takes to check its output; fluent wrong answers survive casual review.
- Open-ended tasks have many valid answers, so a single reference rarely suffices.
- Models are black boxes and public benchmarks saturate or leak into training data quickly.

## Language modeling metrics

- Cross entropy, perplexity, bits-per-character and bits-per-byte all measure how well a model predicts text. Lower perplexity means the text was easier to predict. Use bits-per-byte to compare models with different tokenizers.
- Good uses: comparing base models on your domain, detecting likely training-data contamination (suspiciously low perplexity on a benchmark), flagging abnormal or gibberish inputs, deduplicating new training data.
- Do not use perplexity to compare post-trained (chat) models on task quality; post-training and quantization change perplexity in ways unrelated to helpfulness.

## Choose the method by what the task allows

| Task property | Method | Notes |
|---|---|---|
| Output can be executed or checked | Functional correctness (unit tests, SQL execution, game score) | The strongest signal; report pass@k with k stated |
| Closed answer (class, number, option) | Exact match / accuracy | Normalize case, whitespace, formatting first |
| Reference answers exist, wording varies | Semantic similarity (embedding cosine, BERTScore) | Quality depends on the embedding model; check it on your data |
| Reference exists, surface form matters (translation legacy) | Lexical similarity (BLEU, ROUGE, edit distance) | Correlates poorly with correctness; incomplete or wrong references penalize good answers |
| No reference, subjective quality | AI as a judge, specialized scorers, humans | Validate against human labels |
| Choosing between models or prompts | Comparative (pairwise) evaluation | Easier for raters than absolute scores |

## AI as a judge

Three framings: score a response alone given the question; compare a response to a reference; compare two responses. A judge prompt states:

1. The task (e.g., judge factual consistency of the answer with the context).
2. The criterion, in detail, including what to ignore.
3. The scoring system. Classification (pass/fail, relevant/irrelevant) is more reliable than numbers; if numeric, use a small discrete scale such as 1–5, never a wide or continuous one.
4. Examples for each score with the reason it deserves that score.

```python
JUDGE_V3 = """You check whether an ANSWER is supported by the CONTEXT.
Ignore style and length. A claim not stated in or implied by CONTEXT is unsupported.
Reply with JSON: {{"verdict": "supported" | "unsupported", "reason": "<one sentence>"}}
...examples...
CONTEXT: {context}
ANSWER: {answer}"""  # fill with JUDGE_V3.format(context=..., answer=...)
JUDGE_CONFIG = {"prompt_id": "faithfulness-v3", "model": "<pinned model id>", "temperature": 0}
```

Limitations and mitigations:

- **Inconsistency:** set temperature 0, add scored examples, and measure agreement on repeated runs; consistency does not prove accuracy.
- **Criteria ambiguity:** tools with the same metric name (e.g., faithfulness) use different prompts and scales; scores are not comparable across tools. Never trust a judge whose model and prompt you cannot see.
- **Drift:** a judge prompt edit or model update changes scores; version the judge and re-baseline when it changes.
- **Cost and latency:** each criterion is another call. Use cheaper or specialized judges, or spot-check a sample.
- **Biases:** self-bias (favors its own model's outputs), first-position bias in pairwise prompts (swap order and average), verbosity bias (favors longer answers). Control for length when comparing.
- **Privacy and IP:** a hosted judge sees your data.

Choosing the judge: a stronger model judges a sample of a cheaper model's outputs; a model can self-critique as a sanity check; small specialized judges (reward models, reference-based scorers, preference models, entailment classifiers) can beat general ones on narrow criteria at lower cost.

## Comparative evaluation

- Collect pairwise preferences and fit a rating (Bradley–Terry is more stable than Elo to match order). A ranking is good if it predicts future match outcomes.
- Limits: needs many comparisons as models multiply; crowd prompts may not resemble your use case; a ranking says which is better, not whether either is good enough. Pair it with absolute checks for your usefulness threshold.

## Workflow

1. List the criteria; for each, pick the most exact method the task allows.
2. Build or collect references only where needed; check reference quality.
3. For judge-based criteria, write a rubric prompt with examples, pin model and sampling, version it.
4. Label 50–100 examples by hand and measure judge agreement with humans before relying on it.
5. Control known biases: swap pair order, normalize length, avoid same-model judging when comparing models.
6. Combine methods: cheap signals on all data, expensive judges or humans on a sample.
7. Log judge version with every score so trends stay interpretable.

## Red flags

- BLEU/ROUGE as the main quality metric for open-ended generation.
- A judge prompt with an unexplained 1–10 scale and no examples.
- Using a vendor's built-in "relevance" or "faithfulness" score without reading its prompt.
- The model being evaluated also acting as its own judge in model comparisons.
- Pairwise judging always in the same order.
- Judge prompt or model changed silently between two reported runs.

## Testing notes

- Unit-test metric code (normalization, exact match, pass@k estimator) with hand-computed fixtures.
- Keep a human-labeled calibration set for each judge; fail CI if judge-human agreement drops below an agreed level after a judge change.
- Treat judge outputs as parsed structured data with schema validation and retries.
- For code tasks, run generated code in a sandbox with timeouts; never on the host.
- **Current note:** LLM judges and specialized evaluator models have become standard in evaluation tooling since the book; the same validation, versioning, and bias checks still apply.

## Related

- `../../Evaluation/EvaluateAISystems/evaluateAISystems.md` — criteria, model selection, the full pipeline.
- `../../Foundations/FoundationModels/foundationModels.md` — logprobs and sampling settings.
- `../../Adaptation/DatasetEngineering/datasetEngineering.md` — annotation guidelines shared with evaluation.
- `../../../HandsOnLLM/UsingPretrainedModels/TextClassification/textClassification.md` — classification metrics.
- `../../../DesigningMLSystems/Modeling/ModelDevelopment/modelDevelopment.md` — offline evaluation and baselines.
- `../../../../TDD/README.md` — test-first habits that evaluation-driven development mirrors.
