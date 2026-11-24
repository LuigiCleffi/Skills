# Run: A rule and a test that every installed script runs when called through a symlink

**Mode:** Chore — a project rule and a test; no installed behavior changes (every script already complies).
**Triggers:** none
**Opened:** 2026-11-24   **Closed:** 2026-11-24
**Status:** Closed

Follows the lesson recorded in [the context audit run](2026-11-23-context-audit.md): the audit once compared `process.argv[1]` with `import.meta.url` and, through a symlinked path, exited 0 without running.

| Stage | Status | Record | Notes |
|---|---|---|---|
| adr-gate | done | docs/adr/README.md | routes `templates/tools/**` to ADR-0001 (optional dependencies), which this change does not touch; no new architectural decision |
| dev | done | tests/entry-points.test.mjs | 14 tests; the rule as ROOT-01 in AGENTS.md |
| review | done | | the test fails on the context audit from 142d2c9 (the bug it guards) and passes on every current script; one normalization fix (scripts may print the real path behind the link) |

## Approvals

- 2026-11-24 — "add the entry-point rule and symlink test".

## Result

**Shipped:** `tests/entry-points.test.mjs` runs each of the 13 installed scripts (`checks/`, `guards/`, `harness/`, `tools/`) once from a project and once through a symlink to an identical project, with an invocation that prints deterministic output offline, and requires the same exit code and output. A first test fails when a script is added without an invocation. ROOT-01 in the new *Project Rules* table of `AGENTS.md` states the rule and points to the test.

**Checks:** 190 of 190 tests; frontmatter check 368 valid. Against the context audit from `142d2c9` the new test fails (13 pass, 1 fail), so it catches the bug that motivated it. `tools/rules-check.mjs` reports no problem with ROOT-01; it reports 5 citations in `AGENTS.md` that do not exist (`CleanCode_Uncle_Bob/README.md` and four `actions/` files not installed here), the same on `main` before this change.

**Not in this run:** the other half of the lesson, "exit 1 for a result, never for a crash". `checks`, `cycle-metrics`, `doctor`, `palette-check`, `review-context`, `rulers`, and `rules-check` still exit 1 when they crash, and for several of them 1 also means "found problems". Changing that changes installed behavior; it is a separate fix.
