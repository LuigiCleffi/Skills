---
name: tdd-make-it
description: Turning a Fake It into a real implementation when the path back is not obvious, by writing tests that force the needed objects, passing with ugly code, and then moving code where it belongs and replacing type checks with polymorphism, based on Chapter 13 (Make It) of Test-Driven Development: By Example. Use when a test passes with a hard-coded value, when it is unclear how to generalize a fake, when code casts or checks types with instanceof, or when you are tempted to add a parameter you only expect to need.
---

# Make It

A test is not done while duplication remains, and that includes data duplication: a faked constant in the code that repeats the numbers in the test. If replacing constants with variables is not obviously possible, go forward instead: write tests that force the objects you expect to need, pass them with whatever ugly code works, then refactor.

## Duplication of data counts

- A Fake It that returns `10` while the test computes `5 + 5` is duplication. Do not cross the test off yet.
- If generalizing is obvious, replace constants with variables. If not, move forward with more tests.

## Force the object you need with a test

- Write a test that requires the intermediate structure (a `Sum` holding its two operands).
- Such a test is coupled to implementation, not external behavior. Expect it not to live long; it is a stepping stone.
- Speed up where it is safe: assigning constructor fields does not need its own Fake It.

## Pick test data that breaks the fake

- When adding the next test, choose values that the existing fake cannot satisfy (`3 + 4 = 7` against a fake returning `10`).

```ts
test("reducing a sum adds the amounts", () => {
  const sum = new Sum(Money.dollar(3), Money.dollar(4));
  expect(new Bank().reduce(sum, "USD")).toEqual(Money.dollar(7));
});
```

## Ugly green, then put code where it belongs

- Getting green with a cast or a type check is acceptable as a step.
- Then move the body to the object that owns the data (from `Bank` into `Sum`), hiding fields and removing chains of references.
- Replace explicit class checks with polymorphism: give every implementer the same method, add it to the interface, delete the checks.

## Do not add what you only expect to need

- Leave out a parameter (or field, or hook) until a test needs it, even if you are "sure" it will come. Pure refactoring should not smuggle in speculative design.

## Grow the list as you go

- New cases surfaced mid-cycle (e.g. reducing a plain `Money`) go on the Test List.
- When the bar is green and nothing obvious remains in the code, write the next test.

## Workflow

1. Look for data duplication between the fake and the test.
2. If generalizing is not obvious, write a test that forces the structure you need.
3. Choose inputs for the next behavior test that break the current fake.
4. Pass with the simplest code, even with casts or type checks.
5. Move the logic to the object that owns the data.
6. Replace type checks with a polymorphic method on the shared interface.
7. Add newly discovered cases to the list; cross off the test only when duplication is gone.

## Red flags

- Crossing off a test while its fake constant still mirrors the test data.
- New tests that the existing fake already passes.
- Casts, `instanceof` or type switches left after green.
- Logic in a coordinator that reaches two levels into another object's fields.
- Parameters added "because we will need them".

## Related
- `../AdditionFinally/additionFinally.md` — where the fake was introduced.
- `../Change/change.md` — the next case that finally needs the extra parameter.
- `../../Patterns/GreenBarPatterns/greenBarPatterns.md` — Fake It, Triangulate and Obvious Implementation.
- `../../Patterns/Refactoring/refactoring.md` — Move Method and removing duplication.
- `../../../CleanCode/Functions/functions.md` — replacing type dispatch with polymorphism.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — hiding fields and avoiding train wrecks.
