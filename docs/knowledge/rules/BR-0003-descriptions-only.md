# BR-0003: Skills and agents count only their name and description at startup

**Status:** Confirmed
**Context:** Context audit
**Source:** RS-0001; the user on 2026-11-23
**Confirmed by:** the user, 2026-11-23
**Updated:** 2026-11-23

## Statement
For each skill (`.claude/skills/*/SKILL.md`; `.agents/skills/*/SKILL.md` for Codex; `.opencode/skills`, `.claude/skills`, `.agents/skills` for OpenCode) and agent (`.claude/agents/*.md`, `.codex/agents/*.toml`, `.opencode/agents/*.md`), the audit counts the name and description, not the body. For Claude Code, a description longer than 1,536 characters counts as 1,536.

## Examples
| Situation | Expected outcome |
|---|---|
| A skill with a 200-character description and a 5,000-word body | About 50 tokens counted |
| A Claude Code skill with a 3,000-character description | 1,536 characters counted, and the skill named as truncated |

## Exceptions
None recorded.

## Rationale
Findings 7, 8, 13, 14, 17, 18 of RS-0001.

## Where it is enforced
- Spec: `docs/harness/context-audit/SpecifyRequirements.md`
- Code: `templates/tools/context-audit.mjs`

## Gate entries
The "Agent startup context" row in `docs/knowledge/README.md`.
