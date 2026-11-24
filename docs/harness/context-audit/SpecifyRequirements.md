# Feature Specification: Context audit

**Feature Branch**: `feat/context-audit`

**Created**: 2026-11-23

**Status**: Ready for Implementation

**Input**: User description: "use the skills code kit to improve this project with everything you learned from the video", narrowed in the [plan](plan.md) to a startup context audit tool.

## 1. Problem Statement

Every agent session pays, before the first prompt, for the instruction files, skill and agent descriptions, and hook output its tool loads, and the cost repeats in every session and sub-agent. Today a developer can see this only inside a running Claude Code session (`/context`); nothing measures it for Codex or OpenCode, nothing names what to cut across tools, and no project can hold itself to a budget in CI. Codex also drops instruction text past 32 KiB without telling anyone ([RS-0001](../../knowledge/research/RS-0001-agent-startup-context.md), finding 12). The kit adds to this load itself, so it should let its users measure it.

## 2. Goals and Scope

### Goals

- One command reports, per agent tool used in the project, how many tokens a new session loads from the project before the first prompt, largest parts first.
- A project can set a budget and have CI fail when a tool's startup context exceeds it, or when Codex would drop instruction text.

### In Scope

- A `context-audit` install group that installs `tools/context-audit.mjs` and `tools/context-audit.json`; the `harness` group requires it.
- Claude Code, Codex CLI, and OpenCode, per [BR-0001](../../knowledge/rules/BR-0001-per-tool-startup-set.md).
- Instruction files (with Claude Code imports and rules), skill and agent descriptions, MCP servers and context hooks named, folder-scoped files listed apart.
- Token counts with `js-tiktoken` (`o200k_base`) when installed in the project, otherwise characters divided by four, labeled.
- Text and JSON output; exit codes for CI.
- A pointer from the harness *Context budget* section and the README.

### Out of Scope

- Measuring MCP tool schemas, hook output, or each tool's own system prompt and built-in tools ([BR-0004](../../knowledge/rules/BR-0004-name-mcp-and-hooks.md)).
- User-level and system-level files (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, global skills and servers).
- A session-start hook that runs the audit.
- Fetching remote `instructions` URLs in OpenCode configs.
- Changing what the kit installs to make it smaller (a next feature once the audit can measure it).

## 3. User Scenarios & Testing

### User Story 1 — See what a session loads (Priority: P1)

**Story:** As a developer whose sessions start expensive, I want one report of what each agent tool loads from my project, largest first, so that I know what to cut.

**Why this priority:** Without it nothing else in this feature is useful.

**Independent Test:** Run the tool in a fixture project with known files and compare the listed parts and totals.

**Acceptance Scenarios:**

1. **Given** a project with `.claude/`, a 40,000-character CLAUDE.md, and two skills, **When** the developer runs `node tools/context-audit.mjs`, **Then** the Claude Code section lists CLAUDE.md first, then the two skill descriptions, with tokens for each and a total.
2. **Given** a project with both CLAUDE.md and AGENTS.md and the `.claude/`, `.codex/` folders, **When** the developer runs the audit, **Then** the Claude Code total counts CLAUDE.md and not AGENTS.md, and the Codex total counts AGENTS.md and not CLAUDE.md.
3. **Given** `packages/web/AGENTS.md`, **When** the developer runs the audit, **Then** it is listed under folder-scoped files and no tool's total includes it.

### User Story 2 — Hold a budget in CI (Priority: P2)

**Story:** As a team, I want the audit to fail over a budget I set, so that the startup context cannot grow unnoticed.

**Why this priority:** Turns a one-off look into a standing check.

**Independent Test:** Run the tool with budgets just above and below a fixture's total and check the exit code.

**Acceptance Scenarios:**

1. **Given** the default budget of 10,000 tokens and a Claude Code total of 12,000, **When** the audit runs, **Then** it reports Claude Code 2,000 tokens over budget and exits 1.
2. **Given** combined AGENTS.md files of 40,000 bytes and Codex detected, **When** the audit runs, **Then** it warns that Codex drops 7,232 bytes and exits 1, even with every total within budget.
3. **Given** every total within budget and no Codex drop, **When** the audit runs, **Then** it exits 0.

### User Story 3 — Count without the tokenizer installed (Priority: P3)

**Story:** As a developer who has not installed `js-tiktoken`, I want the audit to still run, so that I am not blocked on a dependency.

