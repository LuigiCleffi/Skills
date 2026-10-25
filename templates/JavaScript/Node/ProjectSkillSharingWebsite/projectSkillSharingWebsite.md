---
name: js-project-skill-sharing-website
description: "Design lessons for a full-stack JavaScript app: designing the HTTP interface first, a regex router and handler chain on Node, validating JSON at the boundary, live updates with long polling via ETag/If-None-Match, and a client built on actions, a fetch wrapper and resilient polling, based on Chapter 21 (Project: Skill-Sharing Website) of Eloquent JavaScript. Use when designing a JSON API, writing a router or middleware, pushing live updates to browsers, splitting server and client responsibilities, or reviewing a small Node web app."
---

# Project: Skill-Sharing Website (server/client design)

Design the contract where client and server touch before writing either side. Keep the server a small set of resource handlers behind a router, validate everything that crosses the boundary, and let clients learn about changes through a versioned resource they can wait on.

## Interface first

- Model data as resources under one prefix (`/talks`, `/talks/:title`, `/talks/:title/comments`) and pick methods by effect: `GET` read, `PUT` create/replace at a known name, `DELETE` remove, `POST` append to a collection.
- Use JSON bodies with `Content-Type: application/json`. Document request shapes, status codes and headers before coding.
- Encode identifiers in URLs with `encodeURIComponent`; decode captured route segments on the server.
- Serve static client files from a separate directory, matched only after API routes.
- Decide access control up front. An API where anyone can delete anything is a demo, not a deployable system.

## Router and handler chain

- A router is a list of `{method, pattern, handler}`; resolving finds the first match, extracts regex groups, decodes them and calls the handler with shared context.
- Handlers are `async` and return a response description (`{status = 200, headers, body}`); one function writes it and turns thrown errors into 500s (or uses `error.status` if set).
- Chain handlers with the `(request, response, next)` convention: router first, then a static file server, then a 404 handler.
- Prefer a maintained static-file package over a hand-rolled one: it handles caching headers, ranges and traversal.

```js
export class Router {
  #routes = [];
  add(method, pattern, handler) { this.#routes.push({method, pattern, handler}); }
  async resolve(request, context) {
    const {pathname} = new URL(request.url, "http://localhost");
    for (const {method, pattern, handler} of this.#routes) {
      const match = pattern.exec(pathname);
      if (match && request.method === method) {
        return handler(context, ...match.slice(1).map(decodeURIComponent), request);
      }
    }
    return null;                              // caller falls through to next()
  }
}
```

**Current note:** in production, frameworks such as Fastify, Express 5 or Hono provide this with schema validation; `URLPattern` is available in recent runtimes for route matching.

## Validate at the boundary

- Parse bodies with `json` from `node:stream/consumers`; a parse failure is a `400`, not a crash.
- Check every field's type and presence before storing; copy only known fields into your model instead of storing the raw object.
- Use `Object.hasOwn(store, key)` (or a `Map`) for lookups keyed by user input, so `"__proto__"` or `"toString"` cannot hit inherited properties.
- Return `404` for missing parents (commenting on a nonexistent talk) and `204` for successful writes without a body.

```js
function parseTalk(data) {
  if (typeof data?.presenter !== "string" || typeof data?.summary !== "string") {
    throw Object.assign(new Error("Bad talk data"), {status: 400});
  }
  return {presenter: data.presenter.trim(), summary: data.summary.trim()};
}
```

## Live updates with long polling

- The server keeps a `version` that increments on every change and exposes it as the `ETag` of the collection.
- A client sends `If-None-Match: "<version>"`. If the version differs, respond immediately with data and the new `ETag`. If it matches and the client sent `Prefer: wait=N`, park the request; otherwise answer `304`.
- Parked requests are resolvers in a waiting list. On change, bump the version and resolve them all with fresh data. A timer answers `304` after `N` seconds so connections do not time out; remove the resolver from the list when it fires.
- Send `Cache-Control: no-store` on polled responses so intermediaries do not cache them.
- Node handles thousands of idle connections cheaply, which makes long polling practical.

