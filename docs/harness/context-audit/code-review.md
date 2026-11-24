# Code review: Context audit

`actions/code-review.md` on `origin/main...142d2c9` (PR #20), two axes in fresh sub-agents with no context from the authoring session. Every citation was checked against the diff; none dropped.

## Standards

1. **[Medium] Breach — entry-point check differs from the house pattern, so the gate can pass without running.** `templates/tools/context-audit.mjs:491` compares `path.resolve(process.argv[1])` with `import.meta.url`; through a symlinked path the tool printed nothing and exited 0 (reproduced). Siblings use `isEntryPoint()` with `realpathSync` (`mermaid-check.mjs:120`, `cycle-metrics.mjs:205`, `gate.mjs:1015`). Cites AGENTS.md working rule 2, CleanCode §7.5. Fix: code + a symlink test.
2. **[Medium] Smell, possible G11 — an unexpected error crashes with exit 1, the over-budget code.** `:484-488`; an unreadable subfolder gives a stack trace and exit 1 (reproduced). Fix: catch at the entry point, print `context-audit: <message>`, exit 2; skip unreadable folders with a warning.
3. **[Low] Smell, C2 — the `auditProject` comment says the budget defaults to the config's;** it defaults to 10,000 (`:386`).
4. **[Low] Smell, G11 — unreadable files warn in the Claude path and count as empty elsewhere** (`:286, 315, 343, 356, 378`).
5. **[Low] Smell — tests check several behaviors each; one re-implements `importFrom`** (`tests/context-audit.test.mjs:68, 132, 146, 164, 281; 158`).

Minor: "Result: over budget" printed for a Codex drop within budget (`:473`); `toml` flag parameter (`:244`); trailing-comma regex can rewrite string contents in JSONC (`:110`); `toLocaleString` repeated; skipping every `templates/` folder hides a user's real files.

## Spec

1. **[Medium] Wrong — unexpected errors exit 1** (FR-014): `chmod 000` subfolder and `tools/context-audit.json` = `null` both crash with exit 1 (reproduced). Same root as Standards 2.
2. **[Medium] Partial — unreadable or binary instruction files are counted silently outside the Claude path** (edge case "Unreadable or binary instruction file"): unreadable Codex AGENTS.md showed 0 bytes and skipped the BR-0005 check; a binary one counted 709 tokens (reproduced). Same root as Standards 4.
3. **[Medium] Wrong — OpenCode `instructions` read files outside the project** (FR-002): `["../outside.md"]` was counted (reproduced, `:169, 353`).
4. **[Low] Wrong — the folder-scoped scan skips `templates/` and dot folders at every depth** (edge case, FR-007): `pkg/templates/AGENTS.md`, `web/.claude/CLAUDE.md` not listed.
5. **[Low] Partial — hooks in `.claude/settings.local.json` are not named** (FR-008).

Minor: an import cycle at the hop limit warns that an already counted file is "not counted" (`:235`); a capped description is a note, not a warning; the estimate label is on the header only (US3-1 says every count); SC-005 gaps for the cases above.

## Summary

- **Worst Standards issue:** through a symlinked path the CI gate passes without running.
- **Worst Spec issue:** failures exit 1, so CI reads a crash as "over budget".

## Coverage

- Diff: `origin/main...HEAD`, 28 files, 1 commit (`142d2c9`); code reviewed in depth, `docs/` records only where code contradicts them.
- Not seen: no uncommitted changes.
- Checks run by the reviewers: fixture projects for every Spec finding and the symlink case, as listed above. The suite was not rerun by them.
- Dropped in citation check: 0.
- Context: fresh sub-agents, one per axis.
- Earlier reviews: none on PR #20.

## Resolution

All findings fixed on 2026-11-23 at the user's request ("Fix them"), each with a test (`tests/context-audit.test.mjs`, 26 → 56 tests, one behavior each, `importFrom` from the helpers):

| Finding | Fix |
|---|---|
| Standards 1, symlinked path exits 0 | `isEntryPoint()` with `realpathSync`, as the sibling tools do; test runs the tool through a symlink (fails on the old code, checked) |
| Standards 2 / Spec 1, crashes exit 1 | `main` reports any error as `context-audit: <reason>` with exit 2; unreadable folders are skipped with a warning; a non-object `tools/context-audit.json` is a usage error |
| Standards 3, false comment | `auditProject` comment says the default is 10,000 and the command line reads the config |
| Standards 4 / Spec 2, unreadable or binary files | one `readCounted` helper warns and leaves the file out everywhere (Codex, OpenCode, rules, folder-scoped, descriptions) |
| Standards 5, tests | split into one behavior per test; `importFrom` used |
| Spec 3, OpenCode instructions outside the project | refused with a warning |
| Spec 4, folder scan | `templates/` skipped only at the root of the kit's own repository; dot folders searched below the root; spec edge case updated |
| Spec 5, `settings.local.json` | hooks and `ENABLE_TOOL_SEARCH` read from it too; FR-008 updated |
| Minor | Result line names the failure ("Codex would drop instructions"); `read` function instead of a `toml` flag; JSONC trailing commas removed in the string-aware loop; `formatNumber`; import cycle at the hop limit no longer warns; capped description also warns; every estimated count marked "≈" (US3-1 updated) |