**Why this priority:** The kit's installed tools have had no dependencies; this keeps first use working.

**Independent Test:** Run in a fixture without `node_modules/js-tiktoken`.

**Acceptance Scenarios:**

1. **Given** no `js-tiktoken` in the project, **When** the audit runs, **Then** it prints `npm install --save-dev js-tiktoken`, marks every count with "≈" (explained as "estimate: characters ÷ 4"), and still applies the budget.
2. **Given** `js-tiktoken` installed, **When** the audit runs, **Then** the report says counts use `o200k_base` and are approximate for Claude models.

## 4. Functional Requirements

- **FR-001:** The installer MUST offer a `context-audit` group that installs `tools/context-audit.mjs` and `tools/context-audit.json`, and the `harness` group MUST require it.
- **FR-002:** The tool MUST run with Node.js 20 or newer from the project root with no arguments, reading only files inside the project.
- **FR-003:** The tool MUST detect Claude Code by `.claude/`, `CLAUDE.md`, `CLAUDE.local.md`, or `.mcp.json`; Codex by `.codex/` or `.agents/skills/`; OpenCode by `.opencode/`, `opencode.json`, or `opencode.jsonc`. When no tool is detected, it MUST report Codex and OpenCode if AGENTS.md exists, and say no tool was found otherwise.
- **FR-004:** For each detected tool, the tool MUST count that tool's root startup set as [BR-0001](../../knowledge/rules/BR-0001-per-tool-startup-set.md) defines it, including Claude Code `@imports` up to four hops and `.claude/rules/*.md` without a `paths` field; rules with `paths` MUST be listed as loaded on demand.
- **FR-005:** For Claude Code, the tool MUST strip block-level HTML comments before counting a CLAUDE file ([RS-0001](../../knowledge/research/RS-0001-agent-startup-context.md), finding 6).
- **FR-006:** For each tool, the tool MUST count the name and description of its skills and agents per [BR-0003](../../knowledge/rules/BR-0003-descriptions-only.md), capping Claude Code descriptions at 1,536 characters and naming each capped skill.
- **FR-007:** The tool MUST list instruction files below the project root as folder-scoped, with their tokens, outside every total ([BR-0002](../../knowledge/rules/BR-0002-subfolder-files-load-lazily.md)).
- **FR-008:** The tool MUST name each configured MCP server per tool and each Claude Code SessionStart or UserPromptSubmit hook command in `.claude/settings.json` and `.claude/settings.local.json`, with a note that their cost is not in the total, and MUST flag Claude Code servers that load definitions upfront ([BR-0004](../../knowledge/rules/BR-0004-name-mcp-and-hooks.md)). It MUST NOT start a server or run a hook.
- **FR-009:** The tool MUST count tokens with `js-tiktoken/lite` and the `o200k_base` ranks when the project can import them, and otherwise with characters divided by four, rounded up; the report MUST name the method used.
- **FR-010:** The text report MUST show, per tool: the total and budget, then each part largest first with its path and tokens; then folder-scoped files, MCP servers, hooks, and warnings.
- **FR-011:** With `--json`, the tool MUST print one JSON object with the same tools, parts, totals, budget, method, and warnings, and nothing else on stdout.
- **FR-012:** The budget MUST come from `"budget"` in `tools/context-audit.json` (10,000 when absent), and may be overridden for one run with `--budget <n>`.
- **FR-013:** When Codex is detected, the tool MUST compare the combined bytes of Codex's startup instruction files with `project_doc_max_bytes` from `.codex/config.toml` (32,768 when absent) and warn with the bytes dropped when over ([BR-0005](../../knowledge/rules/BR-0005-codex-instruction-cap.md)).
- **FR-014:** The tool MUST exit 1 when any tool's total exceeds the budget or Codex would drop text, 0 otherwise, and 2 on a usage or configuration error, with the reason on stderr.
- **FR-015:** The harness *Context budget* section and the README MUST name the command and what it measures.

## 5. Domain Rules and Invariants

- [BR-0001](../../knowledge/rules/BR-0001-per-tool-startup-set.md): each tool's startup set is counted its own way.
- [BR-0002](../../knowledge/rules/BR-0002-subfolder-files-load-lazily.md): folder-scoped files never enter a total.
- [BR-0003](../../knowledge/rules/BR-0003-descriptions-only.md): only names and descriptions of skills and agents count.
- [BR-0004](../../knowledge/rules/BR-0004-name-mcp-and-hooks.md): servers and hooks are named, never run.
- [BR-0005](../../knowledge/rules/BR-0005-codex-instruction-cap.md): the Codex cap fails the audit on its own.
- A file is counted at most once within one tool's total, even when imported twice or by two files.

