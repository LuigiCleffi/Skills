---
name: tdd-green-bar-patterns
description: The four ways to make a failing test pass (Fake It, Triangulate, Obvious Implementation, One to Many) and how to choose step size, based on Chapter 28 (Green Bar Patterns) of Test-Driven Development: By Example. Use when a test is red and you must decide the first implementation, the user asks whether returning a constant is cheating, the right abstraction is unclear, an "obvious" implementation keeps failing, or an operation must work over a collection.
---

# Green Bar Patterns

Treat a red bar as a condition to fix as fast as possible. Get to green by the quickest honest route, even with code you would not keep for more than an hour, then clean it up under green. Shift gears with confidence: Obvious Implementation when sure, Fake It or Triangulate when not.

## Fake It ('Til You Make It)

**Question:** What is your first implementation once you have a broken test? **Answer:** Return a constant. Once the test passes, gradually turn the constant into an expression using variables.

```ts
// test
expect(summary(result)).toBe("1 run, 0 failed");
// step 1: return "1 run, 0 failed";
// step 2: return `${result.runCount} run, 0 failed`;
// step 3: return `${result.runCount} run, ${result.failureCount} failed`;
```

- Like placing a piton above your head: you are not there yet, but you are safe while you climb.
- Something running beats nothing running, especially with a test to prove it; faking fast sometimes reveals that the test itself is wrong before you invest in the real solution.
- Psychological effect: green tells you exactly where you are, so you can refactor with confidence.
- Scope control: starting from a concrete example and generalizing keeps you from being distracted by imagined future problems.
- It does not violate "write no unneeded code": the refactoring step removes the duplication of data between test and code, replacing each constant with the value it was derived from.

## Triangulate

**Question:** How do you most conservatively drive abstraction with tests? **Answer:** Abstract only when you have two or more examples.

```ts
it("adds", () => {
  expect(plus(3, 1)).toBe(4);
  expect(plus(3, 4)).toBe(7); // second example forces the general code
});
const plus = (augend: number, addend: number) => augend + addend;
```

- With one assertion, `return 4` passes. The second example makes the constant impossible and forces the general form.
- The rules feel clear, but they loop: once general, one assertion is redundant; delete it and the constant would pass again.
- Use Triangulate only when you are truly unsure of the right abstraction. Otherwise use Obvious Implementation or Fake It.

## Obvious Implementation

**Question:** How do you implement simple operations? **Answer:** Just implement them.

- Fake It and Triangulate are tiny steps; there is no special virtue in them. If you know what to type and can type it quickly, do it.
- Relying only on Obvious Implementation demands perfection. Solving "clean" and "works" at once can be too much: get back to "works" as soon as possible, then solve "clean".
- Track how often Obvious Implementation surprises you with red, especially off-by-one and sign errors. Repeated "now I'm sure" failures mean shift down to Fake It or Triangulate.
- It is a second gear: be ready to downshift when your head writes checks your fingers cannot cash.

## One to Many

**Question:** How do you implement an operation that works on a collection? **Answer:** Implement it without the collection first, then make it work with the collection.

```ts
// 1. single value
expect(sum(5)).toBe(5);              // sum = (v) => v
// 2. add the collection parameter alongside (Isolate Change)
expect(sum(5, [5])).toBe(5);         // still returns v
// 3. implement with the collection, ignoring v
// 4. drop the single-value parameter
expect(sum([5])).toBe(5);
// 5. enrich the test as planned
expect(sum([5, 7])).toBe(12);
```

- Adding the parameter in the test first lets you change the implementation without touching the test; removing the old parameter lets you change the test without touching the implementation. Both are Isolate Change.
- Every step stays green.

## Choosing a pattern

| Situation | Use |
|---|---|
| You know the code and can type it now | Obvious Implementation |
| You do not know how yet, or want green right now | Fake It, then refactor away the constant |
| The right abstraction is genuinely unclear | Triangulate with a second example |
| Operation over a collection | One to Many, starting from a single item |
| Obvious Implementation went red unexpectedly | Revert and downshift to Fake It |

## Workflow

1. Read the failing test. Decide your gear: obvious, fake or triangulate.
2. Make it green with the smallest change that passes; ugly is acceptable briefly.
3. Run the tests. If an obvious implementation fails, revert and take a smaller step.
4. Refactor under green: replace constants with the expressions they stand for, removing duplication between test and code.
5. If a constant still passes but feels wrong and you cannot see the generalization, add a second example (Triangulate).
6. For collections, grow from one to many through green intermediate steps.

## Red flags

- Staying red while designing the "real" solution.
- Fake It constants left in the code after the refactor step (duplication with the test never removed).
- Triangulating trivial operations everywhere, or keeping redundant assertions after generalizing.
- Long chains of "obvious" implementations that keep failing without downshifting.
- Off-by-one or sign errors in code written in one big step.
- Rewriting an operation and its tests for collections in one change instead of through single-item steps.

## Related

- `../RedBarPatterns/redBarPatterns.md` — Break, the step after Fake It and Triangulate stop helping.
- `../TestingPatterns/testingPatterns.md` — Child Test when green is too far away.
- `../TDDPatterns/tddPatterns.md` — Evident Data, which shows the expression to fake toward.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — removing duplication during refactor.
- `../../../CleanCode/UnitTests/unitTests.md` — the red/green/refactor laws.
