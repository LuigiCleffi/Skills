---
name: llm-scratch-understanding-llms
description: "What an LLM is, next-token prediction as self-supervised pretraining, base (foundation) models vs fine-tuned models, instruction vs classification fine-tuning, the original encoder-decoder transformer vs encoder-only (BERT) and decoder-only (GPT) models, autoregressive generation, emergent zero-shot and few-shot behavior, pretraining data scale and cost, and the three-stage build plan (architecture and data, pretraining, fine-tuning), based on Chapter 1 (Understanding large language models) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when deciding whether to pretrain, fine-tune, or reuse a model, choosing encoder vs decoder architectures, explaining how GPT-style models work, scoping a custom or domain-specific LLM project, or planning an LLM-from-scratch learning or build effort."
---

# Understanding Large Language Models

An LLM is a deep transformer network trained to predict the next token on huge amounts of raw text; everything else (chat, classification, translation) is built on that pretrained base by fine-tuning or prompting. Decide early which stage your project actually needs: almost nobody should pretrain, many should fine-tune, and most should start from open weights.

## The core mechanics in one paragraph

- **Next-token prediction** is the pretraining task. The label is just the next token in the text, so labels come for free: this is *self-supervised* learning on unlabeled text.
- **Autoregressive generation**: a decoder-only model emits one token, appends it to the input, and runs again. Each new token conditions on everything before it.
- **Attention** lets every position look selectively at all earlier positions; it is what replaced recurrent models (see the attention skill).
- "Understand" means the model produces coherent, context-appropriate text, not that it comprehends like a human. Do not design products that assume otherwise.

## Architecture families

| Family | Example | Trained to | Good at |
|---|---|---|---|
| Encoder-decoder (original transformer, 2017) | translation models | map a source sequence to a target sequence | translation, sequence-to-sequence tasks |
| Encoder-only | BERT and variants | fill in masked words using both sides of the context | classification, tagging, embeddings |
| Decoder-only | GPT family, Llama | predict the next token, left to right | generation, and via prompting/fine-tuning almost any text task |

- Transformers and LLMs overlap but are not the same set: transformers also power vision; some LLM research uses recurrent or convolutional designs for efficiency.
- Modern open models keep the GPT recipe with small changes (normalization, activation, position encoding). Learning the GPT-2-style architecture transfers directly.

## Two-stage training

1. **Pretraining** on large, diverse raw text yields a **base (foundation) model** that completes text and shows limited few-shot ability.
2. **Fine-tuning** on a smaller labeled set specializes it:
   - *Instruction fine-tuning*: instruction/response pairs; produces an assistant.
   - *Classification fine-tuning*: texts with class labels; produces a classifier with a fixed label set.

Emergent behavior: a model trained only on next-token prediction can translate, summarize or classify when prompted, zero-shot (no examples) or few-shot (a few examples in the prompt).

## When to build, fine-tune or reuse

| Situation | Decision |
|---|---|
| Learning how LLMs work, or debugging odd model behavior | Implement a small GPT end to end on toy data |
| Narrow domain or task, data must stay in-house, or on-device latency matters | Fine-tune an open pretrained model; custom models can beat general ones on a specific task |
| General-purpose assistant needs | Use an existing instruction-tuned model; adapt with prompting first |
| Considering pretraining from scratch | Only with a budget for very large curated corpora and substantial compute; the book cites GPT-3 pretraining at millions of dollars |

- Pretraining data is a mix of filtered web crawl, books, encyclopedic and code text measured in hundreds of billions of tokens or more. Check licenses: public corpora can contain copyrighted material.
- A token is roughly a word or punctuation piece; dataset sizes are quoted in tokens, not documents.

## The build plan the book follows

- **Stage 1**: data preparation and sampling, attention, the LLM architecture.
- **Stage 2**: training loop, evaluation, pretraining a small model, loading open weights.
- **Stage 3**: fine-tuning for classification and for instruction following.

Use the same staging for a real project: get data and a forward pass working with shapes verified, then a training loop that overfits a tiny batch, then load real weights, then specialize.

**Current note:** since the book, open-weight decoder-only models are far more capable and common, preference tuning after instruction tuning is standard for assistants, and many tasks are solved with prompting or retrieval before any fine-tuning. The decision table above still holds; the default starting point is now stronger.

## Workflow

1. State the task: generation, classification, extraction, or chat.
2. Choose the architecture family (decoder-only for generation; encoder-only is still a cheap strong baseline for pure classification).
3. Try prompting an existing model zero-shot and few-shot; measure on a small labeled set.
4. If quality, privacy, cost or latency fall short, plan fine-tuning (classification or instruction) on open weights.
5. Reserve pretraining for when no suitable base exists and you can afford data and compute.
6. Plan the build in stages and gate each stage with a test (shapes, overfit a batch, loss decreases, task metric).

## Red flags

- Proposing to pretrain from scratch for a product feature without a data and compute budget.
- Treating model output as understanding or ground truth; no evaluation set.
- Using an encoder-only model for open-ended generation, or a large generative model where a small classifier would do.
- Confusing a base model with an instruction-tuned one (base models complete text; they do not follow instructions reliably).
- Pretraining corpora with unknown licenses or provenance.

## Testing notes

- Before choosing an approach, build a small golden set of inputs with expected outputs or labels; compare prompting vs fine-tuned candidates on it.
- tdd: test the plumbing deterministically (tokenizer round trip, tensor shapes, loss is finite) and the model statistically (metrics over a fixed eval set with fixed seeds).
- Record the model, weights source, decoding settings and seed with every eval result so runs are comparable.

## Related

- `../WorkingWithTextData/workingWithTextData.md` — turning text into tokens and embeddings.
- `../../Architecture/AttentionMechanisms/attentionMechanisms.md` — the mechanism behind transformers.
- `../../Architecture/GPTModel/gptModel.md` — the decoder-only architecture in code.
- `../../FineTuning/ClassificationFineTuning/classificationFineTuning.md` and `../../FineTuning/InstructionFineTuning/instructionFineTuning.md` — the two fine-tuning paths.
- `../../../HandsOnLLM/UnderstandingLanguageModels/IntroductionToLLMs/introductionToLLMs.md` — representation vs generative models from the user's side.
- `../../../AIEngineering/Foundations/FoundationModels/foundationModels.md` — how foundation models are trained and sampled today.
- `../../../AIEngineering/Foundations/BuildingAIApplications/buildingAIApplications.md` — deciding whether to build an AI application at all.
