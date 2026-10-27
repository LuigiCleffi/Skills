---
name: dmls-model-development
description: "Framing an ML problem (task type, output, objective function, decoupled objectives), model selection tips, ensembles (bagging, boosting, stacking), experiment tracking and versioning, debugging models, distributed training, AutoML and hyperparameter tuning, the four phases of ML adoption, and offline evaluation (baselines, perturbation, invariance, directional, calibration, confidence, slice-based evaluation), based on Chapter 5 (Model Development) of Chip Huyen's Designing Machine Learning Systems. Use when turning a business request into an ML or LLM task, choosing between a heuristic, a classic model, a fine-tune, or a prompted LLM, setting baselines, tracking prompt or training experiments, tuning hyperparameters, debugging a model that trains but predicts badly, or deciding whether a model or prompt is good enough to ship."
---

# Model Development

Frame the problem before picking a model, start with the simplest thing that can work, and judge every candidate against explicit baselines and slice-level, robustness, and calibration checks, not a single aggregate score. Model development is iterative: every change is an experiment that must be tracked well enough to reproduce.

## Frame the problem

- A business complaint ("support is slow") is not an ML problem. An ML problem has an input, an output, and an objective function. Find the real bottleneck (e.g. routing tickets) and frame that.
- Task type follows the output: regression (continuous), binary, multiclass, multilabel. Either can be converted into the other (bucket prices; threshold a score).
- High-cardinality classification needs roughly a hundred examples per class to learn each one; consider hierarchical classification (coarse group, then subgroup).
- Multilabel is where teams struggle most: annotators disagree on how many labels apply, and you must decide how to turn probabilities into a label set (top-k, per-class thresholds). Either one multilabel model or one binary model per label.
- Prefer framings that survive change. Predicting "which of N apps opens next" as an N-way softmax forces retraining when an app is added; scoring each (user, context, app) pair with a single 0–1 value does not.
- Default losses: RMSE or MAE for regression, log loss for binary, cross entropy for multiclass.
- **LLM note:** the same framing applies to prompts. "Classify this ticket into one of these 4 departments, answer with the label only" is a constrained multiclass task with a parsable output; "help with support" is not. Prefer outputs you can score automatically (labels, JSON fields, scores) over free text where the task allows it.

## Decouple objectives

- When goals conflict (engagement vs. quality, helpfulness vs. safety), train or build one component per objective and combine their scores, e.g. `alpha * quality + beta * engagement`.
- Combining at scoring time lets you retune the weights without retraining, and lets each component update on its own cadence (spam filters change faster than quality judgments).
- **LLM note:** keep moderation, retrieval relevance, and answer quality as separate scorers or calls rather than one mega-prompt asked to optimize everything; you can then tune thresholds and swap one part independently.

## Choose a model: six rules

| Rule | What it means in practice |
|---|---|
| Avoid the state-of-the-art trap | Leaderboard wins on static benchmarks say little about your data, latency, or cost. Use the cheaper solution that solves the problem. |
| Start simple | Simple models deploy early, validate the pipeline end to end, are easy to debug, and become the baseline. Low effort is not the same as simple; a pretrained model is fine if it is easy to start, but still compare it to something simpler. |
| Avoid human bias | Give every candidate the same tuning budget; the favorite architecture usually got more experiments. |
| Performance now vs. later | Plot learning curves; a model that wins with little data may lose when data doubles, and one that learns online may overtake a batch model. |
| Evaluate trade-offs | False positives vs. false negatives, accuracy vs. compute and latency, performance vs. interpretability. Decide which matters before comparing. |
| Know the assumptions | Prediction is possible from X, IID samples, smoothness, linear boundaries, conditional independence, normality. Check the data honors them. |

Adopt ML in phases, each one the baseline for the next: (1) non-ML heuristics, (2) the simplest ML model, (3) optimize simple models (features, objectives, tuning, more data, ensembles), (4) complex models only when simple ones are exhausted and the use case demands it.

