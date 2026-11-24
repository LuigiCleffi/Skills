# BR-0004: MCP servers and context hooks are named, not measured

**Status:** Confirmed
**Context:** Context audit
**Source:** RS-0001; the user on 2026-11-23
**Confirmed by:** the user, 2026-11-23
**Updated:** 2026-11-23

## Statement
The audit lists each configured MCP server per tool and each Claude Code hook on SessionStart or UserPromptSubmit, with a note that their cost is not in the total. It never starts a server or runs a hook. For Claude Code, a server with `alwaysLoad: true`, or `ENABLE_TOOL_SEARCH` set to `false` in the project's settings, is flagged as loading its tool definitions upfront.

## Examples
| Situation | Expected outcome |
|---|---|
| `.mcp.json` with two servers | Both named under Claude Code; total unchanged |
| A SessionStart hook in `.claude/settings.json` | Named with its command; total unchanged |

## Exceptions
None recorded.

## Rationale
Findings 9, 10, 15, 19 of RS-0001: definitions are deferred or undocumented, and hook output needs running the hook.

## Where it is enforced
- Spec: `docs/harness/context-audit/SpecifyRequirements.md`
- Code: `templates/tools/context-audit.mjs`

## Gate entries
The "Agent startup context" row in `docs/knowledge/README.md`.
