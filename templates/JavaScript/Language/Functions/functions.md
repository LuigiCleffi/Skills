---
name: js-functions
description: "Defining JavaScript functions (declarations, expressions, arrows), parameters and defaults, return values, lexical and block scope, closures, the call stack, recursion, extracting and naming functions, and pure functions vs side effects, based on Chapter 3 (Functions) of Eloquent JavaScript. Use when writing or extracting a function, choosing declaration vs arrow, handling optional arguments, creating factories or closures, writing recursive code, hitting stack overflows, or separating pure logic from side effects for testing."
---

# Functions

Use functions to add vocabulary to the program: one clear concept per function, named so the call site reads like the problem. Prefer pure, value-returning functions; push side effects to the edges.

## Three notations

- Declaration `function name(a) {}`: hoisted to the top of its scope, so it can be called before it appears. Good for top-level named helpers.
- Expression `const name = function (a) {}`: an ordinary binding, not hoisted (temporal dead zone with `const`/`let`).
- Arrow `(a) => expr`: concise; a single expression body is returned implicitly. Arrows do not bind their own `this` or `arguments` and cannot be constructors, which is exactly why they suit callbacks.
- Pick one convention per codebase (e.g. declarations for named top-level functions, arrows for callbacks) and stick to it.
- Return an object literal from an arrow by wrapping it in parentheses: `() => ({ ok: true })`.

## Parameters and returns

- JavaScript does not check arity: extra arguments are ignored, missing ones are `undefined`. Do not rely on this silently; validate where it matters.
- Default parameters (`step = 1`) apply only when the argument is `undefined`, not `null`.
- More than ~3 positional parameters, or boolean flags, call for a single options object with destructuring and defaults.
- `return` exits immediately. A function without `return` (or with bare `return;`) yields `undefined`; a function that sometimes returns a value and sometimes not is a bug magnet.

```js
function formatPrice(cents, { currency = "USD", locale = "en-US" } = {}) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
formatPrice(1999);                      // "$19.99"
formatPrice(1999, { currency: "EUR" }); // "€19.99"
```

## Scope

- Scope is lexical: a function sees the bindings where it was written, not where it is called.
- `let`/`const` are block-scoped; each call creates fresh local bindings. `var` is function-scoped and leaks out of blocks; avoid it.
- Inner bindings shadow outer ones with the same name; avoid shadowing, it hides bugs.
- Minimize module-level mutable state; pass values in and return values out.

## Closures

- A function value carries the environment it was created in. Each call of the outer function creates an independent environment.
- Use closures for factories, configuration, memoization and private state.
- In loops, `let` gives each iteration its own binding, so callbacks capture the expected value (a classic `var` bug).

```js
function makeCounter(start = 0) {
  let count = start;
  return { next: () => ++count, current: () => count };
}
const a = makeCounter(), b = makeCounter(10);
a.next(); b.next(); // 1, 11 — independent state
```

## Call stack and recursion

- Each call pushes a frame; the stack is finite. Deep or unbounded recursion throws `RangeError: Maximum call stack size exceeded`.
- Recursion fits branching problems (trees, nested data, search); loops fit linear iteration. Do not assume tail-call optimization (most engines lack it).
- Every recursive function needs a base case reached for all valid inputs, including edge cases (negative numbers, empty input).
- Return `null`/`undefined` for "no result" and chain alternatives with `??` when exploring branches.
- Write the clear version first; optimize only after measuring that it is too slow.

## Growing functions

- Extract a function when you repeat code, or when you need a concept that deserves a name; write the call first, then the body.
- If a name is hard to find or contains "and"/"With", the function mixes concepts: split it (e.g. a pure `zeroPad` instead of `printZeroPaddedWithLabel`).
- Do not generalize speculatively; add options only when a real caller needs them.
- **Current note:** check the standard library before writing helpers (`String.prototype.padStart`, `Math.max(...xs)`, `Array.from`, `structuredClone`).

## Pure functions and side effects

- A pure function depends only on its arguments and changes nothing outside; same input, same output.
- Pure functions compose and test trivially. Side-effecting functions (I/O, logging, DOM, time, randomness) are necessary but belong at the edges.
- Inject impure dependencies (`now`, `random`, `fetch`, `log`) as parameters so the core stays pure.

## Workflow

1. Name the concept; write the call site as you wish it read.
2. Define parameters: required first, optional via defaults or an options object.
3. Implement as a pure function returning a value; move effects to the caller.
4. Keep bindings `const` and local; avoid reading mutable outer state.
5. For recursion, write the base case first and test it; confirm depth is bounded.
6. Refactor: split functions whose names hide two ideas; remove unused generality.

## Red flags

- Functions that both compute and print/log/write; names like `doStuff`, `handleData`, `processAndSave`.
- Boolean flag parameters, long positional parameter lists, or `arguments` usage.
- Mixed return paths (sometimes a value, sometimes nothing).
- Recursion without a guaranteed base case, or unbounded recursion over user-sized input.
- Reassigning function bindings at runtime (`let handler = ...; handler = ...`) to switch behavior.
- `var` in loops capturing a shared binding in callbacks.
- Premature frameworks: generic utilities with one caller.

## Testing notes

- tdd: pure functions need no setup: assert output for inputs, including defaults and missing arguments.
- tdd: inject clocks, random sources and I/O so impure behavior is deterministic in tests.
- For recursion, test the base case, one step above it, a deep case, and invalid input (e.g. negative numbers).
- bdd: step definitions should call the same small functions the app uses; keep glue code thin.

## Related

- `../../Language/ProgramStructure/programStructure.md` — bindings, blocks and control flow.
- `../../Language/HigherOrderFunctions/higherOrderFunctions.md` — functions as arguments and return values.
- `../../Language/DataStructures/dataStructures.md` — rest parameters, spread and destructuring.
- `../../../CleanCode/Functions/functions.md` — small functions, one thing, few arguments.
- `../../../CleanCode/MeaningfulNames/namingRules.md` — naming functions.
- `../../../TDD/Patterns/GreenBarPatterns/greenBarPatterns.md` — growing functions test by test.
