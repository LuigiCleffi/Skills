---
name: js-data-structures
description: "Objects and arrays in JavaScript: properties, dot vs bracket access, methods, mutability and identity, copying, array and string methods, rest/spread, destructuring, optional chaining, Math, and JSON serialization, based on Chapter 4 (Data Structures: Objects and Arrays) of Eloquent JavaScript. Use when modeling records or collections, choosing object vs array vs Map/Set, copying or comparing objects, mutating vs returning new arrays, destructuring parameters, reading possibly missing properties, or serializing data to JSON."
---

# Data Structures: Objects and Arrays

Choose a representation that makes the common operations short and obvious. Treat objects as shared references: know who may mutate them, copy deliberately, and compare by value only with an explicit function.

## Choosing a representation

- Arrays: ordered sequences of conceptually identical items, indexed from 0.
- Plain objects: records with a fixed, known set of named properties.
- `Map`: dictionaries with dynamic or non-string keys, frequent add/remove, or iteration in insertion order. `Set`: unique membership.
- Do not encode structured data in strings ("2 3 5 7") or parallel arrays; give each record one object.
- Pick the representation that makes the expressions using it simplest; a compact array can be fine when indices have a clear meaning, but name the parts on access (destructuring).

## Properties

- `obj.name` uses the literal name; `obj[expr]` evaluates `expr` and converts it to a string key. Use brackets for computed keys and names that are not identifiers.
- Reading a missing property gives `undefined`; reading any property of `null`/`undefined` throws `TypeError`.
- `"key" in obj` checks existence (including inherited); `Object.hasOwn(obj, key)` checks own properties. Setting to `undefined` is not deleting.
- Avoid `delete` on hot objects and records with a fixed shape; build a new object without the key instead.
- `Object.keys`, `Object.values`, `Object.entries` list own enumerable properties; `Object.fromEntries` rebuilds an object.
- Shorthand `{ name, total }` and computed keys `{ [field]: value }` keep literals short.

## Mutability and identity

- Primitives (numbers, strings, booleans) are immutable. Objects and arrays are mutable and passed by reference.
- `===` on objects compares identity: two objects with the same content are not equal. Write or import a deep-equality function when you need value comparison.
- `const` freezes the binding, not the object. Use `Object.freeze` (shallow) when a value must not change.
- Prefer returning new objects/arrays over mutating arguments; if a function mutates, make it obvious in its name and contract.
- **Current note:** use non-mutating array methods `toSorted`, `toReversed`, `toSpliced`, `with(i, v)` (ES2023) instead of `sort`/`reverse`/`splice` on shared arrays. Use `structuredClone(value)` for deep copies of plain data; spread copies only one level.

```js
const order = { id: 7, items: [{ sku: "A", qty: 1 }] };
const shallow = { ...order };           // shares items array
const deep = structuredClone(order);    // independent copy
const updated = { ...order, items: order.items.map((i) => ({ ...i, qty: i.qty + 1 })) };
```

## Array essentials

- End: `push`/`pop` (stack). Start: `unshift`/`shift` (queue; `shift` is O(n) on large arrays).
- Search: `includes` (boolean, handles `NaN`), `indexOf`/`lastIndexOf` (-1 when absent), `find`/`findIndex`/`findLast` with a predicate.
- Copy ranges with `slice(start, end)` (end exclusive, negative indices count from the end); combine with `concat` or spread.
- **Current note:** `arr.at(-1)` reads the last element; `Array.from({ length: n }, (_, i) => ...)` builds ranges.
- Iterate with `for (const item of items)`; avoid `for...in` on arrays (it yields string keys and inherited properties).

## String essentials

- Strings are immutable; every method returns a new string. Assigning properties to a string silently does nothing.
- `slice`, `indexOf` (accepts substrings), `includes`, `startsWith`, `endsWith`, `trim`, `padStart`, `split`, `join`, `repeat`, `toUpperCase`.
- **Current note:** `replaceAll` and `at` are available; prefer them over regex tricks for literal replacements.

