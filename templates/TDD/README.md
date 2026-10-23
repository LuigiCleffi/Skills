## AI Skills

Before writing tests first, choosing the next test, making a failing test pass,
or refactoring under green, find the skills that apply to the step you are on
in the tables below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed. Start with the **Patterns** skills; the two worked examples
show the same moves inside a real session and are best used as illustrations.

Each skill comes from one chapter of Kent Beck's *Test-Driven Development:
By Example*. When `actions/tdd.md` and `actions/dev.md` are installed, they
define who writes tests and who writes production code; these skills define
how each step of the cycle is done.

### Patterns (Part III) — the reference catalog

| Ch | Skill | Use when |
|---|---|---|
| 25 | `./Patterns/TDDPatterns/tddPatterns.md` | Starting a TDD session, planning a test list, choosing test data, or tests share state or skip. |
| 26 | `./Patterns/RedBarPatterns/redBarPatterns.md` | Picking the first or next test, using a new library, a bug is reported, or you are stuck or lost. |
| 27 | `./Patterns/TestingPatterns/testingPatterns.md` | A test is too big, a slow or global dependency is involved, checking callbacks or call order, or error paths are untested. |
| 28 | `./Patterns/GreenBarPatterns/greenBarPatterns.md` | A test is red and you must choose the first implementation, the abstraction is unclear, or the code works over a collection. |
| 29 | `./Patterns/XUnitPatterns/xUnitPatterns.md` | Writing assertions, setUp/tearDown fixtures, test method names, exception tests, or a run-all-tests suite. |
| 30 | `./Patterns/DesignPatterns/designPatterns.md` | Repeated null checks or conditionals, shared mutable objects, new variants, composites, or a proposed Singleton or up-front pattern. |
| 31 | `./Patterns/Refactoring/refactoring.md` | Unifying similar code, changing a data representation, extracting, inlining or moving methods, or adding interfaces or parameters under green tests. |
| 32 | `./Patterns/MasteringTDD/masteringTDD.md` | Choosing step size, what to test and how much, deleting tests, adopting TDD in legacy code, or reading painful tests as design signals. |

### The money example (Part I) — test-driving a domain model

| Ch | Skill | Use when |
|---|---|---|
| 1 | `./MoneyExample/MultiCurrencyMoney/multiCurrencyMoney.md` | Starting a feature test-first: writing the test list and first test, stubbing to compile, faking green, removing test/code duplication. |
| 2 | `./MoneyExample/DegenerateObjects/degenerateObjects.md` | Deciding how to reach green (Fake It vs. Obvious Implementation), or turning a side-effect worry into a test. |
| 3 | `./MoneyExample/EqualityForAll/equalityForAll.md` | Implementing value-object equality, or generalizing from a fake by triangulating with a second example. |
| 4 | `./MoneyExample/Privacy/privacy.md` | Tests read internal fields; rewrite assertions on whole values so fields can become private. |
| 5 | `./MoneyExample/FranclySpeaking/franclySpeaking.md` | The next test is too big; write a smaller stepping-stone test, copy to green, then remove the duplication. |
| 6 | `./MoneyExample/EqualityForAllRedux/equalityForAllRedux.md` | Pulling duplicated sibling code into a superclass in small steps, or adding missing tests before refactoring. |
| 7 | `./MoneyExample/ApplesAndOranges/applesAndOranges.md` | A nagging "what if" doubt should become a test; deferring new abstractions until a test demands them. |
| 8 | `./MoneyExample/MakinObjects/makinObjects.md` | Tests construct concrete subclasses; adding factory methods, reconciling signatures, preparing to remove redundant subclasses. |
| 9 | `./MoneyExample/TimesWereLivinIn/timesWereLivinIn.md` | Near-duplicate classes differ only by constants, you are stuck on a big design move, or tuning refactoring step size. |
| 10 | `./MoneyExample/InterestingTimes/interestingTimes.md` | Similar methods are not yet identical, tests could answer a design question, or an experiment turns the bar red. |
| 11 | `./MoneyExample/RootOfAllEvil/rootOfAllEvil.md` | Subclasses hold only constructors, or deciding whether redundant or structure-bound tests can be deleted. |
| 12 | `./MoneyExample/AdditionFinally/additionFinally.md` | A feature is too big for one test, the design or responsibility is unclear, choosing a metaphor, or writing Assert First. |
| 13 | `./MoneyExample/MakeIt/makeIt.md` | A hard-coded fake is hard to generalize, code uses casts or type checks, or you are tempted to add speculative parameters. |
| 14 | `./MoneyExample/Change/change.md` | Knowledge sits in the wrong class, test and code share literals, library behavior is uncertain, or a refactoring surprises you. |
| 15 | `./MoneyExample/MixedCurrencies/mixedCurrencies.md` | The goal test causes cascading compile errors, or generalizing concrete types to an interface across many signatures. |
| 16 | `./MoneyExample/AbstractionFinally/abstractionFinally.md` | Completing stubbed interface operations, writing tests for readers, dropping a failed experiment, or judging whether TDD pays off. |
| 17 | `./MoneyExample/MoneyRetrospective/moneyRetrospective.md` | The test list is empty, or reviewing a TDD session or result: duplication, metaphor, metrics, coverage, mutation testing. |

