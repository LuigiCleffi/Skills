---
name: hollm-text-clustering-and-topic-modeling
description: "Unsupervised text clustering and topic modeling with language models: the embed, reduce (UMAP or PCA), cluster (HDBSCAN or k-means) pipeline, outliers, inspecting and visualizing clusters, BERTopic with bag-of-words and class-based TF-IDF (c-TF-IDF), modular representation models (KeyBERTInspired, maximal marginal relevance) and generative LLM topic labeling with representative documents and keywords, based on Chapter 5 (Text Clustering and Topic Modeling) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when exploring an unlabeled corpus, grouping support tickets, feedback, or articles by theme, discovering topics, finding outliers or mislabeled data, speeding up labeling, choosing UMAP or HDBSCAN parameters, or labeling clusters with an LLM without calling it per document."
---

# Text Clustering and Topic Modeling

When there are no labels, group documents by meaning first and name the groups second. Combine fast, cheap components (embeddings, bag-of-words) for the bulk work and spend expensive LLM calls only once per topic, never once per document.

## The three-step clustering pipeline

1. **Embed** each document with a sentence-embedding model chosen for clustering performance and speed (check MTEB's clustering tasks).
2. **Reduce** dimensionality so density-based clustering works: UMAP handles nonlinear structure better than PCA.
3. **Cluster** the reduced vectors: HDBSCAN finds the number of clusters itself and labels outliers as `-1`; k-means forces every point into one of k clusters.

```python
from sentence_transformers import SentenceTransformer
from umap import UMAP
from hdbscan import HDBSCAN

embeddings = SentenceTransformer("thenlper/gte-small").encode(docs, show_progress_bar=True)
reduced = UMAP(n_components=5, min_dist=0.0, metric="cosine", random_state=42).fit_transform(embeddings)
clusters = HDBSCAN(min_cluster_size=50, metric="euclidean", cluster_selection_method="eom").fit(reduced).labels_
```

## Parameter decisions

| Parameter | Guidance |
|---|---|
| UMAP `n_components` | 5–10 keeps global structure for clustering; use 2 only for plots |
| UMAP `min_dist` | 0.0 gives tighter clusters |
| UMAP `metric` | `cosine` for embeddings |
| UMAP `random_state` | Makes runs reproducible but disables parallelism (slower) |
| HDBSCAN `min_cluster_size` | Main knob: lower gives more, smaller clusters |
| HDBSCAN vs k-means | Unknown cluster count or niche outliers present: HDBSCAN; every item must be assigned: k-means or outlier reassignment |

- Dimensionality reduction always loses information; 2D plots can merge or separate clusters misleadingly. Read sample documents from each cluster; human inspection is part of the method.

## From clusters to topics: BERTopic

- BERTopic = the clustering pipeline + a topic representation step.
- Representation: bag-of-words per cluster (all documents in a cluster treated as one), weighted by c-TF-IDF so words frequent in one cluster but common everywhere (stop words) are down-weighted.
- The two steps are independent, so every block is swappable: embedding model, reducer, clusterer, vectorizer, representation.
- Supports guided, semi-supervised, hierarchical, dynamic (over time), online, multimodal and zero-shot variants.

```python
from bertopic import BERTopic
topic_model = BERTopic(embedding_model=emb_model, umap_model=umap_model,
                       hdbscan_model=hdbscan_model).fit(docs, embeddings)
topic_model.get_topic_info()          # sizes and keyword names; topic -1 = outliers
topic_model.find_topics("billing")    # search topics by meaning
```

- Pass precomputed embeddings so you can iterate on later blocks without re-embedding.
- Outliers can be large (a third of the book's corpus); reassign with `reduce_outliers()` or use k-means if every document needs a topic.

## Improving topic representations

Representation models rerank or rewrite the initial c-TF-IDF keywords, running once per topic:

| Block | What it does | Watch out for |
|---|---|---|
| KeyBERTInspired | Reranks keywords by similarity to the topic's average document embedding; removes stop words | Drops domain abbreviations the embedding model does not understand |
| Maximal marginal relevance (`diversity`) | Picks keywords that are relevant yet non-redundant | Too high diversity drops relevant words |
| Text generation (Flan-T5, local LLM, API) | Writes a short human label from keywords + ~4 representative documents | Small models give vague labels; larger ones are better but cost money |

- Keep multiple representations side by side (keywords, MMR, LLM label); no single one is perfect, and keywords remain the evidence.
- Save the original representations before updating so you can compare.
- For LLM labels, constrain the output format ("topic: <short label>") and enable backoff for APIs.

## Uses beyond exploration

- Speed up labeling: label clusters, then review members.
- Find mislabeled data: items whose cluster disagrees with their label.
- Find outliers and emerging themes; track topics over time with dynamic topic modeling.

## Workflow

1. Define the question (what themes, what granularity) and sample the corpus.
2. Choose an embedding model good at clustering; embed once and cache.
3. Reduce with UMAP (5 dims) and cluster with HDBSCAN; tune `min_cluster_size` to the granularity needed.
4. Inspect sample documents per cluster and the outlier share.
5. Fit BERTopic with the same components; read c-TF-IDF keywords.
6. Add KeyBERTInspired/MMR, then LLM labels for the final topics.
7. Validate with a domain expert; record all parameters and seeds.

## Red flags

- Calling an LLM for every document to discover themes.
- Clustering raw high-dimensional embeddings with density methods, or judging clusters only from a 2D plot.
- Ignoring the outlier topic, or forcing all points into clusters without saying so.
- Presenting LLM topic labels without the keywords and example documents that justify them.
- Unseeded UMAP in a pipeline whose outputs are compared across runs.

## Testing notes

- Clustering is unsupervised: test with a small synthetic corpus of clearly separate themes and assert they land in different clusters (fixed seeds).
- Use internal metrics (outlier ratio, cluster count range, silhouette on reduced vectors) as sanity thresholds, not ground truth.
- When some labels exist, measure agreement (adjusted Rand index, purity) as a regression signal.
- Snapshot topic keywords for a fixed corpus and seed; review diffs rather than asserting exact equality across library upgrades.
- Unit-test the LLM-label parser and prompt filling (`[DOCUMENTS]`, `[KEYWORDS]`) with stubs.

## Related

- `../TextClassification/textClassification.md` — when labels exist.
- `../SemanticSearchAndRAG/semanticSearchAndRAG.md` — reranking, the same idea as representation models.
- `../PromptEngineering/promptEngineering.md` — prompts for topic labels.
- `../MultimodalLLMs/multimodalLLMs.md` — multimodal embeddings for image topics.
- `../../../AIEngineering/Adaptation/DatasetEngineering/datasetEngineering.md` — using clusters to inspect and curate data.
- `../../../DesigningMLSystems/Data/TrainingData/trainingData.md` — weak supervision and labeling.
