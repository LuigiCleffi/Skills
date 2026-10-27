---
name: dmls-training-data
description: "Creating training data for ML systems: non-probability vs random sampling (simple, stratified, weighted, importance, reservoir), hand labeling and label multiplicity, data lineage, weak supervision with labeling functions, semi-supervision, transfer learning, active learning, class imbalance (metrics, resampling, cost-sensitive, class-balanced and focal loss), and data augmentation (label-preserving transforms, perturbation, synthesis), based on Chapter 3 (Training Data) of Chip Huyen's Designing Machine Learning Systems. Use when building or sampling a training or fine-tuning set, writing annotation guidelines, annotators or LLM labelers disagree, labels are scarce, expensive or private, choosing which samples to label next, a rare class is ignored, accuracy looks great on skewed data, or generating synthetic or augmented examples."
---

# Training Data

Treat training data as an evolving, biased artifact you engineer, not a fixed dataset you receive. Choose how you sample, label, rebalance and augment on purpose, record where every sample and label came from, and judge the result with metrics that see the classes you care about.

## Sampling

Every training set is a sample of reality; the sampling method decides which biases it carries.

| Method | Use when | Watch out for |
|---|---|---|
| Convenience, snowball, judgment, quota (non-probability) | Bootstrapping a first dataset quickly | Selection bias; not representative of production |
| Simple random | Large data, no rare groups that matter | Rare classes can vanish from the sample |
| Stratified | You must keep every class or slice | Hard for multilabel samples or ungroupable data |
| Weighted | Recent or high-value data matters more, or your data's mix differs from the real one | Weights encode assumptions; document them |
| Importance | You can only draw from a proxy distribution Q but need P | Reweight by P/Q; Q must be nonzero wherever P is |
| Reservoir | Sampling k items from an unbounded stream | Needs a correct implementation; test the uniformity |

- Do not confuse weighted sampling (which samples get picked) with sample weights (how much each picked sample moves the loss).
- Before scaling up a new model, try it on a small random subset, and check how performance changes with dataset size.

```python
import random

def reservoir_sample(stream, k, rng=None):
    rng = rng or random.Random()
    reservoir = []
    for n, item in enumerate(stream, start=1):
        if n <= k:
            reservoir.append(item)
        else:
            i = rng.randint(1, n)          # 1 <= i <= n
            if i <= k:
                reservoir[i - 1] = item    # each item kept with prob k/n
    return reservoir
```

**LLM note:** pretraining corpora are convenience samples of easily scraped text, so a base model inherits their skew in language, region and register. When you assemble a fine-tuning or eval set from production prompts, stratify by intent, language and user segment instead of taking whatever logs are handy.

## Labels

- Prefer natural labels (clicks, purchases, corrections) when the task has them; otherwise budget hand labeling as a core, ongoing function, not a one-off.
- Hand labels are expensive (experts), slow (iteration waits on them), and a privacy risk (someone must see the data). A label-schema change, such as adding a new class, forces relabeling.
- Label multiplicity: annotators disagree, more so as expertise rises. Reduce it with a precise problem definition and tie-break rules (e.g. prefer the longest entity span), and train annotators on those rules.
- Data lineage: record source, annotator or labeler, guideline version and date for every sample and label. Never mix a new, cheaper label batch into the pool untagged; when the model gets worse after adding data, lineage tells you which batch to blame.

**LLM note:** an LLM used as an annotator is one more labeler with its own error profile. Version its prompt and model like a guideline, store its outputs with that lineage, and measure its agreement with a human-labeled sample before trusting it.

## When hand labels are scarce

| Method | Idea | Ground truth needed |
|---|---|---|
| Weak supervision | Labeling functions (keywords, regexes, lookups, other models) produce noisy labels that are combined and denoised | None in theory; a small hand-labeled set to estimate LF accuracy |
| Semi-supervision | Self-training on confident predictions, similarity or clustering, perturbation consistency | A small seed set |
| Transfer learning | Start from a model pretrained on a cheap, abundant task (language modeling); prompt it or fine-tune it | None for zero-shot; far fewer labels for fine-tuning |
| Active learning | Label the samples the model is most uncertain about, or where a committee of models disagrees most | Yes, chosen by the model |

- Labeling functions make expertise versionable and reusable, keep private data unseen, and can be reapplied when requirements change. You still train a model so it generalizes to samples no function covers.
- With few labels, decide explicitly how many to spend on evaluation; picking the best of many candidates on one small test set rewards overfitting to it.
- Active learning on the live stream helps the model keep up with changing data.

**LLM note:** a prompted LLM is a powerful labeling function. Combine it with cheaper rules, keep a human-labeled sample to estimate its accuracy, and send low-confidence or disagreeing cases to people (active learning). Do not grade a model against labels produced by that same model.

## Class imbalance

Imbalance is the norm (fraud, churn, disease, spam), and it can be inherent, a sampling artifact (spam filtered before reaching your database), or a labeling error. Find the cause first. It hurts because the minority gives too little signal, the model can settle on predicting the majority, and errors cost asymmetrically.

