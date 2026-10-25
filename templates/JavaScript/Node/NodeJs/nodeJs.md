---
name: js-node
description: "Writing Node.js programs: the node command, process and exit codes, ES modules versus CommonJS, npm and package.json with semantic versioning, the fs callback/promise/sync APIs, HTTP servers, streams and piping, and safe file serving, based on Chapter 20 (Node.js) of Eloquent JavaScript. Use when building a CLI or HTTP server in Node, reading or writing files, managing dependencies, handling streams, mapping URLs to files, or reviewing Node code for blocking I/O and path traversal."
---

# Node.js

Use Node for scripts, tools and servers, and respect its model: one thread, non-blocking I/O, explicit imports for built-ins. Prefer promise APIs, ES modules and `node:`-prefixed built-ins; treat every network input as hostile.

## Running programs

- `node file.js` runs a file; `node` alone opens a REPL.
- `process.argv` holds `[node, script, ...args]`; real arguments start at index 2.
- Signal outcome with the exit status: `0` success, non-zero failure. Set `process.exitCode = 1` and let the program finish rather than calling `process.exit()` mid-I/O.
- Browser globals (`document`, `prompt`, `localStorage`) do not exist; standard ones (`Array`, `JSON`, `URL`, `fetch`, `setTimeout`) do.
- A process that is listening (servers, timers) keeps running until closed.

**Current note:** parse flags with `util.parseArgs`; use `node --watch` in development, `node --env-file=.env` for configuration, and `node --test` for the built-in test runner.

## Modules

- Node supports CommonJS (`require`) and ES modules (`import`/`export`). ESM is the default choice: use `.mjs` or `"type": "module"` in `package.json`.
- Specifiers starting with `/`, `./`, `../` are files (include the extension in ESM); bare names resolve to built-ins or `node_modules`.
- Import built-ins with the `node:` prefix (`node:fs/promises`, `node:http`, `node:path`) so they cannot be shadowed by a package.
- Keep reusable logic in library modules and the CLI entry (argument parsing, I/O, exit code) thin.

**Current note:** in ESM, use `import.meta.dirname` / `import.meta.filename` (Node 20.11+) or `fileURLToPath(import.meta.url)` instead of `__dirname`.

## npm and package.json

- Every project has a `package.json` (name, version, `type`, `scripts`, `dependencies`, `devDependencies`). `npm install` with no arguments installs what it lists; packages install locally in `node_modules`.
- Semantic versioning: MAJOR breaks compatibility, MINOR adds features, PATCH fixes. `^2.3.0` accepts `>=2.3.0 <3.0.0`.
- Commit the lockfile (`package-lock.json`) and install with `npm ci` in CI for reproducible builds.
- Add a dependency only when it beats a few lines of your own code or a built-in; check maintenance and audit results.

## The filesystem

- Three API styles: callbacks (`node:fs`), promises (`node:fs/promises`), and synchronous `*Sync` functions. Prefer promises with `async`/`await`.
- `*Sync` calls block the whole process. They are fine in startup code and small CLIs, never in a request handler.
- Pass `"utf8"` to read text; without an encoding you get a `Buffer` of bytes.
- Errors carry Unix-style `code` values: `ENOENT` (missing), `EEXIST`, `EACCES`, `EISDIR`. Branch on `error.code`, rethrow anything unexpected.

```js
import {readFile} from "node:fs/promises";

export async function readConfig(path, fallback = {}) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
```

- `stat` tells you existence, size, `mtime` and `isDirectory()`; use `readdir`, `mkdir({recursive: true})`, `rm`, `rename` for the rest.

## HTTP servers

- `createServer((request, response) => ...)` is called per request. Read `request.method`, `request.url`, `request.headers` (lowercased names).
- Respond with `response.writeHead(status, headers)`, optional `write` calls, then exactly one `end()`. Always set `Content-Type`.
- Parse URLs with `new URL(request.url, "http://localhost")`; decode path segments with `decodeURIComponent`.
- Dispatch on method through a lookup object (`handlers[request.method] ?? notAllowed`) and have handlers return a response description (`{status, headers, body}`). One place then writes responses and converts thrown errors to 500.
- Respond `405` for unsupported methods, `404` for missing resources, `204` for success with no body. Make `DELETE` of a missing resource succeed (idempotent).
- For calling other services, use the global `fetch` rather than `http.request`.

## Streams

- Writable streams have `write` and `end`; readable streams emit `"data"` and `"end"` (or are async iterable with `for await`).
- `request` is readable, `response` is writable; `createReadStream` / `createWriteStream` stream files without loading them into memory.
- `pipe` does not propagate errors or return a promise. Use `pipeline`, which wires errors on both sides and cleans up.

```js
import {pipeline} from "node:stream/promises";
import {createWriteStream} from "node:fs";

async function saveUpload(request, path) {
  await pipeline(request, createWriteStream(path));
  return {status: 204};
}
```

**Current note:** `node:stream/consumers` (`json`, `text`, `buffer`) reads a whole request body in one `await`.

## Security for file-backed servers

- Never map a URL path straight to a filesystem path. Resolve it, then verify it stays under the base directory:

```js
import {resolve, sep} from "node:path";
const root = resolve("public");
function safePath(urlPath) {
  const path = resolve(root, "." + decodeURIComponent(urlPath));
  if (path !== root && !path.startsWith(root + sep)) {
    throw Object.assign(new Error("Forbidden"), {status: 403});
  }
  return path;
}
```

- Validate methods, sizes and content types; limit body size; never echo raw input into HTML.
- A server that accepts writes needs authentication before it goes anywhere near a network.

## Workflow

1. Choose ESM, set `"type": "module"`, and import built-ins with `node:`.
2. Put logic in importable modules; keep the entry point to argument parsing, wiring and exit status.
3. Use `fs/promises` with `async`/`await`; handle expected error codes, rethrow the rest.
4. Structure servers as method/route lookup plus handlers returning response objects.
5. Stream large bodies with `pipeline`; read small JSON bodies with `stream/consumers`.
6. Constrain every path derived from input to an allowed root.
7. Commit the lockfile; pin and review dependencies.

## Red flags

- `readFileSync` or other `*Sync` calls inside request handlers.
- `src.pipe(dest)` with no error handling; promises created around streams that never reject.
- `catch {}` that swallows all fs errors instead of checking `error.code`.
- `path.join(base, request.url)` without a containment check (path traversal).
- `process.exit()` called while writes are pending; failures that exit with status 0.
- Mixed `require` and `import` styles; bare `"fs"` instead of `"node:fs"`.
- Response paths that never call `end()`, or call it twice.
- Missing lockfile, or dependencies added for trivial helpers.

## Testing notes

- Test library modules directly with `node:test` and `node:assert/strict`; inject paths and clocks.
- Use a temporary directory (`fs.mkdtemp(os.tmpdir() + sep)`) for filesystem tests and clean it up in `after`.
- For servers, export a factory, `listen(0)` for a random port in tests, call it with `fetch`, and `close()` afterward. Cover 404, 405, 403 traversal attempts and idempotent deletes.
- Acceptance tests for CLIs run the process and assert on stdout, stderr and exit code.

## Related

- `../ProjectSkillSharingWebsite/projectSkillSharingWebsite.md` — routing, JSON APIs and long polling on Node.
- `../../Language/Modules/modules.md` — ES modules, CommonJS and packages.
- `../../Language/AsynchronousProgramming/asynchronousProgramming.md` — callbacks, promises, event loop.
- `../../Browser/HttpAndForms/httpAndForms.md` — HTTP methods, status codes and fetch.
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping third-party packages.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — handling and propagating errors.
