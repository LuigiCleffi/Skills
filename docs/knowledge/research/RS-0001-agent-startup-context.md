# RS-0001: What coding agents load before the first prompt

**Status:** Current
**Questions:** Which instruction files, skill and agent descriptions, MCP definitions, and hook outputs do Claude Code, Codex CLI, and OpenCode put in context when a session starts, and which load later? What limits apply? What does `js-tiktoken` need to count tokens offline?
**Scope:** Claude Code, OpenAI Codex CLI, OpenCode, project-level files only (user and system files noted where they change the project's behavior); `js-tiktoken` 1.0.21.
**Researched:** 2026-11-23

## Findings

### Claude Code

1. CLAUDE.md and CLAUDE.local.md in the working directory and every directory above it load at launch, concatenated from the root down; CLAUDE.local.md follows CLAUDE.md in each directory. `./.claude/CLAUDE.md` is an equivalent project location. — Tier 1, [Memory](https://code.claude.com/docs/en/memory), "How CLAUDE.md files load" and "Choose where to put CLAUDE.md files", read 2026-11-23.
2. CLAUDE.md files in subdirectories below the working directory do not load at launch; they load when Claude reads, writes, or edits a file in that subdirectory. — Tier 1, same page, "How CLAUDE.md files load", read 2026-11-23.
3. `@path` imports in a CLAUDE.md are expanded and loaded with it, up to four hops; imports inside code spans or fenced blocks are skipped. — Tier 1, same page, "Import additional files", read 2026-11-23.
4. Files in `.claude/rules/*.md` load at launch unless they have a `paths` frontmatter field, which makes them load only for matching files. — Tier 1, same page, "Set up rules" and "Path-specific rules", read 2026-11-23.
5. Claude Code reads AGENTS.md natively only when no CLAUDE.md, `.claude/CLAUDE.md`, or CLAUDE.local.md exists in the working directory or above it (v2.1.277 or later). — Tier 1, same page, "AGENTS.md" and "When Claude Code reads AGENTS.md", read 2026-11-23.
6. Block-level HTML comments are stripped from CLAUDE.md before it is injected. — Tier 1, same page, "How CLAUDE.md files load", read 2026-11-23.
7. Project skills live in `.claude/skills/<name>/SKILL.md`; at session start only their descriptions are in context, and the body loads when the skill is used. The listing truncates description plus `when_to_use` at 1,536 characters. — Tier 1, [Skills](https://code.claude.com/docs/en/skills), introduction, "Choose where skills load", "Frontmatter reference" (summarized by the fetch tool, not read verbatim), read 2026-11-23.
8. Subagent descriptions in `.claude/agents/*.md` take up context, and Claude Code warns at startup when combined descriptions exceed 15,000 tokens. — Tier 1, [Subagents](https://code.claude.com/docs/en/sub-agents), introduction and "Built-in subagents", read 2026-11-23.
9. SessionStart and UserPromptSubmit hooks add context through `hookSpecificOutput.additionalContext` or plain stdout, capped at 10,000 characters. SessionStart context arrives before the first prompt. — Tier 1, [Hooks](https://code.claude.com/docs/en/hooks), "Add context for Claude", "Exit code 0", "JSON output" (summarized by the fetch tool), read 2026-11-23.
10. Project MCP servers are configured in `.mcp.json` under `mcpServers`. By default (tool search on) only tool names and server instructions load at session start; full definitions load on demand. `ENABLE_TOOL_SEARCH=false` or a server's `alwaysLoad: true` loads definitions upfront. — Tier 1, [MCP](https://code.claude.com/docs/en/mcp), "Project scope", "Scale with MCP tool search", "Configure tool search" (summarized by the fetch tool), read 2026-11-23.

### Codex CLI

11. Codex builds its instructions once at session start: the global `~/.codex` file, then, from the project root down to the working directory, at most one of AGENTS.override.md, AGENTS.md, or a configured fallback name per directory, concatenated root first. — Tier 1, [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), "How Codex discovers guidance", read 2026-11-23.
12. Codex stops adding instruction files once the combined size reaches `project_doc_max_bytes`, 32 KiB by default. — Tier 1, same page, same section, read 2026-11-23.
13. Codex lists skills from `.agents/skills` (working directory up to the repo root) by name, description, and path at startup, within 2% of the context window by default; bodies load when used. — Tier 1, [Build skills](https://learn.chatgpt.com/docs/build-skills), "What Loads at Startup" (summarized by the fetch tool), read 2026-11-23.
14. Custom agents are TOML files in `.codex/agents/` with `name`, `description`, and `developer_instructions`; the description is shown when choosing an agent to spawn. — Tier 1, [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), "Custom agents" (summarized), read 2026-11-23.
15. MCP servers are configured under `[mcp_servers.<id>]` in `config.toml`; a project `.codex/config.toml` loads only for trusted projects. — Tier 1, [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference) (summarized), read 2026-11-23.

### OpenCode

16. OpenCode loads the global AGENTS.md, then every AGENTS.md from the workspace up to the project root, combined; in a directory without AGENTS.md it reads CLAUDE.md instead. Files listed in `instructions` in `opencode.json(c)` load after them. AGENTS.md files below the workspace load when the agent works there. — Tier 1, [Rules](https://opencode.ai/docs/rules), "Discovery", "CLAUDE.md fallback", "Ordering", "Configuration", read 2026-11-23.
17. Skills are found in `.opencode/skills`, `.claude/skills`, and `.agents/skills`; each step lists only ID, name, and description. — Tier 1, [Skills](https://opencode.ai/docs/skills), "Discovery", "Loading", read 2026-11-23.
18. Agents live in `.opencode/agents/<name>.md`; the description is shown to the model choosing which agent to launch. — Tier 1, [Agents](https://opencode.ai/docs/agents), "Locations", "Options > Description", read 2026-11-23.
19. MCP servers are configured in `opencode.json(c)` under `mcp.servers.<name>`, connect automatically, and add their server instructions to the system prompt. — Tier 1, [MCP servers](https://opencode.ai/docs/mcp-servers), "Config", "Server instructions", read 2026-11-23.

### Tokenizer

20. `js-tiktoken` 1.0.21 is pure JavaScript; `js-tiktoken/lite` with `js-tiktoken/ranks/o200k_base` loads one encoding. The full package unpacks to about 22 MB. — Tier 2, npm registry metadata and README (`npm view js-tiktoken`), read 2026-11-23.

## Conflicts and uncertainty

- Findings 7, 9, 10, 13, 14, 15 come from the fetch tool's summary of long pages, not verbatim text. They agree with the verbatim parts but should be rechecked if the spec depends on an exact number.
- Whether OpenCode and Codex send full MCP tool schemas at startup is not documented (finding 19, 15).
- Hook output cannot be measured without running the hook, which may have side effects.
- Older OpenCode configs put servers directly under `mcp` rather than `mcp.servers` (finding 19 says V2 changed this).

## Proposed rules

- BR-0001 (Confirmed 2026-11-23): the root startup set differs per tool (findings 1, 3, 4, 5, 11, 16), so the audit reports each detected tool's set separately.
- BR-0002 (Confirmed 2026-11-23): subfolder instruction files load lazily in all three tools (findings 2, 16), so they are reported apart from the startup total.
- BR-0003 (Confirmed 2026-11-23): only name and description of skills and agents count at startup, from each tool's own folders (findings 7, 8, 13, 14, 17, 18).
- BR-0004 (Confirmed 2026-11-23): MCP servers and hooks are named, not measured: their definitions are deferred or undocumented, and hook output needs running the hook (findings 9, 10, 15, 19).
- BR-0005 (Confirmed 2026-11-23): Codex drops instruction text past 32 KiB, so the audit warns when combined AGENTS.md files exceed `project_doc_max_bytes`, whatever the token budget (finding 12).

## Questions for the user

All three answered by the user on 2026-11-23: per detected tool, count imports and rules, Codex cap as its own warning that fails.


1. Report per tool (Claude Code, Codex, OpenCode), since each loads a different set? Recommendation: yes, for the tools detected in the project.
2. Expand `@imports` and count `.claude/rules/*.md` in the Claude Code total? Recommendation: yes, they load at launch.
3. Warn when Codex would truncate AGENTS.md (32 KiB)? Recommendation: yes, as its own warning.

## Not found

- Exact Claude token counts offline: no official offline tokenizer for current Claude models.
- Whether OpenCode or Codex load MCP tool schemas at startup.
