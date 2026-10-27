---
name: aieng-evaluate-ai-systems
description: "Evaluating AI systems end to end: evaluation-driven development, criteria buckets (domain capability, generation quality, factual consistency and hallucination, safety, instruction following, cost and latency), model selection (hard vs soft attributes, the four-step selection workflow, model APIs vs self-hosting, licenses, data privacy), navigating public benchmarks and leaderboards, data contamination, and designing an evaluation pipeline (per-component and per-task evaluation, guidelines and rubrics, tying metrics to business metrics, eval data slicing, sample sizes, bootstrapping, evaluating the evaluator, experiment tracking), based on Chapter 4 (Evaluate AI Systems) of Chip Huyen's AI Engineering. Use when choosing between models or providers, deciding API vs open weights, building an eval set or golden dataset, writing scoring rubrics, sizing an eval set to detect a difference, checking hallucination or factual consistency, or setting up regression evaluation for prompts, RAG, or agents."
---

# Evaluate AI Systems

Define how the application will be judged before building it (evaluation-driven development). Pick the model that is best for your application, not the best on a leaderboard, by filtering on hard constraints, shortlisting with public data, and deciding with your own evaluation pipeline.

## Criteria buckets

| Bucket | What to measure | Typical method |
|---|---|---|
| Domain capability | Can it do the task (code, legal, math) | Functional correctness, domain benchmarks, multiple-choice |
| Generation quality | Fluency, coherence, relevance | AI judge, human review |
| Factual consistency | Local (against given context) and global (against open knowledge) | Entailment classifier, AI judge, claim decomposition plus search |
| Safety | Toxicity, PII, harmful instructions, bias, brand risk | Classifiers, moderation APIs, red-team sets |
| Instruction following | Format, length, required keywords, constraints, persona | Verifiable checks (regex, schema, word count), judges for the rest |
| Cost and latency | TTFT, TPOT, total latency (p50/p90/p99), cost per request, throughput limits | Load tests on your own prompt distribution |

- Hallucination checks are easiest against explicit context: split the output into claims and check each for entailment, contradiction, or neutral. Watch which query types (niche topics, questions about nonexistent things) trigger hallucinations most.
- Latency is often a nice-to-have annoyance, not a deal-breaker; separate must-haves from preferences before trading quality for speed.

## Model selection workflow

1. **Filter on hard attributes** you cannot or will not change: license, data privacy policy, on-prem or on-device needs, supported languages, context length, provider region, budget ceiling.
2. **Shortlist with public data:** benchmarks and leaderboards relevant to your task, plus price and latency.
3. **Decide with your own pipeline** on your data, balancing quality, cost, and latency (filter by non-negotiables, then pick the best of the rest).
4. **Monitor in production** and feed failures back.

Revisit after every major adaptation step: start prompt experiments with the strongest model to test feasibility, then try cheaper ones; start finetuning with a small model to test code, then scale.

## API vs self-hosting

| Factor | Model API | Self-hosted open-weight model |
|---|---|---|
| Data privacy | Data leaves your boundary | Stays in-house |
| Lineage and IP | Opaque training data | Varies; check license and data disclosures |
| Performance | Usually the strongest models first | Gap varies by task; test it |
| Features | Function calling, structured output, guardrails often built in | You build or assemble them |
| Cost | Per token, roughly linear with volume | Engineering plus compute; per-token cost falls with scale |
| Control | Rate limits, silent model updates, deprecations | You pin versions, finetune, quantize |
| Edge/offline | Not possible | Possible |

- "Open source" models often release weights without training data; read the license for commercial use and restrictions on using outputs to train other models.

## Public benchmarks

- Use them to discard bad models, not to pick the winner. Choose benchmarks that match your task, check correlation among them, and prefer recent or private ones.
- **Contamination** is common and usually accidental. Detect via n-gram overlap (needs training data) or unusually low perplexity. Treat a suspiciously high score on an old public benchmark with doubt.

## Design the evaluation pipeline