### The xUnit example (Part II) — test-driving infrastructure

| Ch | Skill | Use when |
|---|---|---|
| 18 | `./XUnitExample/FirstStepsToXUnit/firstStepsToXUnit.md` | Building a test framework or self-checking tool from scratch, before any test infrastructure exists. |
| 19 | `./XUnitExample/SetTheTable/setTheTable.md` | Repeated arrange code, tests sharing objects, failures that depend on test order, or adding a setUp hook. |
| 20 | `./XUnitExample/CleaningUpAfter/cleaningUpAfter.md` | Tests holding external resources, adding tearDown, or checking hook call order with a log string. |
| 21 | `./XUnitExample/Counting/counting.md` | Choosing the next test, stuck on a too-big test, or growing a result or summary object from a faked value. |
| 22 | `./XUnitExample/DealingWithFailure/dealingWithFailure.md` | A runner must catch and record failures, or a big red test needs a smaller supporting test. |
| 23 | `./XUnitExample/HowSuiteItIs/howSuiteItIs.md` | Building suites or groups that act like single items, or collecting many results into one report. |
| 24 | `./XUnitExample/XUnitRetrospective/xUnitRetrospective.md` | Writing your own xUnit, understanding unittest/JUnit internals, or separating failures from errors. |

# Context for AI: Test-Driven Development

## 1. The Goal

The goal of TDD is clean code that works. It is a predictable way to develop:
you know when you are done, each passing test is a step that stays done, and
you get the chance to learn what the code is teaching before committing to a
design.

## 2. Two Rules

- Write new code only when an automated test has failed.
- Eliminate duplication.

Everything else follows from these. Design grows from code that runs and gives
feedback between decisions. Developers write their own tests, because they
need them many times a day. The environment must answer small changes quickly.
The design must consist of cohesive, loosely coupled pieces, or testing hurts.

## 3. The Cycle

1. **Red.** Write a small test that does not work, and perhaps does not even
   compile yet.
2. **Green.** Make it pass quickly, committing whatever sins are needed to get
   there.
3. **Refactor.** Remove the duplication created to get the test passing,
   including duplication between the test and the code.

Keep the test list beside you. Add every new idea to it instead of chasing it
now, and pick the next test from it after each refactor.

## 4. Step Size Is a Choice

TDD is awareness of the gap between a decision and its feedback, and the
techniques to control that gap. When the problem is easy and you are sure,
take bigger steps (Obvious Implementation). When the problem is hard or a step
surprised you, take smaller ones (Fake It, Triangulate, Child Test). The
harder the problem, the less ground each test should cover.

## 5. Limits

Tests do not mechanically demonstrate everything. Security also depends on
human judgment about the methods used, and subtle concurrency problems cannot
be reproduced reliably by running code. Use TDD for what it shows, and pair
it with review and other checks for what it does not. See
`../CleanCode/Concurrency/concurrency.md` and `../actions/review.md` when
installed.

## 6. How the AI Should Apply It

- Do not claim TDD unless a meaningful failing test was observed before the
  production change that makes it pass.
- Never leave a faked constant in the code after the refactor step.
- Never weaken or delete a meaningful test to get to green.
- Run the tests after every green and every refactoring step, not only at the
  end.
- Report the cycle honestly: what went red, what made it green, what was
  refactored, and what remains on the test list.
