---
name: js-modules
description: "Structuring JavaScript programs into modules and packages: ES module import/export, named versus default exports, CommonJS interop, npm packages and licenses, build and bundling, circular dependencies, and module design for small, predictable, composable interfaces, based on Chapter 10 (Modules) of Eloquent JavaScript. Use when splitting code into files, designing a module or package API, adding an npm dependency, mixing ESM and CommonJS, fixing import cycles, or reviewing project structure."
---

# Modules

A module states what it depends on and what it offers; everything else stays private. Build programs from small ES modules with explicit, narrow interfaces, prefer functions over stateful objects at those interfaces, reuse well-chosen packages, and keep the dependency graph acyclic.

## Why modules

- Without boundaries, everything touches everything (a "big ball of mud"): hard to understand piece by piece and impossible to reuse without dragging the rest along.
- A module has an *interface* (exports) and *dependencies* (imports). Explicit dependencies let tools load, bundle, tree-shake and analyze code, and let readers see coupling at a glance.
- Write code that is easy to delete: a module you can remove by deleting a file and its imports is well isolated.

## ES modules

- Each module has its own scope and runs in strict mode. Nothing leaks into globals.
- `export` a function, class or binding to make it part of the interface; unexported names are private.
- `import { a, b as c } from "./x.js"` for named imports, `import * as ns from "./x.js"` for a namespace, `import d from "./x.js"` for a default export.
- `import`/`export` are static: top level only, string-literal specifiers, resolved before the module body runs. Imported bindings are live and read-only.
- Use `await import(specifier)` for conditional or lazy loading.
- Browsers resolve specifiers as URLs; Node resolves files and packages. Write the file extension in relative imports (`"./graph.js"`) for portable ESM.

```js
// graph.js
export function buildGraph(edges) {
  const graph = new Map();
  for (const [a, b] of edges) {
    graph.set(a, [...(graph.get(a) ?? []), b]);
    graph.set(b, [...(graph.get(b) ?? []), a]);
  }
  return graph;
}

// roads.js
import { buildGraph } from "./graph.js";
const roads = ["Home-Shop", "Shop-Office"];
export const roadGraph = buildGraph(roads.map(r => r.split("-")));
```

- Prefer named exports: they keep names consistent across the codebase, work with refactoring tools and avoid ambiguous default names. Use a default export only when a module truly exports one thing and the ecosystem expects it.
- Keep module top-level code free of side effects (network calls, DOM writes, timers) so importing is cheap and testable; expose an explicit `start()` or `main()` instead.

## CommonJS and interop

- CommonJS uses `require(name)` and `module.exports`/`exports`. `require` is an ordinary run-time call (dynamic names, inside functions) backed by a cache of loaded modules.
- Write new code as ESM (`"type": "module"` in `package.json` or `.mjs`). ESM can import CommonJS; going the other way needs `import()` or a recent Node with `require(esm)` support.
- Never build module loaders from `Function`/`eval` on strings: running code from untrusted text is a code-injection hole.

**Current note:** modern Node is ESM-first, supports `import.meta.dirname`/`filename`, JSON imports with `with { type: "json" }`, and `"exports"`/`"imports"` maps in `package.json` to define a package's public entry points.

## Packages

- A package is a distributable unit of one or more modules plus metadata (`package.json`: name, version, dependencies, entry points, license).
- Before writing a general-purpose utility (parsers, date math, pathfinding), check npm for a maintained, well-tested package. Before adding one, check maintenance, download trends, size, transitive dependencies, security advisories, and license compatibility.
- Copying code between projects instead of sharing a package means fixes land in one copy only.
- Commit the lockfile; pin and update dependencies deliberately; run `npm audit` or equivalent in CI.

## Building and bundling

- Many projects compile (TypeScript, newer syntax), bundle (many modules into few files for the browser) and minify. Treat these as build steps with source maps, not as part of your module design.
- Keep modules small and side-effect free so bundlers can tree-shake unused exports.

## Module design

- **Predictable**: follow existing conventions. A format module exposing `parse` and `stringify` like `JSON` is learned in seconds.
- **Focused**: do one thing. A parser takes a string and returns data; it does not also read files, which would tie it to Node and block browser use. Compose it with a file reader instead.
- **Composable**: modules that compute values beat modules that perform side effects. Push I/O to the edges.
- **Functions over ceremony**: if a function will do, export a function. Avoid "create object, load into it, call getters" APIs that force callers through states and couple them to a custom type.
- **Plain data at boundaries**: accept and return arrays, plain objects and `Map`s. When you need a richer structure (such as a graph), adopt the representation other libraries already use so data can flow between them.
- Organize after exploring: while the problem is unclear keep things together; once the design feels solid, split it into modules along real seams.

```js
// good: pure, focused, conventional
export function parse(text) { /* string -> object */ }
export function stringify(object) { /* object -> string */ }
// caller composes I/O
const config = parse(await readFile(path, "utf8"));
```

## Circular dependencies

- A cycle (A imports B, B imports A, directly or indirectly) means one module runs before its dependency finishes initializing.
- CommonJS returns the partially filled exports object; ESM throws a `ReferenceError` when a not-yet-initialized `let`/`const`/`class` binding is touched during evaluation (hoisted functions happen to work).
- Break cycles by extracting the shared part into a third module, inverting the dependency (pass a function or object in), or merging modules that are really one. Detect them with tools such as `madge` or ESLint `import/no-cycle`.

## Workflow

1. Identify cohesive responsibilities; give each a module with the smallest useful export list.
2. Write imports with explicit relative paths and extensions; prefer named exports.
3. Keep top-level code declaration-only; expose entry points for side effects.
4. Separate pure computation modules from I/O modules; the I/O layer imports the pure ones, never the reverse.
5. Check npm for mature solutions before writing generic code; vet license and health before adding.
6. Keep the dependency graph acyclic; fix cycles by extraction or inversion.
7. Expose public entry points via `package.json` `"exports"` for libraries.

## Red flags

- Globals or `window.x` used to share code between files.
- Modules that read files, hit the network or mutate the DOM on import.
- "Utils" or "helpers" modules that import from half the codebase.
- APIs requiring construct-then-load-then-query rituals where one function call would do.
- Default exports renamed differently in every importer.
- New CommonJS files in an ESM project, or mixing both styles in one package.
- Import cycles, or bugs that depend on import order.
- Copy-pasted modules across projects; dependencies added without license or maintenance checks.
- `new Function`/`eval` on dynamic strings.

## Testing notes

- Each module's exports are its test surface; test them directly and never import private helpers just for tests.
- Pure modules need no mocks. Inject I/O (pass a reader or client as a parameter) so tests can supply fakes instead of mocking module imports.
- Side-effect-free imports keep test startup fast and order-independent.
- Acceptance tests should drive the application's entry module, not reach into internals.

## Related

- `../../Language/SecretLifeOfObjects/secretLifeOfObjects.md` — interfaces and encapsulation at object level.
- `../../Language/ProjectRobot/projectRobot.md` — a project ripe for splitting into modules.
- `../../Language/RegularExpressions/regularExpressions.md` — the line-oriented parser used as a module example.
- `../../Node/NodeJs/nodeJs.md` — npm, `package.json` and Node's module resolution.
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping third-party code.
- `../../../CleanCode/Systems/systems.md` — separating construction from use.
- `../../../CleanCode/SmellsAndHeuristics/heuristicsCatalog.md` — coupling and dependency smells.
