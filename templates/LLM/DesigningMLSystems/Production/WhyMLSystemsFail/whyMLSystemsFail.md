---
name: dmls-why-ml-systems-fail
description: "Why ML models degrade after deployment: natural labels and feedback loop length, software vs ML-specific failures, silent failures, train-serving skew, edge cases vs outliers, degenerate feedback loops (popularity bias, positional features, randomization), covariate shift, label shift, concept drift, feature and label schema change, detecting shift with summary statistics and two-sample tests, time windows, and retraining vs fine-tuning, based on Chapter 7 (Why Machine Learning Systems Fail in Production) of Chip Huyen's Designing Machine Learning Systems. Use when a deployed model or LLM feature gets worse over time, metrics drift on a dashboard, planning post-deployment monitoring, choosing drift detection tests, designing feedback or click labels, a recommender or ranking keeps surfacing the same items, or deciding when and on what data to retrain."
---

# Why ML Systems Fail in Production

Deployment is not the finish line: a model starts decaying the day it ships, usually without raising an error. Plan for it up front by knowing where labels come from and how fast, separating ordinary software failures from ML-specific ones, and watching for distribution shift, edge cases, and feedback loops that the model itself creates.

## Natural labels and feedback loop length

- A task has natural labels when the system can check its own predictions later (ETA vs actual trip time, click vs no click). If it has none, design feedback in: thumbs up/down, "suggest an edit", reactions.
- Feedback loop length is the delay from prediction to label. Minutes (short-content recommendations) make monitoring and fast retraining possible; weeks or months (fraud chargebacks, clothing returns) only support slow reporting.
- Implicit negatives ("no click") need a time window. Short windows give fast labels but mislabel late positives; any window undercounts true positives somewhat. Record the window and treat it as a tunable decision.
- **LLM note:** chat products rarely have natural labels. Log explicit ratings, regenerations, edits, copy events, and abandonment as weak signals, and document what each one really means before training on it.

## Classify the failure before fixing it

| Kind | Examples | Who fixes it |
|---|---|---|
| Software system failure | Broken dependency, wrong model binary deployed, missing permissions, hardware fault, host downtime, bad join in the pipeline | Ordinary engineering: tests, deploy checks, SRE |
| ML-specific failure | Data collection bugs, poor hyperparameters, training/inference pipeline mismatch, distribution shift, edge cases, degenerate feedback loops | ML engineering: data checks, monitoring, retraining |

- Operational failures are loud (timeouts, 404, OOM). ML performance failures are silent: the endpoint returns 200 with a wrong answer.
- In a published review of Google pipeline outages, most root causes were not ML at all. Check the plumbing first.
- Many apparent "shifts" on dashboards are internal bugs: a feature turning into NaN, units changed from years to months, stats computed on the wrong subset, a stale model version, a UI bug changing user behavior. Rule these out before retraining.

## Edge cases and degenerate feedback loops

- Outliers are about data (an unusual input); edge cases are about performance (an input the model gets badly wrong). Not every outlier is an edge case.
- You may drop outliers when training; at inference you must handle them: transform (spelling correction), route to a fallback, or refuse.
- A rare catastrophic error can make an otherwise accurate system unusable (safety-critical domains, or a support bot that occasionally produces offensive text). A rising rate of edge cases can signal shift.
- A degenerate feedback loop forms when predictions shape the feedback used to train the next model: top-ranked items get more clicks, so they rank higher still (popularity or exposure bias, filter bubbles); a screening model only lets through candidates with feature X, so it learns X even harder.
- Detect it offline by measuring output diversity (aggregate diversity, long-tail coverage) and accuracy per popularity bucket; online, watch for outputs becoming more homogeneous over time. Feature importance exposes a model leaning on one proxy feature.
- Correct it with a small dose of randomized exploration (new items get an unbiased traffic pool) and with positional features: train with "shown in slot k", then predict with the position fixed so ranking reflects relevance, not placement. A stronger variant splits "was it seen" from "was it clicked given seen".
- **LLM note:** fine-tuning or preference-tuning on your own model's outputs and the feedback they drew is the same loop. Keep a randomized or human-written slice, log which model and prompt version produced each sample, and deduplicate self-generated data before reuse.

## Types of distribution shift

Training data is the source distribution, production is the target. With inputs X and outputs Y:

| Shift | What changes | Example |
|---|---|---|
| Covariate shift | P(X) changes, P(Y given X) stays | Marketing brings richer users; conversion per income level unchanged |
| Label shift (prior shift) | P(Y) changes, P(X given Y) stays | Fewer positives in the population, same profile per positive |
| Concept drift (posterior shift) | P(Y given X) changes | Same house, lower price after a market shock; often cyclic or seasonal |
| Feature change | Features added, removed, or their value range changes | Age switched from years to months |
| Label schema change | The set of possible labels changes | NEGATIVE split into SAD and ANGRY; new score range |

