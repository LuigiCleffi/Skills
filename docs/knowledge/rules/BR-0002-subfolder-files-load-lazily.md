# BR-0002: Instruction files in subfolders are reported apart from the startup total

**Status:** Confirmed
**Context:** Context audit
**Source:** RS-0001; the user on 2026-11-23
**Confirmed by:** the user, 2026-11-23
**Updated:** 2026-11-23

## Statement
AGENTS.md, CLAUDE.md, and CLAUDE.local.md below the project root are listed with their tokens as "loaded when the agent works in that folder" and are not added to any tool's startup total or budget.

## Examples
| Situation | Expected outcome |
|---|---|
| `packages/web/AGENTS.md` of 3,000 tokens | Listed under folder-scoped files; startup total unchanged |

## Exceptions
None recorded.

## Rationale
Findings 2 and 16 of RS-0001.

## Where it is enforced
- Spec: `docs/harness/context-audit/SpecifyRequirements.md`
- Code: `templates/tools/context-audit.mjs`

## Gate entries
The "Agent startup context" row in `docs/knowledge/README.md`.
