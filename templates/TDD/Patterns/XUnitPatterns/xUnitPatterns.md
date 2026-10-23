---
name: tdd-xunit-patterns
description: How to use an xUnit-family framework well (Assertion, Fixture, External Fixture, Test Method, Exception Test, All Tests), based on Chapter 29 (xUnit Patterns) of Test-Driven Development: By Example. Use when writing or reviewing assertions, deciding whether to move setup into setUp/fixtures, releasing files/connections in tearDown, naming test methods, testing that code raises an exception, or wiring a suite that runs every test in the project.
---

# xUnit Patterns

An xUnit framework gives you a small vocabulary: assertions, fixtures, setup and teardown, test methods and suites. Use each one for the job it was built for, so every test is automatic, specific, isolated and easy to read.

## Assertion

**Problem:** how do you check that a test worked without a human judging the output?
**Answer:** write boolean expressions that the computer checks through an `assert` call.

- Every judgment must be automated. True means everything is fine. False means something unexpected happened.
- Be specific. `assert area != 0` passes for almost any wrong answer. If the area should be 50, assert that it equals 50.
- Prefer the framework's equality assertion. It prints the expected and actual values on failure. Follow the framework's argument order (JUnit puts expected first; in pytest you write `actual == expected`).
- Use floating-point assertions with an explicit tolerance.
- Assert through the public protocol, not private fields or internal types. A test that checks `contract.status` is a `Running` instance breaks when the representation changes. Assert on observable behavior instead (for example, that `contract.start_date()` is now available).
- Wanting to inspect a private variable is a design signal, not a testing problem. Look for the design change that would make the behavior observable. If none comes to mind, check the variable, leave a note to revisit it, and move on.
- Failure messages: some teams require an explanatory message on every assertion. Try it both ways and keep messages where they actually speed up diagnosis.

```python
def test_area():
    assert Rectangle(5, 10).area() == 50            # specific
    assert Circle(1).area() == pytest.approx(3.1416, abs=1e-4)
```

## Fixture

**Problem:** many tests need the same objects in the same starting state.
**Answer:** turn the tests' local variables into instance variables (or fixtures) and initialize them in `setUp()`.

- Setup code is often longer than the act and assert parts, and it repeats across tests. Duplicated setup is slow to write and makes interface changes ripple through many tests.
- Duplicated setup also has a benefit: a test that builds its own objects reads top to bottom. Factored setup forces the reader to remember what `setUp()` created.
- Choose deliberately. Factor out setup when readers can easily keep the base objects in mind. Keep it inline when they can't. If readers say there's too much to remember, factor less.
- One fixture per test class. A test class represents one fixture. Each test method runs on a fresh instance of it, which is then thrown away.
- Need a slightly different fixture? Start a new test class (`EmptyRectangleTest`, `NormalRectangleTest`) instead of adding branches to `setUp()`.
- Test classes don't map one-to-one onto production classes. A class may need two or three fixtures, and a fixture can occasionally serve several classes. The counts usually end up similar, but that isn't a rule.

```python
class TestEmptyRectangle:
    def setup_method(self):
        self.empty = Rectangle(0, 0, 0, 0)

    def test_is_empty(self):
        assert self.empty.is_empty()

    def test_width_is_zero(self):
        assert self.empty.width() == 0.0
```

## External Fixture

**Problem:** the fixture holds external resources such as files, sockets or database connections.
**Answer:** release them in `tearDown()`.

- Goal: each test leaves the world exactly as it found it.
- A `try/finally` repeated in every test is duplication. It's easy to forget, and it adds noise to the test.
- The framework calls `tearDown()` after every test method, even if the test fails. It is not called if `setUp()` itself failed, so keep `setUp()` simple or clean up partial work there.
- Modern equivalents: `yield` fixtures, `afterEach`, context managers.

```python
@pytest.fixture
def report_file(tmp_path):
    f = open(tmp_path / "report.txt", "w")
    yield f
    f.close()          # runs whether the test passed or failed
```

## Test Method

**Problem:** how do you represent and organize a single test case among hundreds or thousands?
**Answer:** as a method whose name starts with `test` (or whatever your runner discovers), grouped in a class that shares one fixture.

- Module, class and method give you three levels. Group tests into modules by area, into classes by fixture, and use one method per test case.
- The name should tell a future reader who wasn't there why the test exists, for example `test_positive_infinity_not_equal_to_negative_infinity`.
- Keep test methods short and direct. If one grows long, play "baby steps": write the smallest test that shows real progress. About three lines is the practical minimum without obscuring the test.
- Optional outline technique: sketch the contract as nested comments ("add to store", then "take missing item", "take existing item"), and put the test methods under the lowest level. The outline becomes documentation of the class's contract. Keep it to two or three levels.

## Exception Test

**Problem:** how do you test that code raises an exception?
**Answer:** catch the expected exception and ignore it. Fail only if it isn't raised.

- Catch only the specific exception type you expect. A different exception, including an assertion failure, should still fail the test.
- Use the framework's helper (`pytest.raises`, `expect(...).toThrow`, `assertThrows`) rather than a hand-written `try/fail/catch`.

```python
def test_missing_rate_raises():
    exchange = Exchange()
    with pytest.raises(KeyError):
        exchange.find_rate("USD", "GBP")
```

## All Tests

**Problem:** how do you run every test together?
**Answer:** build a suite of all suites: one per package, plus one that aggregates the whole application.

- A new test class or method must run automatically the next time the full suite runs. If your runner discovers tests by convention, rely on that. If it doesn't, keep an explicit `AllTests` suite per package and make it runnable from the command line and the IDE.
- Make sure there is one command that runs everything. That is the command to run before every check-in.

## Applying it

1. Write the assertion first, and make it exact and behavioral.
2. When a second test needs the same objects, decide whether to inline or factor the setup, based on how easy the result is to read.
3. If a test needs a different starting state, create a new test class or fixture.
4. Release external resources in teardown or fixture finalizers, never in per-test `try/finally`.
5. Name the method after why the test exists.
6. For error paths, assert the specific exception type with the framework helper.
7. Confirm the new test is picked up by the single "run all tests" command.

## Red flags

- `assert x != 0`, `assert result`, or `assertTrue(a == b)` where an exact equality assertion fits.
- Assertions on private fields, internal class types, or reflection into internals.
- Long `setUp()` that every test depends on, but no reader can remember.
- One `setUp()` with conditionals serving several different fixtures.
- Repeated `try/finally` cleanup inside test bodies. Leaked files, ports or rows between tests.
- Test names like `test1` or `testFindRate2`.
- A bare `except`/`catch` in an exception test, or an exception test with no `fail()` when nothing is thrown.
- Tests that exist but aren't included in the full-suite run.

## Related

- `../TestingPatterns/testingPatterns.md`: test doubles (Mock Object, Self Shunt, Log String, Crash Test Dummy) used inside these fixtures.
- `../../XUnitExample/SetTheTable/setTheTable.md`: where setUp was test-driven into the framework.
- `../../XUnitExample/CleaningUpAfter/cleaningUpAfter.md`: where tearDown was test-driven into the framework.
- `../../XUnitExample/HowSuiteItIs/howSuiteItIs.md`: building TestSuite and running many tests.
- `../../../CleanCode/UnitTests/unitTests.md`: what a clean, readable test looks like.
