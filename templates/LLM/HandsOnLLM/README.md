## AI Skills

Before writing code that loads, calls, combines, or fine-tunes a pretrained
language model, such as tokenizing text, producing embeddings, classifying
or clustering documents, writing prompts, building chains, memory or
agents, semantic search or RAG, working with images, or training
embedding, classification, or generation models, find the skills that
apply to the task in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed. Part I explains what the models do; Part II uses them as
they are; Part III changes their weights. Try Part II before Part III.

Each skill comes from one chapter of Jay Alammar and Maarten Grootendorst's
*Hands-On Large Language Models: Language Understanding and Generation*
(O'Reilly, 2024). The book's code uses Python with Hugging Face
`transformers`, `sentence-transformers`, `datasets`, BERTopic, LangChain,
llama-cpp-python, PEFT, and TRL; library APIs have moved since, so each
skill flags what changed in a "Current note".

### Understanding Language Models (Part I)

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./UnderstandingLanguageModels/IntroductionToLLMs/introductionToLLMs.md` | Scoping an LLM feature, choosing encoder versus decoder models, API versus open weights, estimating VRAM, mapping a task to a technique, or writing the first generation pipeline. |
| 2 | `./UnderstandingLanguageModels/TokensAndEmbeddings/tokensAndEmbeddings.md` | Counting tokens, debugging odd behavior on code, numbers or other languages, choosing a tokenizer that fits the domain, producing sentence embeddings, or building co-occurrence recommenders. |
| 3 | `./UnderstandingLanguageModels/LookingInsideLLMs/lookingInsideLLMs.md` | Reasoning about generation latency and memory, the KV cache, context length, logits and decoding, attention variants, or inspecting a model's architecture. |

### Using Pretrained Language Models (Part II)

| Ch | Skill | Use when |
|---|---|---|
| 4 | `./UsingPretrainedModels/TextClassification/textClassification.md` | Building sentiment, intent or routing classifiers without fine-tuning, choosing between a task model, embeddings plus classifier, zero-shot, or an LLM prompt, and evaluating with F1. |
| 5 | `./UsingPretrainedModels/TextClusteringAndTopicModeling/textClusteringAndTopicModeling.md` | Exploring an unlabeled corpus, grouping tickets or feedback by theme, tuning UMAP and HDBSCAN, running BERTopic, or labeling topics with an LLM. |
| 6 | `./UsingPretrainedModels/PromptEngineering/promptEngineering.md` | Writing or debugging prompts, setting temperature or top_p, few-shot examples, prompt chains, chain-of-thought or self-consistency, or forcing valid JSON output. |
| 7 | `./UsingPretrainedModels/AdvancedTextGeneration/advancedTextGeneration.md` | Running quantized local models, prompt templates, multi-step chains, conversation memory against the context limit, or agents with tools in a ReAct loop. |
| 8 | `./UsingPretrainedModels/SemanticSearchAndRAG/semanticSearchAndRAG.md` | Building document search or chat-with-your-data, chunking, vector indexes, hybrid search, rerankers, grounded answers with citations, or retrieval and RAG evaluation. |
| 9 | `./UsingPretrainedModels/MultimodalLLMs/multimodalLLMs.md` | Searching images by text, zero-shot image labeling, captioning, visual question answering, or choosing and preprocessing for a vision-language model. |

### Training and Fine-Tuning Language Models (Part III)

| Ch | Skill | Use when |
|---|---|---|
| 10 | `./TrainingAndFineTuning/CreatingEmbeddingModels/creatingEmbeddingModels.md` | Off-the-shelf embeddings underperform, fine-tuning a retriever, choosing a contrastive loss, mining hard negatives, Augmented SBERT, or unsupervised and domain-adapted embeddings. |
| 11 | `./TrainingAndFineTuning/FineTuningRepresentationModels/fineTuningRepresentationModels.md` | Fine-tuning BERT for classification, freezing layers under a GPU budget, few-shot SetFit, continued masked-language pretraining, or named-entity recognition. |
| 12 | `./TrainingAndFineTuning/FineTuningGenerationModels/fineTuningGenerationModels.md` | Instruction-tuning or adapting a generator, LoRA and QLoRA, preference data and DPO, PPO or ORPO, or evaluating a fine-tuned generative model. |

# Context for AI: Practical LLM Engineering

## 1. Match the Model to the Task

Representation models (encoders, embeddings) classify, cluster, and
retrieve; generative models write and answer. A small encoder or even
bag-of-words often beats a large generator on cost, latency, and
determinism. Choose the smallest model and access mode (API or open
weights) that meets the evaluated target.

## 2. Tokenizers and Templates Are Part of the Model

Always load a model with its own tokenizer, count tokens with it, and
format chat input with its chat template, in training and inference
alike. Many silent failures trace back to a mismatched tokenizer or
template.

## 3. Embeddings Are the Workhorse

Text embeddings power classification, clustering, search, RAG, memory,
and multimodal retrieval. Record the embedding model and version with
every stored vector, and rebuild indexes when the model changes.

## 4. Combine Cheap and Expensive Components

Let fast components do bulk work and spend LLM calls sparingly: cluster
then label each topic once, retrieve then rerank a shortlist, embed once
and train a light classifier. Pipelines of modular blocks are easier to
evaluate and swap.

## 5. Constrain and Verify Generated Output

Generated text is probabilistic. Use greedy decoding where determinism
matters, constrain format with schemas or grammars, validate every
parsed field, ground factual answers in retrieved sources, and bound
agents with step limits and tool validation.

## 6. Fine-Tune Only After Measuring a Gap

Try pretrained models with prompting and retrieval first. When
evaluation shows a gap, prefer parameter-efficient methods (SetFit,
LoRA, QLoRA) and fine-tune from the strongest pretrained checkpoint, then
evaluate on your own use case rather than public leaderboards.

## How the AI Should Apply It

- Identify the task type and read the one or two matching skills, not the
  whole book.
- Build an evaluation set and a simple baseline before writing model code,
  and report metrics with seeds, model names, and library versions.
- Prefer current library APIs; when the book's code differs from the
  installed version, follow the "Current note" and the library docs.
- Keep model calls behind small interfaces so business logic is tested
  deterministically with stubs, and keep slow model evaluations as
  separate, thresholded regression suites.
- State which results come from the book's examples and which were
  measured on the project's data.
