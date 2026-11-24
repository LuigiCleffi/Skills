# Knowledge Base — Gate

Read this file before specifying, modeling, implementing, or reviewing
behavior. Find every row whose "About" or "Paths" matches the task, then
read only those files. Confirmed rules are binding; a change to one goes
to the user.

Glossary: [glossary.md](glossary.md)

## Routing

| About… | Keywords | Paths | Read |
|---|---|---|---|
| Agent startup context: what a session loads before the first prompt, and its token budget | context, tokens, startup, CLAUDE.md, AGENTS.md, skills, MCP, hooks | `templates/tools/context-audit.*` | [BR-0001](rules/BR-0001-per-tool-startup-set.md), [BR-0002](rules/BR-0002-subfolder-files-load-lazily.md), [BR-0003](rules/BR-0003-descriptions-only.md), [BR-0004](rules/BR-0004-name-mcp-and-hooks.md), [BR-0005](rules/BR-0005-codex-instruction-cap.md), [RS-0001](research/RS-0001-agent-startup-context.md) |

## Register

| ID | Title | Kind | Status | Updated |
|---|---|---|---|---|
| [BR-0001](rules/BR-0001-per-tool-startup-set.md) | The audit reports the startup context of each detected agent tool separately | Rule | Confirmed | 2026-11-23 |
| [BR-0002](rules/BR-0002-subfolder-files-load-lazily.md) | Instruction files in subfolders are reported apart from the startup total | Rule | Confirmed | 2026-11-23 |
| [BR-0003](rules/BR-0003-descriptions-only.md) | Skills and agents count only their name and description at startup | Rule | Confirmed | 2026-11-23 |
| [BR-0004](rules/BR-0004-name-mcp-and-hooks.md) | MCP servers and context hooks are named, not measured | Rule | Confirmed | 2026-11-23 |
| [BR-0005](rules/BR-0005-codex-instruction-cap.md) | The audit fails when Codex would drop instruction text | Rule | Confirmed | 2026-11-23 |
| [RS-0001](research/RS-0001-agent-startup-context.md) | What coding agents load before the first prompt | Research | Current | 2026-11-23 |
