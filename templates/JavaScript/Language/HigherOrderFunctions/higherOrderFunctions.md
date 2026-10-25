---
name: js-higher-order-functions
description: "Abstraction through higher-order functions in JavaScript: passing and returning functions, wrappers, filter/map/reduce/some/every/find, composing data pipelines, readability vs performance, and Unicode-safe string iteration with code points, based on Chapter 5 (Higher-Order Functions) of Eloquent JavaScript. Use when replacing loops with array methods, writing callbacks or function factories, grouping or counting data, choosing reduce vs a loop, or processing text with emoji or non-Latin characters."
---

# Higher-Order Functions

Raise the level of abstraction: express a computation in the vocabulary of the problem and pass the varying part as a function. Small named operations composed into a pipeline are easier to get right than one large loop.

## Abstraction

- Size breeds complexity, and complexity hides bugs. Code that says "sum of a range" is likelier to be correct than code full of counters.
- Notice when you are working at too low a level: if a reader must simulate a loop to see its purpose, extract the purpose into a named function.
- A higher-order function takes functions as arguments or returns them. It abstracts over actions, not just values.

## Kinds of higher-order functions

- Take an action: `repeat(n, action)`, `items.forEach(fn)`.
- Create functions: factories that close over configuration (`greaterThan(10)`).
- Wrap functions: add logging, timing, caching or retries without touching the original.
- Provide control flow: run a callback conditionally, repeatedly or later.

```js
const greaterThan = (limit) => (value) => value > limit;
const withTiming = (fn, log = console.log) => (...args) => {
  const start = performance.now();
  try { return fn(...args); }
  finally { log(`${fn.name} took ${performance.now() - start}ms`); }
};
```

## Standard array methods

- `filter(pred)`: new array with elements passing the test. Pure; does not change the original.
- `map(fn)`: new array of the same length with transformed elements.
- `reduce(combine, start)`: folds elements into one value. Always pass a start value: without it, an empty array throws and the first element's type leaks into the accumulator.
- `some(pred)` / `every(pred)`: array versions of `||` / `&&`; both short-circuit. `every` on an empty array is `true`.
- `find(pred)` / `findIndex` / `findLast`: first match or `undefined`/`-1`.
- `forEach(fn)`: side effects only; it returns `undefined` and cannot `break`. Use `for...of` when you need early exit or `await`.
- `flatMap`, `flat`, `Array.from(iterable, mapFn)` cover common reshaping.
- **Current note:** `Object.groupBy(items, keyFn)` and `Map.groupBy` replace hand-written group/count helpers; `toSorted` sorts without mutating.

```js
const activeTotal = orders
  .filter((o) => o.status === "active")
  .map((o) => o.amountCents)
  .reduce((sum, cents) => sum + cents, 0);

const byStatus = Object.groupBy(orders, (o) => o.status);
const counts = Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, v.length]));
```

## Composability and cost

- Pipelines of `filter`/`map`/`reduce` produce coherent intermediate values you can name, extract and test. One big loop entangles them.
- Name non-trivial callbacks (`isOverdue`, `toInvoiceLine`) instead of inlining long arrow bodies.
- Pipelines allocate intermediate arrays. That is almost always fine; switch to a single loop only for measured hot paths over large data.
- Avoid `reduce` when it obscures intent: building an object with `reduce` is often clearer as `Object.fromEntries(map(...))` or a `for...of` loop. Never mutate external state inside `map`/`filter`.
- Searching with `find`/`includes` inside a loop is O(n²); build a `Map` or `Set` index first for large inputs.

## Strings, code units and code points

- JavaScript strings are UTF-16. `length`, `str[i]` and `charCodeAt` work in 16-bit code units; characters outside the Basic Multilingual Plane (many emoji, rare CJK) occupy two units.
- `codePointAt(i)` returns the full code point starting at unit index `i`. `for...of` and `[...str]` iterate by code point, not by unit.
- Truncating or reversing with `slice`/`split("")` can cut a character in half. User-perceived characters (emoji with skin tones, flags, combining accents) can span several code points.
- **Current note:** use `Intl.Segmenter` for grapheme-correct counting and truncation; `str.normalize()` before comparing text; regex with the `u` or `v` flag for Unicode-aware matching.

```js
const text = "ok 👍🏽";
text.length;                 // 7 code units
[...text].length;            // 5 code points
const graphemes = [...new Intl.Segmenter().segment(text)].length; // 4
```

## Workflow

1. Describe the computation in words (keep active orders, take amounts, sum them); each verb becomes a method or named function.
2. Write predicates and transforms as small pure functions with clear names.
3. Chain array methods; give `reduce` an explicit start value.
4. Extract recurring patterns (count by, group by, index by) into reusable helpers, or use the standard ones.
5. Process text by code point (`for...of`) or grapheme (`Intl.Segmenter`), never by index, when it may contain non-ASCII.
6. Measure before replacing a readable pipeline with a manual loop.

## Red flags

- `map` used only for side effects (result ignored), or `forEach` with `async` callbacks expecting to be awaited.
- `reduce` without an initial value, or a `reduce` whose body is longer than the pipeline it replaces.
- Callbacks that mutate the array being iterated or outside state.
- Nested `find`/`filter` inside loops over large collections (quadratic work).
- `str.length`, `str[i]`, `split("")` or `slice` used to count, reverse or truncate user text.
- Long anonymous callbacks that hide business rules; wrapper functions that drop `this`, arguments or return values.

## Testing notes

- tdd: test predicates and transforms on their own; then test the composed pipeline with a few representative records.
- tdd: include empty collections (reduce start value, `every` = true) and no-match cases (`find` = undefined).
- Use injected callbacks (spies or simple arrays that record calls) to test higher-order functions and wrappers.
- Add text examples with emoji, accents and non-Latin scripts whenever code measures or cuts strings.
- bdd: data-table scenarios map naturally onto `filter`/`map` pipelines; keep the steps declarative.

## Related

- `../../Language/Functions/functions.md` — closures and pure functions underpinning callbacks.
- `../../Language/DataStructures/dataStructures.md` — arrays, objects, `Map`/`Set` used as inputs and indexes.
- `../../Language/ValuesTypesOperators/valuesTypesOperators.md` — strings and comparison basics.
- `../../Language/RegularExpressions/regularExpressions.md` — Unicode-aware text matching.
- `../../../CleanCode/Functions/functions.md` — abstraction levels and small functions.
- `../../../TDD/Patterns/DesignPatterns/designPatterns.md` — pluggable behavior and command-style patterns.
