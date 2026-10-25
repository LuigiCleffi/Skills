---
name: js-project-programming-language
description: "Design lessons for small parsers, interpreters, and domain-specific languages: syntax trees, recursive descent, evaluator dispatch, special forms, scope chains, and closures, based on Chapter 12 (Project: A Programming Language) of Eloquent JavaScript. Use when building or reviewing a parser, expression evaluator, rule engine, template or query mini-language, config DSL, or any code that walks a recursive tree."
---

# Project: A Programming Language

Treat a language as an ordinary program: a parser turns text into a tree of plain data, an evaluator walks that tree against a scope, and a small table of special forms controls evaluation order. Keep the three pieces separate, make errors precise, and never evaluate untrusted input with `eval` or `Function`.

## Separate parsing from evaluation

- The parser's only job is to produce a syntax tree (AST) or throw a `SyntaxError`. The evaluator's only job is to compute a value from a tree and a scope. Merging them makes both harder to test and extend.
- An AST of plain objects with a `type` discriminator (`"value"`, `"word"`, `"apply"`) is easy to log, snapshot, serialise, and transform before running (optimise, compile, lint).
- A uniform syntax (everything is an expression, operators are just names) keeps the parser tiny; each extra syntactic form costs parser code and tests.

```js
// shape of one node
{ type: "apply", operator: { type: "word", name: ">" },
  args: [{ type: "word", name: "x" }, { type: "value", value: 5 }] }
```

## Recursive descent

- Let the parser's structure mirror the grammar: one function per construct, calling each other recursively where the grammar nests.
- Each parse function consumes input and returns `{ node, rest }` (or advances a position index). Returning the remainder keeps functions pure and composable.
- Match atoms with sticky or anchored regexes (`/^\d+\b/`, or the `y` flag with `lastIndex`) and skip whitespace (and comments) in one helper so every call site benefits.
- After parsing the top-level expression, assert that only whitespace remains; otherwise trailing garbage is silently ignored.
- Track position (offset, line, column) in nodes and errors. "Unexpected syntax" without a location is a poor developer experience.
- **Current note:** for anything beyond a toy, slicing strings repeatedly is O(n²); advance an index instead, or use a tokenizer.

## Evaluator dispatch

- Dispatch on `node.type` with a `switch` or a lookup table; throw on unknown types rather than returning `undefined`.
- Look names up with a membership check and throw `ReferenceError` for undefined bindings; check that callees are functions and throw `TypeError` otherwise.
- Ordinary calls evaluate all arguments first, then apply. Constructs that must control evaluation (`if`, `while`, `and`, `define`) are **special forms**: they receive unevaluated argument nodes plus the scope.
- Keep special forms in a registry (`Object.create(null)` or a `Map`) so adding a construct is adding an entry, not editing the evaluator (open/closed).
- Validate arity and argument shapes inside each special form and throw `SyntaxError` with a clear message.

```js
const specialForms = new Map([
  ["if", ([cond, then, otherwise], scope) =>
    evaluate(cond, scope) !== false ? evaluate(then, scope) : evaluate(otherwise, scope)],
]);
```

## Scope and closures

- Represent nested scopes as a chain: each function call creates a child scope whose parent is the scope where the function was **defined**, not where it is called. That single rule produces lexical closures.
- Prototype chains (`Object.create(parentScope)`) give lookup-through-parents for free, but `in` then sees inherited names and assignment always writes locally. Use `Object.hasOwn` to find the owning scope when implementing assignment to an outer binding.
- Distinguish *define* (create in the current scope) from *set* (update the nearest existing binding, `ReferenceError` if none). Conflating them silently shadows outer variables.
- Use null-prototype objects or `Map` for scopes so names like `constructor` or `__proto__` do not collide with `Object.prototype`.

## Host values and safety

- Reusing host (JavaScript) values and functions for the guest language is a cheap, effective shortcut; document which host semantics leak through (number precision, truthiness).
- Be explicit about truthiness rules; a DSL that treats only `false` as false differs from JavaScript and must be tested at the boundary.
- Never feed user-supplied text to `eval` or `new Function`. Building operator functions from a fixed, trusted list is acceptable; building them from input is code injection.
- Bound recursion depth and loop iterations when evaluating untrusted programs.

## Compile when it pays

- Interpretation walks the tree on each run; compilation does work ahead of time (resolve bindings to slots, translate to JavaScript, precompute constants). Reach for it only after measuring.
- Many real problems are small languages in disguise: rule engines, filter/query strings, templating, feature-flag expressions, routing patterns. Recognising that lets you write a grammar, a parser and an evaluator instead of a pile of string `if`s.
- Before writing one, check whether JSON, an existing expression library, or plain JavaScript configuration would do.

## Workflow

1. Write the grammar (even informally) and example programs with expected trees and values.
2. Define the AST node shapes as plain objects with a `type` field.
3. Implement the parser by recursive descent, one function per rule, with positioned `SyntaxError`s and an end-of-input check.
4. Implement the evaluator as a dispatch on node type, plus a special-forms registry for evaluation-controlling constructs.
5. Model scopes as a parent chain created at function definition time; add separate define and set.
6. Add built-ins to a root scope; keep it immutable per run (`Object.create(root)` for each program).
7. Harden: depth limits, no `eval` on input, clear errors with locations.

## Red flags

- Parser that also executes, or evaluator that re-parses strings.
- Regex-only "parsing" of nested structures (parentheses, quotes).
- Errors without position, or `undefined` returned for unknown nodes or names.
- Scope as a plain `{}` (inherits `Object.prototype` keys) or a single global map without nesting.
- Functions capturing the caller's scope instead of the definition scope (dynamic scoping by accident).
- `eval`/`Function` applied to input text.
- Assignment that creates a local when the user meant to update an outer binding.

## Testing notes

- Unit-test the parser and evaluator separately: text → expected AST, AST → expected value. Table-driven tests suit both.
- Write failing tests first for each error case (unbalanced parentheses, trailing text, undefined name, wrong arity, calling a non-function).
- Cover closures and shadowing explicitly; they are where scope bugs surface.
- For a user-facing DSL, express acceptance examples as Gherkin tables of input program and expected result.

## Related

- `../RegularExpressions/regularExpressions.md` — anchored and sticky matching for tokens.
- `../Functions/functions.md` — lexical scope and closures in JavaScript itself.
- `../DataStructures/dataStructures.md` — trees of plain objects.
- `../BugsAndErrors/bugsAndErrors.md` — `SyntaxError`, `ReferenceError`, `TypeError`.
- `../../Browser/DocumentObjectModel/documentObjectModel.md` — the DOM as another tree to walk recursively.
- `../../../TDD/Patterns/TestingPatterns/testingPatterns.md` — child tests for parser rules.
- `../../../CleanCode/Functions/functions.md` — one function per rule, one level of abstraction.
