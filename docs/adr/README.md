# Architecture Decision Records — Gate

Read this file before designing or implementing. Find every row whose
"Looking for / about to" or "Paths" matches the task, then read only
those ADRs. Accepted ADRs are binding; follow them or propose a superseding ADR.

## Routing

| Looking for / about to… | Keywords | Paths | Read |
|---|---|---|---|
| Add a library to an installed tool, or make one depend on a package | dependency, package, import, npm, library | `templates/tools/**`, `templates/harness/**`, `templates/checks/**`, `templates/guards/**` | [ADR-0001](0001-optional-project-dependencies-for-installed-tools.md) |

## Register

| ADR | Title | Status | Date | Areas |
|---|---|---|---|---|
| [0001](0001-optional-project-dependencies-for-installed-tools.md) | Installed tools may use an optional project dependency, with a built-in fallback | Accepted | 2026-11-23 | Technology, Delivery |
