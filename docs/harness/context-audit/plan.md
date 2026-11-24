# Plan: Context audit

## Problem

Every agent session pays for what loads before the first prompt: instruction files, skill and agent descriptions, MCP tool schemas, and hooks that add context. A large CLAUDE.md or many MCP servers can spend tens of thousands of tokens per session without anyone noticing, and the cost repeats in every session and sub-agent. Claude Code shows this with `/context`, but only inside a running session, only for Claude Code, and with no budget a team can hold a project to. The kit itself adds to this load (AGENTS.md, skills, the harness brief hook), so it should help its users measure it.

## Goal

Anyone can run one command in a project and learn how many tokens a new agent session loads before the first prompt, which parts cost the most, and whether the total is within a budget the project sets.

## Users

- A developer whose sessions start expensive and who wants to know what to cut.
- A team that wants CI to fail when the startup context grows past its budget.

## Capabilities (MVP)

1. **Command.** `node tools/context-audit.mjs` in the project root, installed by a new `context-audit` install group. The harness group also installs it.
2. **What it counts.**
   - Instruction files: `AGENTS.md`, `CLAUDE.md`, and `CLAUDE.local.md` at the root, and the same files in subfolders, reported separately as "loaded when the agent works in that folder".
   - Skill and agent descriptions: the `name` and `description` frontmatter of every skill and agent file under `.claude/`, `.opencode/`, and `.codex/`, which tools list in every session.
   - MCP servers: servers configured in `.mcp.json`, `opencode.json` or `opencode.jsonc`, and `.codex/config.toml`, counted and named. Their tool schemas are not measured, since that needs starting each server; the report says so.
   - Hooks: Claude Code hooks in `.claude/settings.json` on `SessionStart` and `UserPromptSubmit`, which add context, counted and named.
3. **Token counts.** With an offline tokenizer (`js-tiktoken`, encoding `o200k_base`). The report names the encoding and says counts are approximate for Claude models. When `js-tiktoken` is not installed in the project, the tool prints the install command (`npm install --save-dev js-tiktoken`) and falls back to characters divided by four, labeled as an estimate.
4. **Report.** The total for the root session, then each part, largest first, with its path and tokens, then the folder-scoped instruction files, the MCP servers, and the hooks. A `--json` option prints the same as JSON.
5. **Budget.** `tools/context-audit.json` sets the budget, 10,000 tokens by default. Over the budget the tool says by how much and exits with code 1, so CI can use it; within it, exit code 0.
6. **Docs.** The harness *Context budget* section and the README point to the command.

## Out of scope

- Measuring MCP tool schemas or Claude Code's own system prompt and tools.
- A session-start hook that runs the audit.
- User-level files outside the project (`~/.claude/CLAUDE.md`, global MCP servers).
- Changing what the kit itself installs to make it smaller.

## Decisions

- Own install group `context-audit`, also pulled in by `harness` (user, 2026-11-23).
- Scope: instruction files, skill and agent descriptions, MCP servers, hooks (user, 2026-11-23).
- Real tokenizer, offline and bundled: `js-tiktoken` with `o200k_base` (user, 2026-11-23).
- Budget 10,000 tokens, configurable, checked on demand only (user, 2026-11-23).

## Accepted assumptions

- **Tokenizer install.** The installed tool imports `js-tiktoken` from the project's own dependencies; the kit does not vendor the encoding files (about 2 MB) into every install. Without it, the tool still runs on the labeled estimate. This makes the tool the first installed file with an optional dependency.
- **Approximation.** `o200k_base` is an OpenAI encoding; counts for Claude differ, typically within a few tens of percent. The report says so. The tool is for finding what is big and holding a budget, not for billing.

## Risks

- **Counts read as exact.** Handled by naming the encoding and the approximation in every report.
- **Nested files over-counted.** Handled by reporting folder-scoped files apart from the root total.

## Success criteria

- In a project with a 40,000-character CLAUDE.md, the report names that file first and the tool exits 1 under the default budget.
- In this repository with the kit installed, the report lists AGENTS.md, the installed skills' descriptions, and the harness brief hook, and the total is within the default budget.
- Without `js-tiktoken`, the tool prints the install command and a labeled estimate, and still applies the budget.
- `--json` output parses and holds the same totals as the text report.

## Open Questions

Open Questions: None. The user approved the plan and both assumptions on 2026-11-23.