- **LLM note:** the phases map directly: a rule or keyword heuristic, then a small classifier or a zero-shot prompt, then few-shot prompts, retrieval, and prompt tuning, then fine-tuning or larger models. Do not fine-tune before a prompted baseline and a heuristic baseline exist.

## Ensembles

- Majority voting helps only when base learners are weakly correlated: three uncorrelated 70% classifiers vote their way to about 78%; three identical ones stay at 70%. Mix model families.
- Bagging (bootstrap samples, vote or average) reduces variance and helps unstable learners such as trees and neural nets; random forests are bagging plus feature sampling.
- Boosting (reweight misclassified samples, add learners) reduces bias; gradient-boosted trees remain strong tabular defaults.
- Stacking trains a meta-learner (or simple vote) on base learners' outputs.
- Ensembles cost latency and maintenance; reserve them for cases where a small gain is worth real money (ads CTR). **LLM note:** sampling several answers and voting (self-consistency) or using multiple judges is an ensemble too, with the same correlation caveat and a multiplied inference bill.

## Experiment tracking and versioning

- Track per run: train and eval loss curves, task metrics on non-test splits, speed (steps or tokens per second), memory and accelerator utilization, and hyperparameters that change over time (learning rate schedule, gradient and weight norms).
- Version code and data together; a run you cannot rebuild is an anecdote. Data versioning is harder (size, unclear diffs, no meaningful merges, deletion requests under privacy law), so at minimum record dataset checksums or snapshot IDs per run.
- Tracking does not guarantee reproducibility: framework and hardware nondeterminism remains, so record the environment too.
- **LLM note:** for prompted systems the "experiment" is model ID and version, prompt template, few-shot examples, decoding parameters, retrieval index version, and eval set version. For fine-tunes add base checkpoint, adapter config, and training data hash.

## Debugging models

Models fail silently: code runs, loss falls, predictions are wrong. Causes: violated assumptions, implementation bugs (e.g. gradients still on during eval), bad hyperparameters, data problems (misaligned labels, stale normalization stats), and poor features. Apply three habits:

1. Start simple and add components one at a time.
2. Overfit a single small batch; if loss will not approach zero, the implementation is broken.
3. Fix random seeds so differences come from your change, not chance.

```python
import random, numpy as np, torch

def set_seed(seed: int = 42) -> None:
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
```

## Scaling and tuning

- Data too big for memory needs out-of-core preprocessing, shuffling, and batching; gradient checkpointing trades compute for memory.
- Data parallelism: synchronous SGD suffers stragglers, asynchronous SGD suffers stale gradients; huge effective batches need learning-rate care and show diminishing returns. Model and pipeline parallelism split the network across devices; they can be combined.
- Tune hyperparameters systematically (random search, grid, Bayesian), concentrating on the sensitive ones; a well-tuned weaker model can beat a poorly tuned stronger one. Never tune on the test split. Architecture search and learned optimizers are mostly for organizations with large compute budgets.
- **Current note:** most teams now consume large pretrained models instead of training from scratch, so distributed training matters mainly for fine-tuning; parameter-efficient methods and managed fine-tuning services reduce the need to run it yourself.

## Offline evaluation

Metrics mean nothing without a baseline. On a 90/10 imbalanced task, guessing by label frequency already gets about 0.82 accuracy, so "accuracy 0.85" may mean the model learned almost nothing. Compare against: random (uniform and label-distribution), a simple heuristic, the zero rule (always the majority class), humans, and the existing solution. A slightly worse model can still win if it is far cheaper.

| Check | Question it answers | LLM version |
|---|---|---|
| Perturbation | Does quality hold on noisy, production-like input? | Typos, casing, paraphrases, extra whitespace, reordered context |
| Invariance | Do outputs stay the same when only sensitive or irrelevant fields change? | Swap names, gender, dialect; outputs and decisions must match |
| Directional expectation | Do outputs move the right way when an input moves? | Adding a disqualifying fact must lower an eligibility score |
| Calibration | Do 70% predictions come true about 70% of the time? | Self-reported confidence and judge scores are often poorly calibrated; measure before thresholding |
| Confidence | Which individual predictions are sure enough to show? | Route low-confidence answers to abstention, clarification, or a human |
| Slice-based | Does a good average hide a failing subgroup? | Per language, user segment, document type, prompt length |

