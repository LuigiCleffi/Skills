---
name: hollm-fine-tuning-representation-models
description: "Fine-tuning encoder (BERT-like) models for classification: full fine-tuning of a pretrained model plus classification head with Hugging Face Trainer, tokenization, DataCollatorWithPadding and compute_metrics, freezing layers and its accuracy-versus-compute trade-off, few-shot classification with SetFit (pair sampling, contrastive embedding fine-tuning, classifier head, zero-shot synthetic examples), continued pretraining with masked language modeling (token versus whole-word masking) for domain adaptation, and named-entity recognition as token classification with BIO tags, subword label alignment, -100 ignore labels, and seqeval F1, based on Chapter 11 (Fine-Tuning Representation Models for Classification) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when frozen embeddings or prompts are not accurate enough, training a sentiment, intent or topic classifier, having only a handful of labels per class, adapting BERT to domain jargon, extracting people, organizations or locations, de-identifying PII, or deciding which layers to freeze under a GPU budget."
---

# Fine-Tuning Representation Models for Classification

With enough labeled data, fine-tuning the whole encoder together with its head usually gives the best accuracy per unit of inference cost. Match the technique to your labels: full fine-tuning for plenty, SetFit for a few per class, continued masked-language pretraining for unusual domains, token classification for entities.

## Choosing the technique

| Situation | Technique | Book result on movie-review sentiment (F1) |
|---|---|---|
| Thousands of labels | Fine-tune BERT + head | ~0.85, above the frozen out-of-domain task model (~0.80) |
| GPU-limited | Freeze lower blocks, train top blocks + head | Head only ~0.63; training the top blocks recovers most of the gap |
| ~16 labels per class | SetFit | ~0.85 with 32 examples total |
| Domain jargon, unlabeled domain text available | Continue MLM pretraining, then fine-tune | Model's vocabulary shifts toward the domain |
| Labels per word | Token classification (NER) | Entity-level F1 |

## Full fine-tuning

```python
from transformers import (AutoTokenizer, AutoModelForSequenceClassification,
                          DataCollatorWithPadding, TrainingArguments, Trainer)
model_id = "bert-base-cased"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForSequenceClassification.from_pretrained(model_id, num_labels=2)
tok = lambda b: tokenizer(b["text"], truncation=True)
train, val = splits["train"].map(tok, batched=True), splits["validation"].map(tok, batched=True)
args = TrainingArguments("model", learning_rate=2e-5, per_device_train_batch_size=16,
                         num_train_epochs=1, weight_decay=0.01, eval_strategy="epoch",
                         save_strategy="epoch", report_to="none", seed=42)
trainer = Trainer(model=model, args=args, train_dataset=train, eval_dataset=val,
                  data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=compute_metrics)
trainer.train()
```

- Pad dynamically per batch with a collator; truncate to the model's maximum length.
- Track the metric you care about (F1) during training through `compute_metrics` to detect overfitting.
- Tune on the validation split; evaluate the test split once at the end.
- **Current note:** `datasets.load_metric` used in the book has been removed in favor of the `evaluate` library, and the `Trainer(tokenizer=...)` argument has been renamed (`processing_class`) in recent `transformers`; check your installed versions.

## Freezing layers

- Inspect `model.named_parameters()`: embeddings, 12 encoder blocks, pooler, classifier for BERT-base.
- Freeze by setting `requires_grad=False`; frozen layers should precede trainable ones.
- Training only the head is fast but much worse; unfreezing the top few blocks recovers most accuracy. Gains flatten after a few blocks, so trade blocks for compute deliberately.
- Freeze by module name (e.g. `bert.encoder.layer.{i}`) rather than parameter index, which is brittle.

## SetFit for few-shot classification

1. Sample pairs: same-class pairs are positives, cross-class pairs negatives (a few labeled examples produce many pairs).
2. Contrastively fine-tune a pretrained sentence-transformer on those pairs.
3. Train a classifier head (logistic regression by default, or a differentiable head) on the tuned embeddings.