## Rest, spread, destructuring

- Rest parameter `(...values)` collects remaining arguments into a real array; prefer it over `arguments`.
- Spread `f(...xs)`, `[...a, ...b]`, `{ ...defaults, ...overrides }` (later keys win). Spreading huge arrays into a call can exceed argument limits.
- Destructure arrays `[first, second]` and objects `{ name, age = 0 }`, including in parameter lists. Destructuring `null`/`undefined` throws; give a default (`= {}`).

```js
function summarize({ name, tags = [] } = {}) {
  const [primary = "none", ...others] = tags;
  return `${name}: ${primary} (+${others.length})`;
}
```

## Optional chaining

- `a?.b`, `a?.[k]`, `fn?.()` short-circuit to `undefined` when the left side is `null`/`undefined`.
- Use it for genuinely optional data; combine with `??` for a default. Do not sprinkle it over data that must exist; that hides bugs instead of failing fast.

## Math namespace

- `Math` groups numeric helpers (`max`, `min`, `floor`, `ceil`, `round`, `trunc`, `abs`, `sqrt`, `random`, `PI`) to avoid polluting the global scope; follow the same idea with modules.
- `Math.floor(Math.random() * n)` gives an integer in `[0, n)`. `Math.random` is not cryptographically secure; use `crypto.getRandomValues` or `crypto.randomUUID` for tokens and IDs.

## JSON

- `JSON.stringify` / `JSON.parse` serialize plain data: double-quoted keys, no functions, comments, `undefined`, `Date` objects (become strings), `Map`/`Set` (become `{}`), `BigInt` (throws).
- `JSON.parse` throws on invalid input; wrap it at trust boundaries and validate the shape of the result.
- `JSON.stringify(value, null, 2)` for readable output.

## Workflow

1. List the operations the code needs (lookup by key, ordered iteration, membership, append) and pick the structure that makes them direct.
2. Define record shapes once (factory function, class, or TypeScript type); keep property names consistent.
3. Decide ownership: who may mutate. Default to returning new values.
4. Use destructuring and defaults at function boundaries; validate required fields.
5. Copy with spread for one level, `structuredClone` for deep plain data.
6. Serialize only plain data; parse and validate JSON at boundaries.

## Red flags

- Mutating a function argument or shared state without saying so; `sort()`/`reverse()` on arrays received from callers.
- Comparing objects or arrays with `===` expecting content equality; `JSON.stringify(a) === JSON.stringify(b)` as deep equality (key order dependent).
- Shallow copy where nested data is later mutated.
- `for...in` over arrays; `obj[key]` lookups on plain objects with user-controlled keys (`__proto__`); use `Map` or `Object.create(null)`.
- Deep optional chains (`a?.b?.c?.d`) on data that is required.
- Unchecked `JSON.parse` of external input.
- Data packed into strings or index-coded arrays without named access.

## Testing notes

- Use deep-equality assertions (`assert.deepStrictEqual`, `toEqual`) for value comparison and identity assertions (`toBe`) only when identity matters.
- tdd: assert that pure functions do not mutate inputs (freeze the input with `Object.freeze` in the test, or compare against a copy).
- tdd: include empty arrays, missing optional properties and `null` inputs in examples.
- bdd: build test data with small factory functions so scenarios state only the fields that matter.

## Related

- `../../Language/Functions/functions.md` — pure functions and avoiding side effects on arguments.
- `../../Language/HigherOrderFunctions/higherOrderFunctions.md` — `map`, `filter`, `reduce` over arrays.
- `../../Language/ValuesTypesOperators/valuesTypesOperators.md` — primitives, equality and coercion.
- `../../Language/SecretLifeOfObjects/secretLifeOfObjects.md` — prototypes, classes, `Map` and iterators.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — data structures vs objects.
- `../../../TDD/Patterns/TestingPatterns/testingPatterns.md` — building test data.