1. **Metrics first.** Overall accuracy hides minority failure. Report per-class precision, recall and F1 with an explicit positive class, and use precision-recall curves rather than ROC alone under heavy imbalance; tune the decision threshold for the cost you care about.
2. **Data-level.** Undersample the majority or oversample the minority; Tomek links and SMOTE help only in low dimensions. Mitigate with two-phase learning (train resampled, fine-tune on original) or dynamic sampling. Never evaluate on resampled data.
3. **Algorithm-level.** Cost-sensitive loss from a cost matrix, class-balanced loss (weights inverse to class frequency), or focal loss (down-weight easy examples).

```python
import torch
from torch import nn

counts = torch.tensor([9000.0, 1000.0])            # per-class sample counts
weights = counts.sum() / (len(counts) * counts)     # inverse frequency
loss_fn = nn.CrossEntropyLoss(weight=weights)
```

**LLM note:** fine-tuning sets are imbalanced too (one dominant intent, few refusals or edge cases), and the model learns the majority behavior. Check per-category counts before training, and evaluate per category, not by one averaged score.

## Augmentation

- **Label-preserving transforms:** crops, flips and rotations for images; synonym or embedding-neighbor swaps for text, only where the meaning truly survives.
- **Perturbation:** small noise, or adversarial examples found by search, to harden the decision boundary; random token replacement in small doses for text.
- **Synthesis:** templates with slot lists for intents and queries, mixup for images, generative models (still maturing at the time of writing).

**LLM note:** LLM-generated synthetic data is template synthesis at scale. Filter it, deduplicate it against eval data, tag it in lineage, and keep a real-data eval set so you never measure the model only on its own distribution.

**Current note:** since the book, using LLMs as annotators, judges and synthetic data generators has become common practice, and so has the concern that training on model-generated data can narrow diversity. Keep human-verified samples as the reference.

## Workflow

1. Write down the target population and how your candidate data was sampled; name the likely selection biases.
2. Pick a sampling method per need: stratified for splits, weighted or importance for known distribution gaps, reservoir for streams.
3. Write a labeling guideline with tie-break rules; measure inter-annotator (or LLM-versus-human) agreement on a pilot batch.
4. If labels are scarce, combine weak supervision, transfer learning and active learning; keep a small trusted hand-labeled set for evaluation.
5. Attach lineage (source, labeler, guideline or prompt version, date) to every sample.
6. Measure class balance and its cause; choose metrics, then data-level or loss-level fixes.
7. Augment where it preserves labels; tag augmented and synthetic samples and keep them out of evaluation.
8. Retrain, run error analysis by data source and class, and iterate on the data before the model.

## Red flags

- Training data scraped or exported "because it was there", with no statement of how it differs from production traffic.
- Random split or random sample on data where a rare class may disappear.
- New label batches, vendors or LLM labelers mixed in without lineage tags.
- Annotation guidelines without examples or tie-break rules; no agreement measured.
- Accuracy as the headline metric on an imbalanced task; F1 without a stated positive class.
- Evaluating on oversampled, augmented or synthetic data.
- Self-training or LLM labels accepted with no hand-labeled check of their accuracy.
- Hard-coded class weights or cost matrices with no rationale.

## Testing notes

- tdd: test samplers with a fixed seed: stratified sampling keeps every class, reservoir sampling holds exactly k items and is near-uniform over many seeded runs (chi-square or tolerance check).
- tdd: unit-test labeling functions as pure functions on handcrafted texts, including abstain cases; test the combiner on known conflicts.
- Test that augmentation preserves the label on golden examples, and that split code never places augmented copies of one source sample on both sides.
- Assert lineage fields are present on every row of a built dataset; fail the build when a source is unknown.
- Evaluation: keep a fixed, human-labeled golden set; report per-class precision, recall and F1 and the PR curve; track LLM-labeler agreement with it over time.
- bdd: scenarios like "Given a label batch from a new vendor, When accuracy drops, Then the report breaks errors down by batch".

## Related

- `../../Foundations/MLSystemsInProduction/mlSystemsInProduction.md` — when ML fits, and why data shifts.
- `../DataEngineeringFundamentals/dataEngineeringFundamentals.md` — sources, formats and dataflow behind the samples.
- `../FeatureEngineering/featureEngineering.md` — features, and leakage when splitting.
- `../../Modeling/ModelDevelopment/modelDevelopment.md` — evaluation, baselines and perturbation tests.
- `../../Production/WhyMLSystemsFail/whyMLSystemsFail.md` — distribution shift and feedback loops.
- `../../../AIEngineering/Adaptation/DatasetEngineering/datasetEngineering.md` — curating and synthesizing data for foundation models.
- `../../../AIEngineering/Evaluation/EvaluationMethodology/evaluationMethodology.md` — AI-as-judge and evaluation methods.
- `../../../HandsOnLLM/UsingPretrainedModels/TextClassification/textClassification.md` — LLMs as zero-shot labelers and classifiers.
- `../../../HandsOnLLM/TrainingAndFineTuning/FineTuningGenerationModels/fineTuningGenerationModels.md` — fine-tuning data for generative models.
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` — sampling from event streams.
- `../../../../TDD/README.md` — test-first patterns for data code.
