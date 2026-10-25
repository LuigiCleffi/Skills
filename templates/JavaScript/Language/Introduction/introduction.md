---
name: js-introduction
description: "How to approach JavaScript as a language: express programs in problem vocabulary, respect the language's permissiveness, target the right ECMAScript version and runtime, and verify by running code, based on the Introduction of Eloquent JavaScript. Use when starting work on a JavaScript or TypeScript codebase, choosing the language level or runtime target, deciding how much to rely on lint and tests to catch silent errors, or judging whether code reads at the right level of abstraction."
---

# Introduction: Programming in JavaScript

Write programs that do not confuse the programmer. Express the solution in the vocabulary of the problem, not in counters and jumps, and treat JavaScript's tolerance for odd input as a reason to add guard rails, not as permission to be loose.

## Programs are buildings of thought

- Complexity grows with size; the core skill is keeping a program understandable as it grows.
- The best code does something interesting while staying easy to read. Prefer clarity over cleverness by default.
- Rules ("best practices") are tools, not a cage. Apply them with judgment; new problems may need new shapes. Taste comes from practice and from making (and recognizing) mistakes.
- The same computation can be written at many levels. A loop with a counter and an accumulator says *how*; `sum(range(1, 10))` says *what*.

```js
// Low level: the reader must simulate the loop to see the intent
let total = 0;
for (let n = 1; n <= 10; n++) total += n;

// Problem vocabulary: intent is visible, details live in small named helpers
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const sum = (numbers) => numbers.reduce((acc, n) => acc + n, 0);
const total2 = sum(range(1, 10)); // 55
```

## What a good language buys you

- It takes care of uninteresting details (jumps, temporary comparisons).
- It provides building blocks (`while`, `console.log`) and lets you define your own (`sum`, `range`).
- It makes those blocks easy to compose. Design your own functions so they compose the same way: take values, return values.

## JavaScript's character

- JavaScript and Java are unrelated; do not carry Java assumptions (classes everywhere, checked types, integer types) into JS.
- ECMAScript is the standard; "JavaScript" and "ECMAScript" name the same language. Since 2015 there is a new edition every year.
- The language is very liberal: it accepts almost anything and silently interprets it, often not as intended. Problems surface late, far from their cause.
- Countermeasures: strict mode (automatic in ES modules and classes), a linter, TypeScript or JSDoc types where the project uses them, and tests that run the code.
- Backward compatibility is sacred: old code keeps running, so legacy idioms (`var`, `==`, `arguments`) remain legal. Their legality is not a recommendation.
- **Current note:** the book targets ECMAScript 2024. Check the project's real target (`browserslist`, `tsconfig` `target`/`lib`, Node `engines`) before using recent features such as `Object.groupBy`, `Array.prototype.toSorted`, or `Promise.withResolvers`.

## Runtimes

- The same language runs in browsers, Node.js (and Deno/Bun), and as a scripting language inside some databases and tools.
- Core language features are shared; I/O, modules loading, globals (`window`, `document`, `process`) differ by host. Know which host a file is written for before using host APIs.
- Code meant to run in several hosts should depend only on the language core and inject host capabilities.

## Learn by running code

- Do not assume you understand code until you have run it. Read examples attentively; write and execute your own.
- Use a REPL (`node`, browser console) or a quick test to check a hypothesis about language behavior before relying on it.
- The `// → value` convention (show the expected output beside the expression) is a good habit in examples, docs, and test names.

## Workflow

1. Identify the runtime (browser, Node, both) and the language level the project targets.
2. Confirm guard rails are on: ES modules or `"use strict"`, linter, type checking if configured.
3. State the problem in its own vocabulary; sketch the top-level code as calls to well-named functions.
4. Implement each helper at a lower level, small enough to be obviously correct.
5. Run the code (tests or REPL) after each small step; do not reason about behavior you can observe.
6. Revisit names and levels of abstraction once it works.

## Red flags

- One long function mixing counters, indexes and business intent.
- "It compiled, so it works": JavaScript rarely refuses code; absence of errors proves little.
- Using a host API (`document`, `fs`, `process`) in code meant to be shared across runtimes.
- Using a language feature newer than the project's target without a polyfill or transpile step.
- Following a rule mechanically where it makes the code harder to read.

## Testing notes

- tdd: because JS fails silently, a fast test loop is the main safety net; write the expectation (`// →`) first, then the code.
- tdd: test the high-level vocabulary (`sum`, `range`) directly; each small helper gets its own focused tests.
- bdd: scenarios should speak problem vocabulary; step definitions are the place where low-level JS details live.
- Run tests in the same runtime the code targets (Node vs. browser/jsdom) to avoid host-specific false greens.

## Related

- `../../Language/ValuesTypesOperators/valuesTypesOperators.md` — the silent coercions this permissiveness causes.
- `../../Language/ProgramStructure/programStructure.md` — statements, bindings, and control flow.
- `../../Language/HigherOrderFunctions/higherOrderFunctions.md` — building problem vocabulary through abstraction.
- `../../../CleanCode/Functions/functions.md` — one level of abstraction per function.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — keep the design simple enough to be obviously correct.
- `../../../TDD/Patterns/TDDPatterns/tddPatterns.md` — learning tests and short feedback loops.
