---
name: dmls-ml-systems-in-production
description: "Deciding when ML is the right tool, enterprise vs consumer use cases, data vs algorithms, how ML in production differs from research (stakeholders, inference over training, latency vs throughput and percentiles, messy shifting data, fairness, interpretability) and from traditional software (code plus data plus artifacts), the four system requirements (reliable, scalable, maintainable, adaptable), and the iterative ML project cycle, based on Chapter 1 (Machine Learning Systems in Production) of Chip Huyen's Designing Machine Learning Systems. Use when scoping a new ML or LLM feature, asking whether a model is needed at all, gathering stakeholder requirements, setting latency SLOs, writing an ML design doc, or planning how a model will be maintained after launch."
---

# Machine Learning Systems in Production

The model is a small part of an ML system: the interface, data stack, infrastructure, and hardware decide whether it works for users. Before building, check that ML fits the problem, collect every stakeholder's requirements, and plan for a system that is reliable, scalable, maintainable, and adaptable through a cycle that never really ends.

## Decide whether ML fits

ML learns complex patterns from existing data to make predictions on unseen data. Check each part before committing:

| Check | Question | If no |
|---|---|---|
| Learnable | Is there something to learn from (data now, or data collectable)? | Launch with humans or rules first and log their outputs as future labels. |
| Complex | Is the mapping too intricate to write by hand? | Use a lookup table, rule, or SQL. |
| Patterned | Is there signal at all, not pure noise? | Stop; no model will find it. |
| Predictive | Can the task be framed as "what would the answer be"? | ML is the wrong tool. |
| Same distribution | Will production inputs resemble the training data? | Plan for drift from day one. |

ML pays off most when the task is repetitive, wrong predictions are cheap (or the benefit of right ones clearly outweighs them), it runs at scale, and the patterns keep changing so hand rules go stale.

Do not use ML when it is unethical, when a simpler solution works, or when it is not cost-effective. If the whole problem is out of reach, split it: a model may handle one piece (for example, matching a query to an FAQ answer) while the rest goes to people.

- **LLM note:** a hosted LLM removes the "existing data" hurdle for many tasks, which makes the other checks more important, not less. A deterministic rule, regex, or lookup still beats an LLM call when the pattern is simple; cost per call and the price of a confident wrong answer decide the rest.

## Know what production changes

| Aspect | Research | Production |
|---|---|---|
| Requirements | One metric on a benchmark | Several stakeholders with conflicting goals |
| Compute priority | Fast training, high throughput | Fast inference, low latency |
| Data | Clean, static, well known | Messy, biased, shifting, private |
| Fairness | Optional | Required |
| Interpretability | Optional | Required for trust and debugging |

- **Stakeholders.** Product, sales, ML, platform, and management each want something different (relevance vs revenue vs latency vs stability). List each requirement and mark it must-have or nice-to-have; a must-have latency budget can rule out every candidate model.
- **Small gains.** A fraction of a percent matters for some tasks (ad clicks) and is invisible for others. If users cannot notice the gain, a complex model must win by a wide margin to justify its cost. Ensembles that win competitions are often too slow and opaque to ship.
- **Leaderboards.** Benchmarks hide the hard steps (collecting and labeling data) and, with many teams tuning on one test set, a winner can be lucky.
- **Fairness.** Models encode the past and can discriminate at scale; errors on small groups barely move the overall metric. Evaluate per group, not only overall.
- **LLM note:** public LLM leaderboards have the same flaws. Pick models on your own task-specific eval set, and weigh cost, latency, and data-handling terms alongside quality.

## Latency is a distribution

- Latency here means response time: request sent to response received. Throughput is queries served per unit of time.
- Batching can raise both throughput and latency; online batching also adds wait time while a batch fills.
- Never report only the mean. One slow outlier inflates it. Track p50 for the typical user and p90, p95, p99 for the tail, and write requirements as percentiles (for example, "p99 under N ms").
- The slowest requests often come from the most valuable users (the ones with the most data).
- **LLM note:** measure time to first token and total generation time separately, as percentiles, and per prompt length band; long prompts and long outputs dominate the tail.

