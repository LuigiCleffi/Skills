---
name: tdd-equality-for-all-redux
description: "Removing duplication between sibling classes by moving common code step by step into a superclass, reconciling two implementations until they are identical, and writing missing tests before refactoring under-tested code, based on Chapter 6 (Equality for All, Redux) of Test-Driven Development: By Example. Use when two classes share copied code, when pulling a method up into a base class, or when about to refactor code whose tests do not cover the change."
---

# Equality for All, Redux

Clean up after a copy-and-paste green by moving shared code into a common superclass in small, always-green steps. Make the duplicated methods exactly alike before deleting one. If the code you are about to refactor lacks tests, write the tests you wish you had first.

## Choose the shape of the cleanup

- Having one sibling extend the other usually saves little. A common superclass for both tends to work better, even if it takes a bit longer.
- Start tiny: introduce the empty superclass, make one subclass extend it, run the tests.

## Move code up in small steps

- Move a field to the superclass (widening visibility so subclasses can see it). Run tests.
- To move a method, first make it independent of the subclass: change the local variable's type, then the cast, then rename it to fit the general concept. Run tests after each change.
- Move the now-general method to the superclass.
- For the second sibling, reconcile its copy step by step until it is identical to the one above, then delete it. This is Reconcile Differences.
- Steps can be larger when you feel confident; go smaller as soon as anything surprises you.

## Write the tests you wish you had

You will often refactor code without adequate tests. A refactoring mistake will then pass unnoticed. You will start to fear refactoring, do less of it, and the design will decay. So test retroactively before refactoring.

```typescript
test("equality", () => {
  expect(new Dollar(5).equals(new Dollar(5))).toBe(true);
  expect(new Dollar(5).equals(new Dollar(6))).toBe(false);
  // added before touching Franc.equals: the copied class had no coverage
  expect(new Franc(5).equals(new Franc(5))).toBe(true);
  expect(new Franc(5).equals(new Franc(6))).toBe(false);
});
```

Copying test lines adds duplication too; list it and clean it later.

## Workflow

1. Pick the duplicated method or field to unify.
2. Check that both copies are covered; if not, write the missing tests first.
3. Introduce or reuse the common superclass; run tests.
4. Make one copy general (types, casts, names) in small steps; move it up.
5. Reconcile the other copy until identical; delete it; run tests.
6. Add any new question that arises (for example, comparing the two siblings) to the Test List.

## Red flags

- Refactoring copied code that has no tests of its own.
- Moving a method up in one big edit and debugging afterwards.
- Deleting one implementation before it is identical to the one that stays.
- Making one sibling inherit from the other just to share a few lines.
- Stopping cleanup early because "the tests still pass".

## Related

- `../FranclySpeaking/franclySpeaking.md` — the copy-and-paste step that created this duplication.
- `../ApplesAndOranges/applesAndOranges.md` — the question this cleanup raised.
- `../../../CleanCode/LegacyRefactoring/legacyRefactoring.md` — adding tests before changing legacy code.
- `../../../CleanCode/Classes/classes.md` — organizing classes and responsibilities.
