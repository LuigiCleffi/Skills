---
name: tdd-francly-speaking
description: "Breaking a too-big test into a smaller stepping-stone test and allowing copy-and-paste to reach green, with the duty to remove the duplication right after, based on Chapter 5 (Franc-ly Speaking) of Test-Driven Development: By Example. Use when the next test on the list feels like too big a leap, when tempted to copy a class to get a sibling working, or when the user asks whether duplication is ever acceptable in TDD."
---

# Franc-ly Speaking

When the interesting test is too big to implement in one small step, write a smaller test that represents real progress toward it. Getting it green by duplicating code is allowed, but the cycle is not finished until the duplication is gone.

## Find a stepping-stone test

- If you cannot write a test you can pass in one small step, ask what prerequisite would bring the big test within reach. Test that first.
- Here, mixed-currency addition needed a second currency object before anything else, so the next test was a copy of the first currency's test for the new one.

## The phases have different purposes

1. Write a test.
2. Make it compile.
3. Run it and watch it fail.
4. Make it run.
5. Remove duplication.

The first phases must go fast, to reach a known state with the new behavior. During them, speed beats design and almost any sin is allowed, including copy-and-paste of tests and code. The last phase is where good design is applied. The cycle does not work without it: good design, at the right moment.

```python
def test_franc_multiplication():          # copied from the Dollar test, then edited
    five = Franc(5)
    assert five.times(2) == Franc(10)
    assert five.times(3) == Franc(15)

class Franc:                              # copied from Dollar; duplication is now on the list
    def __init__(self, amount): self._amount = amount
    def times(self, m): return Franc(self._amount * m)
    def __eq__(self, other): return self._amount == other._amount
```

## Pay the debt immediately

- Write every duplication you introduced on the Test List (shared equality, shared multiplication, the duplicated classes).
- Do not show, merge or check in the code until the duplication is removed.
- When the step to green is short, you may skip the separate "make it compile" step.

## Workflow

1. Look at the next big test; if it is too big, find the smaller test that moves you toward it.
2. Write it, copying an existing test if that is fastest.
3. Make it pass the fastest way, including copying production code.
4. List each duplication you created.
5. Start removing them before writing any new test.

## Red flags

- Stalling on a big test instead of finding a smaller one.
- Treating "speed over design" as permanent instead of a phase of seconds or minutes.
- Committing or sharing copied code before the duplication is removed.
- Refusing a quick copy out of aesthetics and staying red longer.

## Related

- `../EqualityForAllRedux/equalityForAllRedux.md` — removing the duplication this step created.
- `../Privacy/privacy.md` — why simplifying earlier tests made this copy easy.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — no duplication as a rule of simple design.
