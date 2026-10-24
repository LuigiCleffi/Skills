---
name: tdd-privacy
description: "Using a newly built feature (such as equality) to make tests read as statements of truth and to stop tests reaching into internal state, so fields can become private, based on Chapter 4 (Privacy) of Test-Driven Development: By Example. Use when tests assert on public fields or internals, when the user wants to make a field private but tests depend on it, or when a test reads as a sequence of steps instead of a claim."
---

# Privacy

Once a capability exists, use it to improve the tests. Compare whole objects instead of peeking at fields, so the test states what is true and production code is free to hide its internals.

## Make tests assert truths, not steps

- Replace assertions on internal fields with assertions on whole values, once equality is available.
- Remove temporary variables that no longer help; inline the call into the assertion.
- A good test reads like a claim about the system ("five times two equals ten"), not a script of operations.

```typescript
// Before: coupled to internals
const product = five.times(2);
expect(product.amount).toBe(10);

// After: states the truth, no internal access
expect(five.times(2).equals(new Dollar(10))).toBe(true);
```

## Reduce coupling, then hide

- When the class itself is the only user of a field, make the field private.
- Tests that use only the public behavior survive internal changes; tests that read fields break with every refactoring.

## Accept and manage the risk

- The multiplication test now depends on equality. If equality is wrong, multiplication can look right when it is not, and two tests can fail together.
- TDD does not aim for perfection. Saying everything twice, as code and as test, is meant to reduce defects enough to move on with confidence.
- When a defect slips through anyway, learn how the test should have been written, add it, and keep going.

## Workflow

1. Find assertions that inspect internal state of an object under test.
2. Rewrite them in terms of the new public operation (here, equality), one assertion at a time, running tests after each.
3. Inline temporaries that no longer add meaning.
4. Check who still uses the internal field; if only the class, make it private.
5. Run all tests, cross the item off the Test List.

## Red flags

- Tests that read public fields or call getters added only for tests.
- A field that cannot be made private because tests depend on it.
- Tests that read as step-by-step procedures with throwaway variables.
- Assuming the suite is perfect; ignoring that one broken feature can mask another.

## Related

- `../EqualityForAll/equalityForAll.md` — building the equality these tests now rely on.
- `../FranclySpeaking/franclySpeaking.md` — how the simplified test makes the next test easy to write.
- `../../../CleanCode/UnitTests/unitTests.md` — readable tests and one concept per test.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — hiding data behind behavior.
