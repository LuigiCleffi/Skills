# Run: A context audit tool that measures what a session loads before the first prompt

**Mode:** Feature — a new installable tool and install group that users of the kit will run and see.
**Triggers:** cross-module (the tool in `templates/tools/` and its group in the installer, `bin/cli.ts`, change together)
**Opened:** 2026-11-23   **Closed:**
**Status:** Open

The kit is installed into this repository from its own build (groups harness, code-review, clean-code, javascript; gate hook "warn"; no guards, checks, or MCP server) and kept out of git; only this run's records are committed. `harness/config.json` guards this repository's code: `bin/**`, `templates/**/*.mjs`, `templates/**/*.json`, `tests/**`, `scripts/**`.

| Stage | Status | Record | Notes |
|---|---|---|---|
| plan | done | docs/harness/context-audit/plan.md | approved by the user 2026-11-23 |
| research | done | docs/knowledge/research/RS-0001-agent-startup-context.md | 5 rules confirmed by the user (BR-0001 to BR-0005) |
| spec | done | docs/harness/context-audit/SpecifyRequirements.md | approved by the user 2026-11-23 |
| spec-checklist | done | docs/harness/context-audit/spec-checklist.md | all 15 items Ready |
| strategy | skipped: an additive tool in an existing free package; no positioning, pricing, or go-to-market change |  |  |
| ddd | done | docs/harness/context-audit/DomainModel.md | light model: Audit, ToolReport, Part, Counter |
| bdd | done | docs/harness/context-audit/context-audit.feature | 10 scenarios, automated as node:test in tests/context-audit.test.mjs |
| uiux | skipped: no screens; the CLI report format is specified in FR-010 and FR-011 |  |  |
| knowledge-gate | done | docs/knowledge/README.md | routes to BR-0001 to BR-0005 and RS-0001; all Confirmed |
| adr-gate | done | docs/adr/README.md | no records before; ADR-0001 recorded (optional dependency), Accepted from the user's decision |
| tasks | done | docs/harness/tasks/2026-11-23-context-audit.md | 4 tasks |
| dev | done | docs/harness/tasks/2026-11-23-context-audit.md | 4/4 tasks done; 145 tests pass |
| review | done |  | self-review: 3 findings fixed (library default budget, glob walking node_modules, mentions read as imports), each with a test |
| qa | done | docs/harness/context-audit/qa-report.md | 18 scenarios PASS |
| code-review | done | docs/harness/context-audit/code-review.md | 10 findings (2 overlap), all citations verified; fixes pending |

## Approvals

- 2026-11-23 — "use the skills code kit to improve this project with everything you learned from the video".
- 2026-11-23 — Install: "Install, keep it local". Feature: "Startup context audit tool".
- 2026-11-23 — Packaging: "Its own group". Scope: "Instruction files, Skill and agent descriptions, MCP servers, Hooks". Budget: "Over 10k tokens, configurable".
- 2026-11-23 — Token counts: "A real tokenizer", then, given that installed tools have no dependencies today: "Bundled offline tokenizer".

- 2026-11-23 — Plan: "Approve the plan".
- 2026-11-23 — Research questions: per detected tool; count `@imports` and `.claude/rules`; Codex 32 KiB cap as its own failing warning. BR-0001 to BR-0005 confirmed.
- 2026-11-23 — Spec and its four assumptions: "Approve the spec".
- 2026-11-23 — Commit and pull request: "Commit and open PR" (no version bump).
- 2026-11-23 — Code review findings: "Fix them". Spec clarified with them: FR-008 (`settings.local.json`), the folder-scan edge case, US3-1 ("≈" on every estimated count).

## Result

(written when the run closes)
