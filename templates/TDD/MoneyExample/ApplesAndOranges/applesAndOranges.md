---
name: tdd-apples-and-oranges
description: "Turning a nagging doubt into a test, fixing it in a reasonable but imperfect way, and deferring new design until there is better motivation, based on Chapter 7 (Apples and Oranges) of Test-Driven Development: By Example. Use when the user or agent wonders \"what happens if…\", when two different types might wrongly compare equal, or when tempted to introduce a new concept or abstraction that no test demands yet."
---

# Apples and Oranges

When a worry will not leave you, write it as a test and see. Make it pass with something reasonable, even if slightly smelly, and do not introduce new design until a test gives you a stronger reason.

## Convert doubts into tests

- A doubt you have already put on the Test List can still nag you. If it does, take it next: write the test and run it.
- A failing test turns a vague fear into a concrete defect you can fix. A passing one lets you stop worrying.

```python
def test_different_types_are_not_equal():
    assert Franc(5) != Dollar(5)

# Reasonable, not perfect: equal only if amounts and concrete types match
def __eq__(self, other):
    return self._amount == other._amount and type(self) is type(other)
```

## Accept a reasonable fix, note the smell

- Comparing implementation-level types works, but it is a criterion from the language, not from the domain. You would rather compare a domain concept (here, a currency).
- If that domain concept does not exist yet and this one need is not enough to justify it, keep the smelly fix and add the concept to the Test List as a question.
- Design that arrives with a real motivation is cheaper and better aimed than design added on speculation.

## Workflow

1. Notice the doubt (an edge case, a cross-type interaction, a suspicious equality).
2. Write the test that would expose the problem; run it.
3. If it fails, fix it in the simplest reasonable way.
4. If the fix uses a technical criterion where a domain one belongs, list the missing concept.
5. Go back to the main thread of the Test List; introduce the concept when a test needs it.

## Red flags

- Worrying about a case for a long time without writing the test.
- Introducing a new abstraction or type just to make one check prettier.
- Leaving a smelly fix in place without recording it.
- Equality or comparison logic that silently treats different domain types as the same.

## Related

- `../EqualityForAllRedux/equalityForAllRedux.md` — the refactoring that raised this question.
- `../MakinObjects/makinObjects.md` — continuing to remove duplication between the subclasses.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — minimal design driven by tests.
