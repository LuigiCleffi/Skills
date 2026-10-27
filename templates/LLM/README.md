## AI Skills

Before building, adapting, evaluating, or reviewing anything that uses a
large language model or another machine learning model, decide which
question the task asks, then read only the entry point for the book that
answers it. Inside each book, read only the chapter skills whose "Use when"
matches the task.

| Folder | Entry point | Use when |
|---|---|---|
| AIEngineering | `./AIEngineering/README.md` | Building a product on a foundation model: choosing a model, evaluation and AI-as-judge, prompts, RAG, agents and tools, deciding whether to finetune, dataset curation, inference latency and cost, guardrails, architecture, and user feedback. |
| HandsOnLLM | `./HandsOnLLM/README.md` | Using pretrained models in code: tokenizers and embeddings, classification, clustering and topic modeling, prompting and generation pipelines, semantic search and RAG, multimodal models, and fine-tuning embedding, classification, or generation models. |
| BuildLLMFromScratch | `./BuildLLMFromScratch/README.md` | Working on the model itself in PyTorch: tokenization and data loaders, attention, the GPT architecture, pretraining loops, loss and perplexity, decoding, classification and instruction fine-tuning, and LoRA. |
| DesigningMLSystems | `./DesigningMLSystems/README.md` | The ML system around any model: framing the business problem, data pipelines, labels and sampling, features and leakage, model selection and offline evaluation, deployment (batch or online), and why models fail in production. |

When `actions/dev.md`, `actions/tdd.md`, `actions/bdd.md`, and
`actions/review.md` are installed, they own the workflow; these skills
define how LLM and ML code, prompts, data, and evaluations are built.
Every chapter skill ends with "Red flags" for `dev` and `review` and
"Testing notes" for `tdd`, `bdd`, and evaluation, and carries a "Current
note" where the field has moved on since the book.

## Choosing the book

The books sit at different layers of the same stack:

1. **Application** (Huyen, *AI Engineering*): what to build on top of a
   model and how to know it works. Start here for any LLM feature; it
   decides between prompting, retrieval, agents, and finetuning.
2. **Practitioner** (Alammar & Grootendorst, *Hands-On Large Language
   Models*): how to call, combine, and fine-tune pretrained models with
   common libraries once the approach is chosen.
3. **Internals** (Raschka, *Build a Large Language Model (From Scratch)*):
   how the model works inside, for training, debugging, or modifying it.
4. **System** (Huyen, *Designing Machine Learning Systems*): the data,
   pipelines, deployment, and monitoring that any model in production
   needs, LLM or not.

Prompting and RAG appear in both *AI Engineering* and *Hands-On*: use
*AI Engineering* for the design decision and its evaluation, *Hands-On*
for the implementation. Fine-tuning appears in three books: *AI
Engineering* decides whether to, *Hands-On* shows how with libraries, and
*From Scratch* shows what happens inside.

# Context for AI: Building with LLMs

## 1. Evaluate Before You Optimize

No prompt, retrieval change, model swap, or finetune is an improvement
until an evaluation says so. Define the task's success criteria and a
versioned evaluation set first, then compare every change against it.
Anecdotes from a handful of manual tries are not evidence.

## 2. Start With the Simplest Adaptation

Try a strong model with a clear prompt first, add retrieval when the model
lacks knowledge, add tools or agents when it must act, and finetune only
when evaluation shows prompting and retrieval cannot reach the target on
quality, cost, or latency.

## 3. Treat Model Output as Untrusted

Outputs can be wrong, malformed, or steered by injected instructions in
retrieved documents, tool results, or user input. Validate structure,
check claims that matter, constrain what tools an agent may call, and keep
humans in the loop for irreversible actions.

## 4. Data Decides Quality

Training, fine-tuning, retrieval, and evaluation data determine most of the
outcome. Keep evaluation data out of training data, track where every
dataset came from and its license, deduplicate, and look at samples by
hand before trusting aggregate numbers.

## 5. Make Nondeterminism Testable

Wrap model calls behind small interfaces so deterministic code (parsing,
routing, prompt assembly, retrieval, post-processing) is unit tested with
fakes. Test the model's behavior with evaluation sets and thresholds, fixed
seeds and temperature 0 where possible, and never with exact-string
assertions on free text.

## 6. Watch Cost, Latency, and Drift

Measure tokens, time to first token, time per output token, and cost per
request alongside quality. Monitor inputs and outputs in production;
users, data, and providers' models change underneath a working system.

## 7. Books Age

Model names, benchmarks, prices, context lengths, and library APIs in the
books are dated; the principles are not. Check current provider
documentation and library versions before quoting numbers or writing API
calls, and prefer each skill's "Current note" over the book.

## 8. How the AI Should Apply It

- Match the project's existing model provider, libraries, and evaluation
  tooling before applying a skill's preference.
- In `dev`, read the skills for the component you are about to build and
  check the change against their "Red flags" before reporting it done.
- In `tdd` and `bdd`, use the "Testing notes" to separate deterministic
  tests from model evaluations.
- In `review`, cite the skill and the red flag a finding comes from.
- Do not invent evaluation results, benchmark scores, or costs; report
  what was measured and what was assumed.
- Ask before spending significant money or compute (large evaluation runs,
  training or fine-tuning jobs, bulk API calls) and before sending private
  data to a third-party model provider.
