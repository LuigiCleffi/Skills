---
name: tdd-root-of-all-evil
description: Deleting classes that no longer earn their keep and pruning tests that only made sense for the old structure, based on Chapter 11 (The Root of All Evil) of Test-Driven Development: By Example. Use when subclasses contain only constructors, when a refactoring has made a class hierarchy unnecessary, when the user asks whether a test can be deleted, or when tests contain redundant assertions that duplicate other tests.
---

# The Root of All Evil

A subclass that only holds a constructor is not a reason to exist. Replace references to it with the superclass, delete it, and then delete tests that only protected the old structure. Remove a test only after confirming the behavior it covers is still covered elsewhere.

## Eliminating useless subclasses

1. Confirm every behavior has been pulled up; the subclass has nothing but a constructor.
2. Replace each reference to the subclass with the superclass (usually inside factory methods).
3. Search for remaining references, including in tests.
4. Delete the subclass once nothing refers to it. Run all tests.

```ts
// before: Money.franc = (n) => new Franc(n, "CHF")
static franc(amount: number): Money {
  return new Money(amount, "CHF");
}
```

## Pruning tests after a structural change

Tests are code too, and redundant ones are a cost. Delete a test when:

- it only makes sense for a structure you just removed (e.g. "a subclass instance equals a base-class instance" once the subclass is gone),
- it exercises logic that no longer differs from another tested path (separate multiplication tests per currency when currency no longer changes the logic).

Within a test, drop assertions that duplicate others exactly. Keep one representative per distinct case, including the negative one.

```ts
test("equality", () => {
  expect(Money.dollar(5).equals(Money.dollar(5))).toBe(true);
  expect(Money.dollar(5).equals(Money.dollar(6))).toBe(false);
  expect(Money.franc(5).equals(Money.dollar(5))).toBe(false);
  // franc-vs-franc copies removed: same logic path as dollar-vs-dollar
});
```

Before deleting, ask: is this behavior covered sufficiently elsewhere? If yes, delete without losing confidence. If unsure, keep it.

## Workflow

1. Check that the class to delete has no behavior of its own.
2. Redirect callers to the general class, smallest step first; run tests.
3. Delete the class.
4. List tests that reference the old structure or duplicate another path.
5. For each, find the test that still covers its behavior; if found, delete it.
6. Trim duplicate assertions inside the remaining tests.
7. Run all tests and update the Test List.

## Red flags

- Subclasses or wrapper types kept only "because they were there".
- Tests asserting relationships between classes that no longer exist.
- Copies of the same test differing only by an input that no longer affects the logic.
- Deleting a test without checking what else covers its behavior.
- Keeping a burdensome test because deleting tests feels wrong.

## Related
- `../InterestingTimes/interestingTimes.md` — unifies the methods that make the subclasses empty.
- `../AdditionFinally/additionFinally.md` — next step once a single class remains.
- `../../Patterns/Refactoring/refactoring.md` — Inline and Migrate refactorings for removing structure.
- `../../Patterns/TestingPatterns/testingPatterns.md` — keeping tests small and meaningful.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — fewest classes and methods.
- `../../../CleanCode/UnitTests/unitTests.md` — keeping the suite clean.
