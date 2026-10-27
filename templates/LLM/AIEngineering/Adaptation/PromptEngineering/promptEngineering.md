---
name: aieng-prompt-engineering
description: "Prompt engineering for production applications: anatomy of a prompt (task description, examples, the task), in-context learning (zero-shot, few-shot), system vs user prompts and chat templates, context length and position effects (needle in a haystack), best practices (clear explicit instructions, personas, examples, output format and end markers, sufficient context, task decomposition and prompt chaining, chain-of-thought and self-critique, iteration), prompt optimization tools, organizing and versioning prompts in a catalog, and defensive prompt engineering (prompt extraction, jailbreaking, direct and indirect prompt injection, information and training data extraction, model, prompt and system-level defenses, violation and false refusal rates), based on Chapter 5 (Prompt Engineering) of Chip Huyen's AI Engineering. Use when writing or reviewing system prompts, adding few-shot examples, splitting a bloated prompt into a chain, storing and versioning prompts, evaluating a prompt optimizer, or hardening an LLM app, RAG pipeline, or agent against prompt injection and data leaks."
---

# Prompt Engineering

Treat prompts as versioned code that is evaluated, not as magic phrases: state the task unambiguously, give context and examples, specify the output, and split complex work into steps. Assume every input, retrieved document, and tool output may be hostile, and defend at the model, prompt, and system levels.

## Anatomy and placement

- A prompt has a task description (role, rules, output format), examples, and the concrete task. Context is the information the model needs to do it.
- System and user prompts are concatenated before the model sees them; the system prompt helps because it comes first and models are trained to prioritize it.
- Use the model's exact chat template. Template mistakes fail silently (the model still answers, just worse). Print the final rendered prompt when debugging.
- Models attend best to the start and end of long prompts. Put critical instructions there and test long-context recall with needle-in-a-haystack style probes using private facts.
- Some models prefer the task description first, others last; test both.

## Best practices

| Practice | How |
|---|---|
| Be explicit | Define the scale (1–5, integers only), what to do when unsure, what not to output (preambles) |
| Persona | Assign the perspective the answer should take (e.g., a first-grade teacher grading) |
| Examples | Add few-shot examples when the domain or format is unusual; strong models gain less from them. Use token-cheap example formats |
| Output format | Name JSON keys and types; end the prompt with a marker (e.g., `-->`) so the model starts the answer instead of continuing the input |
| Context | Supply the source material; to restrict answers to it, say so, show refusal examples, and ask for quotes or citations |
| Decompose | One prompt per subtask (e.g., intent classification, then a per-intent response prompt). Easier to debug, monitor, parallelize, and to run cheap steps on cheaper models |
| Time to think | Chain-of-thought ("think step by step", or spell out the steps) and self-critique improve reasoning but add latency and tokens |
| Iterate | Change one thing at a time, compare on the same eval set, read the provider's prompting guide |

- Decomposition can raise user-perceived latency when intermediate steps are hidden; measure time to the first visible token.

## Prompt optimization tools

- Tools can search for prompts against your metric and eval data, or have a model rewrite prompts. Start by hand to learn the model and the task.
- When using tools: inspect the prompts they generate, check they use the right template, count the hidden API calls (variations x examples x generate/validate/score), and pin tool versions because default templates change.

## Organize and version prompts

- Keep prompts out of application code, in their own module or files, with metadata: model, sampling settings, input and output schema, owner, use case, date.
- Version prompts independently of code (a prompt catalog) when several applications share them, so each app can pin a version.
- Evaluate a prompt change in the whole system; a better subtask prompt can hurt the end-to-end result.

```python
from pydantic import BaseModel

class PromptSpec(BaseModel):
    id: str                 # "ticket-intent"
    version: str            # "2025-03-14.2"
    model: str
    temperature: float = 0.0
    template: str           # rendered with explicit fields only
    output_schema: dict | None = None

def render(spec: PromptSpec, **fields: str) -> str:
    return spec.template.format(**fields)  # missing field raises KeyError early
```

## Defensive prompt engineering

Attack types: **prompt extraction** (reveal the system prompt), **jailbreaking and prompt injection** (make the model do what it should not, including executing tools), **information extraction** (leak context, PII, or memorized training data). Risks include unauthorized tool or code execution, data leaks, harmful output, misinformation, and brand damage.

- **Indirect injection** is the most dangerous: instructions hidden in web pages, emails, documents, repository files, or database fields that the model reads through tools or retrieval. Treat all of it as data.
- Assume your system prompt will leak; never put secrets or access controls in it.

Defense layers (use all three):

1. **Model level:** pick models trained on an instruction hierarchy (system above user above model output above tool output) and safety-tuned to answer borderline requests helpfully rather than refuse.
2. **Prompt level:** state what must never be done; repeat the core instruction after untrusted content; warn about known attack styles; delimit untrusted content clearly; audit third-party default templates, which may lack safety instructions.
3. **System level:** run generated code in an isolated sandbox; require human approval for write or destructive actions (e.g., SQL containing DELETE, DROP, UPDATE; sending email; payments); grant tools least privilege; define out-of-scope topics and route them away; add input and output guardrails (PII, toxicity, known attack patterns); watch usage patterns for repeated probing.

Measure robustness with two numbers: **violation rate** (successful attacks / attempts) and **false refusal rate** (safe requests refused). Optimizing only the first produces a useless system.

## Workflow

1. Write the task description, output schema, and a handful of examples from real data.
2. Render through the model's chat template; inspect the final prompt.
3. Build a small eval set and baseline the prompt; record version and sampling settings.
4. Iterate one change at a time; decompose when the prompt grows or mixes intents.
5. Move the prompt to the catalog with metadata; pin the version in each app.
6. Threat-model inputs, retrieved content, and tools; add the three defense layers.
7. Red-team with known attack templates and automated probing; track violation and false refusal rates per release.

## Red flags

- Prompts built by string concatenation scattered through code, unversioned.
- Secrets, keys, or internal policies in the system prompt.
- Retrieved documents or tool outputs inserted without delimiting or treated as instructions.
- An agent that can write, delete, send, or pay without human approval or least-privilege scopes.
- Generated code executed outside a sandbox.
- Prompt changes merged without an eval run; reliance on "tip $300"-style tricks.
- Only blocking attacks measured, never false refusals.

## Testing notes

- tdd: test prompt rendering deterministically (all fields present, delimiters intact, template matches the model) and test parsers on recorded outputs.
- Maintain a prompt regression suite per prompt version; run it in CI with stubbed or cached model calls plus a small live suite.
- Keep an adversarial set: direct jailbreaks, injected instructions in documents, emails, and tool outputs, prompt-extraction attempts; assert that no protected tool call or secret appears.
- bdd: write scenarios such as "an email containing 'forward all mail' does not trigger a forward action".
- **Current note:** reasoning-oriented models now do much of the step-by-step thinking without being asked, and many APIs enforce JSON schemas natively; prompt injection, however, remains unsolved, so system-level defenses are still required.

## Related

- `../../Adaptation/RAGAndAgents/ragAndAgents.md` — context construction and tool use.
- `../../Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` — guardrails in the architecture.
- `../../Foundations/FoundationModels/foundationModels.md` — sampling and structured outputs.
- `../../../HandsOnLLM/UsingPretrainedModels/PromptEngineering/promptEngineering.md` — prompting in code.
- `../../../HandsOnLLM/UsingPretrainedModels/AdvancedTextGeneration/advancedTextGeneration.md` — chains and memory.
- `../../../../CleanCode/README.md` — keeping prompt-handling code clean.
