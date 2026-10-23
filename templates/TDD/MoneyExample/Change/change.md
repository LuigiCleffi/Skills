---
name: tdd-change
description: Passing a new case with quick ugly code, moving the knowledge to the right owner with Add Parameter, removing data duplication between test and code, using a Learning Test to check a language assumption, and writing a test when a refactoring surprises you, based on Chapter 14 (Change) of Test-Driven Development: By Example. Use when a hard-coded rule appears in the wrong class, when you are unsure how a library or language feature behaves, when a helper class is introduced during refactoring, or when a refactoring unexpectedly turns the bar red.
---

# Change

Get the new case green fast, even if the wrong object ends up knowing something. Then move that knowledge to its proper owner, adding parameters as needed, and remove the constants duplicated between test and code. Check uncertain assumptions about the platform with a small test, and turn surprises into tests.

## Ugly first, then relocate the knowledge

- A hard-coded conditional (`CHF to USD means rate 2`) inside the value object is fine for one green bar.
- Then move it to the object that should own it (the `Bank`). Add Parameter so callers pass that collaborator in; this takes seconds once the need is real.
- Interface methods may need wider visibility; accept the language's rules and move on.

## Remove duplication between test and code

- The same literal appearing in the test and in the implementation is duplication. Replace it with real data: a lookup table populated by the test.

```python
def test_reduce_money_different_currency():
    bank = Bank()
    bank.add_rate("CHF", "USD", 2)
    assert bank.reduce(Money.franc(2), "USD") == Money.dollar(1)
```

## Learning Test for assumptions

- Unsure whether the platform compares arrays, tuples or dates by value? Write a tiny test and run it. If it fails, you have learned you need a real key object.

## Helpers introduced during refactoring

- A private helper (a `Pair` key with equality and hash) written as part of a refactoring can be covered by the existing tests that drive the refactoring.
- Write separate tests for it if your pair partner cannot see where you are going, or if its logic grows more complex.
- A deliberately weak implementation (hash returning a constant) is acceptable to get working; improve it later with real usage data.

## Surprises become tests

- If a refactoring goes red unexpectedly (identity rate USD to USD missing), write a test that communicates the discovery, then fix.
- Several failures may vanish with one change; run all tests to confirm.

## Workflow

1. Write the test for the new case.
2. Pass it with the quickest code, even in the wrong class.
3. Add Parameter to give the right collaborator to the code that needs it; move the logic there.
4. Replace literals shared by test and code with real data structures fed by the test.
5. When an assumption about the language or library is uncertain, write a Learning Test.
6. If the bar goes red unexpectedly, write a test that isolates the surprise, then make it pass.
7. Run all tests; update the list.

## Red flags

- Value objects that know about policies or tables owned by another object.
- The same magic number in the test and the implementation.
- Guessing at library semantics instead of testing them.
- Silently fixing a surprise failure without leaving a test behind.
- Complex helper logic covered only indirectly when nobody else can follow it.

## Related
- `../MakeIt/makeIt.md` — where the extra parameter was deliberately postponed.
- `../MixedCurrencies/mixedCurrencies.md` — the full mixed case built on this conversion.
- `../../Patterns/RedBarPatterns/redBarPatterns.md` — Learning Test and Regression Test.
- `../../Patterns/Refactoring/refactoring.md` — Add Parameter and Move Method.
- `../../../CleanCode/Boundaries/boundaries.md` — learning tests at third-party boundaries.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — eliminating duplication.
