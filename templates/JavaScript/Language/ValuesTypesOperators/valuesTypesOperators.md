---
name: js-values-types-operators
description: "JavaScript primitive values (number, string, boolean, null, undefined), operators, precedence, type coercion, strict equality, and short-circuit operators ||, && and ??, based on Chapter 1 (Values, Types, and Operators) of Eloquent JavaScript. Use when comparing values, choosing == vs ===, providing defaults, doing arithmetic with fractions or money, handling NaN or Infinity, building strings with template literals, or debugging an unexpected NaN, \"51\" or false."
---

# Values, Types, and Operators

Know exactly what type each value has and what each operator does to it. JavaScript converts types silently, so make conversions explicit, compare strictly, and pick the default operator (`??` vs `||`) that matches the values you really accept.

## Numbers

- One `number` type: 64-bit IEEE 754 float. Integers are exact only up to `Number.MAX_SAFE_INTEGER` (2^53 − 1, about 9 quadrillion).
- Fractions are approximations: `0.1 + 0.2 !== 0.3`. Never compare floats with `===`; compare with a tolerance, or use integer minor units (cents) for money.
- Special values: `Infinity`, `-Infinity`, `NaN`. `NaN` is a number, is not equal to itself, and spreads through every arithmetic step.
- Detect `NaN` with `Number.isNaN(x)`, not `x === NaN` and not the global `isNaN` (which coerces).
- `%` is remainder, not mathematical modulo: `-7 % 3 === -1`. Use `((n % m) + m) % m` for a non-negative result.
- Use `**` for powers; `Number.isInteger`, `Number.isSafeInteger` to validate.
- **Current note:** use `BigInt` (`123n`) for integers beyond 2^53 (IDs, counters from other systems); it does not mix with `number` in arithmetic. Numeric separators (`1_000_000`) improve readability.

```js
const approxEqual = (a, b, eps = Number.EPSILON * 8) => Math.abs(a - b) < eps;
approxEqual(0.1 + 0.2, 0.3); // true
const totalCents = 1999 + 1; // money as integers
```

## Strings

- Quotes `'`, `"` and backticks are equivalent for plain text; pick one convention (linter/prettier) and escape only when needed.
- Template literals interpolate (`${expr}`) and may span lines. Prefer them over `+` chains.
- Strings are immutable sequences of UTF-16 code units; `length` counts units, not characters (see higher-order functions skill).
- `<`/`>` compare by code unit: uppercase sorts before lowercase. For human ordering use `a.localeCompare(b)` or `Intl.Collator`.

## Booleans, null and undefined

- Comparisons and logical operators produce booleans.
- `undefined`: "no value was ever given" (missing argument, missing property, no `return`). `null`: "explicitly empty". Treat them as one "nullish" case unless an API distinguishes them.
- `typeof` gives a type name string; beware `typeof null === "object"` and `typeof [] === "object"` (use `Array.isArray`).

## Coercion and equality

- Operators silently convert operands: `"5" - 1 === 4`, `"5" + 1 === "51"`, `8 * null === 0`, `"five" * 2` is `NaN`.
- `+` prefers string concatenation if either side is a string. Convert input explicitly: `Number(str)`, `String(n)`, `Boolean(x)`.
- `==` applies complex conversion rules (`0 == false`, `"" == false`). Use `===`/`!==` by default.
- One accepted `==` idiom: `x == null` is true exactly for `null` and `undefined`. Use only if the team's lint config allows it; otherwise write `x === null || x === undefined` or rely on `??`.
- Falsy values: `false`, `0`, `-0`, `0n`, `NaN`, `""`, `null`, `undefined`. Everything else is truthy, including `"0"`, `"false"`, `[]` and `{}`.

```js
const quantity = Number(input.value);
if (!Number.isFinite(quantity)) throw new TypeError(`Invalid quantity: ${input.value}`);
```

## Logical and conditional operators

- `&&` and `||` return one of their operands, not necessarily a boolean, and short-circuit: the right side runs only if needed.
- `a || b` falls back for any falsy `a`, so it clobbers valid `0` and `""`. `a ?? b` falls back only for `null`/`undefined`. Default numeric and string settings with `??`.
- `cond ? a : b` evaluates only the chosen branch. Use it for choosing values, not for side effects; avoid nesting it.
- Precedence, low to high among common ones: `? :`, `??`/`||`, `&&`, comparisons, `+ -`, `* / %`, unary. Mixing `??` with `||`/`&&` requires parentheses (syntax error otherwise). When in doubt, parenthesize.
- **Current note:** logical assignment `a ??= b`, `a ||= b`, `a &&= b` assigns only when the operator would pick `b`.

```js
const pageSize = options.pageSize ?? 20; // 0 stays 0
const label = user.nickname || user.name; // "" falls back on purpose
config.retries ??= 3;
```

## Workflow

1. Identify the type of each operand at the boundary (form input, JSON, query string are strings).
2. Convert explicitly once, at the boundary, and validate (`Number.isFinite`, `Number.isInteger`).
3. Compare with `===`; for floats, compare with a tolerance; for text ordering, use `localeCompare`.
4. Choose `??` for defaults unless falsy values must also fall back; document that choice.
5. Parenthesize mixed logical/arithmetic expressions whose precedence a reader might doubt.

## Red flags

- `==` / `!=` anywhere except a deliberate `== null`.
- `value || default` where `value` can legitimately be `0`, `""` or `false`.
- `x === NaN`, global `isNaN(str)`, or arithmetic on unparsed strings.
- Money or quantities stored as fractional floats; float equality checks.
- `parseInt(x)` without radix, or `parseInt` used to truncate numbers (use `Math.trunc`).
- Sorting or comparing user-visible strings with `<` instead of `localeCompare`.
- Truthiness checks on arrays/objects expecting emptiness (`if (list)` is true for `[]`).

## Testing notes

- tdd: write examples for boundary values: `0`, `-0`, `""`, `null`, `undefined`, `NaN`, `Infinity`, `2**53`, strings that look like numbers.
- tdd: assert floats with a tolerance (`assert.ok(Math.abs(a - b) < eps)` or the framework's `toBeCloseTo`).
- Use strict assertions (`assert.strictEqual`, `toBe`) so coercion cannot make a test pass.
- bdd: acceptance criteria for numeric input should cover non-numeric, empty and zero input explicitly.

## Related

- `../../Language/ProgramStructure/programStructure.md` — converting input before branching on it.
- `../../Language/DataStructures/dataStructures.md` — identity vs value equality for objects.
- `../../Language/HigherOrderFunctions/higherOrderFunctions.md` — strings, code units and code points.
- `../../Language/BugsAndErrors/bugsAndErrors.md` — strict mode and failing fast on bad input.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — validating at boundaries.
- `../../../TDD/Patterns/TDDPatterns/tddPatterns.md` — evident data and boundary examples.