## 6. Edge Cases and Failure Scenarios

- **Import cycle** (`a.md` imports `b.md`, which imports `a.md`): each file counted once; no loop.
- **Import past four hops:** not counted; listed as a warning with the chain.
- **Import of a missing file or one outside the project:** not counted; listed as a warning.
- **`@` inside a code span or fenced block, or an email address:** not treated as an import.
- **Skill file without frontmatter or description:** counted as zero, named in a warning, since tools do not advertise it.
- **Malformed `.mcp.json`, `opencode.json(c)`, `.claude/settings.json`, or `tools/context-audit.json`:** a warning naming the file for the first three, with the tool's other sections still reported; exit 2 for the audit's own config.
- **`.codex/config.toml` with `project_doc_max_bytes` that is not a positive integer:** warning, and 32,768 used.
- **Budget flag not a positive integer:** exit 2.
- **Unreadable or binary instruction file:** warning naming it; not counted.
- **`node_modules` and `.git` at any depth, dot folders at the root (the tools' own configuration, counted in the startup sets), and `templates/` at the root when it is the kit's own (`templates/actions/harness.md` exists):** never searched for folder-scoped files. Below the root, `templates/` and dot folders are searched.
- **Unreadable folder:** a warning naming it; the rest is still reported.
- **Unexpected error:** the reason on stderr and exit 2, never 1.
- **No instruction files at all:** a report with zero totals; exit 0.

## 7. Key Entities

- **Tool**: an agent tool detected in the project (Claude Code, Codex, OpenCode), with its startup set, total, MCP servers, and hooks.
- **Part**: one counted item of a startup set: an instruction file, an import, a rules file, or a skill or agent description, with its path and tokens.
- **Folder-scoped file**: an instruction file loaded only when the agent works in its folder.
- **Budget**: the most tokens a tool's startup set may hold.
- **Warning**: a problem the developer should act on (over budget, Codex drop, broken import, unreadable file, capped description).

## 8. Success Criteria

### Measurable Outcomes

- **SC-001:** In a fixture with a 40,000-character CLAUDE.md, the report names that file first and the audit exits 1 under the default budget.
- **SC-002:** In this repository with the kit installed, the report lists AGENTS.md (or CLAUDE.md), any skill and agent descriptions in the tools' folders, and the harness brief hook, and the run finishes in under two seconds. (Corrected during dev: the kit installs its workflows as plain files routed through AGENTS.md, not into `.claude/skills/`, so a kit install alone adds no descriptions.)
- **SC-003:** Without `js-tiktoken`, the audit prints the install command and labeled estimates, and applies the budget.
- **SC-004:** `--json` output parses, and its totals equal the text report's for the same project.
- **SC-005:** Every acceptance scenario and edge case above has an automated test that passes.

## 9. Assumptions and Dependencies

### Assumptions

- The project root is the working directory the tool runs in; Codex's "project root down to the working directory" is then the root alone.
- One budget applies to every tool's total.
- Claude Code reads `ENABLE_TOOL_SEARCH` from the project's `.claude/settings.json` `env`; the shell environment is not read.
- The text report uses plain lines, no colors, so it reads the same in CI logs.

### Dependencies

- `js-tiktoken` 1.0.x, optional, installed by the user in the project.
- The installer's group mechanism in `bin/cli.ts`, as used by `cycle-metrics`.

### Open Questions

Open Questions: None.

## 10. Traceability and Verification

| Requirement | Verified by |
|---|---|
| FR-001 | US1 install test (installer test: group installs both files; harness requires it) |
| FR-003, FR-004, FR-005 | US1 scenarios 1 and 2; edge cases on imports |
| FR-006 | US1 scenario 1; capped-description test |
| FR-007 | US1 scenario 3 |
| FR-008 | MCP and hook listing test |
| FR-009 | US3 scenarios 1 and 2 |
| FR-010, FR-011 | SC-004 |
| FR-012, FR-014 | US2 scenarios 1 and 3; budget flag edge case |
| FR-013 | US2 scenario 2; config edge case |
| FR-015 | review of the docs diff |
