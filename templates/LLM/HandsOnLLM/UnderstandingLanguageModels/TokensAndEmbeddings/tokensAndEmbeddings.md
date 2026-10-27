---
name: hollm-tokens-and-embeddings
description: "Tokenization (word, subword, character, byte; BPE, WordPiece, SentencePiece), token IDs and decoding, special tokens (CLS, SEP, PAD, UNK, MASK, chat-role and fill-in-the-middle tokens), how tokenizer design and training data shape behavior on code, numbers, capitalization and non-English text, token embedding matrices, contextualized token embeddings, sentence and document text embeddings with sentence-transformers, word2vec skip-gram and negative sampling, and embeddings for recommendation, based on Chapter 2 (Tokens and Embeddings) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when counting or budgeting tokens, debugging odd model behavior on code, numbers, emojis or other languages, choosing a model whose tokenizer fits the domain, adding special tokens, producing sentence embeddings, or building item-to-item recommendations from co-occurrence sequences."
---

# Tokens and Embeddings

A model never sees text: a tokenizer turns text into IDs, and the model turns IDs into vectors. Both are fixed at training time and inseparable from the model, so choose models whose tokenizer fits your data and treat embeddings as the reusable product of a language model.

## How a tokenizer is defined

Three choices fix its behavior:

1. **Method**: BPE (GPT family, Llama, StarCoder), WordPiece (BERT), SentencePiece (T5, supports BPE and unigram).
2. **Parameters**: vocabulary size (tens of thousands, trending toward ~100K+), special tokens, casing.
3. **Training data**: the same method trained on code, English, or multilingual text yields a different vocabulary.

- A pretrained model only works with the tokenizer it was trained with. Never swap tokenizers; load both from the same checkpoint.
- Adding special tokens to an existing model requires resizing the embedding matrix and training the new rows.

## Granularity trade-offs

| Scheme | Handles new words | Sequence length | Notes |
|---|---|---|---|
| Word | No (out-of-vocabulary) | Short | Bloated vocabulary of near-duplicates; still used for item IDs in recommenders |
| Subword | Yes, by splitting | ~3–4 characters per token in English | Default for LLMs |
| Character | Yes | Long; the model must learn spelling | Less text fits in the context |
| Byte | Yes, any Unicode | Longest | Competitive in multilingual settings; many BPE tokenizers keep bytes as a fallback only |

## What tokenizer differences mean in practice

- **Casing**: uncased tokenizers (bert-base-uncased) lose capitalization; all-caps words can explode into many tokens in older tokenizers.
- **Whitespace and newlines**: some tokenizers drop newlines (blind to chat turns or code layout); code-oriented ones have single tokens for runs of spaces, which helps indentation-sensitive languages.
- **Unknown characters**: older tokenizers map emoji or Chinese to `[UNK]`/`<unk>`, making the model blind to them. Byte-fallback tokenizers represent them as several byte tokens.
- **Numbers**: tokenizers that split digits individually represent arithmetic more consistently than ones that merge arbitrary digit chunks.
- **Domain tokens**: chat roles (`<|user|>`, `<|assistant|>`), fill-in-the-middle tokens for code completion, repository/file tokens, citation or reasoning markers. Use them through the model's chat template, not by hand-concatenating strings.

Inspect before you trust:

```python
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("microsoft/Phi-3-mini-4k-instruct")
ids = tok("Write an apology email.\n    return x", add_special_tokens=True).input_ids
print(len(ids), [tok.decode(i) for i in ids])
```

## Token embeddings

- The model holds an embedding matrix of shape `vocab_size x hidden_dim`; row lookup is the first step inside the model.
- Static embeddings (word2vec, GloVe, the raw input matrix) give one vector per token. Contextualized embeddings (outputs of an encoder such as DeBERTa or BERT) differ per occurrence and power NER, extractive summarization, and classification.
- Model output shape is `[batch, tokens, hidden]`; special tokens like `[CLS]` and `[SEP]` are included in the token count.

## Text embeddings

- One vector per sentence or document; enables classification, clustering, semantic search and RAG.
- Mean-pooling token embeddings works, but models trained specifically for sentence embeddings are better. Use `sentence-transformers`:

```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
vecs = model.encode(["Best movie ever!", "Terrible plot."], normalize_embeddings=True)
assert vecs.shape == (2, model.get_sentence_embedding_dimension())
```

- Embedding dimension is fixed per model; store the model name and version with every stored vector.

## word2vec and contrastive training

- Skip-gram: a sliding window yields (center, neighbor) positive pairs.
- Negative sampling: random words are added as negatives so the classifier cannot always say "neighbors"; random negatives are good enough.
- The idea "show two items, predict whether they are related" recurs in sentence-embedding training (ch10) and image–text models (ch9).

## Embeddings beyond language

Treat any ordered sequence of IDs as sentences: playlists as sentences and songs as words give song embeddings whose neighbors are good recommendations.

```python
from gensim.models import Word2Vec
model = Word2Vec(playlists, vector_size=32, window=20, negative=50, min_count=1, workers=4, seed=42)
model.wv.most_similar(positive=str(song_id), topn=5)
```

- Filter out sequences of length one; they produce no pairs.
- Large windows suit unordered collections (playlists, baskets); small windows suit ordered text.

## Workflow

1. Pick candidate models; tokenize representative samples (code, numbers, other languages, emoji) and inspect tokens and counts.
2. Reject tokenizers that map important content to unknown tokens or drop structure you need (newlines, casing).
3. Budget context and cost in tokens measured with the model's own tokenizer.
4. For representation tasks, use a dedicated sentence-embedding model; record its name, dimension and normalization.
5. For non-text items with co-occurrence data, try word2vec-style embeddings as a cheap recommender baseline.

## Red flags

- Estimating tokens as words or characters for billing or context limits instead of counting with the real tokenizer.
- Loading a tokenizer from a different checkpoint than the model.
- Hand-building chat prompts with role strings instead of `apply_chat_template`.
- Using an uncased or no-newline tokenizer for code, logs, or case-sensitive identifiers.
- Comparing embeddings produced by different models or versions in the same index.
- Averaging raw LLM token states and expecting sentence-embedding quality.

## Testing notes

- Unit-test token budgeting with the real tokenizer on fixed strings (round-trip `decode(encode(x))`, counts within limits).
- Shape tests: assert embedding dimension and batch size; assert normalized vectors have unit norm.
- Sanity golden pairs: a paraphrase pair should score higher cosine similarity than an unrelated pair.
- Fix seeds (and `workers=1` for exact gensim reproducibility) when asserting on trained embeddings; prefer rank-based assertions over exact floats.

## Related

- `../IntroductionToLLMs/introductionToLLMs.md` — the model families these tokenizers serve.
- `../LookingInsideLLMs/lookingInsideLLMs.md` — what happens after the embedding lookup.
- `../../TrainingAndFineTuning/CreatingEmbeddingModels/creatingEmbeddingModels.md` — training sentence embeddings contrastively.
- `../../UsingPretrainedModels/SemanticSearchAndRAG/semanticSearchAndRAG.md` — using text embeddings for retrieval.
- `../../../BuildLLMFromScratch/Foundations/WorkingWithTextData/workingWithTextData.md` — implementing BPE and embedding layers.
- `../../../../DataSystems/README.md` — storing and evolving vector data.
