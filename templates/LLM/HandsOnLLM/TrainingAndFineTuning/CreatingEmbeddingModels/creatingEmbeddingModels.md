---
name: hollm-creating-embedding-models
description: "Training and fine-tuning text embedding models: what similarity an embedding should capture, contrastive learning, bi-encoders (SBERT, Siamese, mean or CLS pooling) versus cross-encoders, building positive and negative pairs from NLI data, loss functions (softmax, cosine similarity, multiple negatives ranking / InfoNCE with in-batch negatives), easy, semi-hard and hard negatives, SentenceTransformerTrainer with training arguments, STSB and MTEB evaluation, supervised fine-tuning of a pretrained embedding model, Augmented SBERT with a cross-encoder labeling a silver dataset, unsupervised TSDAE, and domain adaptation by adaptive pretraining, based on Chapter 10 (Creating Text Embedding Models) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when off-the-shelf embeddings underperform on your domain, fine-tuning a retriever on query-document pairs, choosing a sentence-transformers loss, mining hard negatives, labeling pairs cheaply with a cross-encoder, training embeddings without labels, or evaluating embedding quality."
---

# Creating Text Embedding Models

An embedding model learns whatever notion of similarity its training pairs express, so the data you contrast (positives and, above all, negatives) defines the model. Prefer fine-tuning a strong pretrained embedding model over training from scratch, and evaluate on a task that matches how the embeddings will be used.

## Decide what "similar" means

- Semantic similarity, sentiment similarity, query–answer relevance, and duplicate detection are different targets. Choose training pairs that express your target.
- Contrastive learning teaches "why this and not that": show related pairs and unrelated pairs so the model learns distinguishing features.

## Bi-encoder versus cross-encoder

| | Bi-encoder (SBERT) | Cross-encoder |
|---|---|---|
| Input | Each text encoded separately, pooled to a vector | Both texts together in one pass |
| Output | Reusable embeddings | A similarity/relevance score, no embedding |
| Speed at scale | Fast: embed once, compare by cosine | Slow: one pass per pair (quadratic for all-pairs) |
| Accuracy | Good | Usually better |
| Use for | Retrieval, clustering, first stage | Reranking, labeling pairs (Augmented SBERT) |

- Raw BERT `[CLS]` or averaged outputs make poor sentence embeddings; train with a contrastive objective.

## Training data

- NLI datasets give pairs: entailment as positives, contradiction (and often neutral) as negatives.
- Domain pairs often come for free: question/answer, title/abstract, query/clicked document, image/caption.
- Smaller datasets make training unstable; quality matters as much as size.

## Loss functions

| Loss | Data | Notes |
|---|---|---|
| `SoftmaxLoss` | Labeled pairs (classes) | Original SBERT; generally outperformed, avoid |
| `CosineSimilarityLoss` | Pairs with a 0–1 similarity score | Good for semantic textual similarity |
| `MultipleNegativesRankingLoss` (InfoNCE) | Positive pairs or (anchor, positive, negative) triplets | Strong default; other pairs in the batch act as negatives; larger batches make it harder and usually better |
| `MarginMSELoss` | Teacher score margins | Useful for training cross-encoders/distillation |

In the book's runs on the same small NLI subset, MNR beat cosine loss, which beat softmax loss, on STSB.

## Negatives

- **Easy**: random documents; cheap but teach little.
- **Semi-hard**: nearest neighbors from a pretrained embedding model; related topic, not necessarily wrong answers.
- **Hard**: on-topic but wrong (a sentence about Utrecht's population for a question about Amsterdam's). Produce by manual labeling or with a generative model judging or generating pairs. Hard negatives usually improve quality most.
- Check mined negatives are not actually positives (false negatives poison training).

## Training with sentence-transformers

```python
from sentence_transformers import SentenceTransformer, losses
from sentence_transformers.trainer import SentenceTransformerTrainer
from sentence_transformers.training_args import SentenceTransformerTrainingArguments
from sentence_transformers.evaluation import EmbeddingSimilarityEvaluator

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")   # fine-tune, not from scratch
loss = losses.MultipleNegativesRankingLoss(model)
evaluator = EmbeddingSimilarityEvaluator(sts["sentence1"], sts["sentence2"],
                                         [s / 5 for s in sts["label"]], main_similarity="cosine")
args = SentenceTransformerTrainingArguments(output_dir="ft_embed", num_train_epochs=1,
    per_device_train_batch_size=32, warmup_steps=100, fp16=True, eval_steps=100, logging_steps=100, seed=42)
SentenceTransformerTrainer(model=model, args=args, train_dataset=triplets,
                           loss=loss, evaluator=evaluator).train()
```