**Current note:** Server-Sent Events (`EventSource`) give one-way push over plain HTTP with built-in reconnection; WebSockets fit two-way, high-frequency traffic. Long polling remains a valid, firewall-friendly fallback.

## Client architecture

- Application state is one object (`{user, talks}`); the UI emits actions; a `handleAction(state, action)` applies local changes and triggers server requests.
- Do not update local state optimistically for server-owned data; let the poll deliver the authoritative version.
- Wrap `fetch` once so HTTP error statuses reject (`fetchOK`), and route every failure to a visible error report.
- Poll in an `async` loop: send the stored tag, `continue` on `304`, store the new `ETag` and update on `200`, and back off briefly on network errors before retrying.

```js
async function pollTalks(onTalks, {signal} = {}) {
  let tag;
  while (!signal?.aborted) {
    try {
      const response = await fetchOK("/talks", {signal,
        headers: tag ? {"If-None-Match": tag, Prefer: "wait=90"} : {}});
      if (response.status === 304) continue;
      tag = response.headers.get("ETag");
      onTalks(await response.json());
    } catch (error) {
      if (signal?.aborted) return;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

- Persist small user preferences (the display name) in `localStorage`; keep shared data on the server.
- Render with small functions returning DOM nodes; components that hold state get a class with `syncState`.
- Re-rendering a whole list on every update destroys focus and half-typed input. Reuse DOM per item (keyed by id) and update only changed items.

## Persistence

- In-memory stores lose everything on restart. The simplest durable step is writing JSON to a file on every change and loading it at startup; write to a temporary file and `rename` it so a crash cannot leave half a file.
- Move to a database once you need concurrent writers, queries or size beyond memory.

## Workflow

1. Write the HTTP contract: resources, methods, bodies, status codes, headers.
2. Implement the router and response writer; add handlers one resource at a time, test-first.
3. Validate and normalize input in each handler before touching state.
4. Add the change version and waiting list; wire `updated()` into every mutating handler.
5. Build the client: state, actions, fetch wrapper, polling loop, render functions.
6. Add persistence and access control before exposing the service.

## Red flags

- Server and client written in parallel with no agreed contract.
- A long `if/else` chain on method and URL instead of a route table.
- Storing request bodies as-is; `talks[title]` lookups without `Object.hasOwn`.
- Catch handlers that reference the wrong variable name (`catch (error) { String(err) }`), turning a 500 path into a crash.
- Waiting requests with no timeout, or timers that resolve a request already answered.
- Mutating handlers that forget to bump the version, so clients never see the change.
- Client polling loops with no backoff on failure (hammering the server) or no way to stop.
- Whole-list re-render that wipes inputs the user is typing in.
- Public write and delete endpoints with no authentication or rate limiting.

## Testing notes

- Unit-test the router, validators and `handleAction` as plain functions.
- Test the server in-process: create it with an injected store, `listen(0)`, exercise each route with `fetch`, then `close()`. Cover 400, 404, 204 and long-poll paths (immediate data, 304 on timeout with a short wait, wake-up on change).
- Use fake timers or very small `wait` values so polling tests run fast.
- Acceptance scenarios (two clients, one sees the other's change) run against the real server with a browser driver; assert on what each user sees.

## Related

- `../NodeJs/nodeJs.md` — Node HTTP servers, streams and file safety.
- `../../Browser/HttpAndForms/httpAndForms.md` — fetch, status checks, forms and storage.
- `../../Browser/ProjectPixelArtEditor/projectPixelArtEditor.md` — state, actions and component design.
- `../../Language/RegularExpressions/regularExpressions.md` — route patterns and capture groups.
- `../../../CleanCode/Systems/systems.md` — separating construction, wiring and use.
- `../../../BDD/CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — API-level acceptance tests.
