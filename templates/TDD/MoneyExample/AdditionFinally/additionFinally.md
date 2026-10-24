---
name: tdd-addition-finally
description: "Starting a hard feature by shrinking the test to a smaller step that still shows progress, choosing a metaphor, and writing the test from the assertion backward, based on Chapter 12 (Addition, Finally) of Test-Driven Development: By Example. Use when a requested feature is too big for one test, when the design of a new capability is unclear, when deciding which object owns a responsibility, when the to-do list has become messy, or when choosing between Fake It and Obvious Implementation."
---

# Addition, Finally

When the target test is too big, write a smaller one that still represents real progress. Slow down while writing that test if the design needs thought: pick a metaphor, decide who owns the responsibility, and write the test from the assertion back to the setup. Then get it compiling fast, see it fail, and make it pass.

## Refresh the Test List

- When the to-do list gets cluttered, copy the open items to a fresh list.
- If an item is so small that copying it is more work than doing it, just do it.

## Shrink the test

- If you cannot see how to write the full story (mixed-currency addition), start with a simpler example on the same path (same-currency addition).
- The smaller test must still move toward the goal; it is not a detour.

## Choose speed per step

- If the implementation is obvious, use Obvious Implementation.
- If the design is not obvious, use Fake It and refactor toward the real code.
- Speeding up the implementation can coexist with slowing down on the test. Some tests deserve careful thought.

## Let a metaphor shape the design

- State the hard constraint first (most code should not know it may be dealing with several currencies; rates must be able to vary).
- Consider metaphors (wallet, expression) and pick the one that keeps ordinary code looking like ordinary arithmetic.
- When an object does not behave the way you need, introduce an Imposter: a new object with the same external protocol but a different implementation.
- There is no formula for these ideas. Confident tests and well-factored code prepare you to recognize and apply them.

## Decide responsibility deliberately

- Keep core objects as ignorant of the rest of the world as possible so they stay flexible, testable and reusable.
- Avoid piling every operation onto the core abstraction; put operations like conversion on a collaborator.
- Treat the choice as provisional and be willing to move it if a better home appears.

## Assert First, then work backward

```python
def test_simple_addition():
    five = Money.dollar(5)
    total = five.plus(five)          # an Expression, not a Money
    bank = Bank()
    reduced = bank.reduce(total, "USD")
    assert reduced == Money.dollar(10)
```

Write the last line first, then ask what each previous line must provide.

## Workflow

1. Rewrite the to-do list if it is messy.
2. Replace the big test with a smaller one that represents progress.
3. Think about the metaphor and responsibilities; write the test assertion first, then the setup.
4. Make it compile quickly: an empty interface, an empty class, a stub returning null.
5. Run and watch it fail.
6. Fake It (return the expected constant) to get green.
7. Note the duplication between test and code; refactoring it away is the next step.

## Red flags

- Attacking the full feature in one test with no smaller stepping stone.
- Rushing the test when the design genuinely needs thought.
- Core domain objects that know about conversion, persistence or other outside concerns.
- Writing setup before knowing what the assertion needs.
- Leaving the test uncompiled for long while designing.

## Related
- `../MakeIt/makeIt.md` — removing the Fake It duplication this chapter leaves behind.
- `../MoneyRetrospective/moneyRetrospective.md` — how the expression metaphor reshaped the whole design.
- `../../Patterns/RedBarPatterns/redBarPatterns.md` — One Step Test and Test List.
- `../../Patterns/TestingPatterns/testingPatterns.md` — Assert First.
- `../../Patterns/GreenBarPatterns/greenBarPatterns.md` — Fake It and Obvious Implementation.
- `../../Patterns/DesignPatterns/designPatterns.md` — Imposter.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — where behavior should live.
