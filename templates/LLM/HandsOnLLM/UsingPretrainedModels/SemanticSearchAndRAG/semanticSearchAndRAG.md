---
name: hollm-semantic-search-and-rag
description: "Semantic search and retrieval-augmented generation: dense retrieval with embeddings and nearest-neighbor indexes (NumPy, FAISS, Annoy, vector databases), BM25 keyword search and hybrid search, relevance thresholds, chunking strategies (sentence, paragraph, overlap, title context), cross-encoder rerankers in two-stage pipelines, retrieval evaluation (precision at k, average precision, MAP, nDCG), grounded generation with citations, local RAG with a quantized LLM and FAISS, query rewriting, multi-query, multi-hop, query routing and agentic RAG, and RAG evaluation (fluency, utility, citation recall and precision, faithfulness, answer relevance, LLM-as-a-judge, Ragas), based on Chapter 8 (Semantic Search and Retrieval-Augmented Generation) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when building search over documents, a chat-with-your-data or question-answering bot, choosing chunk size or a vector store, adding a reranker, reducing hallucinations with grounding, or measuring retrieval and answer quality."
---

# Semantic Search and Retrieval-Augmented Generation

Search with language models is a pipeline: retrieve candidates cheaply, rerank them precisely, then optionally generate a grounded, cited answer. Each stage is measurable on its own, so build an evaluation suite of queries and relevance judgments before tuning any of them.

## Three building blocks

| Block | Input | Output | Strength |
|---|---|---|---|
| Dense retrieval | Query, index of chunk embeddings | Nearest chunks | Matches meaning without shared keywords |
| Reranker (cross-encoder) | Query + shortlist | Reordered shortlist with scores | Large quality gains as a drop-in last stage |
| Grounded generation (RAG) | Query + top chunks | Answer with citations | Fewer hallucinations, answers from your data |

## Dense retrieval decisions

- Embed documents and queries with the same model; some models need different input types or prefixes for queries versus documents.
- Dense retrieval always returns neighbors, even when nothing is relevant: set a similarity threshold or let the generator say it cannot answer.
- Exact phrases, IDs, and rare terms favor keyword search (BM25). Use **hybrid search** (keyword + dense) as the default first stage.
- Retrieval models degrade out of domain (e.g. general web model on legal text); evaluate on your domain and fine-tune if needed (ch10).
- A query and its answer are not necessarily "similar" text; retrieval-trained embedding models handle this better than generic similarity models.

## Chunking

| Strategy | Use when | Risk |
|---|---|---|
| One vector per document (title/intro only) | Quick demo | Most content unsearchable |
| Averaged chunk vectors per document | Coarse document similarity | Over-compressed, loses specifics |
| Sentence chunks | Fact lookup, short sentences | Too little context |
| Paragraph or 3–8 sentence chunks | Default for prose | Long paragraphs blur concepts |
| Overlapping windows, title prepended | Chunks depend on surroundings | Larger index, duplicate hits |

- Choose chunking from expected queries; test two or three strategies on the eval suite.
- Store chunk text, source ID, position and title alongside each vector for citations and filtering.

## Indexes

- Up to tens of thousands of vectors: brute-force cosine with NumPy is fine.
- Millions: approximate nearest-neighbor libraries (FAISS, Annoy), optionally GPU.
- Need inserts/deletes without rebuild, metadata filters, or multi-tenant serving: a vector database.
- Normalize vectors and match the index metric (inner product on normalized vectors equals cosine).

## Reranking

- Two-stage pipeline: first stage retrieves 100–1,000 candidates; a cross-encoder scores each (query, document) pair jointly and reorders.
- Relevance scoring is a classification problem (0 irrelevant to 1 relevant); a monoBERT-style cross-encoder is the classic design.
- Rerankers are slower per document than bi-encoders; never run them over the whole corpus.
- Open-source retrieve-and-rerank is available through sentence-transformers (`CrossEncoder`).

