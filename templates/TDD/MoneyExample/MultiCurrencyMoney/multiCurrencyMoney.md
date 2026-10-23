---
name: tdd-multi-currency-money
description: Starting a feature test-first with a to-do list, an imagined interface, stubs to compile, a faked green bar and duplication removal between test and code, based on Chapter 1 (Multi-Currency Money) of Test-Driven Development: By Example. Use when the user says "let's TDD this", asks where to start a new feature, how to write the first test, what the red/green/refactor cycle looks like step by step, or when a passing implementation still hard-codes the expected answer.
---

# Multi-Currency Money

Start from tests, not objects. Write down the tests you need, pick the simplest one, write it against the interface you wish you had, get it to red, then green by any means, then remove the duplication between the test and the code before moving on.

## Begin with a to-do list

- Before coding, list the behaviors that, once passing, would convince you the feature works. This is the Test List.
- Mark the item you are working on; cross items off when done.
- When a new concern appears (a smell, an edge case, a design doubt), add it to the list instead of acting on it now. Stay on the current test.
- Pick the item that looks easiest, not the most important. If the first test seems hard, start smaller.

## Write the test as a story

- Write the test as if the perfect API already existed. You are describing the operation from the outside.
- The imagined interface may turn out wrong; adjusting it later is cheaper than starting from an ugly, "realistic" one.
- Accept known smells (public fields, side effects, primitive types) for now and write each one on the list.

## Red: make it compile, then fail

- A test that does not compile is a failing test. List the compile errors and remove them one at a time with empty stubs: the class, the constructor, the method, the field. Count errors down as a measure of progress.
- Run it and watch it fail. A concrete failure ("expected 10, got 0") is progress: the problem shrinks from "build the feature" to "make this test pass".

## Green: the smallest change

Return or assign the expected constant. This is Fake It ('Til You Make It). The goal of this phase is a passing test, not a good design.

## Refactor: remove duplication between test and code

The fake constant duplicates data that lives in the test. Write it as the computation it stands for, then replace each literal with the variable it came from.

```python
def test_multiplication():
    five = Dollar(5)
    five.times(2)
    assert five.amount == 10

# Fake:       self.amount = 10
# Expose:     self.amount = 5 * 2
# Generalize: self.amount = self.amount * multiplier
```

Duplication is the symptom; dependency between test and code is the problem. While the code hard-codes the answer, you cannot write another sensible test without changing it. Remove the duplication so the next test needs one change only.

## Step size

TDD is about being able to take tiny steps, not about always taking them. Practice very small steps so you can drop down to them when things get strange; take larger ones when you are confident.

## Workflow

1. Write the Test List for the feature.
2. Pick the simplest item and write one test with the interface you want.
3. Add stubs until it compiles; run it and see it fail.
4. Make it pass with the smallest change, even a constant.
5. Run all tests and see them pass.
6. Refactor: replace constants with variables until the test and the code no longer duplicate each other.
7. Cross the item off and add any new items you noticed.

## Red flags

- Designing classes before any test exists.
- Starting with the hardest, most interesting test.
- Stopping at green while the code still returns the hard-coded expected value.
- Fixing every smell you see immediately instead of listing it.
- Writing a large batch of production code to make one test compile.

## Related

- `../DegenerateObjects/degenerateObjects.md` — the full cycle and when to use Obvious Implementation instead of Fake It.
- `../EqualityForAll/equalityForAll.md` — Triangulate, the third way to reach green.
- `../../../CleanCode/UnitTests/unitTests.md` — the three laws of TDD and what a clean test looks like.
