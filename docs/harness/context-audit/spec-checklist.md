# Spec checklist: Context audit

Source: [SpecifyRequirements.md](SpecifyRequirements.md) (Ready for Implementation, approved 2026-11-23), rules BR-0001 to BR-0005.

| ID | Requirement and acceptance condition | Source | Status |
|---|---|---|---|
| REQ-01 | `context-audit` group installs `tools/context-audit.mjs` and `tools/context-audit.json`; `harness` requires it, so `list` shows it among harness's groups | FR-001 | Ready |
| REQ-02 | Runs from the project root with Node 20+ and no arguments; reads only files inside the project; never starts servers or runs hooks | FR-002, FR-008 | Ready |
| REQ-03 | Detection: Claude Code by `.claude/`, CLAUDE.md, CLAUDE.local.md, `.mcp.json`; Codex by `.codex/`, `.agents/skills/`; OpenCode by `.opencode/`, `opencode.json(c)`; none detected + AGENTS.md → Codex and OpenCode; nothing → "no agent tool found" | FR-003 | Ready |
| REQ-04 | Claude Code set: CLAUDE.md, `.claude/CLAUDE.md`, CLAUDE.local.md at the root; AGENTS.md only when none of the three exists; `@imports` up to 4 hops, once each, skipping code spans, fences, and emails; `.claude/rules/*.md` without `paths`; rules with `paths` listed on demand; HTML block comments stripped | FR-004, FR-005, BR-0001 | Ready |
| REQ-05 | Codex set: AGENTS.override.md else AGENTS.md at the root; bytes compared with `project_doc_max_bytes` (32,768 default, invalid → warning + default); over → warning with bytes dropped, exit 1 | FR-004, FR-013, BR-0005 | Ready |
| REQ-06 | OpenCode set: AGENTS.md else CLAUDE.md at the root, plus local files and globs in `instructions` (URLs listed, not fetched) | FR-004, BR-0001 | Ready |
| REQ-07 | Descriptions: name + description of skills and agents from each tool's folders; Claude Code capped at 1,536 characters and named; missing description → zero and a warning | FR-006, BR-0003 | Ready |
| REQ-08 | Folder-scoped files below the root listed with tokens, outside totals; `node_modules`, `.git`, `templates/` never searched | FR-007, BR-0002 | Ready |
| REQ-09 | MCP servers named per tool (`.mcp.json` mcpServers; `.codex/config.toml` mcp_servers; `opencode.json(c)` mcp.servers or legacy mcp); Claude Code `alwaysLoad` or `ENABLE_TOOL_SEARCH=false` in `.claude/settings.json` env flagged upfront; SessionStart and UserPromptSubmit hook commands named | FR-008, BR-0004 | Ready |
| REQ-10 | Tokens via `js-tiktoken/lite` + `o200k_base` when importable from the project, else ceil(chars ÷ 4); method named; fallback prints `npm install --save-dev js-tiktoken` | FR-009 | Ready |
| REQ-11 | Text report per tool: total vs budget, parts largest first; then folder-scoped, MCP, hooks, warnings; plain text | FR-010 | Ready |
| REQ-12 | `--json` prints one object, nothing else on stdout, totals equal to the text report | FR-011 | Ready |
| REQ-13 | Budget from `tools/context-audit.json` `budget` (10,000 default); `--budget <n>` overrides; non-positive or non-integer → exit 2 | FR-012, FR-014 | Ready |
| REQ-14 | Exit 1 over budget or Codex drop; 0 otherwise; 2 on usage or own-config error, reason on stderr; malformed third-party config → warning, other sections still reported | FR-014, edge cases | Ready |
| REQ-15 | Harness *Context budget* and README name the command | FR-015 | Ready |

**Ready for implementation:** all items.
**Blocked:** none.
**Assumptions:** the four in the spec, approved by the user on 2026-11-23.
**Out of scope:** as listed in the spec, section 2.