**Step 1 — Evaluate every component and the whole.** Score intermediate outputs (e.g., PDF-to-text, then field extraction) so failures can be localized. Evaluate per turn and per task; task completion (and turns needed) matters most to users.

**Step 2 — Write the evaluation guideline.** Define what the app should and should not do (out-of-scope inputs), criteria (often 2–3, e.g., relevance, factual consistency, safety), a scoring scale per criterion, and a rubric with examples. A correct answer can still be a bad answer if it is unhelpful. Validate the rubric with people; if humans disagree, refine it. Map metrics to business outcomes (e.g., consistency at X percent lets you automate Y percent of tickets) and set the usefulness threshold.

**Step 3 — Methods and data.** Mix methods per criterion: cheap classifier on everything, expensive judge on a sample, human review of a daily sample. Use logprobs as confidence when available. Build multiple eval sets: one matching the production distribution, plus slices (user tier, channel, length, language), known-hard cases, common user mistakes (typos), and out-of-scope inputs. Slicing also exposes Simpson's paradox.

**Sample size:** smaller differences need many more examples. Rough rule: each 3x smaller score difference needs about 10x more samples (about 100 examples to trust a 10-point gap, about 1,000 for 3 points). Check stability with bootstrap resampling:

```python
import random, statistics

def bootstrap_scores(per_example_scores, rounds=1000, seed=0):
    rng = random.Random(seed)
    n = len(per_example_scores)
    means = [statistics.mean(rng.choices(per_example_scores, k=n)) for _ in range(rounds)]
    means.sort()
    return means[int(0.025 * rounds)], means[int(0.975 * rounds)]  # rough 95% interval
```

If the interval is wide or two systems' intervals overlap heavily, add examples before declaring a winner.

**Evaluate the evaluator:** do better responses get better scores, do metrics move business metrics, are runs reproducible (judge temperature 0), are metrics redundant (perfectly correlated) or contradictory, and what cost and latency does evaluation add?

**Iterate with tracking:** log eval data version, rubric version, judge prompt and model, and sampling settings with every result.

## Workflow

1. Write criteria, rubric, and usefulness threshold tied to a business metric.
2. Apply hard-attribute filters; shortlist three to five models from public data.
3. Assemble eval sets from real data where possible; annotate with the rubric.
4. Run each candidate (and each prompt version) through the same pipeline; compare with confidence intervals and per-slice results.
5. Pick on the cost–quality–latency frontier; record the decision and its evidence.
6. Wire the same evaluations into CI for prompt/model changes and into production monitoring.

## Red flags

- Choosing a model from a leaderboard alone, or from one benchmark that may be contaminated.
- An eval set of 20 hand-picked prompts used to claim a few-point improvement.
- Only end-to-end scores for a multi-step pipeline, so failures cannot be located.
- No out-of-scope or adversarial slice in the eval data.
- Metrics with no mapping to a business outcome or threshold.
- Eval runs not reproducible because data, rubric, or judge versions were not logged.

## Testing notes

- bdd: express acceptance criteria as thresholds on named eval sets and slices ("faithfulness at least 0.9 on billing questions").
- Keep a versioned golden set in the repo or a data store; tests reference it by version.
- Make the eval harness itself deterministic: fixed seeds for sampling and bootstrap, pinned judge config, cached model outputs for re-scoring.
- Gate deployments on regression against the previous release per slice, not just on the aggregate.
- **Current note:** leaderboards and benchmark suites have turned over again since the book; prefer recent, task-matched, or held-out benchmarks and treat any long-public benchmark as possibly contaminated.

## Related

- `../../Evaluation/EvaluationMethodology/evaluationMethodology.md` — metrics and AI judges.
- `../../Adaptation/RAGAndAgents/ragAndAgents.md` — retrieval and agent evaluation.
- `../../Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` — monitoring and feedback in production.
- `../../../DesigningMLSystems/Modeling/ModelDevelopment/modelDevelopment.md` — slice-based evaluation and baselines.
- `../../../DesigningMLSystems/Data/TrainingData/trainingData.md` — labeling and sampling.
- `../../../../BDD/README.md` — scenarios as acceptance criteria.
