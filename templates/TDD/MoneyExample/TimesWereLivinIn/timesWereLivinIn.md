---
name: tdd-times-were-livin-in
description: "Reconciling near-duplicate classes by pushing their differences out to the caller and then pulling identical code up, while consciously adjusting step size, based on Chapter 9 (Times We're Livin' In) of Test-Driven Development: By Example. Use when two subclasses or modules differ only in a constant or constructor detail, when you feel stuck on a big design idea, when a refactoring tempts you into a side trip, or when deciding whether to take tiny or large refactoring steps."
---

# Times We're Livin' In

When a large design move feels out of reach, pick a smaller item from the Test List that moves in the same direction. Make two near-identical pieces of code identical by moving what varies into the caller, then pull the now-identical code into one place. Change step size to match how confident you feel.

## Work on something smaller when stuck

- If the big idea (eliminate a class hierarchy, introduce a new abstraction) has no obvious first step, scan the to-do list for a smaller item that prepares the ground.
- Ask "how do I want to test this?" before "how do I implement this?". The test question keeps you honest about the next step.
- Start with the simplest representation that passes the test (a string for a currency code, not a flyweight type). Upgrade only when a test demands it.

```ts
test("money knows its currency", () => {
  expect(Money.dollar(1).currency()).toBe("USD");
  expect(Money.franc(1).currency()).toBe("CHF");
});
```

## Reconcile Differences by moving the variation outward

Two constructors (or methods) differ only by a constant. To unify them:

1. Store the constant in a field and return the field from a shared accessor.
2. Add Parameter: let the constructor receive the value instead of hard-coding it.
3. Move the constant to the caller, typically a Factory Method.
4. Assign the parameter to the field. The constructors are now identical.
5. Pull the identical code up into the shared superclass or module.

Run the tests after each step. The variation now lives in one obvious place: the caller.

## Interruptions

- A refactoring may reveal another wart (a method calling a constructor directly instead of the factory). The strict answer is to note it on the list and keep going.
- In practice a very brief interruption is fine if it unblocks the current change. Never interrupt an interruption: if the side trip uncovers another side trip, write it down.

## Step size is a dial

- Be able to work in tiny steps; you do not have to work that way all the time.
- If you take a big step and something breaks, shift down to small steps until green again.
- Once a refactoring has worked in small steps on one class, repeat the analogous change on its sibling in one larger step.
- Tiny steps feel restrictive? Go bigger. Feeling unsure? Go smaller. There is no permanently right size.

## Workflow

1. Pick the smallest to-do item that moves toward the larger design goal.
2. Write or adjust a test that pins the behavior (e.g. each object reports its own currency).
3. Make the differing pieces store their variation in data instead of code.
4. Push the variation into the caller with Add Parameter and the Factory Method.
5. Keep the bar green after each change; if a step goes red, back up and take smaller steps.
6. Repeat the proven sequence on the sibling, faster.
7. Pull up the identical code and delete the duplicates.

## Red flags

- Staring at a big design idea with no test to write next.
- Building elaborate types (registries, flyweights) before any test needs them.
- A chain of nested side trips during one refactoring.
- Taking large steps after a surprise failure instead of slowing down.
- Two "identical" constructors left in place after they became identical.

## Related
- `../MakinObjects/makinObjects.md` — introduces the factory methods that receive the moved variation.
- `../InterestingTimes/interestingTimes.md` — continues the reconciliation for methods that are not yet identical.
- `../../Patterns/Refactoring/refactoring.md` — Reconcile Differences, Add Parameter and Extract/Move moves in catalog form.
- `../../Patterns/TDDPatterns/tddPatterns.md` — Test List and choosing the next item.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — removing duplication as a design driver.
