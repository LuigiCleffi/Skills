## AI Skills

Before implementing, reviewing or debugging the internals of a language
model in PyTorch (tokenizers and data loaders for next-token training,
attention and transformer blocks, a GPT-style model, pretraining and
generation loops, loading pretrained weights, classification or
instruction fine-tuning, or LoRA adapters), find the skills that apply to
the task in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed. For an end-to-end build, follow the groups in order:
each stage's output (token batches, a model, pretrained weights) is the
next stage's input.

Each skill comes from one chapter or appendix of Sebastian Raschka's
*Build a Large Language Model (From Scratch)* (Manning, 2024). The skills
carry small PyTorch snippets for the key mechanics and shape-based testing
notes. Appendices B (references) and C (exercise solutions) are not
covered. The source copy ended partway through appendix A, so the
appendix D and E skills follow the appendices' known scope rather than
their text; verify them against a complete copy.

### Foundations

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./Foundations/UnderstandingLLMs/understandingLLMs.md` | Deciding whether to pretrain, fine-tune or reuse a model, choosing encoder vs decoder architectures, explaining how GPT-style models work, or scoping a custom LLM project. |
| 2 | `./Foundations/WorkingWithTextData/workingWithTextData.md` | Writing a tokenizer or next-token data pipeline, choosing context length and stride, joining documents with end-of-text tokens, or debugging target shifts and embedding shapes. |
| A | `./Foundations/IntroductionToPyTorch/introductionToPyTorch.md` | Writing or reviewing PyTorch modules, data loaders or training loops, or debugging shape, dtype, device, gradient or train/eval mode errors. |

### Architecture

| Ch | Skill | Use when |
|---|---|---|
| 3 | `./Architecture/AttentionMechanisms/attentionMechanisms.md` | Implementing self-attention, causal masks or multi-head attention, or debugging attention shapes, future-token leakage or mask device errors. |
| 4 | `./Architecture/GPTModel/gptModel.md` | Building a transformer block or GPT model, sizing parameters and memory, fixing unstable deep training, or writing a basic generation loop. |

### Training

| Ch | Skill | Use when |
|---|---|---|
| 5 | `./Training/Pretraining/pretraining.md` | Writing an LLM training or evaluation loop, computing loss or perplexity, reading train vs validation curves, choosing temperature or top-k, checkpointing, or loading GPT-2 weights. |
| D | `./Training/TrainingLoopExtras/trainingLoopExtras.md` | Loss spikes or diverges early, gradients explode, or a loop needs learning-rate warmup, cosine decay or gradient clipping. |

### Fine-Tuning

| Ch | Skill | Use when |
|---|---|---|
| 6 | `./FineTuning/ClassificationFineTuning/classificationFineTuning.md` | Turning a GPT model into a spam, sentiment or intent classifier, choosing which layers to train, reading out the last token, or handling class imbalance. |
| 7 | `./FineTuning/InstructionFineTuning/instructionFineTuning.md` | Building an instruction dataset and prompt template, writing a collate function with -100 loss masking, or evaluating instruction following with a judge LLM. |
| E | `./FineTuning/LoRA/loRA.md` | Full fine-tuning is too slow or large, adding LoRA adapters, choosing rank and alpha, or merging adapters for serving. |

# Context for AI: Building LLMs from Scratch

## 1. Everything Is Next-Token Prediction

Pretraining, instruction fine-tuning and generation all rest on one
objective: predict the next token from the previous ones. Inputs and
targets are the same sequence shifted by one; losses are cross-entropy
over flattened logits.

## 2. Shapes Are the Specification

Every module has a fixed shape contract: token IDs `(batch, seq)`,
embeddings and block outputs `(batch, seq, emb_dim)`, logits
`(batch, seq, vocab_or_classes)`. Write those contracts as tests before
trusting any loss curve.

## 3. Causality Must Be Enforced, Not Assumed

A decoder-only model is only valid if no position sees the future. The
causal mask is a correctness property; test it by changing later tokens
and checking earlier outputs stay the same.

## 4. Reuse Pretrained Weights

Pretraining at useful scale is expensive. Implement the architecture to
match open weights exactly, load them with shape checks, and spend effort
on fine-tuning and evaluation instead.

## 5. Specialize With the Least Change That Works

Prefer prompting, then a small task head or adapters (LoRA), then
unfreezing top layers, before full fine-tuning. Match the fine-tuning kind
to the output: a fixed label set or free-form responses.

## 6. Evaluate Outputs, Not Just Loss

Track validation loss and perplexity, but also inspect generated samples,
measure task accuracy on held-out data, and score instruction responses
against references with a fixed, versioned judge.

## How the AI Should Apply It

- Read only the skills matching the task; for a full build, go Foundations,
  Architecture, Training, Fine-Tuning.
- Keep code small and config-driven; use the snippets as references, and
  prefer fused library kernels (for example PyTorch's scaled dot-product
  attention) in production once they match the reference implementation.
- Add deterministic tests first: tokenizer round trips, target shifts,
  shapes, causality, parameter counts, overfit-one-batch, seeded
  generation.
- Treat model quality as a statistical property measured on fixed eval
  sets with fixed seeds and decoding settings; record them with results.
- Say where the book's GPT-2-era choices differ from current practice and
  check the installed library versions before relying on newer APIs.