```python
from setfit import SetFitModel, Trainer as SetFitTrainer, TrainingArguments as SetFitArgs, sample_dataset
few = sample_dataset(splits["train"], num_samples=16)
model = SetFitModel.from_pretrained("sentence-transformers/all-mpnet-base-v2")
trainer = SetFitTrainer(model=model, args=SetFitArgs(num_epochs=3, num_iterations=20),
                        train_dataset=few, eval_dataset=splits["validation"], metric="f1")
trainer.train(); trainer.evaluate()
```

- SetFit can also go zero-shot by generating synthetic examples from label names.
- Spend effort on choosing a few high-quality, representative examples per class.

## Continued pretraining (MLM)

- Insert a step between generic pretraining and task fine-tuning: continue masked language modeling on domain text (general BERT, then domain BERT, then task model).
- Token masking (15% of tokens) converges faster; whole-word masking is harder and can learn better representations.
- Use `DataCollatorForLanguageModeling(tokenizer, mlm=True, mlm_probability=0.15)`; drop labels.
- The tokenizer is not updated; save it alongside the model. Sanity-check with a fill-mask pipeline: predictions should shift toward domain words.

## Named-entity recognition

- Labels use BIO tags: `B-` begins an entity, `I-` continues it, `O` is outside.
- Words split into subword tokens need aligned labels: first subtoken keeps the word's label, following subtokens get the `I-` variant (or -100 to score only first subtokens); special tokens get -100 so the loss ignores them.
- Use `AutoModelForTokenClassification` with `id2label`/`label2id`, `DataCollatorForTokenClassification`, and `is_split_into_words=True` with `word_ids()` for alignment.
- Evaluate entity-level F1 with seqeval over whole sequences (pass a list of label sequences per sentence, not one token per sequence, or entity spans are not scored correctly).
- Use cases include de-identification and anonymization; review recall carefully since a missed entity leaks data.

## Workflow

1. Confirm a frozen baseline (ch4) and a target metric on a validation split.
2. Pick the technique by label count and domain (table above).
3. Fine-tune with fixed seed, dynamic padding, and per-epoch validation metrics.
4. If compute-bound, freeze lower blocks and measure the trade-off.
5. For jargon-heavy domains, continue MLM pretraining on unlabeled domain text first.
6. Evaluate on the untouched test split; inspect errors per class or entity type.
7. Save model, tokenizer, label maps and training config together.

## Red flags

- Selecting checkpoints or hyperparameters on the test split (the book's examples pass the test split as `eval_dataset` for brevity; do not copy that).
- Head-only training presented as "fine-tuning" without comparing to unfrozen blocks.
- NER labels not aligned to subword tokens, or special tokens not set to -100.
- Token-level accuracy reported for NER instead of entity-level F1 (O tags dominate).
- Missing `id2label`/`label2id`, producing `LABEL_0` outputs in production.
- Continued pretraining on text that overlaps the evaluation set.

## Testing notes

- Unit-test label alignment on crafted examples (a word split into three subtokens, special tokens, truncation) and assert exact label sequences.
- Overfit test: training on a few examples for several steps should drive loss near zero; if not, wiring is broken.
- Fixed seeds and a frozen validation set; regression-gate on F1 against the baseline.
- For SetFit, run several seeds and report mean and spread; few-shot results vary with the sampled examples.
- bdd: example tables of texts with expected labels or entities, including tricky negatives.

## Related

- `../../UsingPretrainedModels/TextClassification/textClassification.md` — frozen-model baselines to beat.
- `../CreatingEmbeddingModels/creatingEmbeddingModels.md` — contrastive learning behind SetFit.
- `../FineTuningGenerationModels/fineTuningGenerationModels.md` — fine-tuning decoders instead.
- `../../../BuildLLMFromScratch/FineTuning/ClassificationFineTuning/classificationFineTuning.md` — classification head on a GPT model.
- `../../../AIEngineering/Adaptation/Finetuning/finetuning.md` — when and how to fine-tune.
- `../../../DesigningMLSystems/Modeling/ModelDevelopment/modelDevelopment.md` — experiment tracking and baselines.
