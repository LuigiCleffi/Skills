---
name: tdd-degenerate-objects
description: "The three-phase TDD cycle (write a test, make it run, make it right) and choosing between Fake It and Obvious Implementation to reach green, based on Chapter 2 (Degenerate Objects) of Test-Driven Development: By Example. Use when deciding how much code to write to pass a test, when an expected red turns up unexpectedly, when an object mutates on an operation and should not, or when a design dislike (side effects, aliasing) should become a test."
---

# Degenerate Objects

Aim for clean code that works, and get there in two moves: first make it work, then make it clean. Reach green fast with either a fake or the obvious real code, and shift down to fakes the moment a test surprises you.

## The cycle

1. **Write a test.** Imagine how the operation should look in code and invent the interface you want. Include every element you think the answer needs.
2. **Make it run.** Getting to green quickly dominates everything else. If the clean solution is obvious and quick, type it. If it is obvious but will take a while, note it and get green in seconds another way.
3. **Make it right.** With the behavior in place, remove the duplication and shortcuts you introduced, keeping the bar green.

This is the reverse of architecture-first development, where you design the clean structure first and then struggle to fit in what you learn while making it work.

## Two ways to green

- **Fake It ('Til You Make It).** Return a constant, then replace constants with variables until the code is real.
- **Obvious Implementation.** Type the real implementation and run the tests to confirm that what is obvious to you is also obvious to the computer.

Switch between them by confidence. Chain Obvious Implementations while things go well. On an unexpected red, back up, fake it, and refactor to the real code. Return to Obvious Implementation once confidence is back. A third strategy, Triangulate, comes in the next chapter.

## Turn a design feeling into a test

If something bothers you (here, an operation that mutates its receiver), express it as a test that fails because of that problem. Then the design talk becomes about concrete cases instead of opinions.

```typescript
test("multiplying does not change the original", () => {
  const five = new Dollar(5);
  expect(five.times(2).amount).toBe(10);
  expect(five.times(3).amount).toBe(15); // fails if times() mutates
});

// Obvious Implementation: return a new object
times(multiplier: number): Dollar {
  return new Dollar(this.amount * multiplier);
}
```

Changing the interface (here, `times` now returns a value) means changing the test. That is fine: your first guess at the interface is no more reliable than your first guess at the implementation.

## Workflow

1. Write the test that captures the behavior or the design concern.
2. Get it compiling with a stub (for example, return a null or empty value).
3. Decide: is the real code obvious and short? Type it. If not, fake it.
4. Run the tests. If red was unexpected, drop to Fake It and smaller steps.
5. Once green, clean up while staying green.

## Red flags

- Spending minutes on a "proper" solution while the bar stays red.
- Insisting on Obvious Implementation after it has already produced surprises.
- Leaving the shortcut in place after green; a fast green excuses shortcuts only for a moment.
- Debating a design preference without writing the test that would settle it.
- Refusing to change a test when the interface it assumed proves wrong.

## Related

- `../MultiCurrencyMoney/multiCurrencyMoney.md` — Fake It and removing test/code duplication step by step.
- `../EqualityForAll/equalityForAll.md` — Triangulate and Value Object.
- `../../../CleanCode/Functions/functions.md` — avoiding hidden side effects in functions.
