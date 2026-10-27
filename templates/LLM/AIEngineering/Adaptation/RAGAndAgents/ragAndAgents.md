---
name: aieng-rag-and-agents
description: "Context construction with retrieval-augmented generation and agents: RAG vs long context, retriever and generator architecture, term-based retrieval (BM25) vs embedding-based retrieval and vector search (ANN indexes, HNSW), retrieval metrics (context precision and recall, NDCG, MRR), hybrid search and reciprocal rank fusion, chunking strategy, reranking, query rewriting, contextual retrieval, multimodal and tabular RAG (text-to-SQL), agents (environment, tools, read vs write actions, function calling), planning (decoupling plan from execution, plan validation, intent classification, granularity, control flows, ReAct and Reflexion reflection, tool selection and ablation), agent failure modes (invalid tool, invalid parameters, wrong values, goal and constraint failures, false task completion, tool failures, inefficiency), and memory (internal, short-term, long-term), based on Chapter 6 (RAG and Agents) of Chip Huyen's AI Engineering. Use when building or debugging a RAG pipeline, choosing chunk size, BM25 vs embeddings or hybrid search, evaluating retrieval, adding tools or function calling to an LLM, designing an agent loop, deciding which actions need human approval, or diagnosing why an agent fails."
---

# RAG and Agents

Give the model the right context per query instead of hoping it knows: retrieve only what is relevant (RAG), and let it act through tools when answering needs more than text (agents). Start simple (term-based retrieval, few read-only tools), evaluate each component separately, and gate every write action.

## RAG vs long context

- Long context does not remove the need for retrieval: data grows past any window, models use the middle of long prompts poorly, and every extra token costs money and latency.
- If the whole knowledge base fits comfortably in context and is reused often, putting it in the prompt (with prompt caching) can be simpler; measure both on your eval set.

## Retrieval algorithms

| | Term-based (BM25, inverted index) | Embedding-based (vector search) |
|---|---|---|
| Speed and cost | Fast to index and query | Embedding generation and ANN search cost more |
| Out of the box | Strong baseline | Depends on embedding model fit to your data |
| Improves with tuning | Little room | Finetune embeddings and retriever |
| Weakness | Misses paraphrases and synonyms | Blurs exact keywords: error codes, SKUs, names |

- Start with BM25; add embeddings when paraphrase misses dominate. Production systems usually combine both (**hybrid search**): run them in sequence (cheap retriever for candidates, precise one to rerank) or in parallel and fuse rankings.
- For ANN indexes, trade recall, queries per second, build time, and index size; HNSW-style indexes are accurate and fast but costly to build.

```python
def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> list[str]:
    """Each ranking is a list of doc ids, best first. Returns fused order."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)
```

## Retrieval optimization

- **Chunking:** split by structure where possible (sections, then paragraphs, then sentences, recursively), with small overlap so boundary facts survive. Use format-aware splitters (code, Q&A pairs). Smaller chunks fit more diverse snippets but lose context and multiply index size; chunk size must fit the embedding model's and generator's limits. Chunking by a model's tokenizer forces reindexing when you change models. Tune size on your eval set.
- **Reranking:** cut candidates to what fits the context with a stronger model (cross-encoder or LLM), optionally weighting recency for time-sensitive data. In context, inclusion matters more than exact order, but put the best items at the start or end.
- **Query rewriting:** turn follow-ups ("How about Emily?") into standalone queries using conversation history; if needed facts are unknown, the rewriter should say the query is unresolvable rather than invent them.
- **Contextual retrieval:** enrich each chunk with metadata, keywords, entities, likely questions it answers, or a short model-generated summary situating it in its document.
- **Tabular data:** route to text-to-SQL: pick the relevant tables (schema may not fit in context), generate SQL, execute read-only, and generate the answer from results.

## Evaluate RAG in three parts

1. Retrieval: context precision (share of retrieved items that are relevant) and context recall (share of relevant items retrieved); ranking metrics (NDCG, MRR) when order matters.
2. Embeddings and index: retrieval quality on your queries, latency, cost.
3. End-to-end answers: faithfulness to retrieved context and answer relevance.

## Agents

An agent is defined by its environment and its tools; the model plans, acts, observes, and decides when it is done. Agents need stronger models because errors compound (95 percent accuracy per step falls to roughly 60 percent over 10 steps) and because tools raise the stakes.

