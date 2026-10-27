---
name: llm-scratch-instruction-fine-tuning
description: "Supervised instruction fine-tuning of a pretrained GPT model: instruction-input-response datasets, Alpaca and Phi-3 style prompt templates, train/validation/test splits, a custom collate function that pads per batch, shifts targets, keeps one end-of-text token and masks padding with ignore_index -100, optional masking of instruction tokens, truncation to an allowed max length, moving batches to the device in the collate function, fine-tuning GPT-2 medium with the pretraining loop, extracting responses, and scoring them with a judge LLM against references, based on Chapter 7 (Fine-tuning to follow instructions) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when building an instruction or chat fine-tuning dataset, writing a collate function or loss mask for SFT, choosing a prompt template, debugging a model that rambles past its answer, or evaluating instruction-following with LLM-as-a-judge."
---

# Instruction Fine-Tuning

Instruction fine-tuning is next-token training on prompt-formatted instruction/response pairs. Most of the work is in the data: one consistent template, per-batch padding, targets shifted by one, padding excluded from the loss with `-100`, and an end-of-text token kept so the model learns to stop. Evaluate generated answers, not just loss.

## Dataset and template

- Each entry has an `instruction`, an optional `input`, and an `output`. The book uses about 1,100 entries split 85% train, 10% test and 5% validation.
- Choose one prompt style and use it everywhere: training, validation, generation and evaluation.
  - **Alpaca style**: a preamble, then `### Instruction:`, optional `### Input:`, and `### Response:` sections. Used in the book.
  - **Phi-3 style**: `<|user|>` and `<|assistant|>` turns; shorter prompts.
- If a model was already instruction-tuned with a template, reuse its template.

```python
def format_input(entry):
    text = ("Below is an instruction that describes a task. "
            "Write a response that appropriately completes the request."
            f"\n\n### Instruction:\n{entry['instruction']}")
    return text + (f"\n\n### Input:\n{entry['input']}" if entry["input"] else "")

def format_example(entry):
    return format_input(entry) + f"\n\n### Response:\n{entry['output']}"
```

## Batching: the custom collate function

1. Tokenize each formatted example (pre-tokenize once in the Dataset).
2. Append one end-of-text token (50256) to each sequence.
3. Pad each batch only to its own longest sequence (cheaper than a global length).
4. Inputs are all tokens but the last; targets are the same shifted left by one.
5. In the targets, keep the **first** end-of-text token (so the model learns to end its answer) and replace remaining padding with `-100`, which `cross_entropy` ignores by default (`ignore_index=-100`).
6. Optionally truncate to an allowed maximum (the model's context length, 1,024 for GPT-2).
7. Move tensors to the device inside the collate function; bind `device` with `functools.partial`.

```python
import torch
from functools import partial

def collate(batch, pad_id=50256, ignore_index=-100, allowed_max_length=None, device="cpu"):
    max_len = max(len(seq) + 1 for seq in batch)
    inputs, targets = [], []
    for seq in batch:
        padded = seq + [pad_id] * (max_len - len(seq))    # always ends with >= 1 pad (end of text)
        x = torch.tensor(padded[:-1])
        y = torch.tensor(padded[1:])
        pad_positions = torch.nonzero(y == pad_id).squeeze(1)
        if pad_positions.numel() > 1:
            y[pad_positions[1:]] = ignore_index          # keep the first end-of-text target
        if allowed_max_length is not None:
            x, y = x[:allowed_max_length], y[:allowed_max_length]
        inputs.append(x)
        targets.append(y)
    return torch.stack(inputs).to(device), torch.stack(targets).to(device)

collate_fn = partial(collate, allowed_max_length=1024, device="cpu")
x, y = collate_fn([[1, 2, 3], [4, 5]])
assert y.tolist() == [[2, 3, 50256], [5, 50256, -100]]
```

- **Masking the instruction** (setting prompt tokens in the targets to `-100`, so loss covers only the response) is optional. Evidence is mixed; the book leaves it unmasked and cites work finding that loss over instructions can help. Treat it as a hyperparameter.

## Fine-tune

- Start from a larger base when possible; the book uses GPT-2 medium (355M) because the 124M model is too weak for instructions.
- Reuse the pretraining loop and loss unchanged; the book trains two epochs with AdamW (`lr=5e-5, weight_decay=0.1`), minutes on a GPU and longer on a laptop CPU.
- Watch validation loss and print a generated answer for a fixed validation prompt each epoch.

## Extract responses and evaluate

- Generate for each test entry with the same template, then strip the prompt prefix and the `### Response:` marker to get the answer; stop at end-of-text.
- Save `instruction, input, reference output, model response` records to JSON for review and re-scoring.
- Evaluation options: multiple-choice knowledge benchmarks, human preference comparisons, or automated scoring by a stronger LLM against references. The book uses a local Llama 3 8B via Ollama, asking for an integer score from 0 to 100, and reports the average.
- Judge outputs are not fully deterministic: parse defensively (skip non-integer replies and count them), repeat scoring and average, and compare models with the same judge, prompt and test set.

**Current note:** instruction-tuned chat models today are usually followed by preference tuning (for example RLHF or DPO-style methods), and libraries handle chat templates and loss masking for you; check that the template and masks they apply match the model's own. LLM-as-judge remains common but should be calibrated against human labels on a sample.

## Workflow

1. Clean the dataset; split train, validation and test with a fixed seed.
2. Fix one prompt template; write `format_input` and reuse it everywhere.
3. Write and unit test the collate function (shift, end-of-text, `-100`, truncation).
4. Load the largest base model you can afford; check its pre-fine-tuning answers.
5. Fine-tune with the standard loop; watch validation loss and sample answers.
6. Generate test responses, save them, and score with a fixed judge prompt; average and inspect low scores.

## Red flags

- Different templates at training and inference; prompt text leaking into extracted answers.
- All padding masked including the first end-of-text token (model never learns to stop) or none masked (loss dominated by padding).
- Padding to a global maximum when per-batch padding suffices.
- Sequences longer than the context length not truncated.
- Evaluating only on training-style prompts, or with a judge that sees the model name.
- Judge scores parsed with bare `int()` and failures silently dropped from the average without reporting the count.

## Testing notes

- tdd: golden tests for `collate` like the assertion above, covering one-item batches, equal-length sequences, truncation, and instruction masking.
- Assert `cross_entropy` with `-100` targets equals the loss computed on the unmasked positions only.
- Template test: `format_example(entry)` matches a stored expected string exactly (snapshot test).
- Eval harness: fixed test set, fixed seed and decoding settings (greedy for reproducibility), judge prompt versioned with results; report mean, count scored, and the lowest examples.
- bdd: scenarios such as "given an instruction with an input, the response answers it and stops" run against the saved responses file.

## Related

- `../../Training/Pretraining/pretraining.md` — the loop, generation and weight loading reused here.
- `../ClassificationFineTuning/classificationFineTuning.md` — the specialist alternative.
- `../LoRA/loRA.md` — parameter-efficient instruction tuning.
- `../../Foundations/WorkingWithTextData/workingWithTextData.md` — tokens, end-of-text and padding.
- `../../../HandsOnLLM/TrainingAndFineTuning/FineTuningGenerationModels/fineTuningGenerationModels.md` — SFT and preference tuning with libraries.
- `../../../AIEngineering/Adaptation/Finetuning/finetuning.md` and `../../../AIEngineering/Adaptation/DatasetEngineering/datasetEngineering.md` — when to fine-tune and how to build instruction data.
- `../../../AIEngineering/Evaluation/EvaluationMethodology/evaluationMethodology.md` — AI-as-judge pitfalls.
