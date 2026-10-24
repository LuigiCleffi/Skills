---
name: tdd-mixed-currencies
description: "Landing the original goal test when it will not compile in one step, by backing off to a more specific version, then generalizing declarations from the leaves back to the test while following the compiler, based on Chapter 15 (Mixed Currencies) of Test-Driven Development: By Example. Use when the test you want triggers a cascade of compile errors, when generalizing a concrete type to an interface across many signatures, when a type change ripples through the codebase, or when stubs are needed to get back to compiling."
---

# Mixed Currencies

Write the test you actually want. If it cannot compile and run quickly, back off to a more specific version that can run in one step, make it pass, then generalize the declarations from the edges inward until the original test compiles. Let the compiler's errors serve as the to-do list for the cascade.

## Back off, then generalize

- The goal test uses the abstract type everywhere; the code still has concrete types in many signatures. Changing all at once means many compile errors at once.
- Instead, write the same scenario with concrete types so it compiles now. It runs, and it may fail on real behavior; fix that first.

```ts
test("mixed addition", () => {
  const fiveBucks: Money = Money.dollar(5);   // later: Expression
  const tenFrancs: Money = Money.franc(10);   // later: Expression
  const bank = new Bank();
  bank.addRate("CHF", "USD", 2);
  expect(bank.reduce(fiveBucks.plus(tenFrancs), "USD")).toEqual(Money.dollar(10));
});
```

- Here the failure was real (15 instead of 10): the composite was not reducing its parts. Fix behavior before touching types.

## Generalize from the leaves to the root

- Avoid ripple by starting at the edges: fields and constructor parameters of the composite, then method parameters and return types on the value object, and only then the declarations in the test.
- When a structure starts to resemble a known pattern (Composite), note it but do not generalize until a test asks for it.

## Follow the compiler

- After changing a declaration in the test, each compile error names the next required change (an operation missing from the interface, a method that must become public).
- Satisfy errors one at a time. Where a real implementation is not yet driven by a test, add a stub and put it on the Test List.

## Workflow

1. Write the goal test exactly as you want it to read.
2. If it does not compile quickly, rewrite it with more specific types so it runs in one step.
3. Make it pass; fix any real behavioral gap it exposes.
4. Generalize declarations starting at the leaves (fields, constructor parameters), running tests each time.
5. Move outward to method signatures, then to the test's own declarations.
6. Follow each compile error; stub what is not yet tested and add it to the list.
7. Confirm all tests pass with the goal test in its intended form.

## Red flags

- Living with dozens of compile errors while trying to fix them all at once.
- Generalizing types before the concrete scenario passes.
- Starting the generalization at the test and fighting the ripple inward.
- Stubs added to satisfy the compiler but missing from the Test List.
- Introducing a full pattern because the code looks a bit like it.

## Related
- `../Change/change.md` — the conversion behavior this test combines.
- `../AbstractionFinally/abstractionFinally.md` — implementing the stubs left on the list here.
- `../../Patterns/RedBarPatterns/redBarPatterns.md` — One Step Test and Test List.
- `../../Patterns/DesignPatterns/designPatterns.md` — Composite.
- `../../Patterns/Refactoring/refactoring.md` — Isolate Change and Extract Interface.
- `../../../CleanCode/Classes/classes.md` — depending on abstractions.
