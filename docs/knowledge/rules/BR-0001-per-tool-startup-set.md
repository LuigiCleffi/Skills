# BR-0001: The audit reports the startup context of each detected agent tool separately

**Status:** Confirmed
**Context:** Context audit
**Source:** RS-0001; the user on 2026-11-23
**Confirmed by:** the user, 2026-11-23
**Updated:** 2026-11-23

## Statement
For each tool detected in the project, the audit counts the files that tool loads at session start, in that tool's own way: Claude Code loads CLAUDE.md, `.claude/CLAUDE.md`, and CLAUDE.local.md from the working directory and every parent, their `@imports` up to four hops (skipping imports in code spans and fenced blocks), and `.claude/rules/*.md` without a `paths` field; it loads AGENTS.md only when none of those CLAUDE files exists. Codex loads, per directory from the project root down, AGENTS.override.md or else AGENTS.md. OpenCode loads AGENTS.md per directory, or CLAUDE.md where no AGENTS.md exists, plus files listed in `instructions`. A tool is detected by its folder (`.claude/`, `.codex/`, `.opencode/`) or config (`.mcp.json`, `opencode.json(c)`), or by an instruction file only it reads.

## Examples
| Situation | Expected outcome |
|---|---|
| Project with CLAUDE.md and AGENTS.md, `.claude/` present | Claude Code total counts CLAUDE.md, not AGENTS.md |
| Project with only AGENTS.md and `.claude/` | Claude Code total counts AGENTS.md |
| CLAUDE.md imports `@docs/a.md`, which imports `@docs/b.md` | Both imported files count |
| `.claude/rules/api.md` has `paths: src/api/**` | Listed as loaded on demand, not in the total |

## Exceptions
None recorded.

## Rationale
Findings 1, 3, 4, 5, 11, 16 of RS-0001: no tool loads both CLAUDE.md and AGENTS.md by default, so one combined total would over-count.

## Where it is enforced
- Spec: `docs/harness/context-audit/SpecifyRequirements.md`
- Code: `templates/tools/context-audit.mjs`

## Gate entries
The "Agent startup context" row in `docs/knowledge/README.md`.