- **Tools:** knowledge (retrievers, search, SQL, APIs), capability extensions (calculator, code interpreter, translators, captioners), and write actions (send, update, pay, deploy). Read actions perceive; write actions change the world and need trust, least privilege, and approval.
- **Function calling:** declare each tool with name, parameters, and documentation; restrict the tool list per query; validate every generated call against the schema before executing.
- **Planning:** decouple plan generation from execution. Validate plans with heuristics (only known tools, step limit) or a judge, then execute; on failure, reflect and replan. An intent classifier helps choose tools and reject out-of-scope requests early.
- **Granularity:** natural-language plans survive tool renames and suit the model better, but need a translator to executable calls; exact function names are brittle. Hierarchical planning balances both.
- **Control flow:** sequential, parallel, if-branch, loop. Parallelize independent calls.
- **Reflection:** interleave thought, action, observation (ReAct) and add an evaluator plus self-reflection after failures (Reflexion). It improves results cheaply relative to better planning, but costs tokens and latency.
- **Tool selection:** compare tool sets, ablate tools that do not move success, replace tools the model keeps misusing, and inspect the distribution of tool calls.
- **Human in the loop:** define per action what the agent may do alone, what needs approval, and what humans execute.

## Agent failure modes and metrics

| Failure | Example | Measure |
|---|---|---|
| Invalid tool | Calls a tool not in the inventory | Share of calls to unknown tools |
| Invalid parameters | Wrong arity or types | Share of calls failing schema validation |
| Wrong parameter values | Right tool, wrong number | Accuracy against labeled calls |
| Goal or constraint failure | Wrong destination, over budget, missed deadline | Task success with constraints checked |
| False completion | Claims success with work undone | Independent verification of the end state |
| Tool failure | Tool returns wrong output, or a needed tool is missing | Per-tool tests; failure clustering by domain |
| Inefficiency | Too many steps, cost, or time | Steps, cost, and latency per task vs a baseline |

Build a planning dataset of (task, tool inventory) tuples, generate several plans per task, and track valid-plan rate and attempts needed to get a valid plan.

## Memory

- Internal knowledge (weights) for what every query needs; short-term memory (context) for the current task; long-term memory (retrievable store) for rarely needed or cross-session information.
- Memory handles context overflow, persists user preferences, keeps answers consistent, and preserves structured data. Decide what to add, what to summarize, and what to evict; store tables as tables, not as pasted text.

## Workflow

1. Build a retrieval eval set: real queries with labeled relevant documents.
2. Ship BM25 plus a simple chunker; measure precision, recall, and answer faithfulness.
3. Add embeddings or hybrid search, reranking, query rewriting, or contextual chunks only when the eval shows which failure dominates.
4. For agents, start with read-only tools and a validated plan-then-execute loop with step and cost limits.
5. Log every tool call and output; measure the failure table above.
6. Add write actions one at a time, each with schema validation, least privilege, and human approval until data justifies relaxing it.

## Red flags

- Jumping to a vector database before trying BM25; no retrieval metrics, only end-to-end impressions.
- Chunk size chosen once and never evaluated; chunks without document titles or context.
- Retrieved text or tool output trusted as instructions (indirect prompt injection).
- Agents with write tools, no approval gate, no step or spend limit.
- Tool calls executed without schema validation; tool errors swallowed instead of returned to the planner.
- Agent success judged by the agent's own claim of completion.

## Testing notes

- tdd: unit-test chunkers (boundaries, overlap, maximum size), RRF and rerankers with fixed rankings, query rewriting parsers, and tool-call validators.
- Test tools independently of the model with ordinary unit tests; fake tools in agent loop tests to script observations, including errors and timeouts.
- Assert the agent stops at the step limit and asks for approval before write actions.
- bdd: scenarios per user goal with constraint checks on the end state, run against recorded or stubbed model responses for determinism.
- **Current note:** standardized tool protocols such as the Model Context Protocol and native function calling are now common, so agents can reach far more tools; that makes least privilege, approval gates, and injection defenses more important, not less.

## Related

- `../../Adaptation/PromptEngineering/promptEngineering.md` — prompt injection defenses.
- `../../Adaptation/Finetuning/finetuning.md` — RAG vs finetuning decision.
- `../../Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` — routers, caches, write-action risk.
- `../../../HandsOnLLM/UsingPretrainedModels/SemanticSearchAndRAG/semanticSearchAndRAG.md` — dense retrieval and reranking in code.
- `../../../HandsOnLLM/TrainingAndFineTuning/CreatingEmbeddingModels/creatingEmbeddingModels.md` — training embedding models.
- `../../../../DataSystems/README.md` — indexes, storage, and derived data.
