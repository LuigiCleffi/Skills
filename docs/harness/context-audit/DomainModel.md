# Domain Model: Context audit

## Bounded Context

**Context audit**: measuring what an agent tool loads from a project before the first prompt. It reads the project's files and the agent tools' conventions ([RS-0001](../../knowledge/research/RS-0001-agent-startup-context.md)); it owns no data and writes nothing. It sits beside the harness (which consumes its result in docs) and the installer (which ships it), and shares no model with either.

## Ubiquitous Language

Terms are in [the glossary](../../knowledge/glossary.md): **Startup context**, **Folder-scoped file**, **Budget**. Also:

| Term | Meaning | Code name |
|---|---|---|
| Tool | An agent tool detected in the project: Claude Code, Codex, OpenCode | `tool` |
| Part | One counted item of a tool's startup context: an instruction file, an import, a rules file, or a skill or agent description | `part` |
| Startup set | The parts one tool loads at session start, per BR-0001 | `startupSet` |
| Counter | How tokens are counted: the `o200k_base` tokenizer or the characters ÷ 4 estimate | `counter` |
| Warning | A problem to act on: over budget, Codex drop, broken import, unreadable file, capped or missing description, malformed config | `warning` |

## Model

- **Audit** (the result, a value): the counter used, the budget, one **ToolReport** per detected tool, the folder-scoped files, and the warnings. Built once from a project directory; never changed after.
- **ToolReport** (value): tool name, startup set of **Parts** (largest first), total, MCP servers, hooks, and for Codex the instruction bytes and cap.
- **Part** (value): kind, path, tokens, and a note (for example "capped at 1,536 characters").
- **Counter** (service): text → tokens. Two implementations behind one function, chosen once per run.

## Invariants

- A file is counted at most once in one tool's total (imports included).
- Folder-scoped files never enter a total (BR-0002).
- Only names and descriptions of skills and agents are counted (BR-0003).
- MCP servers and hooks never change a total; they are never started or run (BR-0004).
- The exit code follows from the Audit alone: 1 when any total exceeds the budget or Codex drops bytes (BR-0005), else 0.

Open Questions: None.
