---
name: js-bugs-and-errors
description: "Preventing, finding and handling mistakes in JavaScript: strict mode, types, automated tests, hypothesis-driven debugging, special return values versus exceptions, try/catch/finally, cleanup and consistent state, custom error classes with selective catching, and assertions, based on Chapter 8 (Bugs and Errors) of Eloquent JavaScript. Use when designing how a function reports failure, writing try/catch, reviewing error handling, debugging wrong output or NaN/undefined, or adding guards and assertions."
---

# Bugs and Errors

JavaScript reports few mistakes on its own, so make it stricter, write the types down, and test automatically. When something fails, think before changing code. Decide deliberately how each failure is reported, catch only the errors you understand, and leave state consistent when an exception cuts a function short.

## Make the language help you

- Write ES modules and classes: they are strict mode automatically. In legacy scripts add `"use strict"` at the top.
- Strict mode turns assignment to an undeclared name into a `ReferenceError` and makes `this` `undefined` in plain calls, so a forgotten `new` or a detached method fails immediately instead of writing globals.
- Nonsense such as `true * "x"` yields `NaN` or `undefined` and travels far before anything breaks. Validate inputs at boundaries and fail close to the cause.
- Write types down. Use TypeScript or JSDoc types checked by `tsc --checkJs`; at minimum document parameter and return types. Generic functions need type parameters (`<T>(items: T[]) => T`).
- Run a linter (ESLint) in CI to catch unused variables, shadowing, accidental globals and `==` misuse.

## Testing and debugging

- Automate tests; manual re-checking is slow and incomplete. Use a test runner (`node:test`, Vitest, Jest) rather than ad hoc `if` checks.
- Code with fewer external interactions and persistent values is easier to test; push I/O to the edges.
- When output is wrong, do not make random edits. Form a theory, then gather observations to confirm or reject it: targeted `console.log` of key values, a breakpoint, or a `debugger` statement with devtools or `node --inspect` open.
- The line that throws is often only the first place a bad value is used. Trace the value back to where it was produced.
- Once found, write a failing test that reproduces the bug before fixing it.

## Choosing how to report failure

- **Special return value** (`null`, `undefined`, a result object): use when failure is common and the immediate caller must handle it, such as parsing user input or a lookup that may miss.
- When every value is a legal result, wrap it: `{ ok: true, value }` / `{ ok: false, error }`, as iterators do with `{ value, done }`.
- Return values force every caller in the chain to check and forward; that gets noisy fast.
- **Exceptions**: use when the caller cannot reasonably continue, so intermediate functions can ignore the failure and only the thrower and the handler deal with it.
- Always throw `Error` instances (or subclasses), never strings or plain objects; only `Error` carries a `stack`.

**Current note:** pass the underlying error as `cause` when wrapping (`new Error("Load failed", { cause: err })`) so the original stack survives; use `AggregateError` for several failures.

## Exceptions and cleanup

- Any call or property access can throw, so a function with several side effects can be interrupted halfway, leaving state inconsistent.
- First reduce the risk: do everything that can fail (lookups, validation) *before* mutating anything, and prefer computing new values over changing existing ones.
- Use `finally` for cleanup that must always run (release a lock, close a handle, restore a flag). `finally` does not swallow the exception; unwinding continues after it.
- Do not `return` from `finally`; it silently discards the exception in flight.

```js
function withUnlocked(box, body) {
  const wasLocked = box.locked;
  if (wasLocked) box.unlock();
  try {
    return body();
  } finally {
    if (wasLocked) box.lock();
  }
}
```

**Current note:** `using` / `await using` declarations with `Symbol.dispose` (explicit resource management) are an emerging alternative to `try/finally` for cleanup; check runtime support before relying on them.

## Selective catching

- JavaScript catches everything a `try` throws, including typos (`ReferenceError`) and `TypeError`s from your own bugs. A catch block that assumes "it must be bad input" hides those bugs and can loop forever.
- Define error classes for expected failures and check them with `instanceof`; rethrow everything else. Never branch on `error.message`, which is meant for humans and changes.
- Catch-all handlers are acceptable only to route errors somewhere (log, report, return a 500) at the top level, and they must keep the details.

```js
export class InputError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "InputError";
  }
}

try {
  return parseDirection(raw);
} catch (error) {
  if (!(error instanceof InputError)) throw error;
  return askAgain(error.message);
}
```

- An uncaught exception is a reasonable outcome for programmer mistakes. Browsers log it; Node.js terminates the process, protecting against corrupted state. For expected, routine problems, crashing is the wrong strategy.

## Assertions

- Assertions check programmer assumptions, not user input. Throw loudly on impossible states instead of returning `undefined`.
- Reserve them for mistakes that are easy to make. Asserting every possible bad input makes the code noisy.
- In Node, `node:assert` (`assert.ok`, `assert.strictEqual`) works for runtime invariants as well as tests.

## Workflow

1. For each function that can fail, decide: return value (expected, local) or exception (exceptional, propagate). Document which.
2. Validate external input at the boundary; throw a domain error subclass or return a result object.
3. Perform failing steps before mutations; wrap required cleanup in `finally`.
4. Catch only where you can handle; test with `instanceof` and rethrow the rest.
5. Wrap lower-level errors with `{ cause }` when translating them to a higher-level meaning.
6. Add assertions for invariants you have already got wrong once.
7. On a bug: hypothesize, observe, reproduce in a failing test, fix, keep the test.

## Red flags

- Empty `catch {}` or a catch that ignores the error variable.
- `catch (e)` followed by logic that assumes one specific cause, with no rethrow.
- `if (err.message === "...")` or `includes` on messages to pick behavior.
- `throw "message"` or throwing plain objects.
- Mutation before a call that may throw, with no rollback.
- `return` inside `finally`.
- Functions that return `null` for some failures and throw for others without a clear rule.
- Missing `"use strict"` in non-module scripts; constructors callable without `new`.
- Debugging commits full of trial-and-error edits and leftover `console.log`/`debugger`.

## Testing notes

- Assert error type and relevant data, not message text: `assert.throws(() => f(x), InputError)` or `expect(() => f(x)).toThrow(InputError)`.
- Test the rollback path: make a dependency throw mid-operation and assert state is unchanged.
- Write the reproducing test before the fix (red, then green).
- In acceptance scenarios, map expected failures to visible outcomes (message, status code) and keep unexpected errors failing the scenario.

## Related

- `../../Language/SecretLifeOfObjects/secretLifeOfObjects.md` — subclassing `Error` and `instanceof`.
- `../../Language/ProjectRobot/projectRobot.md` — persistent data makes recovery and testing simpler.
- `../../Language/AsynchronousProgramming/asynchronousProgramming.md` — errors in promises and `async` functions.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — exceptions over error codes, do not return null.
- `../../../CleanCode/UnitTests/unitTests.md` — clean, fast, repeatable tests.
- `../../../TDD/Patterns/RedBarPatterns/redBarPatterns.md` — regression tests and breaking when stuck.
- `../../../BDD/CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — automating error-path criteria.
