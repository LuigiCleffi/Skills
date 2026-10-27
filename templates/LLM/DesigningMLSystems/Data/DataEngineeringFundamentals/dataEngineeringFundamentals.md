---
name: dmls-data-engineering-fundamentals
description: "Data sources for ML (user input, system logs, behavioral data, internal databases, third-party data), serialization formats (JSON, CSV, Parquet, Avro, Protobuf, pickle), row-major vs column-major and text vs binary, relational, document and graph data models, structured vs unstructured data, warehouses, lakes and lakehouses, transactional vs analytical processing, ETL vs ELT, dataflow through databases, services and real-time transports, and batch vs stream features, based on Chapter 2 (Data Engineering Fundamentals) of Chip Huyen's Designing Machine Learning Systems. Use when choosing a storage format or database for training data, logs or prompts, designing a feature or LLM data pipeline, deciding ETL vs ELT, passing predictions between services, choosing REST/RPC vs Kafka-style events, splitting batch (static) from streaming (dynamic) features, or fixing schema and null-handling bugs that reach a model."
---

# Data Engineering Fundamentals

Pick formats, data models, stores and dataflow by how the data will be read and written later, not by habit. Most ML production pain is data plumbing: know where each piece of data comes from, who assumes its structure, and how fresh it must be when the model sees it.

## Know your data sources

| Source | Traits | Handling rule |
|---|---|---|
| User input (text, files, forms) | Malformed often, needs fast response | Validate heavily at the edge: length, type, encoding, file format |
| System logs and model outputs | Well-formed, high volume, mostly needed when debugging | Log broadly, process periodically, set retention, move old logs to cold storage |
| Behavioral events (clicks, dwell, dismissals) | System-generated but still user data | Treat as personal data under privacy rules; it is also future training signal |
| Internal databases (inventory, CRM, users) | Authoritative business state | Read at prediction time for filtering and ranking, not only for training |
| Second/third-party data | Bought, pre-cleaned, privacy-sensitive, shrinking as tracking IDs become opt-in | Document provenance and consent; expect supply to change |

- **LLM note:** prompts and chat transcripts are user input (validate size, encoding, injected content) and behavioral data at once (personal, regulated). Model completions and tool traces are system logs; keep them, because they become eval and fine-tuning data.

## Choose a serialization format by access pattern

| Format | Kind | Use for |
|---|---|---|
| JSON / JSONL | Text, human-readable | Interchange, configs, small datasets, chat/instruction records |
| CSV | Text, row-major | Quick exports; beware lost float precision and poor escaping |
| Parquet | Binary, column-major | Large tables, analytics, reading a few of many features |
| Avro / Protobuf | Binary, schema-based | Service messages and event streams with evolving schemas |
| Pickle | Binary, Python-only | Avoid for sharing: language-locked and unsafe to load from untrusted sources |

- Row-major (CSV, OLTP rows) favors appending and reading whole examples; column-major (Parquet) favors reading a subset of columns across many rows. Many writes: row-major. Many column reads: column-major.
- Binary is more compact than text; converting a mid-sized CSV to Parquet commonly cuts size by half or more.
- pandas DataFrames are column-oriented: iterating rows is slow. Vectorize per column, or convert to a NumPy array when you truly need row access.

```python
import pandas as pd
df = pd.read_parquet("rides.parquet", columns=["ts", "location", "distance", "price"])  # read only needed columns
df["price_per_km"] = df["price"] / df["distance"]  # column-wise, not df.iterrows()
```

- **Current note:** for model weights, safer tensor-only formats (such as safetensors) are now the common default over pickle-based checkpoints; for datasets, columnar files plus table formats with schema evolution are standard.

## Pick the data model that makes your queries easy

- **Relational:** normalized tables, declarative SQL, a query optimizer does the planning. Normalize to avoid update anomalies; accept join cost.
- **Document:** self-contained records with good locality; "schemaless" only means the reader, not the writer, assumes the structure. Joins and cross-document filters are expensive.
- **Graph:** relationships first; use when queries traverse an unknown number of hops (social, knowledge, fraud rings).
- Many engines support several models; choose per workload, not per fashion.
- **Structured vs unstructured** is really about who assumes the schema: the writer (warehouse) or the reader (lake). Lakehouses mix the two.
- Schema changes bite models silently: a null replaced by 0 can turn into a real-looking value (e.g. age 0). Encode missing explicitly and test it.
- **LLM note:** keep raw documents in a lake, but store the processed corpus (cleaned text, chunk IDs, source, license, timestamp, dedup hash) as a structured table so you can filter, audit and rebuild it.

