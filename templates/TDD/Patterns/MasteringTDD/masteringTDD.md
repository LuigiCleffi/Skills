---
name: tdd-mastering-tdd
description: "Decision guidance for practicing TDD in real projects, organized by question (step size, what not to test, how to tell good tests, how many tests, when to delete tests, legacy code, application-level tests, scaling, patterns, XP practices), based on Chapter 32 (Mastering TDD) of Test-Driven Development: By Example. Use when the user asks how big TDD steps should be, what doesn't need tests, whether the tests are good or too many, whether to delete a redundant test, how to start TDD in an existing untested codebase, whether to drive from acceptance tests, or why setup is long and tests are slow or brittle."
---

# Mastering TDD

TDD is a pragmatic way to reach code you trust, not a set of rules to follow mechanically. Use the answers below to make judgment calls: pick the step size, choose what to test, read what the tests say about the design, and adopt TDD in code that already exists.

## How big should the steps be?

There are two questions here: how much ground each test covers, and how many intermediate steps each refactoring takes.
- You should be able to work at either extreme, one line of logic per test or hundreds. Over time, experienced practitioners take smaller steps.
- Do manual refactorings in many tiny steps at first, because manual refactoring is error-prone. After you've done a particular refactoring many times by hand, try skipping some steps.
- Automated refactoring makes 20 manual steps one menu item. With good tool support, refactor more aggressively and try more experiments.
- If your language or environment makes the test/compile/run cycle slow, you'll be tempted to take bigger steps. Notice whether that actually makes you faster.

## What don't you have to test?

The rule of thumb: keep writing tests until fear turns into boredom. Concretely, test the logic you write:
- conditionals
- loops
- operations
- polymorphism

Don't test other people's code (libraries, frameworks, generated code) unless you have reason to distrust it. If an external dependency behaves strangely, you may write a test that documents the behavior and fails when it changes.

## How do you know you have good tests?

Treat test pain as a design signal:

| Symptom | What it says about the design | Response |
|---|---|---|
| Long setup (many lines to build objects for one assert) | Objects are too big | Split them |
| Setup duplication with no natural shared home | Objects are too tangled | Decouple them |
| Long-running tests | Small parts are hard to test in isolation | Fix the design so pieces run alone. Keep the full suite well under ten minutes |
| Fragile tests (break unexpectedly) | One part unexpectedly affects another | Break the connection or merge the two parts |

## How many tests (how much feedback) do you need?

- Base the decision on experience and reflection. Different practitioners write very different numbers of tests for the same small problem, such as a triangle classifier (six tests against sixty-five).
- Think in terms of mean time between failures (MTBF). Would this test make the program measurably more robust? Skip tests for conditions that can't realistically occur, such as integer overflow in a language with arbitrary-precision integers.
- Raise the bar when the required MTBF is extreme, as with safety-critical systems. Then test unlikely conditions and their combinations, unless you can show by other means that they can't arise.
- If your knowledge of the implementation already gives you confidence, you may skip a test. Black-box testing, where you deliberately ignore the implementation, has value, but it is a different discipline from TDD.

```ts
test("equilateral", () => expect(classify(2, 2, 2)).toBe(1));
test("isosceles", () => expect(classify(1, 2, 2)).toBe(2));
test("scalene", () => expect(classify(2, 3, 4)).toBe(3));
test("rejects a degenerate triangle", () => expect(() => classify(1, 2, 3)).toThrow());
test("rejects non-positive sides", () => expect(() => classify(-1, 2, 2)).toThrow());
```

## When should you delete tests?

1. **Confidence first.** Never delete a test if doing so reduces your confidence in the system's behavior.
2. **Communication second.** If two tests exercise the same code path but describe different scenarios to a reader, keep both.
3. Delete the less useful of two tests only when they are redundant on both counts.

## How does TDD lead to frameworks?

Code for today and let the design follow the variations that actually occur:
1. The first feature is implemented simply and directly.
2. The second, a variation of it, moves the shared part into one place and the differences into separate methods or classes.
3. The third reuses the common logic, and its unique logic has an obvious home.

The Open/Closed principle ends up satisfied for the variations that actually happen. When an unusual variation arrives later, the design evolves quickly at that point, and the tests keep the change safe. Don't build in flexibility for variations that haven't occurred.

## Can you test-drive enormous systems?