- Aggregates can mislead: a model can win overall and lose on every subgroup (Simpson's paradox). Find slices by domain heuristics, by error analysis on misclassified examples, or by automated slice-finding.
- Calibrate with Platt scaling (`sklearn.calibration.CalibratedClassifierCV`) and inspect with `calibration_curve`. Calibration matters when probabilities feed counts or budgets, not only rankings.

## Workflow

1. Restate the request as input, output, and objective; pick the task type and a framing that survives new classes.
2. Split conflicting goals into separate objectives with tunable weights.
3. Build baselines: random, zero rule, heuristic, existing solution, and human where available.
4. Ship the simplest model (or prompt) end to end; then iterate under tracked, seeded, versioned experiments.
5. Compare candidates with equal tuning budgets, learning curves, and the trade-offs that matter for this product.
6. Evaluate offline beyond the headline metric: perturbation, invariance, directional, calibration, confidence thresholds, and critical slices.
7. Record the decision, the baselines beaten, and the known weak slices before handing off to deployment.

## Red flags

- A metric reported with no baseline, or an F1 that equals what label-frequency guessing gives.
- Reaching for a fine-tune, a frontier model, or an ensemble before a heuristic or prompted baseline exists.
- Hyperparameters, prompts, or few-shot examples chosen by looking at test-set results.
- One favored model got weeks of tuning; the alternative got an afternoon.
- Runs without recorded data version, seed, model version, or prompt version; "the good run" cannot be reproduced.
- Only overall accuracy reported; no slice table; sensitive attributes used as features.
- Raw model probabilities or LLM self-rated confidence used as thresholds without a calibration check.
- An N-way output layer that must be retrained whenever a class is added.

## Testing notes

- Overfit-one-batch as an automated smoke test: a tiny model on a handful of examples must reach near-zero loss within a few steps.
- Shape and contract tests for model wrappers: output dimensions, probability ranges and sums, label set, and parsable structured output from LLM calls (with the model mocked).
- Golden sets with frozen versions for regression comparisons; assert the new candidate beats every recorded baseline by a stated margin, overall and per critical slice.
- Metamorphic tests: invariance (swap names, the output must not change) and directional (raise lot size, price must not fall) express well as BDD scenarios and run against both classic models and LLMs.
- For nondeterministic LLM outputs, fix temperature and seed where the provider allows, run each case several times, and assert on pass rates or parsed fields rather than exact strings.
- Calibration test: bin predicted probabilities on a held-out set and assert expected calibration error stays under an agreed bound.

## Related

- `../../Foundations/MLSystemsInProduction/mlSystemsInProduction.md` — when ML is the right tool and research vs. production requirements.
- `../../Data/TrainingData/trainingData.md` — labels, sampling, class imbalance, and splits feeding these models.
- `../../Data/FeatureEngineering/featureEngineering.md` — feature choice and data leakage that distort evaluation.
- `../../Production/ModelDeployment/modelDeployment.md` — taking the chosen model to production.
- `../../Production/WhyMLSystemsFail/whyMLSystemsFail.md` — why offline results degrade after launch.
- `../../../AIEngineering/Evaluation/EvaluationMethodology/evaluationMethodology.md` — evaluating open-ended foundation-model outputs.
- `../../../AIEngineering/Evaluation/EvaluateAISystems/evaluateAISystems.md` — model selection and eval pipelines for AI applications.
- `../../../AIEngineering/Adaptation/Finetuning/finetuning.md` — when fine-tuning beats prompting.
- `../../../BuildLLMFromScratch/Training/TrainingLoopExtras/trainingLoopExtras.md` — learning-rate schedules and gradient clipping in practice.
- `../../../../TDD/README.md` — test-first habits for the deterministic code around models.
- `../../../../BDD/README.md` — expressing invariance and directional checks as scenarios.
