---
name: tdd-makin-objects
description: "Moving toward removing redundant subclasses by reconciling method signatures, declaring shared methods in the superclass, and decoupling tests from concrete classes with Factory Methods, based on Chapter 8 (Makin' Objects) of Test-Driven Development: By Example. Use when tests construct concrete subclasses directly, when subclasses do too little to justify existing, when two variants of a method differ only in return type, or when deciding whether a now-redundant test can be deleted."
---

# Makin' Objects

Prepare to eliminate subclasses that no longer earn their keep by reducing references to them. Make sibling methods share a signature, declare them on the superclass, and route all construction in tests through Factory Methods so the hierarchy can change without touching test code.

## Reconcile signatures first

- When two subclasses have nearly identical methods, make them return the common supertype. That is a small step toward a single implementation.
- If the superclass must expose the method before it can implement it, declare it there (for example, as abstract). Run tests.

## Decouple tests from subclasses with Factory Method

- Add a static creation method on the superclass that returns the supertype.
- Change tests to use it and to declare variables as the supertype, one test at a time.
- Once no test or client mentions the concrete subclass, you are free to change or remove inheritance without touching them.

```typescript
abstract class Money {
  static dollar(amount: number): Money { return new Dollar(amount); }
  static franc(amount: number): Money { return new Franc(amount); }
  abstract times(multiplier: number): Money;
}

test("multiplication", () => {
  const five = Money.dollar(5);
  expect(five.times(2).equals(Money.dollar(10))).toBe(true);
});
```

## Notice redundant tests, but wait

- When a test checks no logic that another test does not already check, it is suspicious. Ask whether deleting it would cost any confidence.
- If it would cost some, keep it for now and add "delete this test?" to the Test List. Revisit when the code it guards disappears.

## Workflow

1. Compare the duplicated methods; change their return types to the supertype.
2. Declare the method on the superclass; run tests.
3. Introduce a Factory Method returning the supertype; use it in one test.
4. Change variable declarations in tests to the supertype; run tests.
5. Replace every remaining direct construction of the subclasses in tests.
6. List tests that look redundant once subclasses go away; do not delete them yet.

## Red flags

- Tests that call subclass constructors directly, locking the hierarchy in place.
- Trying to remove subclasses in one large step.
- Subclasses that only differ by the type they construct.
- Deleting a test because it looks redundant before the duplicated code is actually gone.

## Related

- `../EqualityForAllRedux/equalityForAllRedux.md` — moving code into the superclass in small steps.
- `../ApplesAndOranges/applesAndOranges.md` — the deferred currency concept that will replace subclass checks.
- `../../../CleanCode/Functions/functions.md` — hiding type dispatch behind a factory.
- `../../../CleanCode/UnitTests/unitTests.md` — keeping tests free of incidental coupling.
