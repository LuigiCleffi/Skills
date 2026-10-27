---
name: hollm-introduction-to-llms
description: "Language AI landscape from bag-of-words and word2vec to attention and the Transformer, representation (encoder-only, BERT-like) versus generative (decoder-only, GPT-like) models, the pretraining then fine-tuning paradigm, context windows, common LLM use cases, responsible use, VRAM limits, proprietary APIs versus open models, and a first Hugging Face text-generation pipeline, based on Chapter 1 (An Introduction to Large Language Models) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when scoping an LLM feature, choosing between an encoder and a decoder model, deciding API versus self-hosted open weights, estimating GPU or VRAM needs, mapping a business task (classification, topic discovery, search, chatbot, multimodal) to a technique, or writing the first transformers pipeline call."
---

# Introduction to Large Language Models

"LLM" is not one thing: it spans small encoder models that produce embeddings and large decoder models that generate text. Start every project by mapping the task to the right model family and the right access mode (API or open weights), then add components (retrieval, prompting, fine-tuning) around it.

## The lineage, as decisions

| Technique | What it captures | Still useful for |
|---|---|---|
| Bag-of-words (token counts over a vocabulary) | Which words occur, no meaning | Cheap baselines, keyword features, topic representations (Chapter 5) |
| word2vec (static dense embeddings) | Word meaning, one vector per word regardless of context | Lightweight similarity, features when compute is tiny |
| RNN encoder-decoder + attention | Context, but sequential and hard to parallelize | Mostly historical |
| Transformer (self-attention, parallel training) | Contextual meaning of every token | Basis of almost every model in the book |

- A static embedding gives "bank" one vector for both river and finance; when context changes meaning, use a contextual (Transformer) model.
- Self-attention lets every token look at the whole sequence; decoders mask future positions so generation cannot peek ahead.

## Representation versus generative models

- **Representation models** (encoder-only, BERT family): bidirectional, pretrained with masked language modeling, output embeddings; the `[CLS]` token often summarizes the input. Use for classification, clustering, semantic search, reranking.
- **Generative models** (decoder-only, GPT family): autoregressive next-token prediction; instruct/chat variants follow directions. Use for generation, summarization, extraction into free text, conversation.
- Encoder-decoder (original Transformer, T5-style) remains a fit for sequence-to-sequence tasks such as translation.
- Size is not the definition: the book counts sub-billion-parameter embedding models as LLMs. Choose by task and constraints, not by "largeness".

## Training paradigm

1. **Pretraining** (language modeling on huge corpora) produces a base or foundation model that predicts text but usually does not follow instructions. Almost no team should do this themselves.
2. **Fine-tuning / post-training** adapts the base model to a task or to instruction following and preferences; far cheaper and needs far less data.
- Decide first whether a pretrained model as-is (Chapters 4–9) is enough; fine-tune (Chapters 10–12) only when evaluation shows a gap.

## Mapping tasks to techniques

| Task | Approach | Skill |
|---|---|---|
| Sentiment or label prediction with labels | Supervised classification with encoder or decoder | ch4, ch11 |
| Find themes in tickets, no labels | Embed, reduce, cluster, then label topics with an LLM | ch5 |
| Find relevant documents | Semantic search, reranking | ch8, ch10 |
| Chatbot using docs and tools | Prompting + RAG + agents, maybe fine-tuning | ch6, ch7, ch8, ch12 |
| Reason over images | Multimodal model | ch9 |

## API versus open weights

| Factor | Proprietary API | Open model, self-hosted |
|---|---|---|
| Hardware and ops | None on your side | Need GPUs and serving know-how |
| Quality | Often strongest | Improving; may suffice for narrow tasks |
| Cost | Pay per use | Hardware/hosting; cheap at volume |
| Data | Leaves your boundary | Stays local (sensitive data) |
| Customization | Limited or none | Full fine-tuning, inspection |
| License | Provider terms | Varies; "open" may forbid commercial use, check it |

- VRAM is the binding constraint for local models; requirement depends on size, precision/quantization, context length and backend. There is no single formula: measure.
- The book assumes a 16 GB GPU as a practical minimum and uses a small instruct model (Phi-3-mini) to stay within it.

## First generation call

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

model_id = "microsoft/Phi-3-mini-4k-instruct"
model = AutoModelForCausalLM.from_pretrained(model_id, device_map="auto", torch_dtype="auto")
tokenizer = AutoTokenizer.from_pretrained(model_id)
generator = pipeline("text-generation", model=model, tokenizer=tokenizer,
                     return_full_text=False, max_new_tokens=200, do_sample=False)
out = generator([{"role": "user", "content": "Summarize: ..."}])
print(out[0]["generated_text"])
```

- Always load the model and its matching tokenizer together.
- Cap `max_new_tokens`; set `do_sample=False` for reproducible output during development.
- Pass chat-formatted messages to instruct models; the pipeline applies the chat template.
- **Current note:** recent `transformers` releases may warn about or rename some loading arguments (e.g. dtype handling, `trust_remote_code` no longer needed for models now supported natively); check the installed version's docs.

## Responsible use

- Bias: training data is rarely disclosed; test outputs for biased behavior on your population.
- Transparency: tell users when they interact with an LLM; keep a human in the loop for high-stakes domains (medical, legal).
- Hallucination: models can be confidently wrong; never treat output as ground truth without verification.
- IP and regulation: track licenses and applicable rules (e.g. the EU AI Act) for your deployment.

## Workflow

1. State the task as input, output, and success metric.
2. Classify it: representation (embed/classify/search) or generation (write/answer) or both.
3. Choose access mode with the API-versus-open table; check license and data constraints.
4. Pick the smallest model that plausibly works; check VRAM and latency budgets.
5. Build a baseline with a pretrained model and a held-out evaluation set.
6. Add components (prompting, retrieval, fine-tuning) only when evaluation shows a need.

## Red flags

- Using a generative LLM for a task a small encoder or even bag-of-words would solve (cost, latency, nondeterminism).
- Sending sensitive data to a third-party API without a data agreement.
- Assuming "open" means commercially usable without reading the license.
- Planning to pretrain from scratch when fine-tuning or prompting suffices.
- No `max_new_tokens` cap; outputs treated as facts.

## Testing notes

- Wrap model calls behind an interface so unit tests use a stub; test parsing and business logic deterministically.
- In integration tests use greedy decoding (`do_sample=False`) and a fixed seed; assert on properties (format, label set, length), not exact wording.
- Keep a small golden set of input/expected-output pairs per task and track a metric over time.
- bdd: scenarios describe user-visible outcomes ("the ticket is routed to billing"), not model internals.

## Related

- `../TokensAndEmbeddings/tokensAndEmbeddings.md` — tokenizers and embeddings in depth.
- `../LookingInsideLLMs/lookingInsideLLMs.md` — how decoders generate tokens.
- `../../UsingPretrainedModels/TextClassification/textClassification.md` — first applied task.
- `../../../AIEngineering/Foundations/BuildingAIApplications/buildingAIApplications.md` — deciding whether to build an AI application.
- `../../../BuildLLMFromScratch/Foundations/UnderstandingLLMs/understandingLLMs.md` — the same landscape from the builder's side.
- `../../../DesigningMLSystems/Foundations/MLSystemsInProduction/mlSystemsInProduction.md` — when ML is the right tool at all.
