# BR-0005: The audit fails when Codex would drop instruction text

**Status:** Confirmed
**Context:** Context audit
**Source:** RS-0001; the user on 2026-11-23
**Confirmed by:** the user, 2026-11-23
**Updated:** 2026-11-23

## Statement
When Codex is detected and the combined bytes of the instruction files it loads exceed `project_doc_max_bytes` (from `.codex/config.toml`, 32,768 by default), the audit warns how many bytes Codex drops and exits with code 1, even when the token budget is met.

## Examples
| Situation | Expected outcome |
|---|---|
| Combined AGENTS.md files of 40,000 bytes, no override | Warning: 7,232 bytes dropped; exit 1 |
| Combined 30,000 bytes | No warning |

## Exceptions
None recorded.

## Rationale
Finding 12 of RS-0001: Codex stops adding text past the cap without telling the user.

## Where it is enforced
- Spec: `docs/harness/context-audit/SpecifyRequirements.md`
- Code: `templates/tools/context-audit.mjs`

## Gate entries
The "Agent startup context" row in `docs/knowledge/README.md`.
