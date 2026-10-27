## AI Skills

Before scoping an ML or LLM feature, building data pipelines or training
sets, engineering features, choosing and evaluating a model, deciding how
predictions are served, or diagnosing a model that degrades in production,
find the skills that apply to the task in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed. The skills are written for ML systems in general; each
one notes how its lessons apply when the model is an LLM (leakage into
eval sets, shifting prompts, batch vs online prediction for LLM features).

Each skill comes from one chapter of Chip Huyen's *Designing Machine
Learning Systems: An Iterative Process for Production-Ready Applications*
(O'Reilly, 2022). The source used is the Early Release, which contains
chapters 1–7 only. Later chapters of the final book (continual learning
and testing in production, monitoring infrastructure, the MLOps platform,
and the human side of ML) are not covered here; for LLM-specific
evaluation, feedback, and inference see `../AIEngineering/`.

### Foundations

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./Foundations/MLSystemsInProduction/mlSystemsInProduction.md` | Scoping a new ML or LLM feature, asking whether a model is needed at all, gathering stakeholder requirements, setting latency percentiles, or writing an ML design doc. |

### Data

| Ch | Skill | Use when |
|---|---|---|
| 2 | `./Data/DataEngineeringFundamentals/dataEngineeringFundamentals.md` | Choosing storage formats or data models for training data, logs or prompts, designing ETL/ELT or feature pipelines, picking service calls vs event streams, splitting batch (static) from streaming (dynamic) features. |
| 3 | `./Data/TrainingData/trainingData.md` | Building or sampling a training or fine-tuning set, annotators or LLM labelers disagree, labels are scarce, costly or private, choosing what to label next, a rare class is ignored, or generating synthetic or augmented data. |
| 4 | `./Data/FeatureEngineering/featureEngineering.md` | Adding or encoding features, imputing missing values, scaling or bucketing, splitting train/test by time or group, offline scores look too good (leakage), or checking an LLM eval set for contamination. |

### Modeling

| Ch | Skill | Use when |
|---|---|---|
| 5 | `./Modeling/ModelDevelopment/modelDevelopment.md` | Turning a request into an ML/LLM task, picking heuristic vs classic model vs prompt vs fine-tune, setting baselines, tracking experiments, debugging a model that predicts badly, or judging offline readiness. |

### Production

| Ch | Skill | Use when |
|---|---|---|
| 6 | `./Production/ModelDeployment/modelDeployment.md` | Choosing batch vs online prediction for a model or LLM feature, precomputing outputs vs per-request calls, a model is too slow or costly to serve, quantizing or distilling, cloud vs on-device inference, or training/serving pipelines diverge. |
| 7 | `./Production/WhyMLSystemsFail/whyMLSystemsFail.md` | A deployed model or LLM feature degrades over time, metrics drift on dashboards, planning post-deploy monitoring or drift tests, designing click/feedback labels, a ranker keeps surfacing the same items, or deciding when to retrain. |

# Context for AI: Designing ML Systems

## 1. The Model Is a Small Part of the System

Design the interface, data, features, serving, and monitoring together.
Check first that ML fits the problem and that a simple non-ML baseline
cannot do the job; for LLM features, a rule or lookup still wins when the
pattern is simple.

## 2. Requirements Come From Stakeholders, in Numbers

Collect each stakeholder's goal, mark it must-have or nice-to-have, and
state it measurably: latency as percentiles, cost per prediction, accuracy
floors, fairness per group.

## 3. Data Decides Quality

Data, labels, and features drive results more than the algorithm. Version
data, prompts, and training sets like code, record lineage, and treat
synthetic or LLM-generated labels as data to be checked, not trusted.

## 4. Evaluate Honestly

Split by time or group, keep test data out of every fitting step, and
check eval sets for contamination. Compare against baselines and report
metrics per slice, not only overall.

## 5. Serve Within the Budget

Choose batch or online prediction, cloud or edge, and compress the model
until it meets the latency and cost budget. Keep one feature (or prompt)
pipeline for training and serving.

## 6. Expect Silent Failure and Shift

ML systems fail without errors. Monitor inputs and outputs for
distribution shift, watch for degenerate feedback loops, and plan how and
when the model is updated.

## How the AI Should Apply It

- Match the task to the "Use when" column and read only those skills.
- For a new feature, start with Chapter 1, then follow the stages in order:
  data, training data, features, model development, deployment, failure
  modes.
- When the model is an LLM, apply each skill's LLM notes and pair it with
  the matching skill in `../AIEngineering/` or `../HandsOnLLM/`.
- Do not invent business numbers, labels, or eval results; state which
  inputs were assumed rather than measured.
- Remember the coverage gap: for continual learning and monitoring
  platforms, say the source does not cover them and use other references.