```python
from sentence_transformers import SentenceTransformer, CrossEncoder, util
bi = SentenceTransformer("thenlper/gte-small")
ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
doc_emb = bi.encode(chunks, normalize_embeddings=True)
hits = util.semantic_search(bi.encode(query, normalize_embeddings=True), doc_emb, top_k=50)[0]
scores = ce.predict([(query, chunks[h["corpus_id"]]) for h in hits])
top = [chunks[hits[i]["corpus_id"]] for i in scores.argsort()[::-1][:3]]
```

## Retrieval evaluation

- Test suite = document archive + queries + relevance judgments.
- Precision at k rewards relevant results; **average precision** also rewards ranking them early; **MAP** averages AP over all queries.
- **nDCG** handles graded relevance (some documents more relevant than others).
- Compare systems only on the same suite; track metrics per pipeline change.

## Grounded generation

- Prompt: retrieved context, then the question, then instructions (concise, cite sources, say when the context does not contain the answer).
- Prefer generators and APIs that return span-level citations; otherwise ask for document IDs and verify they exist in the context.
- Local RAG works with a small quantized model and FAISS, but expect weaker answers and no native citations.

## Advanced RAG

| Technique | Solves |
|---|---|
| Query rewriting | Verbose chat messages or references to earlier turns |
| Multi-query | Questions needing several searches (compare 2020 vs 2023) |
| Multi-hop | Follow-up searches that depend on earlier results |
| Query routing | Several sources (HR wiki vs CRM) |
| Agentic RAG | LLM decides when, where and whether to search; sources become tools |

- Let the rewriter decide that no search is needed for questions it can answer directly.
- More autonomy needs more capable models and more guardrails (ch7).

## RAG evaluation

- Human axes: fluency, perceived utility, citation recall (statements supported by citations), citation precision (citations that support their statements).
- Automated: LLM-as-a-judge scoring faithfulness (answer consistent with context) and answer relevance; Ragas implements these.
- Evaluate retrieval and generation separately so failures are attributable.
- **Current note:** long-context models do not remove the need for retrieval on large or changing corpora; hybrid search with reranking remains a strong default, and LLM-judge scores should be spot-checked against human labels.

## Workflow

1. Build the eval suite: representative queries, relevance judgments, and reference answers.
2. Chunk, embed, index; record model, chunking and metric.
3. Measure keyword, dense and hybrid first stages (MAP/nDCG, recall@k).
4. Add a reranker over the shortlist; measure again.
5. Add grounded generation with citations and an explicit "not in context" path.
6. Add query rewriting/multi-query only for observed failure types.
7. Evaluate faithfulness and citations; monitor in production with user feedback.

## Red flags

- No relevance threshold and no "I don't know" path; answers built on irrelevant neighbors.
- Dense-only search for queries with codes, names or exact phrases.
- Mixed embedding models or versions in one index; queries embedded with a different model.
- Chunks stored without source metadata, making citations impossible.
- Reranker run over the full corpus, or retrieval top-k too small for the reranker to help.
- Shipping RAG with only anecdotal checks; no separate retrieval metrics.
- Untrusted retrieved text that can inject instructions into the prompt.

## Testing notes

- Unit-test chunking (boundaries, overlap, metadata) and prompt assembly deterministically.
- Retrieval regression test: MAP or recall@k on a frozen suite must not drop below a threshold.
- Golden questions with known answers and required citations; assert the cited chunk IDs are among the retrieved ones.
- Negative tests: questions whose answers are absent must yield a refusal or "not found".
- Use a fixed embedding model version and seed; rebuild the index in test setup from fixtures.

## Related

- `../../TrainingAndFineTuning/CreatingEmbeddingModels/creatingEmbeddingModels.md` — training retrieval embeddings.
- `../../TrainingAndFineTuning/FineTuningRepresentationModels/fineTuningRepresentationModels.md` — cross-encoders as classifiers.
- `../AdvancedTextGeneration/advancedTextGeneration.md` — chains, agents and local LLMs.
- `../TextClassification/textClassification.md` — evaluation metrics basics.
- `../../../AIEngineering/Adaptation/RAGAndAgents/ragAndAgents.md` — RAG architecture in production.
- `../../../AIEngineering/Evaluation/EvaluateAISystems/evaluateAISystems.md` — building evaluation pipelines.
- `../../../../DataSystems/README.md` — storage and indexing trade-offs.
