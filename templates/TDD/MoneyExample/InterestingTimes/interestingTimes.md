---
name: tdd-interesting-times
description: "Making two similar methods identical by backing up, asking the test suite instead of reasoning, and handling a red bar caused by an experiment, based on Chapter 10 (Interesting Times) of Test-Driven Development: By Example. Use when two methods look alike but are not identical, when you are debating a design question the tests could answer, when an experiment turns the bar red, when a failure message is unreadable, or when equality compares classes instead of values."
---

# Interesting Times

When two methods are similar but not identical, sometimes you must step back to move forward: inline what they call and replace constants with variables until they match. When unsure whether a change is safe, make it and let the tests answer. If the experiment goes red and the fix needs model changes, revert to green, write the missing test, then redo the experiment.

## Back up to make code identical

- Undo a recent abstraction if that exposes the duplication (e.g. inline a factory call back into a direct constructor call).
- Replace literal constants with the variables that already hold the same value.
- Repeat on the sibling. Once both bodies are byte-for-byte equal, pull them up.

## Ask the computer

- With clean code and a trustworthy suite, a question like "does it matter which concrete type I return here?" is cheaper to answer by trying it and running the tests than by minutes of reasoning.
- Without tests you have no choice but to think. With tests, choose whichever answers faster.

## Improving the failure message

A failure that prints object identities instead of values is hard to read. Adding a `toString`/`__repr__` purely for debug output, without a test, is an accepted exception because:

- you are about to see its output immediately,
- it is debug-only, so the risk is low,
- you are already on red and should not write new tests on red.

Note the exception rather than making it a habit.

## Red bar from an experiment: the conservative path

You should not change model code without a test, and you should not write a new test while red. So:

1. Revert the change that turned the bar red. Back to green.
2. Write a test that captures the case the experiment exposed; the failing situation itself is the test data.
3. Make that test pass by fixing the model.
4. Reapply the original experiment. It now passes.

```python
def test_equality_ignores_concrete_class():
    assert Money(10, "CHF") == Franc(10, "CHF")

# fix: compare the value that matters, not the type
def __eq__(self, other):
    return self.amount == other.amount and self.currency == other.currency
```

## Workflow

1. Compare the two similar methods and find the smallest change that makes them more alike.
2. Inline or replace constants with variables; run tests after each step.
3. Try the uncertain change and let the suite decide.
4. If the failure message is cryptic, add a debug representation so the next run tells you what is wrong.
5. If red and the fix touches model code: revert, write the test, fix, redo.
6. Pull up the now-identical methods.

## Red flags

- Ten minutes of debate over a question a 15-second test run could settle.
- Fixing model code while the bar is red with no test describing the fix.
- Equality based on runtime class when the domain says value (currency, id) decides.
- Unreadable assertion output left in place.
- Treating "no test for toString" as license to skip tests for real behavior.

## Related
- `../TimesWereLivinIn/timesWereLivinIn.md` — the earlier half of the same reconciliation.
- `../RootOfAllEvil/rootOfAllEvil.md` — deleting the subclasses once their methods are unified.
- `../EqualityForAllRedux/equalityForAllRedux.md` — earlier equality refactoring under tests.
- `../../Patterns/RedBarPatterns/redBarPatterns.md` — Regression Test and writing the test that captures a discovered case.
- `../../Patterns/Refactoring/refactoring.md` — Reconcile Differences and Inline Method.
- `../../../CleanCode/UnitTests/unitTests.md` — readable assertions and failure messages.
