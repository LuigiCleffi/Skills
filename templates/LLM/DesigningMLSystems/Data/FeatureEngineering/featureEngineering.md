---
name: dmls-feature-engineering
description: "Learned vs engineered features, missing values (MNAR, MAR, MCAR), deletion vs imputation, scaling, standardization and log transforms, discretization, encoding categorical features with unseen categories and the hashing trick, feature crossing, positional embeddings and Fourier features, data leakage causes and detection, feature importance (SHAP, ablation) and feature generalization (coverage, value overlap), based on Chapter 4 (Feature Engineering) of Chip Huyen's Designing Machine Learning Systems. Use when adding or removing model features, imputing missing values, scaling or bucketing inputs, encoding IDs or categories that grow in production, splitting data into train/validation/test, a model scores suspiciously well offline but fails in production, checking an LLM eval set for contamination, or deciding what context and metadata to feed an LLM."
---

# Feature Engineering

Once a model works at all, the right features usually buy more than clever tuning, and the wrong ones (leaky, non-generalizing, or unmaintained) cause the worst production failures. Engineer features with the split, the serving path, and the label's provenance in mind, and treat data leakage as the default suspect whenever offline results look too good.

## Learned vs engineered features

- Deep models learn features from raw text, images and audio, so hand-made n-grams, lemmatization or stopword lists are rarely worth it there.
- They do not remove the need for features about context: who posted, account age, thread popularity, transaction history. Those come from domain knowledge and data joins, not from the model.
- Most production ML is still tabular and classical; expect to hand-engineer features there, and involve subject matter experts (fraud, medicine) in the workflow even if they are not engineers.
- **LLM note:** for an LLM the "features" are what goes into the context: retrieved documents, user and account metadata, tool results, conversation history. Choosing, formatting and ordering them is feature engineering, with the same leakage, coverage and skew risks.

## Common operations

| Operation | Use it for | Watch out for |
|---|---|---|
| Missing values | Every real dataset | Not all missing values are alike (below) |
| Min-max scaling to [0,1] or [-1,1] | No assumption on distribution | Needs train-split min/max reused at inference |
| Standardization (z-score) | Roughly normal features | Same: train-split mean and std only |
| Log transform | Skewed features (income, counts) | Analysis on transformed data can mislead |
| Discretization (buckets) | Continuous values whose fine differences don't matter | Boundaries from histograms, quantiles, domain sense |
| Categorical encoding | Brands, accounts, domains, IPs | New categories appear in production constantly |
| Feature crossing | Non-linear interactions for linear and tree models | Cardinality blow-up, more data needed, overfitting |
| Positional embeddings | Sequence order for transformers; Fourier features for continuous coordinates | Learned positions only cover lengths seen in training |

### Missing values

- **MNAR** (missing because of the value itself, e.g. high earners skip income): the missingness is a signal; keep it, add an "is missing" indicator.
- **MAR** (missing because of another observed variable, e.g. one group skips age): deleting those rows silently removes that group from the model.
- **MCAR** (no pattern): rare; investigate before assuming it.
- Column deletion can throw away a strongly predictive variable; row deletion is acceptable only for MCAR and a tiny fraction of rows.
- Impute with defaults or mean/median/mode, but never with a value that is also valid (0 children, age 0): it makes "unknown" indistinguishable from a real answer, and a value never seen in training produces garbage predictions. When an upstream form stops collecting a field, the model sees a flood of imputed values; alert on that.

### Categories that grow

Mapping each known category to an index breaks on unseen values; a single UNKNOWN bucket either crashes nothing but starves new items (never seen in training) or lumps luxury brands with knockoffs. Use the hashing trick: hash into a fixed space so any value, seen or not, gets an index. Collisions are random and, in published industry experience, cost little; enlarge the space to reduce them.

```python
from sklearn.feature_extraction import FeatureHasher
hasher = FeatureHasher(n_features=2**18, input_type="string")
X = hasher.transform([["brand=acme"], ["brand=never-seen-before"]])  # both encode, no refit
```

**LLM note:** tokenizers already solve the open-vocabulary problem for text, but IDs passed as features (user, tenant, product) still need hashing or embeddings; embeddings from a pretrained encoder are the modern form of a learned categorical feature and must come from the same model version in training and serving.

## Data leakage

Leakage is when some form of the label reaches the features in training but is not available at prediction time. It survives careful evaluation and fails spectacularly in production. Common causes:

1. **Random split of time-correlated data.** Future information (that day's market or trend) leaks into training. Split by time: e.g. train on weeks 1 to 4, split week 5 into validation and test.
2. **Scaling before splitting.** Global mean/std include the test split. Split first, fit statistics on train, apply to all splits.
3. **Imputing with full-data statistics.** Same fix: train-split statistics only.
4. **Duplicates across splits.** From collection, merges, or oversampling. Deduplicate before and check after splitting; oversample only after splitting.
5. **Group leakage.** Correlated examples (two scans of one patient, one user's sessions) land in different splits. Split by group.
6. **Collection-process leakage.** The data source encodes the label (sicker patients sent to a different scanner). Track lineage and normalize away source artifacts.

```python
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

df = df.sort_values("event_time")
train, holdout = df[df.event_time < cutoff], df[df.event_time >= cutoff]
scaler = StandardScaler().fit(train[num_cols])        # fit on train only
gss = GroupShuffleSplit(n_splits=1, test_size=0.5, random_state=0)
val_idx, test_idx = next(gss.split(holdout, groups=holdout.patient_id))
```

**Detecting it:** look for features with unusually high correlation to the label (alone or in combination, like start date plus end date giving tenure); run ablations on suspicious features; distrust a new feature that jumps the metric; and use the test split only to report final performance, never for feature ideas or tuning.

**LLM note:** the biggest leak in LLM work is eval contamination: benchmark or golden-set items present in pretraining or fine-tuning data, near-duplicate paraphrases across train and eval, and eval items reused as few-shot examples in the prompt. Deduplicate with exact and fuzzy (n-gram or embedding) matching, keep eval sets private and dated, and prefer items created after the model's training cutoff.

## Engineering good features

- More features mean more leakage risk, overfitting, memory and serving cost, online latency (features computed at request time), and technical debt when upstream data changes. Prune features that no longer help; keep their definitions to reuse later.
- **Importance:** built-in tree importances, SHAP for global and per-prediction contributions, ablation as the intuitive check. Typically a few features carry most of the importance.
- **Generalization:** drop pure identifiers (a comment ID); check coverage (share of rows with a value) per slice and per split; a big coverage gap between train and test signals a bad split or leakage. Check value overlap: a day-of-week feature with Monday to Saturday in train and Sunday in test hurts. Trade specificity for generality deliberately (hour of day vs is-rush-hour) rather than replacing one with the other blindly.

## Workflow

1. List candidate features with their source, owner, and when each value becomes known relative to the label.
2. Split first: by time when data is time-correlated, by group when examples are correlated; deduplicate before and verify after.
3. Classify missingness per column (MNAR, MAR, MCAR); choose deletion, imputation and missing indicators accordingly.
4. Fit scalers, imputers, vocabularies and buckets on the train split only; persist them and reuse the same artifacts in serving.
5. Encode open-ended categories with hashing or embeddings; add crosses only where the model can't learn the interaction.
6. Screen for leakage: label correlations, ablations, suspicious jumps, coverage gaps between splits.
7. Measure importance and generalization; remove features that cost more than they return.
8. For LLM systems, apply the same steps to prompt context and to the eval set: decontaminate, version, and log exactly what context each prediction saw.

## Red flags

- `fit_transform` on the full dataset, or `train_test_split(..., shuffle=True)` on events with timestamps.
- Oversampling, augmentation or deduplication done before the split.
- Imputing with 0 or "" where that is a legal value, with no missing indicator.
- A category-to-index dictionary built once with no plan for unseen values.
- A feature that is only computable after the outcome (refund issued, ticket resolved, final diagnosis).
- Offline metric far above anything in the literature or above the previous model, with no ablation explaining it.
- Test set consulted during feature design or hyperparameter tuning.
- Preprocessing code duplicated between training notebook and serving service.
- LLM: golden-set questions also used as few-shot examples, or eval data scraped from the public web after the model's cutoff without a contamination check.

## Testing notes

- Unit test transforms deterministically: a fitted scaler applied to a fixed frame gives known values; serialize, reload and assert identical output (train/serve parity).
- Test that every transform's fitted statistics come from train rows only (e.g. assert scaler mean equals train mean, not full-data mean).
- Split tests: max(train time) < min(test time); no group ID and no content hash appears in more than one split.
- Unseen-category test: encode a value never seen in training and assert no exception and an in-range index.
- Missing-value test: a row with every optional field absent still produces a valid, non-default-looking prediction path, and missing indicators are set.
- Leakage regression test: train a quick model on each single feature; fail the build if any feature alone exceeds a sanity threshold on validation.
- LLM evals: run an n-gram or embedding near-duplicate check between eval items and any training or few-shot data; record dataset and prompt versions with every eval run so results are reproducible.

**Current note:**
- Feature stores and shared transformation code are now a common way to guarantee the same feature logic offline and online; not all of them manage feature definitions, so check what yours versions.
- Benchmark contamination is a widely recognized problem for public LLM benchmarks; treat public leaderboard scores as weak evidence and rely on private, recently created eval sets for decisions.
- Most current transformer LLMs use relative or rotary position schemes rather than the absolute learned or sinusoidal embeddings the chapter describes; the underlying lesson (order must be encoded explicitly, and lengths beyond training are risky) still holds.

## Related

- `../TrainingData/trainingData.md` — sampling, labeling, class imbalance, and augmentation before features.
- `../DataEngineeringFundamentals/dataEngineeringFundamentals.md` — sources, formats, batch vs streaming features.
- `../../Modeling/ModelDevelopment/modelDevelopment.md` — baselines, ablations and offline evaluation.
- `../../Production/ModelDeployment/modelDeployment.md` — online feature computation and latency.
- `../../Production/WhyMLSystemsFail/whyMLSystemsFail.md` — train-serving skew and distribution shift.
- `../../../HandsOnLLM/UnderstandingLanguageModels/TokensAndEmbeddings/tokensAndEmbeddings.md` — tokens and embeddings as learned features.
- `../../../AIEngineering/Adaptation/DatasetEngineering/datasetEngineering.md` — deduplication and data quality for LLM datasets.
- `../../../AIEngineering/Evaluation/EvaluationMethodology/evaluationMethodology.md` — contamination and eval design.
- `../../../../DataSystems/Foundations/EncodingAndEvolution/encodingAndEvolution.md` — schema evolution for feature data.
- `../../../../TDD/README.md` — test-first for transforms and pipelines.
