---
name: aieng-dataset-engineering
description: "Building datasets for finetuning and evaluating foundation models: data formats per training stage (sequences, instruction-response, preference pairs, scored examples), curation for chain-of-thought and tool-use data, the quality, coverage and quantity trio, quality criteria (relevant, aligned, consistent, formatted, unique, compliant), how much data you need (PEFT vs full finetuning, task complexity, base model strength, start with 50-100 examples), acquisition and annotation guidelines, data augmentation and synthesis (rule-based, simulation, AI-generated instructions and responses, self-instruct, reverse instruction, back-translation, long-context synthesis), data verification, limits of synthetic data (quality control, superficial imitation, model collapse, obscured lineage), model distillation, and data processing (inspection, deduplication with exact, fuzzy, MinHash or semantic matching, cleaning and filtering, PII removal, formatting to the chat template), based on Chapter 8 (Dataset Engineering) of Chip Huyen's AI Engineering. Use when assembling a finetuning or eval dataset, writing annotation guidelines, generating synthetic data with an LLM, distilling a large model into a small one, deduplicating or cleaning a corpus, or deciding how much data to collect."
---

# Dataset Engineering

Data, not the training script, usually decides finetuning outcomes. Define the behavior you want, then curate data that is high quality, covers the real range of inputs, and is large enough, in that priority order. Verify everything, synthetic data especially, and keep lineage so you can trust and legally use the result.

## Format per stage

| Goal | Data format |
|---|---|
| Continued pre-training / domain adaptation | Raw sequences of text |
| Supervised (instruction) finetuning | (instruction, response); instruction may split into system and user prompts |
| Preference finetuning | (instruction, preferred response, rejected response) |
| Reward model | Preference pairs or ((instruction, response), score) |

- To teach chain-of-thought, responses must contain the reasoning steps; to teach tool use, examples must show the calls and observations. Human demonstrations of tool use can be a poor fit, because people and models use tools differently; simulated or AI-generated traces are often better.
- Multi-turn behavior needs multi-turn examples.

## Quality, coverage, quantity

**Quality** — a small set of excellent examples can beat a large noisy one. Each example should be:

- relevant to the task and time period;
- aligned with task requirements (factual where facts matter, concise if answers should be concise, with justifications if required);
- consistent across examples and annotators;
- correctly formatted (no stray HTML, odd whitespace, inconsistent casing or numbers);
- sufficiently unique (duplicates bias the model and contaminate test splits);
- compliant with policies and law (no forbidden PII, licensed sources only).

**Coverage** — match the diversity of real usage: task types, topics, lengths, languages, phrasing (including typos and terse queries), and difficulty. Mixes matter: deliberately balance domains rather than taking whatever is abundant.

**Quantity** depends on:

- Method: full finetuning needs orders of magnitude more than LoRA; with hundreds to a few thousand examples, prefer PEFT on a strong base model; with very large datasets, full finetuning of smaller models becomes competitive.
- Task complexity and how close the base model already is (stronger bases need fewer examples).
- Start with about 50–100 carefully made examples. Clear gains suggest more data will help; no gain usually means more of the same data will not, though check hyperparameters, prompts, and data quality first.
- Lower-quality or adjacent data can be used for a first finetuning stage before the expensive, high-quality set.

## Acquisition and annotation

- Your own application data (inputs, outputs, user feedback) is the most relevant source; then public and licensed datasets, inspected and license-checked (including the provenance of their parts).
- Combine sources: filter a public set, fix weak responses by hand, synthesize for gaps, re-annotate. Expect to revise guidelines and re-annotate several times.
- Write annotation guidelines that say what good looks like, whether a correct answer can still be unhelpful, and how adjacent scores differ. Reuse the evaluation rubric; annotation and evaluation guidelines are the same artifact.

## Augmentation and synthesis

Reasons: more quantity, targeted coverage (rare classes, long or short inputs, adversarial and safety cases), sometimes higher quality or consistency than humans (complex math, preference labels), privacy (synthetic records), and distillation.

- **Rule-based:** templates and transformations (synonym replacement, perturbation, entity swaps to reduce bias).
- **Simulation:** generate tool-use or agent trajectories in simulated environments.
- **AI-generated instructions:** seed topics or templates, generate many instructions per item; watch diversity (too many per template collapses variety).
- **AI-generated responses:** several per instruction, filtered by verification.
- **Reverse instruction:** take high-quality human content and have a model write the prompt that would elicit it, avoiding hallucinated long responses; can bootstrap a model iteratively.
- **Back-translation and execution checks:** for code and translation, verify by translating back or running tests; keep only examples that pass.
- **Long-context synthesis:** generate question-answer pairs from chunks, then train with the full long document as context.

