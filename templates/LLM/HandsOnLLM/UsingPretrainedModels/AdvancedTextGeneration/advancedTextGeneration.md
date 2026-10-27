---
name: hollm-advanced-text-generation
description: "Extending LLMs without fine-tuning: loading quantized GGUF models (bit precision, 4-bit rule of thumb), explicit prompt templates, chains of prompt templates and sequential multi-prompt pipelines, conversation memory (full buffer, windowed buffer of last k turns, running LLM summary) and their trade-offs, and agents that choose tools via the ReAct thought, action, observation loop with search and calculator tools, using LangChain and llama-cpp-python, based on Chapter 7 (Advanced Text Generation Techniques and Tools) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when running a local quantized model, building a chatbot that must remember the conversation, managing chat history against the context limit, composing multi-step LLM pipelines, giving an LLM tools such as search, calculator or APIs, or reviewing an agent loop for reliability."
---

# Advanced Text Generation Techniques and Tools

Most LLM systems are the model plus plumbing: a correct prompt template, chains of focused calls, memory that fits the context window, and tools the model can call. Add each component deliberately, know its cost, and keep autonomous behavior observable and bounded.

## Model I/O: quantized models

- Quantization stores weights with fewer bits (16 to 8 to 4), cutting memory and speeding inference with modest accuracy loss.
- Rule of thumb from the book: use at least 4-bit; below that (3 or 2 bit) quality drops noticeably, and a smaller model at higher precision is usually the better choice.
- GGUF is the file format used by llama.cpp/llama-cpp-python for quantized models; load with `n_gpu_layers=-1` to offload all layers to GPU and set `n_ctx` explicitly.
- Fix a `seed` when comparing outputs.

## Prompt templates

- Lower-level backends (llama.cpp, raw completions) do not apply the chat template; an instruct model fed a bare string may return nothing useful. Wrap the model with its template once and reuse it.
- Hosted chat APIs apply templates server-side; do not double-wrap.
- Parameterize templates (`{product}`, `{summary}`) instead of retyping prompts.

## Chains

- A chain links a prompt template to an LLM, or links several such steps where each output becomes the next input.
- Splitting a story into title, then character, then summary gives smaller prompts and individually accessible intermediate outputs.
- Give each link explicit input and output keys; this makes links reusable and testable.

## Memory

LLMs are stateless; memory means putting history back into the prompt.

| Memory type | Pros | Cons | Use when |
|---|---|---|---|
| Full buffer | Simplest; no loss inside the window | Prompt grows every turn; slower; overflows context | Short sessions, large context |
| Windowed buffer (last k turns) | Bounded size | Forgets everything older than k | Task-focused chats where only recent turns matter |
| Running summary (extra LLM call) | Bounded size; keeps gist of whole history | Extra call per turn; lossy; exact facts may be lost | Long conversations |

- The summarizer can be a smaller, cheaper model.
- Store critical facts (names, IDs, user choices) in structured state, not only in a lossy summary.
- Larger context windows do not remove the cost: every history token is processed before generation.

## Agents and ReAct

- An agent lets the LLM decide which actions to take and in which order, using **tools** (search, calculator, APIs) and an **agent type** that plans.
- ReAct loop: Thought (what to do and why), Action (tool + input), Observation (tool result), repeated until a final answer.
- Give the model tools for what it is bad at: arithmetic goes to a calculator, current facts go to search.
- Tool descriptions are prompts: name and describe each tool precisely so the model selects correctly.
- Agents need capable instruction-following models; small local models may fail to follow the format.
- Autonomy removes the human from intermediate steps. Mitigate: return sources (URLs) with answers, verify at each step, cap iterations, and handle parse errors.

Minimal shape of a tool loop, framework-agnostic:

```python
def run_agent(llm, tools, question, max_steps=5):
    scratchpad = []
    for _ in range(max_steps):
        step = llm.decide(question, scratchpad, tools)   # returns tool call or final answer
        if step.final_answer is not None:
            return step.final_answer, scratchpad
        result = tools[step.tool](step.tool_input)        # validate input before calling
        scratchpad.append((step.thought, step.tool, step.tool_input, result))
    raise RuntimeError("agent exceeded max_steps")
```

- **Current note:** the LangChain classes used in the book (`LLMChain`, `ConversationBufferMemory`, string-parsed ReAct agents) have since been deprecated or reorganized, and most models and APIs now support native structured tool calling; prefer native tool calling and current framework APIs, but the memory trade-offs and ReAct loop still apply.

## Workflow

1. Pick the model and precision that fit memory; verify the chat template is applied.
2. Write each step as a parameterized template with named inputs and outputs.
3. Compose steps into a chain; inspect intermediate outputs.
4. Choose memory by expected conversation length; keep hard facts in explicit state.
5. Add tools only for capabilities the model lacks; describe them precisely.
6. Bound the agent: max steps, timeouts, allowed tools, input validation, logging of each thought/action/observation.
7. Evaluate final answers and tool-use correctness on a task set.

## Red flags

- Instruct model called without its template (empty or rambling output).
- 2-bit quantization chosen to fit a large model when a smaller model would do better.
- Full chat history appended forever with no window or summary.
- Agent loops without step limits, timeouts, or logging; tools with side effects (payments, deletes, emails) callable without confirmation.
- Tool inputs from the model passed unvalidated to shells, SQL or HTTP.
- Agent answers presented without sources or verification.

## Testing notes

- Unit-test each chain link with a fake LLM returning canned text; assert template rendering and key passing.
- Memory tests: after k+1 turns the windowed buffer excludes turn 1; summary memory stays under a token budget.
- Agent tests: scripted fake LLM that requests a tool, assert the tool is called with validated input, the observation is fed back, and `max_steps` aborts runaway loops.
- Evaluate tool selection accuracy and final-answer correctness on a fixed task set with temperature 0.
- bdd: "given the user said their name earlier, when they ask for it, the bot answers it."

## Related

- `../PromptEngineering/promptEngineering.md` — templates, chaining, reasoning prompts.
- `../SemanticSearchAndRAG/semanticSearchAndRAG.md` — retrieval as another component.
- `../../TrainingAndFineTuning/FineTuningGenerationModels/fineTuningGenerationModels.md` — how quantization works.
- `../../UnderstandingLanguageModels/LookingInsideLLMs/lookingInsideLLMs.md` — context length and KV cache cost.
- `../../../AIEngineering/Adaptation/RAGAndAgents/ragAndAgents.md` — agents, tools, planning, failure modes.
- `../../../AIEngineering/Production/InferenceOptimization/inferenceOptimization.md` — quantization for serving.
- `../../../AIEngineering/Production/ArchitectureAndUserFeedback/architectureAndUserFeedback.md` — guardrails and system architecture.
