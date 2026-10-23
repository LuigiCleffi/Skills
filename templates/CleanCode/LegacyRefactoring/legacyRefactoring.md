---
name: clean-code-legacy-refactoring
description: Refactoring inherited, third-party or legacy code that has incomplete tests, following the make-it-work-then-make-it-right approach of Chapter 16 (Refactoring SerialDate) of Clean Code. Use whenever the user wants to clean up or modernize old or inherited code, open-source or vendor code they now own, code with low or unknown test coverage, code with suspected latent bugs, or asks how to safely refactor something they did not write. Also use when replacing int constants with enums, removing dead code, fixing base classes that know about their subclasses, or untangling a utility class full of statics.
---

# Refactoring Legacy Code: First Make It Work, Then Make It Right

The case study takes a respectable, widely used open-source date class and cleans it up methodically. The lesson isn't "this code was bad." It's that even good inherited code benefits from a disciplined two-phase pass, and that the first phase usually turns up real bugs.

## Phase 1: First, make it work

The existing tests passed, but they covered only about half the code. Before changing anything:

1. **Measure coverage** with a coverage tool. Look for unexecuted regions and for functions that are never called at all (dead functions).
2. **Write your own independent test suite** that exercises everything that could break. In the case study, this raised statement coverage to roughly 90%.
3. **Expect to find bugs.** Some new tests failed, revealing actual defects: off-by-one errors in date boundaries, wrong behavior near edge days, and a function that never returned the right value. Write tests that pin the correct behavior, then fix the code.
4. **Look at coverage patterns.** Code that's never executed by any test, or executed only on the failing path, points to the cause.
5. **Test exhaustively around bugs.** Bugs cluster. When you find one, test that function thoroughly.
6. Mark tests for unclear requirements as questions, for example skipped with a note, instead of guessing.

Only when the suite is thorough and green do you start restructuring.

## Phase 2: Then make it right

Walk through the code from top to bottom, improving as you go and running the **full** test suite after every change. Typical improvements in the case study, which are a good checklist for legacy code:

- **Clean the file header.** Remove change-history comments (version control has them) and keep only the required legal notice.
- **Fix docs and comments.** Delete redundant or stale ones and make the remaining ones accurate.
- **Rename for accuracy.** Choose names that describe the abstraction rather than one implementation detail.
- **Fix base classes that depend on their derivatives.** A base class shouldn't know about its concrete subclasses. Use an abstract factory to create instances, so the base stays abstract.
- **Replace int constants with enums.** Give months and weekdays a proper type, and move the related conversion and validation logic onto the enum.
- **Delete dead code**: unused functions, unused constants and unreachable branches.
- **Move misplaced responsibilities.** Put each function where a reader would look for it, and turn static helpers into instance methods when they operate on one instance.
- **Introduce explanatory variables** for complex expressions.
- **Encapsulate boundary conditions** and **remove duplication**, often revealing that several functions are variants of one algorithm.
- **Don't override safeties.** Keep compiler warnings and checks on, and control serialization identifiers explicitly rather than suppressing them.
- **Prefer structure over convention**, such as abstract methods subclasses must implement over naming rules they're expected to follow.

## Watch for metrics that look worse

Coverage may drop as a percentage after cleanup, because dead and trivial code was removed and the remaining code is denser. What matters is that the important code is covered, the code is smaller and clearer, and the bugs are fixed.

## Applying it

When the user has inherited code to clean up:
1. Run the existing tests and measure coverage. Report the gaps.
2. Propose or write characterization tests until the risky areas are covered. Flag any test that fails as a likely bug, and confirm the intended behavior with the user before fixing it.
3. Fix the confirmed bugs, with tests.
4. Then refactor in small, verified steps using the checklist above.
5. Summarize what was found (bugs, dead code) and what changed, and leave the code cleaner than it was found.

Related: `../SmellsAndHeuristics/heuristicsCatalog.md` provides the full heuristic catalog that the case study cites (such as F4 dead function, G7 base class depending on derivatives, T1 insufficient tests).
