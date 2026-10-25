---
name: js-program-structure
description: "Expressions vs statements, side effects, bindings (const, let, var), naming, conditionals, loops, break/continue, switch, compound assignment, semicolons and comments, based on Chapter 2 (Program Structure) of Eloquent JavaScript. Use when declaring variables, choosing const vs let, writing if/else chains or switch dispatch, writing or reviewing loops and their exit conditions, converting user input before branching, or naming bindings."
---

# Program Structure

Build programs from small expressions combined into clear statements. Bind values with `const` unless they must change, keep control flow shallow and explicit, and make every loop's exit condition obvious.

## Expressions, statements, side effects

- An expression produces a value; a statement does something. A statement that neither produces a side effect nor changes state is dead code.
- Separate value-producing code from effect-producing code; it makes both easier to test.
- End statements with semicolons, or adopt a no-semicolon style enforced by a formatter. Never rely on memory of automatic semicolon insertion: a line starting with `(`, `[` or a template literal can join the previous line.

## Bindings

- Bindings grasp values; they do not contain them. Two bindings may refer to the same value.
- `const` by default; `let` only when the binding is reassigned. `const` prevents reassignment, not mutation of the object it refers to.
- Do not use `var`: it is function-scoped, hoisted, and allows silent redeclaration.
- A declared but unassigned `let` holds `undefined`; prefer declaring at first meaningful assignment.
- One binding per declaration reads better in diffs than `let a = 1, b = 2`.

```js
const MAX_ATTEMPTS = 3;          // fixed value
let attempts = 0;                // changes over time
const user = { name: "Ana" };
user.name = "Bia";               // allowed: const binds, it doesn't freeze
```

## Names

- camelCase for bindings and functions, PascalCase for classes/constructors, UPPER_SNAKE_CASE for true module-level constants.
- Names may contain letters, digits, `$`, `_`, and must not start with a digit or be a reserved word.
- Name by role in the problem, not by type (`unpaidInvoices`, not `arr2`).

## The environment and calls

- The environment is the set of bindings in scope, including host globals (`console`, `window`, `process`). Do not shadow or reassign globals.
- A function call is an expression; nest calls freely when the result reads well, otherwise name intermediate values.
- Convert input explicitly before using it (`Number(text)`), then validate (`Number.isNaN`).

## Conditionals

- Always use braces for multi-line bodies; a single-line `if (x) return;` guard is fine if the team allows it.
- Prefer early returns (guard clauses) over deep nesting.
- `else if` chains test in order; put the most specific case first and end with a clear default.
- `switch` compares with `===` and falls through until `break`. Every case must end in `break`, `return` or `throw`; mark intentional fall-through with a comment. Often a lookup object or `Map` reads better.

```js
const shippingFor = { standard: 5, express: 15, pickup: 0 };
function shippingCost(method) {
  const cost = shippingFor[method];
  if (cost === undefined) throw new RangeError(`Unknown method: ${method}`);
  return cost;
}
```

## Loops

- `for (init; test; update)` keeps all loop state in one place; use it for counted loops.
- `while` when the number of iterations is unknown; `do...while` when the body must run at least once (retry until valid).
- Count from 0 and use `<` with lengths; off-by-one errors come from mixing `<=` and 1-based counts.
- Every loop needs a reachable exit. A `for (;;)` or `while (true)` must contain an obvious `break` or `return`.
- `break` leaves the innermost loop; `continue` skips to the next iteration. Use them sparingly; a well-named helper with `return` is often clearer.
- Use compound assignment (`+=`, `*=`, `++`) for updates; avoid `++` inside larger expressions.
- **Current note:** for arrays and other iterables prefer `for...of` or array methods over index loops; use `x ** n` instead of loops for powers.

## Formatting and comments

- Consistent indentation shows structure; let the formatter (Prettier/ESLint) decide, not individual taste.
- `//` for line comments, `/* */` for blocks. Comment why, not what; code that needs a "what" comment usually needs a better name or a function.

## Workflow

1. Decide which bindings change; declare the rest `const`.
2. Convert and validate inputs at the top; return early on invalid cases.
3. Pick the loop form that fits: counted (`for`), condition-driven (`while`), at-least-once (`do`), collection (`for...of`).
4. Write the exit condition before the body; check it terminates for empty and boundary inputs.
5. Replace long `if/else` or `switch` dispatch on a value with a lookup table when cases only map values.
6. Run the formatter and linter; resolve warnings rather than disabling them.

## Red flags

- `var`, or `let` for a binding never reassigned.
- Missing `break` in a `switch` case without a fall-through comment.
- Loops whose exit depends on a variable changed in several places, or `while (true)` with a buried `break`.
- `<=` with `.length` (off-by-one), or 1-based counters indexing arrays.
- Deeply nested `if` blocks instead of guard clauses.
- Statements with no effect (unused expression results), commented-out code, comments restating code.
- Lines starting with `(` or `[` in no-semicolon code.

## Testing notes

- tdd: drive each branch of a conditional with its own example; include the default/else branch.
- tdd: for loops, test zero, one and many iterations, and the boundary where the exit condition flips.
- Keep side effects (logging, prompts, I/O) out of the logic under test so tests assert on returned values.
- bdd: each `else if` arm usually maps to a scenario outline row; make the default case an explicit scenario.

## Related

- `../../Language/ValuesTypesOperators/valuesTypesOperators.md` — conversions and equality used in conditions.
- `../../Language/Functions/functions.md` — block scope and extracting loops into functions.
- `../../Language/DataStructures/dataStructures.md` — `for...of` over arrays.
- `../../../CleanCode/MeaningfulNames/namingRules.md` — naming bindings.
- `../../../CleanCode/Formatting/formatting.md` — indentation and vertical layout.
- `../../../CleanCode/Comments/comments.md` — when a comment is justified.