- Dataset columns must match the loss (anchor/positive/negative for MNR triplets; sentence1/sentence2/label for cosine).
- All layers are trainable by default; that usually works better than freezing.
- Free GPU memory between experiments (restart the process).

## Evaluation

- STSB (human similarity 0–5, rescaled to 0–1) with Pearson/Spearman on cosine gives a quick signal.
- MTEB covers many tasks and languages (and records evaluation time); run the subsets matching your use (retrieval, clustering, classification).
- Your own retrieval suite (ch8) is the decisive test; benchmark gains may not transfer.
- Weigh latency and dimension alongside accuracy.

## Little or no labeled data

- **Augmented SBERT**: (1) train a cross-encoder on a small gold set, (2) create candidate pairs (prefer top-k neighbors from a pretrained embedder over random pairing, which yields mostly negatives), (3) label them with the cross-encoder to form a silver set, (4) train the bi-encoder on gold + silver. In the book, 20% of the data plus silver labels nearly matched training on all of it. Train on gold alone too, to measure what silver adds.
- **Unsupervised**: SimCSE, Contrastive Tension, TSDAE, GPL. TSDAE deletes words, encodes the damaged sentence (CLS pooling), and trains a tied decoder to reconstruct the original.
- **Domain adaptation**: adaptive pretraining on the target domain (TSDAE or masked language modeling), then fine-tune with supervised data, even out-of-domain or Augmented SBERT.
- **Current note:** strong general-purpose embedding models, including instruction-prefixed and LLM-based embedders, are now widely available; fine-tune only after measuring a gap on your own evaluation suite.

## Workflow

1. Define the similarity target and build an in-domain evaluation set (pairs with scores or queries with relevant documents).
2. Benchmark several pretrained embedding models on it.
3. Collect positive pairs; mine semi-hard/hard negatives and spot-check them.
4. Fine-tune with MNR loss (or cosine for scored pairs) from the best pretrained model.
5. With little data, use Augmented SBERT; with none, TSDAE or adaptive pretraining.
6. Compare against the baseline on your suite and MTEB subsets; check latency.
7. Version the model and re-embed the whole corpus on upgrade.

## Red flags

- Training from `bert-base` when a pretrained sentence model would start far ahead.
- Softmax loss chosen by default; tiny batches with MNR loss.
- Only random negatives for a retrieval model meant to separate near-miss answers.
- Evaluating only on STSB when the product is retrieval.
- Test pairs leaking into training; duplicate pairs in a batch for MNR (false in-batch negatives).
- Upgrading the embedding model without rebuilding the vector index.

## Testing notes

- Data tests: column names match the loss, no empty strings, no overlap between train and eval pairs, negatives differ from positives.
- Smoke-train a few steps on a tiny dataset in CI and assert loss decreases and output dimension is unchanged.
- Fix `seed`; report metrics with the dataset revision and model hash.
- Regression gate: new model must not drop below baseline on the in-domain suite (recall@k, MAP, Spearman).
- Golden triplets: assert sim(anchor, positive) > sim(anchor, hard negative) for a curated set.

## Related

- `../FineTuningRepresentationModels/fineTuningRepresentationModels.md` — SetFit builds on contrastive fine-tuning.
- `../../UsingPretrainedModels/SemanticSearchAndRAG/semanticSearchAndRAG.md` — where retrieval embeddings are used and evaluated.
- `../../UsingPretrainedModels/MultimodalLLMs/multimodalLLMs.md` — contrastive learning for image–text.
- `../../UnderstandingLanguageModels/TokensAndEmbeddings/tokensAndEmbeddings.md` — word2vec as early contrastive training.
- `../../../AIEngineering/Adaptation/DatasetEngineering/datasetEngineering.md` — synthetic and curated training data.
- `../../../DesigningMLSystems/Data/TrainingData/trainingData.md` — labeling and weak supervision.