Yes. The amount of functionality doesn't seem to reduce TDD's effectiveness, because removing duplication produces many small objects that can be tested in isolation. For example, one system had roughly equal amounts of production and test code (about 250k lines each), with thousands of tests run many times a day in about 20 minutes.

## Can you drive development with application-level tests?

- The benefit: tests written by users (with help) express exactly what the system should do next.
- The technical cost is fixtures. You need a way to run tests for features that don't exist yet, often an interpreter that reports steps it can't handle yet.
- The social cost: users must write tests before implementation begins, which organizations resist.
- The feedback loop is long. You may see red for days.
- Recommendation: master red/green/refactor at the programmer level first, then spread it. Keep programmer-level TDD even alongside acceptance tests, for immediate green bars and a simpler internal design.

## How do you switch to TDD midstream (legacy code)?

Code written without tests is usually hard to test, and refactoring it without tests risks bugs you won't catch.
1. **Don't** write tests for everything and refactor everything. That means months with no new features.
2. **Limit scope.** Leave alone parts that could be simplified but don't need to change now.
3. **Break the deadlock** between tests and refactoring with other kinds of feedback: careful work with a partner, or coarse system-level tests that give some confidence.
4. Use that feedback to make the area you must change more amenable to change, then test-drive the new code.
5. Over time, the parts that change constantly will look test-driven. When an untested corner bites, slow down, break the deadlock there, and continue.

## Does test order matter?

Some sequences of tests flow in small steps, while the same tests in another order seem to have no small-step path. When you're stuck, try a different next test before forcing a large step.

## How does TDD relate to patterns?

- Turning repeated decisions into rules makes them a habit, which leaves more energy for problems that fit no rule.
- You can aim for a pattern: test the first variant, then write a test for the second and expect refactoring to lead you to a Strategy. The design will often surprise you, though. It's usually better to state what the system should do and let the design emerge.

## Why does TDD work, and how does it fit with other practices?

- Defects are found earlier and are cheaper to fix. There's less stress, because you only have to make one test work at a time. Teams can trust your builds.
- It shortens the feedback loop on design decisions to seconds or minutes, because each design idea immediately meets a concrete test.
- Despite the name, TDD is an analysis and design technique, not mainly a testing technique.
- Pair programming: the tests keep the pair agreeing on which problem they're solving, and a rested partner can take over.
- Work rested: if the next test won't pass, or two tests won't pass together, take a break.
- Continuous integration: get a test passing, remove duplication, and check in. A 15–30 minute cycle is realistic.
- Simple design and refactoring: code only what the tests need, and remove duplication. Greater confidence allows bolder refactoring.
- Continuous deployment: if the tests really raise MTBF, ship more often.

## Applying it

1. Choose the step size for the current uncertainty. Shrink it whenever a step surprises you.
2. Test your own conditionals, loops, operations and polymorphism. Skip trusted third-party code.
3. When a test is painful to write, fix the design it points to before adding more tests.
4. Decide how many tests to write by asking whether each one moves MTBF or confidence.
5. Delete a test only if it adds neither confidence nor communication.
6. In legacy code, limit the scope, get coarse feedback, then test-drive the part you are changing.

## Red flags

- A test with a hundred lines of setup for one assertion.
- A suite that takes so long nobody runs it before checking in.
- Tests that break when unrelated code changes.
- Tests of library or framework behavior with no reason to distrust it.
- "Test everything first" plans for a legacy codebase that would block feature work for months.
- Deleting a test because it "looks redundant" without checking confidence and communication.
- Designing in flexibility for variations no test or feature has required.
- Pushing on while tired when the next test won't pass.

## Related

- `../TDDPatterns/tddPatterns.md`: Test List, Test First and isolated tests.
- `../RedBarPatterns/redBarPatterns.md`: choosing the next test, and Break when stuck.
- `../Refactoring/refactoring.md`: refactoring in small steps.
- `../DesignPatterns/designPatterns.md`: patterns that emerge from removing duplication.
- `../../../CleanCode/LegacyRefactoring/legacyRefactoring.md`: working safely in legacy code.
- `../../../CleanCode/UnitTests/unitTests.md`: F.I.R.S.T. and clean tests.
- `../../../CleanCode/SimpleDesign/simpleDesign.md`: simple design driven by tests.
