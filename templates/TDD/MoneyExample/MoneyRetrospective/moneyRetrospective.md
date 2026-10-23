---
name: tdd-money-retrospective
description: Reviewing a finished TDD session or its result: what is left to do, how the metaphor shaped the design, test-run rhythm, code metrics, step counts and test quality via coverage and defect insertion, based on Chapter 17 (Money Retrospective) of Test-Driven Development: By Example. Use when the Test List is empty, when the user asks to review or wrap up TDD work, to judge whether test-driven code is done, to assess test quality, coverage or mutation results, or to evaluate a TDD process.
---

# Money Retrospective

When the Test List is empty, stop and review both the process and the result. Look for duplication that is still there, check whether the names and concepts fit together, measure the tests' quality, and decide where more polish actually matters. "Done" is relative: the code you change every day must be rock solid; rarely touched periphery can be rougher.

## What is next?

- **Remaining duplication.** Lasting duplication that the current design makes hard to remove is a symptom of a latent design. Name it and decide whether to restructure.
- **Run a static analyzer** after the obvious tasks. It never forgets the obsolete method you meant to delete.
- **Additional tests.** A test that "should not" work but does: find out why. A test that should not work and does not: record it as a known limitation or future work.
- **Design review.** Do the words and concepts play together? Rename or restructure where they do not.

## Metaphor

- The metaphor drives the structure, not just the names. A different metaphor (flat wallet vs. nested expression) can produce a completely different, often simpler design.
- In review, ask whether the chosen metaphor still fits the problems that showed up.

## Rhythm and process

- Tests should run often, about once a minute while coding. Surprises in pass/fail should be rare; when one happens, it often traces to a hasty refactoring.
- The cycle: add a small test, run and see it fail, make a change, run and see it pass, refactor to remove duplication.
- Changes needed to compile and to pass should stay small. Refactorings vary more: most are small, a few are large.

## Code metrics to check

- Test and production code of roughly similar size, in lines and functions.
- Test code with no branching or loops (complexity of one).
- Low production complexity; heavy use of polymorphism instead of conditionals is a good sign.
- Long test methods usually mean common setup was not factored out yet.

## Test quality

- **Statement coverage** is a starting point, not proof. Disciplined TDD should approach full coverage; uncovered lines should be explainable (a debug-only `toString`).
- **Defect insertion** (mutation testing): change the meaning of a line; some test should fail. A surviving mutant is either a real gap or a change that does not alter meaning (one fake constant is as good as another).
- Coverage improves two ways: more tests, or simpler logic under the same tests. Refactoring conditionals away often does the second.
- TDD tests do not replace performance, stress or usability testing.

## Applying it

1. Confirm the Test List is empty and all tests pass.
2. List remaining duplication and decide which reveals a design change worth making.
3. Run the static analyzer; act on what you agree with.
4. Brainstorm tests that should fail; run them; explain or record the outcome.
5. Check coverage and investigate every uncovered line.
6. Run or simulate mutation testing on core logic; add tests for real survivors.
7. Review names and the metaphor; note what to try differently next time.
8. Summarize the three core skills used: Fake It / Triangulate / Obvious Implementation, removing duplication between test and code, and controlling the gap between tests.

## Red flags

- Declaring work done while known duplication remains unexamined.
- Gold-plating rarely changed periphery while core code stays shaky.
- Long gaps between test runs, or frequent surprises at red or green.
- Branching logic inside tests.
- Treating coverage percentage as the measure of test quality.
- Claiming TDD tests cover performance or usability.

## Related
- `../AbstractionFinally/abstractionFinally.md` — the session being reviewed.
- `../MultiCurrencyMoney/multiCurrencyMoney.md` — the Test List and cycle this review closes.
- `../../XUnitExample/XUnitRetrospective/xUnitRetrospective.md` — the companion retrospective for Part II.
- `../../Patterns/MasteringTDD/masteringTDD.md` — broader questions on practicing TDD well.
- `../../Patterns/GreenBarPatterns/greenBarPatterns.md` — the three ways to get to green.
- `../../../CleanCode/SmellsAndHeuristics/smellsReview.md` — systematic review of remaining smells.
- `../../../CleanCode/UnitTests/unitTests.md` — clean test criteria.
