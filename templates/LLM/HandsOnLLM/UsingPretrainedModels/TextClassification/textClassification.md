---
name: hollm-text-classification
description: "Classifying text with pretrained language models without fine-tuning: task-specific encoder models via pipelines, frozen embedding models plus a lightweight classifier such as logistic regression, zero-shot classification by cosine similarity to label descriptions, prompting encoder-decoder (Flan-T5) and API chat models (GPT) to emit labels, parsing generated labels, model selection (BERT variants, MTEB), evaluation with precision, recall, F1 and confusion matrices, TF-IDF baselines, API cost and rate-limit handling, based on Chapter 4 (Text Classification) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when building sentiment analysis, intent detection, ticket routing, spam or moderation labels, deciding between a task model, embeddings plus classifier, zero-shot, or an LLM prompt, checking whether labeling data is worth it, or evaluating a classifier with a classification report."
---

# Text Classification

Classification is the cheapest place to start with language models, and there is a ladder of options from zero labels to a trained head. Always compare against a classic baseline, evaluate on a held-out split with per-class metrics, and pick the cheapest option that meets the target.

## The option ladder

| Option | Labels needed | Compute | When to choose |
|---|---|---|---|
| TF-IDF + logistic regression | Yes | CPU | Always build it as the baseline |
| Pretrained task-specific model (e.g. a sentiment RoBERTa) | No | Small GPU or CPU | A Hub model exists for your task and domain is close |
| Frozen embedding model + classifier | Yes (hundreds+) | Embed once, train on CPU | No ready task model; want a strong cheap model |
| Zero-shot via label-description embeddings | No | Embedding only | Feasibility check before paying for labels |
| Instruction-tuned generative model with a prompt | No (a few examples help) | GPU or API cost per call | Labels are nuanced, few or changing; accept cost and latency |
| Fine-tuned encoder (ch11) | Yes | GPU training | Best accuracy per inference cost at scale |

- In the book's sentiment benchmark the ordering was roughly: zero-shot embeddings < out-of-domain task model < Flan-T5 prompt ≈ embeddings + logistic regression < API chat model. Treat these as indicative, not universal; rerun on your data.

## Model selection

- Start from solid encoder baselines (BERT, RoBERTa, DistilBERT, DeBERTa, ALBERT; tiny variants for speed).
- For embeddings, shortlist from the MTEB leaderboard, then weigh inference speed, dimension, language coverage and license, not only score.
- Prefer a task model fine-tuned on your domain (movie reviews versus tweets) when one exists.

## Embeddings plus a classifier

```python
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

emb = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
X_train = emb.encode(train_texts, show_progress_bar=True)
X_test = emb.encode(test_texts)
clf = LogisticRegression(random_state=42, max_iter=1000).fit(X_train, y_train)
print(classification_report(y_test, clf.predict(X_test)))
```

- The embedding model stays frozen; cache embeddings to disk so classifier experiments are fast.
- Any classifier works on top; start linear.

## Zero-shot with embeddings

- Write a short description per label, embed it, assign each document the label with highest cosine similarity.
- Specific descriptions ("a very negative movie review") beat bare names; iterate on descriptions against a small labeled check set.
- Use the zero-shot score to decide whether collecting labels is worthwhile.

```python
from sklearn.metrics.pairwise import cosine_similarity
labels = emb.encode(["A very negative movie review", "A very positive movie review"])
y_pred = cosine_similarity(X_test, labels).argmax(axis=1)
```

## Generative models as classifiers

- Generative models output text, so the prompt must define the task and the exact output format ("return 1 or 0, nothing else").
- Encoder-decoder instruction models (Flan-T5) use the `text2text-generation` pipeline; decoder chat models use chat messages.
- Use temperature 0 for classification; validate and map outputs to labels with a strict parser and an "unparseable" bucket, never `int(output)` unguarded.
- APIs: track cost before running a dataset, add retry with exponential backoff for rate limits, keep keys out of code.
- Closed models may have seen public benchmarks in training; their scores on public datasets can be inflated. Evaluate on private data.

## Evaluation

- Use separate train, validation (for tuning prompts, descriptions, hyperparameters) and test splits; touch test last.
- Report per-class precision, recall and F1 plus a confusion matrix; the book uses weighted-average F1 as the headline number.
- Precision: of items labeled X, how many are X. Recall: of true X items, how many were found. Choose which matters for the business cost of errors.

## Workflow

1. Define labels precisely; collect or sample a labeled test set even if training labels are absent.
2. Build TF-IDF + logistic regression; record F1.
3. Try zero-shot embeddings and an off-the-shelf task model; record F1, latency, cost.
4. If labels exist, train a classifier on frozen embeddings.
5. Try a prompted generative model when nuance or label churn justifies it; parse strictly.
6. Pick the cheapest option meeting the target; escalate to fine-tuning (ch11) only if needed.

## Red flags

- No baseline, or only accuracy reported on imbalanced classes.
- Prompt or label descriptions tuned on the test set.
- Free-text LLM output cast directly to labels with no validation or fallback.
- Per-request LLM calls for high-volume classification a small encoder could handle.
- API keys in code, no retry/backoff, no cost estimate.
- Benchmarking a closed model on a public dataset and trusting the number.

## Testing notes

- Golden set: fixed labeled examples with a minimum F1 threshold as a regression test in CI (mark slow, run nightly if needed).
- Unit-test the output parser with valid, malformed, extra-whitespace, and wrong-case responses.
- Stub the model client to test routing logic deterministically; set `random_state` for classifiers.
- bdd: scenarios such as "a complaint about billing is routed to the billing queue" backed by example tables.

## Related

- `../TextClusteringAndTopicModeling/textClusteringAndTopicModeling.md` — when there are no labels at all.
- `../PromptEngineering/promptEngineering.md` — writing classification prompts.
- `../../TrainingAndFineTuning/FineTuningRepresentationModels/fineTuningRepresentationModels.md` — fine-tuning BERT, SetFit few-shot.
- `../../UnderstandingLanguageModels/TokensAndEmbeddings/tokensAndEmbeddings.md` — text embeddings.
- `../../../BuildLLMFromScratch/FineTuning/ClassificationFineTuning/classificationFineTuning.md` — classification head on a GPT model.
- `../../../AIEngineering/Evaluation/EvaluationMethodology/evaluationMethodology.md` — evaluating model outputs.
- `../../../DesigningMLSystems/Data/TrainingData/trainingData.md` — labeling strategies.
