# Tasks: Context audit

Spec: [SpecifyRequirements.md](../context-audit/SpecifyRequirements.md). Model: [DomainModel.md](../context-audit/DomainModel.md). Rules: BR-0001 to BR-0005. ADR-0001.

### TASK-01 Write the scenarios as failing tests
**Files:** `tests/context-audit.test.mjs` (new)
**Change:** one test per scenario in `context-audit.feature` and per edge case in the spec, building fixture projects with `makeProject` and running the tool with and without `--json`
**Depends:** none
**Status:** done
**Verify:** `node --test tests/context-audit.test.mjs`

### TASK-02 Build the audit tool and its config
**Files:** `templates/tools/context-audit.mjs` (new), `templates/tools/context-audit.json` (new)
**Change:** detection, per-tool startup sets with imports and rules, descriptions, folder-scoped files, MCP and hook listing, the two counters, Codex cap, text and JSON reports, exit codes (FR-002 to FR-014; ADR-0001 for the optional import)
**Depends:** TASK-01
**Status:** done
**Verify:** `node --test tests/context-audit.test.mjs`

### TASK-03 Add the install group and make harness require it
**Files:** `bin/cli.ts`, `tests/cli.test.mjs`
**Change:** a `context-audit` group installing both files; `harness` requires it; a test that `list` shows it under harness and the install writes both files (FR-001)
**Depends:** TASK-02
**Status:** done
**Verify:** `npm test`

### TASK-04 Point the docs to the command
**Files:** `templates/actions/harness.md`, `README.md`
**Change:** the *Context budget* section and the README name `node tools/context-audit.mjs`, what it counts, and the budget (FR-015)
**Depends:** TASK-02
**Status:** done
**Verify:** `npm run check:frontmatter`