```python
import numpy as np

def latency_report(ms: list[float]) -> dict[str, float]:
    arr = np.asarray(ms)
    return {p: float(np.percentile(arr, q)) for p, q in
            {"p50": 50, "p90": 90, "p95": 95, "p99": 99}.items()}
```

## ML systems are code, data, and artifacts

- Software keeps code and data apart; ML systems are built from both, plus the models trained from them. Version and test the data, not only the code.
- Not every sample is equally valuable; accepting all data blindly invites quality loss and data poisoning.
- Large models are hard to load, run fast enough, and debug; they fail silently with plausible but wrong outputs.
- **LLM note:** prompts, retrieval indexes, and fine-tuning sets are artifacts too. Version them with the code and record which ones produced each output.

## Four requirements

- **Reliable:** keeps doing the right thing under faults. ML fails silently, so define how you will know a prediction is wrong (labels, feedback, spot checks).
- **Scalable:** handles growth in model size, traffic, and model count. Autoscale resources up and down, and automate monitoring, retraining, and reproducible builds once you have many models.
- **Maintainable:** ML engineers, DevOps, and domain experts can each work in familiar tools and debug together without blame.
- **Adaptable:** can find improvements and ship updates without downtime as data and requirements change.

## Workflow

1. Write the problem as a prediction: inputs, output, who consumes it, and the cost of a wrong answer.
2. Run the fit checks; try the simplest non-ML solution and keep it as a baseline.
3. List stakeholders and their requirements; mark each must-have or nice-to-have with a number (latency percentile, cost per prediction, accuracy floor, fairness constraint).
4. Sketch the full system: interface, data sources, features, model, serving, monitoring, retraining.
5. Plan the cycle: scoping, data engineering, model development, deployment, monitoring and updates, business analysis, then back to scoping.
6. Decide how correctness will be observed in production before launch.

## Red flags

- A model where a rule or lookup would do, or an LLM call for exact-match logic.
- A design doc that covers only the model, with no data, serving, or monitoring section.
- A single optimization metric with no business metric tied to it, or no owner for each requirement.
- Latency stated as an average, or no latency budget at all.
- Overall accuracy reported with no per-group breakdown for decisions about people.
- Data, prompts, or models not versioned alongside code.
- A plan that ends at "deploy".

## Testing notes

- tdd: write the non-ML baseline first and test it; the model must beat it on the same fixed eval set.
- tdd: unit-test the plumbing (input validation, output schema, fallbacks) with a stub model so tests are deterministic.
- bdd: express stakeholder requirements as scenarios with measurable outcomes (for example, the p95 latency of the recommendation endpoint stays under budget under expected load).
- Evaluation: report per-slice metrics (user groups, input types) next to the overall score; keep a golden set that changes only by explicit versioning.
- Load tests should report percentiles, not means.

**Current note:**
- Many teams now start a new feature with a prompted foundation model and move to a smaller or fine-tuned model once cost, latency, or quality data justify it; the fit checks and requirements above still apply.
- This Early Release covers chapters 1–7; monitoring infrastructure, continual learning, and the human side of ML from the final book are not in this library.

## Related

- `../../Data/DataEngineeringFundamentals/dataEngineeringFundamentals.md` — data sources, formats, and dataflow.
- `../../Modeling/ModelDevelopment/modelDevelopment.md` — baselines, framing, and decoupled objectives.
- `../../Production/ModelDeployment/modelDeployment.md` — batch vs online prediction and inference speed.
- `../../Production/WhyMLSystemsFail/whyMLSystemsFail.md` — silent failures and distribution shift.
- `../../../AIEngineering/Foundations/BuildingAIApplications/buildingAIApplications.md` — scoping applications built on foundation models.
- `../../../HandsOnLLM/UnderstandingLanguageModels/IntroductionToLLMs/introductionToLLMs.md` — what LLMs can and cannot do.
- `../../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` — reliability, scalability, and percentiles in data systems.
- `../../../../ProductDefinition/plan.md` — product goals and stakeholders.
- `../../../../DevOps/Practices/Monitoring/monitoring.md` — observing systems in production.
