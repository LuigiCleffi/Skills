---
name: js-asynchronous-programming
description: "Callbacks, promises, async/await, generators, the event loop, and the race conditions that hide in await gaps, based on Chapter 11 (Asynchronous Programming) of Eloquent JavaScript. Use when writing or reviewing code that waits on I/O, timers, or network calls, wrapping a callback API in a promise, running work in parallel with Promise.all, adding timeouts or cancellation, or debugging lost errors and out-of-order results."
---

# Asynchronous Programming

Make waiting explicit and keep it composable: return promises (or use `async` functions) instead of threading callbacks, start independent work together and await it once, and never mutate shared state across an `await` gap. Every promise must end in a handled rejection somewhere.

## Models of waiting

- Synchronous code blocks until a result exists; asynchronous code starts an action and is notified when it finishes. JavaScript runtimes (browsers, Node) do this with one thread and an event loop, not with shared-memory threads.
- Asynchronicity is contagious: a function that awaits something must itself return a promise. Accept that and push async to the edges rather than hiding it.
- Callbacks work but nest deeply, make loops awkward, and make error delivery error-prone. Use them only where an API demands it (event listeners, legacy Node APIs), and wrap them once.

## Promises

- A promise is a receipt for a value that may not exist yet. It settles once: resolved (fulfilled) or rejected. Later `resolve`/`reject` calls are ignored, which is what makes timeout races safe.
- `then` returns a new promise: a plain return value fulfils it, a returned promise is adopted, a throw rejects it. Chain small transformation steps rather than nesting.
- Rejections skip success handlers until a `catch` (or the second `then` argument) handles them. A `catch` that returns a value recovers the chain.
- `Promise.resolve(x)` wraps a value (returns `x` unchanged if already a promise); `Promise.reject(err)` creates a rejected one.
- Wrap callback APIs exactly once, rejecting on error:

```js
const readText = (path) =>
  new Promise((resolve, reject) => {
    legacyRead(path, (error, text) => (error ? reject(error) : resolve(text)));
  });
```

- **Current note:** Node ships `node:fs/promises` and `util.promisify`; prefer them over hand-written wrappers. Use `Promise.withResolvers()` when resolve/reject must escape the executor.

## Async functions

- `async` functions always return a promise; `return v` fulfils it, `throw` rejects it. `await` suspends the function until the promise settles and rethrows rejections at that point, so ordinary `try/catch/finally` works.
- Loops with `await` read like synchronous code; prefer them over recursive `then` chains for sequential retry or search logic.
- `await` only pauses the current function, not the program. Other callbacks run in the gap.
- Arrow functions and methods can be `async` too (`async (x) => ...`, `async load() {}`).

## Parallel versus sequential

- Start independent operations first, then await them together. `await` inside a `for` loop serialises work, which is right only when each step depends on the last or you must limit load.

```js
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
```

- `Promise.all` rejects on the first failure; use `Promise.allSettled` when you need every outcome, `Promise.any` for the first success, `Promise.race` for the first settlement.
- Fire-and-forget batches still need a `catch`, or each failure becomes an unhandled rejection.

## Timeouts and cancellation

- A timeout is a race between the work and a timer; settle-once semantics make the loser harmless. Reject with an `Error` subclass, not a string, so callers can test `instanceof`.
- A timeout does not stop the underlying work. **Current note:** pass an `AbortSignal` (`AbortSignal.timeout(ms)`, `AbortController`) to APIs like `fetch` so the work is actually cancelled.

```js
const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
```

- Promisified delay: `const wait = (ms) => new Promise((r) => setTimeout(r, ms));` (Node also has `node:timers/promises`).
- For a stoppable loop (polling, playback), check a flag or `signal.aborted` each iteration and let the loop's promise resolve when stopped.

## Generators

- `function*` returns an iterator; each `yield` pauses and hands out a value, saving local state. Use generators to write custom iterators (a `*[Symbol.iterator]() { for (const m of this.#items) yield m; }` method) without manual state objects.
- `yield` works only directly in the generator body, not inside nested callbacks.
- Async functions are conceptually generators that yield promises. **Current note:** use `async function*` with `for await...of` to consume streams and paginated APIs.

## The event loop

- Scripts and callbacks run to completion, one at a time. A long synchronous loop delays every timer, I/O callback and UI event queued behind it.
- Callbacks start on a fresh stack: a `try/catch` around `setTimeout(...)` never sees the callback's throw. Handle errors inside the callback or move to promises.
- Promise handlers always run asynchronously (as microtasks), even for already-settled promises, so code after `.then(...)` runs first.
- Runtimes report unhandled rejections; Node terminates the process by default. Treat that warning as a bug.

## Async bugs

- Read-modify-write across an `await` (`total += await f()`, `list = list + await g()`) reads the old value before the gap and overwrites concurrent updates. Compute values and combine them after `Promise.all` instead.

```js
const lines = await Promise.all(files.map(async (f) => `${f}: ${(await readText(f)).length}`));
return lines.join("\n");
```

- State checked before an `await` may be stale after it (user logged out, component unmounted, request superseded). Re-check or use cancellation.
- Forgetting `await` returns a pending promise; `if (await isValid())` vs `if (isValid())` is a classic always-truthy bug.

## Workflow

1. Decide which operations are independent; start them together and await with `Promise.all`/`allSettled`.
2. Wrap any callback API once at the boundary; expose only promise-returning functions.
3. Write the flow as an `async` function with `try/catch` where recovery is meaningful; let other errors propagate.
4. Add timeouts and cancellation with `AbortSignal` for every network or long-running call.
5. Scan each `await` for shared state read before and written after it; refactor to pure combination.
6. Ensure every promise chain terminates in a handler or an awaited caller.

## Red flags

- Nested callbacks or `then` inside `then` instead of a flat chain or `async` function.
- `new Promise` wrapping something that already returns a promise (the "explicit construction" anti-pattern).
- `await` in a loop over independent items; or `forEach(async ...)`, which never waits.
- `.catch(() => {})` that silently swallows errors without a comment explaining why.
- Rejecting or throwing strings instead of `Error` objects.
- Mutable accumulators updated after `await` inside parallel tasks.
- Missing `await` on a returned promise inside `try` (errors escape the `catch`).
- Timeouts that never cancel the underlying request.

## Testing notes

- Make test functions `async` and `await` the code under test; assert rejections with `await assert.rejects(...)` (`node:test`) or `await expect(p).rejects...`.
- Inject the slow dependency (fetcher, clock) so tests resolve immediately; use fake timers for timeout and debounce logic.
- Write a test for the failure path of each `Promise.all` and for timeout expiry, not just the happy path.
- In acceptance tests, wait on observable conditions (element visible, response received), never on fixed sleeps.

## Related

- `../Functions/functions.md` — closures that capture state across callbacks.
- `../HigherOrderFunctions/higherOrderFunctions.md` — `map` to promises, then combine.
- `../BugsAndErrors/bugsAndErrors.md` — error classes and propagation.
- `../../Browser/HandlingEvents/handlingEvents.md` — the event loop as seen from UI events.
- `../../Node/NodeJs/nodeJs.md` — promise-based file and network APIs.
- `../../../CleanCode/Concurrency/concurrency.md` — concurrency principles and shared-state hazards.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — where to catch and where to propagate.
