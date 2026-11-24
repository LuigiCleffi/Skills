# ADR-0001: Installed tools may use an optional project dependency, with a built-in fallback

**Status:** Accepted
**Date:** 2026-11-23
**Deciders:** the user (2026-11-23: "A real tokenizer", then "Bundled offline tokenizer")
**Areas:** Technology, Delivery
**Related:** [Spec](../harness/context-audit/SpecifyRequirements.md) FR-009, [plan](../harness/context-audit/plan.md), RS-0001 finding 20

## Context
Files the kit installs under `tools/` and `harness/` run on Node.js alone, with one precedent: `tools/mermaid-check.mjs` resolves `mermaid` and `jsdom` from the project (`createRequire` on the project's `package.json`) and exits 2 with the install command when they are missing. The context audit needs token counts (FR-009). No offline tokenizer is exact for current Claude models; `js-tiktoken` is pure JavaScript and offline, but unpacks to about 22 MB, and the `o200k_base` ranks alone are about 2 MB.

## Options considered
### Option A — Characters divided by four
No dependency, no network. An estimate that can be off by tens of percent; enough to find what is big.
### Option B — Anthropic's token-counting API, opt-in
Exact for Claude, no dependency, but sends file contents off the machine and needs an API key.
### Option C — Vendor the tokenizer into the installed files
Offline and always available, but adds about 2 MB to every install of the group, and the kit would ship third-party code it must keep current.
### Option D — Required project dependency, like mermaid-check
Resolve `js-tiktoken` from the project and exit 2 without it. Consistent with the precedent, but the audit then fails on first run in most projects, and CI needs the package before the check can run at all.
### Option E — Optional dependency from the project, with Option A as fallback
The tool imports `js-tiktoken` from the project's own `node_modules`; without it, it prints the install command and uses the labeled estimate.

## Decision
Option E. The user chose a real, offline tokenizer; importing it from the project keeps installs small and leaves the version to the project, and the fallback keeps the tool working on first run. This applies to installed tools that need a third-party library for a better result; it does not allow an installed tool to fail without the library.

## Consequences
- **Positive:** real counts for projects that opt in; no growth of the installed files; no network.
- **Negative:** the audit's numbers depend on what the project installed, so two projects may count the same file differently; counts are `o200k_base`, approximate for Claude. `mermaid-check` keeps its required-dependency behavior; this ADR does not change it.
- **Follow-up:** none.

## Compliance
- An installed tool resolves an optional package from the project (`createRequire` on the project's `package.json`), only inside a `try`, and MUST produce its full output without it, saying which method it used and how to install the package. A tool that cannot do its job without a package exits 2 with the install command instead, as `mermaid-check` does.
- It MUST NOT install packages, download data, or call a network service to replace the missing package.
- Where it applies: `templates/tools/**`, `templates/harness/**`, `templates/checks/**`, `templates/guards/**`.
- Enforced by review and by a test that runs the tool without the package.

## Gate entries
| Add a library to an installed tool, or make one depend on a package | dependency, package, import, npm, library | `templates/tools/**`, `templates/harness/**`, `templates/checks/**`, `templates/guards/**` | [ADR-0001](0001-optional-project-dependencies-for-installed-tools.md) |
