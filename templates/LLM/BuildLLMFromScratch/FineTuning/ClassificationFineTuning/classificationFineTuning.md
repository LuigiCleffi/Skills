---
name: llm-scratch-classification-fine-tuning
description: "Fine-tuning a pretrained GPT model as a text classifier: instruction vs classification fine-tuning trade-offs, balancing a labeled dataset by undersampling, train/validation/test splits, padding to a fixed length with the end-of-text token, replacing the output head with a small class head, freezing the model and unfreezing the last transformer block and final norm, using the last token's output under causal attention, cross-entropy loss and accuracy on the last token, choosing epochs, and classifying new text, based on Chapter 6 (Fine-tuning for classification) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when turning an LLM into a spam, sentiment, intent or topic classifier, deciding which layers to train, reading out a decoder model's prediction, handling class imbalance, or evaluating a fine-tuned classifier's accuracy."
---

# Classification Fine-Tuning

To classify text with a GPT model, swap its vocabulary-sized output head for a head with one output per class, train only the top of the network, and read the prediction from the last token, the only position that has attended to the whole input. It needs far less data and compute than instruction fine-tuning but can only ever answer with its fixed labels.

## Classification vs instruction fine-tuning

| | Classification | Instruction |
|---|---|---|
| Output | one of a fixed label set | free text |
| Data and compute | less | more |
| Flexibility | single task, highly specialized | general, many tasks |
| Choose when | labels are known and stable, precise categorization matters | users phrase varied tasks in natural language |

## Prepare the data

- Inspect the label distribution. The book balances a skewed spam set by undersampling the majority class to the minority count; other remedies (class weights, oversampling) also work.
- Map labels to integers starting at 0.
- Split into train, validation and test (the book uses 70/10/20) after shuffling with a fixed seed.
- Tokenize; pad every example to one length (the longest training example, or the context length) with the end-of-text ID 50256; truncate longer texts. Pad validation and test to the same length as training.

## Modify the model

1. Load pretrained GPT-2 weights (see the pretraining skill).
2. Freeze everything: `requires_grad = False` on all parameters.
3. Replace `out_head` with `nn.Linear(emb_dim, num_classes)`; new layers are trainable by default.
4. Unfreeze the last transformer block and the final LayerNorm. Lower layers hold general language features; the top layers adapt to the task, and training fewer layers is cheaper. Training all layers is an option when data allows.

```python
import torch
import torch.nn as nn

def prepare_classifier(model, emb_dim, num_classes):
    for p in model.parameters():
        p.requires_grad = False
    model.out_head = nn.Linear(emb_dim, num_classes)
    for p in model.trf_blocks[-1].parameters():
        p.requires_grad = True
    for p in model.final_norm.parameters():
        p.requires_grad = True
    return model

def calc_loss_batch(inputs, labels, model, device):
    logits = model(inputs.to(device))[:, -1, :]          # last token: (b, num_classes)
    return nn.functional.cross_entropy(logits, labels.to(device))

@torch.no_grad()
def accuracy(loader, model, device):
    model.eval()
    correct = total = 0
    for x, y in loader:
        preds = model(x.to(device))[:, -1, :].argmax(dim=-1)
        correct += (preds == y.to(device)).sum().item()
        total += y.numel()
    return correct / total
```

## Why the last token

- Under the causal mask, position `t` sees only tokens `0..t`. Only the final position has information about the entire input, so its output vector is the natural sequence summary. The first token sees only itself.
- With right padding, the last position is a pad token that still attends to all real tokens; this works, but the readout shifts with padding length.

## Train and evaluate

- Accuracy is not differentiable, so optimize cross-entropy on the last-token logits and report accuracy.
- Before training, accuracy should be near chance (about 50% for two balanced classes); measure it as a baseline.
- The book trains with AdamW (`lr=5e-5, weight_decay=0.1`) for five epochs and reaches mid-90s test accuracy on balanced spam data.
- Five epochs is a reasonable start; reduce if validation loss rises early, increase if it is still falling.
- Expect validation accuracy slightly above test accuracy because choices were tuned on validation. Narrow a large gap with more dropout or weight decay.

## Inference

- Apply exactly the training preprocessing: tokenize, truncate to the trained length (never beyond the model's context length, `pos_emb.weight.shape[0]`), pad with the same token, add the batch dimension, run under `eval()` and `no_grad()`, `argmax` the last-token logits, and map the index back to a label name.
- Save the fine-tuned `state_dict` together with the label mapping and the padding length.

**Current note:** a common refinement is to read the logits at the last non-padding token (or use left padding) instead of the final padded position, and to pass an attention mask so padding is ignored. For pure classification, a small encoder model or an embedding model plus a light classifier is often a cheaper baseline worth comparing against.

## Workflow

1. Define labels and check class balance; balance or weight.
2. Split with a fixed seed; tokenize and pad all splits to the training length.
3. Load pretrained weights; measure zero-shot accuracy as a baseline.
4. Freeze, replace the head, unfreeze the last block and final norm.
5. Train on last-token cross-entropy; track loss and accuracy per epoch on train and validation.
6. Report test accuracy once; save weights with preprocessing settings.

## Red flags

- Using the first token's or a mean over padded positions' output without a mask.
- Vocabulary-sized head left in place and labels compared to token IDs.
- All parameters frozen, including the new head (nothing trains), or nothing frozen by accident when memory is tight.
- Validation and test padded to different lengths than training; inference preprocessing that differs from training.
- Reporting only accuracy on imbalanced data; tuning on the test set.

## Testing notes

- Shape test: after `prepare_classifier`, logits are `(b, T, num_classes)` and the last-token slice is `(b, num_classes)`.
- Freezing test: count trainable parameters and assert only the last block, final norm and new head are trainable.
- Golden set: a fixed, labeled sample of real messages with expected labels; assert accuracy above a threshold in CI, with a confusion matrix for review.
- Padding robustness: the same text padded to different lengths should give the same label.
- bdd: scenarios phrase business rules (obvious spam is flagged, a normal message is not) and call the same `classify` function production uses.

## Related

- `../../Training/Pretraining/pretraining.md` — loading GPT-2 weights first.
- `../../Architecture/AttentionMechanisms/attentionMechanisms.md` — causal masking behind the last-token choice.
- `../InstructionFineTuning/instructionFineTuning.md` — the generalist alternative.
- `../LoRA/loRA.md` — training adapters instead of unfreezing layers.
- `../../../HandsOnLLM/UsingPretrainedModels/TextClassification/textClassification.md` — classification with pretrained and embedding models.
- `../../../HandsOnLLM/TrainingAndFineTuning/FineTuningRepresentationModels/fineTuningRepresentationModels.md` — fine-tuning encoder classifiers.
- `../../../DesigningMLSystems/Data/TrainingData/trainingData.md` — class imbalance and labeling.
