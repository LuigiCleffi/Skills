---
name: tdd-xunit-retrospective
description: The test sequence for building an xUnit-style framework, when to roll your own, the difference between failures and errors, and plugging other kinds of tests into an xUnit runner, based on Chapter 24 (xUnit Retrospective) of Test-Driven Development: By Example. Use when the user wants to write a test framework or harness, learn a new language by building one, understand how unittest/JUnit/pytest work internally, report assertion failures separately from errors, or make scripts or non-code checks run alongside ordinary test cases.
---

# xUnit Retrospective

The value of the xUnit example is its sequence of test cases, not its implementation details. A framework that passes those tests gives you isolated, composable tests, which is what test-first work needs.

## The sequence to follow

Build any test runner by driving these behaviors in roughly this order:

1. A test case runs the method named by the test (Pluggable Selector).
2. `setUp()` runs before the test method; each test gets a fresh fixture.
3. `tearDown()` runs after it; verify the order with a Log String.
4. A result object counts tests run.
5. A failing test method is caught and counted, and the run continues.
6. A suite runs many tests into one result (Composite, Collecting Parameter).
7. Still to do after that: tearDown even when the test fails, errors in setUp caught and reported, suites built automatically from a test class.

Python's `unittest` and JUnit follow this same shape: `TestCase`, `setUp`/`tearDown`, `TestResult`, `TestSuite`.

## Why build your own

- **Mastery**: xUnit's spirit is simplicity. A framework you wrote is one you fully understand and can bend to your needs.
- **Exploration**: implementing xUnit in a new language exercises most of the features you will use daily.
- Otherwise, use the existing port for your language; there is almost certainly one.

## Failures versus errors

- An assertion failure and an unexpected exception are different events. Failed assertions usually take longer to debug.
- Record them separately in the result and report them separately (frameworks commonly list errors first).

```python
def test_distinguishes_errors(self):
    suite = TestSuite()
    suite.add(SpyCase("fails_assertion"))
    suite.add(SpyCase("raises_key_error"))
    suite.run(self.result)
    assert self.result.summary() == "2 run, 1 failed, 1 error"
```

## A single Test interface

- Cases and suites share one small interface: count the test cases, and run into a given result.
- In a statically typed language, declare it; in a dynamic language, just implement the two operations.
- Anything that implements it can run with ordinary tests. A script-based or data-driven check can report a count of 1 and notify the result on failure, and the runner treats it like any test case.

## Applying it

1. Building a runner: drive it through the sequence above, one test per item, keeping the framework's own tests green.
2. Using a runner: rely on these guarantees (fresh fixture per test, teardown after, results collected, one failure does not stop the run) and check that your framework provides them before depending on them.
3. Extending a runner: make the new kind of check implement the shared Test interface rather than writing a parallel runner.
4. Reporting: show counts plus the names of failing tests, with failures and errors distinguished.

## Red flags

- A homegrown runner with no tests of its own.
- A runner that stops at the first failure or reports a single pass/fail with no counts.
- Failures and errors merged into one bucket.
- A second, parallel runner built for a new kind of check instead of adapting it to the Test interface.
- A framework that grows features beyond what its users' tests require.

## Related

- `../FirstStepsToXUnit/firstStepsToXUnit.md` — where the sequence starts.
- `../HowSuiteItIs/howSuiteItIs.md` — the shared run(result) interface.
- `../../Patterns/XUnitPatterns/xUnitPatterns.md` — the xUnit pattern catalog.
- `../../Patterns/DesignPatterns/designPatterns.md` — Composite, Collecting Parameter, Template Method, Pluggable Selector.
- `../../MoneyExample/MoneyRetrospective/moneyRetrospective.md` — the companion retrospective for Part I.
- `../../../CleanCode/UnitTests/unitTests.md` — writing clean tests on top of the framework.