- Train-serving skew is a gap from day one (curated, cleaned, resampled data differs from live data); temporal shift is a gap that grows. Shifts can be sudden, gradual, or seasonal, and several can happen at once.
- Oversampling and active learning deliberately create covariate shift; account for it when evaluating.
- If you know how the target differs, importance weighting (reweight training samples by the density ratio) can help.
- **LLM note:** user prompts shift constantly (new topics, new products, new jargon, events after the knowledge cutoff, new languages, longer pasted documents). Concept drift appears when correct answers change (prices, policies, laws) even though questions look the same. A new output category or tool is a label schema change for any classifier or router in front of the model.

## Detecting and addressing shift

- Prefer accuracy-related metrics against ground truth when labels arrive in time. Investigate unexplained jumps up as well as drops.
- Without timely labels, monitor input distributions (and prediction distributions). Summary stats (mean, median, variance, quantiles) are a cheap first check; similar stats do not prove no shift.
- Two-sample tests: Kolmogorov-Smirnov works only on one-dimensional data (single features, scalar predictions) and can be noisy; MMD and least-squares density difference handle multivariate data. Reduce dimensionality first. Statistical significance is not practical importance: a difference visible in a small sample is more likely to matter.
- Choose the time window deliberately: windows shorter than the seasonality cycle raise false alarms; cumulative metrics hide short dips, so plot sliding-window metrics too. Compute fine-grained stats and merge them into longer views.
- Fix options: train on broader data, adapt without labels (research-grade, rarely used), or retrain with labeled target data, either from scratch or by fine-tuning on recent data (start from where drift began, or since the last update). Measure which works; do not pick a retraining cadence by gut feel.
- Design for robustness: prefer stable features (bucket a volatile app-store rank), weigh accuracy against how fast a feature decays, and split models by segment that drift at different rates.

```python
import numpy as np
from scipy.stats import ks_2samp

def drifted(reference: np.ndarray, current: np.ndarray, alpha: float = 0.01) -> bool:
    """One-dimensional check, e.g. prompt length or a projected embedding axis."""
    return ks_2samp(reference, current).pvalue < alpha
```

- **LLM note:** embed incoming prompts, reduce them (PCA or cluster assignments), and compare against a reference window: per-component KS tests, cluster-share changes, or a multivariate test. Track simple proxies too: prompt length, language, refusal rate, tool-call rate, output length.

## Workflow

1. Write down, per model, whether natural labels exist, how they are inferred, and the feedback loop length.
2. Separate operational alerts (latency, errors, OOM) from ML performance monitoring.
3. On a regression, rule out software and pipeline bugs first: model version, feature nulls, units, schema, recent deploys.
4. Name the shift type (covariate, label, concept, feature or schema change) and whether it is skew or temporal.
5. Pick detectors suited to the data's dimensionality and a window that respects seasonality.
6. Check for feedback loops: output diversity, per-popularity-bucket accuracy, position bias.
7. Address it: fix the bug, add exploration or positional features, or retrain on target data; record the decision.
8. Revisit feature choices and model segmentation to reduce future drift.

## Red flags

- "It's deployed, we're done" with no owner, monitoring, or retraining plan.
- Only operational dashboards; no way to see prediction quality.
- Click-derived negatives with an undocumented or arbitrary window.
- Retraining reflexively when a dashboard spikes, without checking pipeline bugs.
- Cumulative accuracy as the only chart; KS on high-dimensional embeddings directly.
- Training the next model on logs from the current one with no exploration traffic or position feature.
- Volatile raw features (live rank, counters) with no stability analysis.
- An LLM eval set frozen at launch while user traffic has moved on.

## Testing notes

- Unit-test drift detectors with synthetic data: identical samples must not alert; a shifted mean or a new category must alert. Fix seeds.
- Test label-inference logic: a click after the window stays negative; a click within it becomes positive.
- Test pipeline invariants that mimic fake shift: no NaNs, expected units and ranges, same feature code in training and serving.
- Evaluate on time-sliced test sets (train on older, test on newer) to measure decay, not just random splits.
- For recommenders, include popularity-bucket and coverage metrics in the eval report.
- For LLM features, keep a living golden set refreshed from recent sampled traffic alongside a fixed regression set; compare both on each release.
- **Current note:** drift and LLM observability tooling is now widely available, including embedding-based drift views, but which tests suit your data and windows remains an engineering decision. The book's monitoring and continual-learning chapters are not in this Early Release.

## Related

- `../ModelDeployment/modelDeployment.md`: batch vs online prediction and train-serving pipeline consistency.
- `../../Data/TrainingData/trainingData.md`: sampling bias, class imbalance, and label sources.
- `../../Data/FeatureEngineering/featureEngineering.md`: feature stability and leakage.
- `../../Modeling/ModelDevelopment/modelDevelopment.md`: offline evaluation and slice-based tests.
- `../../../AIEngineering/Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md`: collecting user feedback for LLM apps.
- `../../../AIEngineering/Evaluation/EvaluateAISystems/evaluateAISystems.md`: evaluation pipelines for AI systems.
- `../../../../DevOps/Practices/Monitoring/monitoring.md`: monitoring and alerting practice.
- `../../../../DataSystems/DistributedData/TroubleWithDistributedSystems/troubleWithDistributedSystems.md`: non-ML failure modes.
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md`: windowed statistics over event streams.