## Verify synthetic data

- Prefer data you can verify functionally (code that passes tests, SQL that executes). Otherwise score with AI judges or specialized classifiers, check factual consistency, detect topic drift, and flag outliers.
- Heuristic filters: drop empty, too short or too long examples, repetitive ones, same instruction with conflicting responses, and outputs that merely repeat the input.

Limits to respect:

- **Quality control:** unverifiable synthetic data is a liability.
- **Superficial imitation:** a student trained on a stronger teacher's outputs copies style, not capability, and can learn to produce confident-looking wrong answers.
- **Model collapse:** training repeatedly on generated data loses rare events; mix in real data.
- **Obscured lineage:** the teacher's copyright and benchmark contamination flow into your data; check the teacher's terms for using outputs to train models.

**Distillation:** train a small student on a large teacher's outputs for a narrow task to cut cost and latency; evaluate the student on real data, not only on teacher-generated data.

## Processing pipeline

1. **Inspect:** source and processing history; distributions of length, tokens, topics, languages, scores by source, time, and annotator; inter-annotator disagreement. Read a sample yourself; it pays off more than any tool. Try annotating a few examples to check annotation trustworthiness.
2. **Deduplicate:** decide the level (document, paragraph, sentence) and threshold (exact vs near-duplicate). Use exact hashing, n-gram or fuzzy match, MinHash or Bloom filters for scale, or embeddings for semantic duplicates. Deduplicate across train and eval splits.
3. **Clean and filter:** strip markup and boilerplate, remove PII and disallowed fields, drop toxic or low-quality data, watch annotator fatigue patterns; prune to the most useful examples if over budget.
4. **Format:** use the target model's tokenizer and exact chat template. Few-shot prompts become training examples; the finetuned prompt can drop the long task description.

Do trial runs of each script, order steps by cost, and never modify the raw data in place.

```python
import hashlib, re

def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()

def drop_exact_duplicates(rows: list[dict]) -> list[dict]:
    seen, kept = set(), []
    for row in rows:
        key = hashlib.sha256(normalize(row["instruction"] + "\n" + row["response"]).encode()).hexdigest()
        if key not in seen:
            seen.add(key)
            kept.append(row)
    return kept
```

## Workflow

1. Write the target behavior and the annotation guideline (shared with evaluation).
2. Gather candidate data; record source, license, and processing per subset.
3. Inspect, deduplicate (including against eval sets), clean, and filter.
4. Fill coverage gaps with augmentation or synthesis; verify every synthetic example.
5. Format to the model's template; split train/validation/test with no overlap.
6. Run a small finetune to test the data's value before scaling collection.
7. Version the dataset with a data card (sources, filters, synthetic share, known gaps).

## Red flags

- Scraped data used without license review or PII removal.
- Synthetic data generated and used with no verification step or real-data mix.
- No deduplication between training data and evaluation sets.
- Annotation done without a guideline, or with a guideline that differs from the eval rubric.
- Data formatted with a different chat template than inference uses.
- Raw data overwritten by processing scripts; no record of transformations.
- Collecting tens of thousands of examples before testing whether 100 help.

## Testing notes

- tdd: processing steps are pure functions; unit-test normalization, dedup thresholds, PII scrubbers, and template formatting with small fixtures, including Unicode and whitespace edge cases.
- Add data validation checks in the pipeline: schema, length bounds, allowed labels, no empty responses, no train/eval overlap (hash comparison).
- Track dataset statistics per version and alert on large shifts (length, topic, language mix).
- Spot-check a random sample by hand at every release; log reviewer agreement.
- **Current note:** synthetic and model-generated data now make up much of post-training data across the industry; verification and real-data anchoring matter more as that share grows.

## Related

- `../../Adaptation/Finetuning/finetuning.md` — when and how to finetune.
- `../../Evaluation/EvaluateAISystems/evaluateAISystems.md` — rubrics and eval sets.
- `../../../DesigningMLSystems/Data/TrainingData/trainingData.md` — sampling, labeling, class imbalance.
- `../../../DesigningMLSystems/Data/DataEngineeringFundamentals/dataEngineeringFundamentals.md` — data sources and formats.
- `../../../BuildLLMFromScratch/FineTuning/InstructionFineTuning/instructionFineTuning.md` — instruction dataset formatting.
- `../../../../DataSystems/README.md` — batch pipelines for large corpora.
