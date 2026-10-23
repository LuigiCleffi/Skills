---
name: tdd-patterns
description: The strategic TDD patterns (what a test is, when to write it, what logic and data to test), based on Chapter 25 (Test-Driven Development Patterns) of Test-Driven Development: By Example. Use when starting a TDD session, deciding what to test or when to write tests, planning a test list, writing a test from the assertion backwards, choosing test data, the user says "no time to test", tests share state or depend on run order, or test values look like unexplained magic numbers.
---

# Test-Driven Development Patterns

Before tactics, settle strategy: a test is an automated, isolated procedure; it is written before the code; the work is driven by a written list of tests; each test is built from its assertion backwards; and its data is chosen so a reader can see why the expected answer is right.

## Test (noun)

**Question:** How do you test your software? **Answer:** Write an automated test.

- "Testing" a change by clicking around is not the same as *having* a test. A test is a procedure that runs by itself and yields pass or fail.
- Under stress, manual testing drops, errors rise, stress rises: a vicious loop. Automated tests break it: when stress rises, run the tests. Green turns fear into boredom.
- Whenever you feel unsure whether a change broke something, run the suite instead of guessing.
- Running a new test you are sure will fail is optional, but a surprise pass tells you something (the behavior may already exist).

## Isolated Test

**Question:** How should running one test affect another? **Answer:** Not at all.

- One broken behavior should produce one failure, not a cascade. Two failures should mean two problems.
- Isolated tests are order-independent: any subset can run alone.
- Keep tests fast enough to run yourself, often, before anyone else sees a defect.
- Do not share mutable fixtures between tests for performance. If setup is expensive, split the problem into small orthogonal pieces so each test's setup is cheap.
- Isolation pressure is a design force: it pushes toward many small, cohesive, loosely coupled objects.

## Test List

**Question:** What should you test? **Answer:** Before you start, write a list of all the tests you know you will need.

- Write the list first, so nothing is forgotten and your head is free for the current step.
- Order of entries: examples of each operation you need; then the null/empty version of operations that do not exist yet; then the refactorings you expect to need to leave the code clean.
- List tests; do not implement them all at once. Each written test adds inertia to refactoring, and ten failing tests keep you red for a long time.
- Stay at most one change away from green (like the climber keeping three of four limbs anchored).
- As implementation suggests new tests or cleanups, append them to the list ("this is getting ugly" goes on the list).
- At session end: unfinished feature items stay on the list for next time; larger out-of-scope refactorings go to a "later" list. A test you suspect might fail is rarely deferred: making it pass outranks shipping.

```text
TODO
- [ ] total of empty cart is 0
- [ ] total of one item
- [ ] total of several items
- [ ] refactor: extract Money from Cart
```

## Test First

**Question:** When should you write tests? **Answer:** Before the code under test.

- You will not test afterward: once the feature runs, the goal is met and stress pushes testing out.
- Test First is a tool for design and scope control, which is why it survives moderate stress: writing the test first lowers stress, which makes testing more likely.

## Assert First

**Question:** When should you write the asserts? **Answer:** First.

Writing a test answers many questions at once: where the behavior lives, what to name it, how to check the answer, what the answer is, what other tests it implies. Assert First separates the two easiest ones, "what is the right answer?" and "how will I check it?", then works backwards.

```ts
// 1. Start with the assertion.
expect(reply.contents()).toBe("abc");
// 2. Where does reply come from? Add the line above it.
const reply = client.read();
// 3. Where does client come from? Add the line above that, and so on.
const client = connect("localhost", port);
```

Each step is a tiny decision with feedback in seconds; adjust names once real usage shows them.

## Test Data

**Question:** What data do you use in test-first tests? **Answer:** Data that makes the tests easy to read and follow.

- Every difference in the data should mean something. If 1 and 2 are conceptually the same, use 1.
- Use as many inputs as the design needs, and no more: three items instead of ten if they drive the same decisions.
- Never use one constant for two meanings. Testing `plus(2, 2)` hides swapped arguments; use `plus(3, 4)`.
- Use **Realistic Data** (real-world traces) only when: testing real-time systems against recorded external events; comparing new output with a legacy system (parallel test); refactoring a simulation that must produce exactly the same answers, especially with floating point.

## Evident Data

**Question:** How do you represent the intent of the data? **Answer:** Put expected and actual results in the test and make their relationship evident.

```ts
it("converts with commission", () => {
  const bank = new Bank();
  bank.addRate("USD", "GBP", 2);
  bank.setCommission(0.015);
  const result = bank.convert(usd(100), "GBP");
  expect(result).toEqual(gbp((100 / 2) * (1 - 0.015)));
});
```

- Prefer the visible computation over a bare `49.25`: the reader sees how the inputs produce the answer.
- Bonus: the expression in the assertion tells you what the code must compute, which pairs well with Fake It.
- This is an accepted exception to "no magic numbers" within one test. If named constants already exist, use them.

## Workflow

1. Write the Test List for the session (operations, null cases, expected refactorings).
2. Pick one item. Write its test first, starting with the assertion and working backwards.
3. Choose minimal, meaningful, evident data; avoid reusing a constant for two meanings.
4. Make it pass, keeping the test isolated from all others; run the whole suite whenever in doubt.
5. Append new ideas and cleanups to the list; cross off finished items; carry leftovers forward.

## Red flags

- "No time to test" followed by manual clicking and shipping.
- Tests that pass alone but fail in another order, or one bug causing dozens of failures.
- Shared mutable fixtures justified by speed.
- Many tests written at once and left red for a long time.
- Tests written after the code, or never.
- Expected values like `49.25` with no visible derivation; the same literal used for two roles.
- Ten-element inputs where three would force the same design.

## Related

- `../RedBarPatterns/redBarPatterns.md` — which test to take from the list next, and when to stop.
- `../GreenBarPatterns/greenBarPatterns.md` — how to make each listed test pass.
- `../TestingPatterns/testingPatterns.md` — techniques for writing individual tests (doubles, Log String).
- `../../../CleanCode/UnitTests/unitTests.md` — clean test structure and F.I.R.S.T., including independence.