## Storage engines and ETL

- Transactional workloads need low latency and availability, usually row-oriented and often ACID; analytical workloads aggregate columns across many rows. Modern systems blur this line and decouple storage from compute.
- "Online" is overloaded: say whether data must be online (immediate), nearline (fast, automatic) or offline (needs human or batch step).
- **ETL:** validate and reject bad records at Extract (notify the source), clean, join, standardize categories ("M"/"Male"/"1") and dedupe at Transform, then decide how often to Load.
- **ELT** (dump raw into a lake, transform later) gives fast arrival but makes finding anything slow as data grows. Prefer schemas once the shape is known.

## Modes of dataflow between processes

| Mode | Good for | Weak when |
|---|---|---|
| Shared database | Simple, same org, latency-tolerant | Processes cannot share access; strict latency |
| Services (REST for public, RPC for internal) | Logic-heavy, request/response | Many services call each other; a down service cascades |
| Real-time transport (pub/sub such as Kafka, or message queues) | Data-heavy, many producers and consumers, async | You need a synchronous answer now |

- Request-driven calls are synchronous: if a dependency is down, callers retry until timeout. Publishing predictions as events to a broker decouples producers from consumers.
- Cache upstream predictions with a refresh interval instead of calling another model on every request.

## Batch vs stream processing

- Batch jobs over historical data compute **static features** that change slowly (account age, long-run rating).
- Stream processing over transports computes **dynamic features** about current state (drivers available now, last 10 prices); it is good at incremental, stateful aggregation.
- Most real systems need both, joined at prediction time; a stream engine can also run batch, not easily the reverse.
- **LLM note:** retrieval indexes are static-feature pipelines (batch re-embedding); session context, recent user actions and live inventory injected into prompts are dynamic features that need streaming or request-time lookups.

## Workflow

1. Inventory every data source; record owner, freshness need, privacy class and expected malformations.
2. List the read and write patterns for each dataset; pick row vs column and text vs binary from them.
3. Choose the data model per workload and write down who enforces the schema.
4. Define explicit encodings for missing values and categories; add schema validation at extract time.
5. Choose dataflow per edge: database, service call, or event stream, based on latency and coupling.
6. Split features into static (batch) and dynamic (stream or request-time) and design the join.
7. Set retention and storage tiers for logs, prompts and outputs, respecting privacy rules.

## Red flags

- `df.iterrows()` over large DataFrames; reading whole Parquet files to use three columns.
- Pickle files loaded from outside the team, or used as a long-term exchange format.
- Nulls silently filled with 0 or empty string before training.
- "Schemaless" stores with no reader-side validation; schema changes without backfill or versioning.
- A chain of synchronous model-to-model calls on the request path with no cache or timeout.
- User behavior or prompt logs stored without retention policy or access control.
- Training features computed by a batch job but served from a different streaming code path with no consistency check.

## Testing notes

- Unit-test parsers and transforms with malformed inputs: too long, wrong type, wrong encoding, empty, unexpected category spellings.
- Schema tests at pipeline boundaries: column names, dtypes, nullability, allowed ranges; fail the load rather than coerce.
- Round-trip tests for serialization (write then read equals original, including floats and Unicode).
- For streaming features, replay a recorded event log and assert the aggregate equals the batch computation over the same window.
- For LLM corpora, assert dedup hashes are unique and every record carries source and timestamp.
- **Current note:** data-contract and expectation tools that validate tables in CI are now routine; use whichever the stack already has.

## Related

- `../../Foundations/MLSystemsInProduction/mlSystemsInProduction.md` — why data, not the model, dominates production work.
- `../TrainingData/trainingData.md` — sampling and labeling once the data is stored.
- `../FeatureEngineering/featureEngineering.md` — turning stored data into features without leakage.
- `../../Production/ModelDeployment/modelDeployment.md` — batch vs online prediction built on these pipelines.
- `../../../AIEngineering/Adaptation/DatasetEngineering/datasetEngineering.md` — curating data for foundation models.
- `../../../HandsOnLLM/UsingPretrainedModels/SemanticSearchAndRAG/semanticSearchAndRAG.md` — indexes as stored, refreshed data.
- `../../../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — relational, document and graph models in depth.
- `../../../../DataSystems/Foundations/EncodingAndEvolution/encodingAndEvolution.md` — formats and schema evolution.
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` — event streams and stream processing.
- `../../../../DataSystems/DerivedData/BatchProcessing/batchProcessing.md` — batch jobs.
- `../../../../DBA/README.md` — SQL and schema work in Oracle or PostgreSQL.
