# QA report: Context audit

**Run:** [2026-11-23-context-audit](../runs/2026-11-23-context-audit.md)
**Spec:** [SpecifyRequirements.md](SpecifyRequirements.md)
**Date:** 2026-11-23
**How:** `npm test` (176 tests after the code-review fixes, 56 for this feature in `tests/context-audit.test.mjs`, each building a fixture project and running the installed tool as a user would), `npm run check:frontmatter`, and the tool run on this repository with the kit installed.

## Change against the tasks

| Task | Done | Evidence |
|---|---|---|
| TASK-01 scenarios as tests | yes | `tests/context-audit.test.mjs`, 26 tests, red before TASK-02 (24 failed, 1 skipped without the tokenizer) |
| TASK-02 tool and config | yes | `templates/tools/context-audit.mjs`, `templates/tools/context-audit.json`; 26/26 pass |
| TASK-03 install group | yes | `bin/cli.ts` group `context-audit`, required by `harness`; `tests/cli.test.mjs` checks `list` and the installed files; 146/146 pass |
| TASK-04 docs | yes | README section 34 and the Brief paragraph; harness *Context budget*; frontmatter check: 368 valid |

Nothing outside the tasks changed except `package.json` and `package-lock.json` (`js-tiktoken` as a dev dependency, so the tokenizer path is tested) and `.gitignore` (the locally installed kit).

## Scenarios

| ID | Scenario | Source | How | Result | Evidence |
|---|---|---|---|---|---|
| QA-01 | `list` shows `context-audit`; harness install writes both files | FR-001 | `tests/cli.test.mjs` | PASS | both `list` matches and both `existsSync` checks pass |
| QA-02 | Runs from the root with no arguments, reads only project files, runs no hook | FR-002 | test "names MCP servers and context hooks…" | PASS | `touch ran.txt` hook did not create `ran.txt` |
| QA-03 | Detection per tool; bare AGENTS.md → Codex and OpenCode; empty → "No agent tool found", exit 0 | FR-003 | tests "counts each tool's own…", "reports Codex and OpenCode for a bare AGENTS.md…" | PASS | tools `["codex","opencode"]`; empty project exit 0 with the message |
| QA-04 | Claude Code set: CLAUDE files, AGENTS.md fallback, imports to four hops once each, code and emails skipped, rules with and without `paths` | FR-004 | five import, rules, and fallback tests | PASS | counted `CLAUDE.md, docs/a.md…docs/d.md`; `docs/e.md` warned; `api.md` on demand |
| QA-05 | HTML block comments stripped | FR-005 | test "strips block-level HTML comments…" | PASS | 2,800-character comment counted under 10 tokens |
| QA-06 | Descriptions only; Claude cap 1,536 with note; missing description warned | FR-006 | tests "names the largest file first…", "caps Claude Code descriptions…" | PASS | skill with 5,000-word body under 20 tokens; note "description capped at 1,536 characters" |
| QA-07 | Folder-scoped files outside totals; `node_modules` and `templates` skipped | FR-007 | test "lists folder-scoped files…" | PASS | only `packages/web/AGENTS.md` (3,000 tokens) listed; Codex total holds `AGENTS.md` only |
| QA-08 | MCP servers and hooks named, upfront flag from `alwaysLoad` and `ENABLE_TOOL_SEARCH`; Codex and OpenCode servers read | FR-008 | four MCP and hook tests | PASS | `[{docs,false},{db,true}]`; tool search off → `upfront: true`; Codex `docs`; OpenCode `search` and legacy `legacy` |
| QA-09 | `o200k_base` when installed; estimate with install command otherwise | FR-009, SC-003 | tests "estimates without js-tiktoken…", "counts with o200k_base…" | PASS | "hello world" = 2 tokens; text shows `npm install --save-dev js-tiktoken` and "estimate: characters ÷ 4" |
| QA-10 | Text report: total of budget, parts largest first, sections, plain text | FR-010 | test "prints the same totals as text and as JSON…" and the run on this repository | PASS | "Claude Code: 2,030 of 10,000 tokens", AGENTS.md first, brief hook named |
| QA-11 | `--json` parses and matches the text totals | FR-011, SC-004 | same test | PASS | JSON total appears as "N of 10,000 tokens" in the text |
| QA-12 | Budget from config, `--budget` override, library default | FR-012 | tests "exits 0 within budget…", "uses the default budget…" | PASS | 400 chars: exit 0 at 10,000, exit 1 at 50 (flag and config); library budget 10,000 |
| QA-13 | Codex cap: 40,000 bytes → 7,232 dropped, exit 1 within budget; config cap read; bad value warned | FR-013 | tests "fails when Codex would drop…", "reads the Codex cap…" | PASS | `{bytes:40000, cap:32768, dropped:7232}`, exit 1; cap 65,536 → exit 0; `"big"` → 32,768 and warning |
| QA-14 | Exit 2 on bad budget, unknown option, malformed own config; third-party config malformed → warning, exit 0 | FR-014 | tests "exits 2 on a bad budget…", "warns about a malformed third-party config…" | PASS | `0, -3, ten, 1.5`, `--frobnicate`, `{ not json` all exit 2 with the reason on stderr; broken `.mcp.json` exit 0 with warning |
| QA-15 | README and harness *Context budget* name the command | FR-015 | `grep context-audit README.md templates/actions/harness.md` | PASS | README: 3 mentions (section 34, Brief paragraph); harness.md: 1 |
| QA-16 | This repository with the kit installed: listed parts, under two seconds | SC-002 | `node tools/context-audit.mjs` | PASS | `o200k_base`, Claude Code 2,030 tokens (AGENTS.md), brief hook named, 0.2 s, exit 0 |
| QA-17 | 40,000-character CLAUDE.md is named first and fails the default budget | SC-001 | test "names the largest file first and fails over the default budget" | PASS | parts start with `CLAUDE.md` at 10,000 tokens; exit 1 |
| QA-18 | Every acceptance scenario and edge case has a passing automated test | SC-005 | `npm test` | PASS | 176 of 176 pass; the 10 scenarios in `context-audit.feature` and every edge case in the spec, including those the code review added, have a test |

**Verdict:** PASS
