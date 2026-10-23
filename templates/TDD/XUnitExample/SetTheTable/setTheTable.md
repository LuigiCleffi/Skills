---
name: tdd-set-the-table
description: Building test fixtures with setUp so every test gets fresh, isolated objects, and test-driving the setUp hook itself, based on Chapter 19 (Set the Table) of Test-Driven Development: By Example. Use when several tests repeat the same arrange code, when tests share objects to save time, when a test fails only after (or only before) another test, when one failure cascades into many, when deciding between per-test and shared fixtures, or when adding a setUp/beforeEach hook to a runner.
---

# Set the Table

Tests follow Arrange–Act–Assert, and the arrange part repeats across tests. Put that shared arrangement in `setUp()` and rebuild it for every test, so no test can affect another. Trade speed for isolation until creation cost forces otherwise.

## Arrange, Act, Assert

1. **Arrange** — create the objects.
2. **Act** — stimulate them.
3. **Assert** — check the results.

The act and the assertion are what make a test unique; the arranged objects are often the same from test to test. That shared arrangement is the fixture.

## Performance versus isolation

- **Performance** argues for building shared objects once for many tests.
- **Isolation** argues that one test's success or failure must be irrelevant to the others.
- Coupled tests cause one real failure to break ten tests, make results depend on run order, and worst of all let a broken test pass because an earlier test left state behind.
- Default: if objects are cheap enough to create, create them fresh for each test. Do not share mutable fixtures, and do not lean on globals.

## Test-drive the hook

Prove the runner calls `setUp()` before the test method with a spy, exactly as you proved the method ran:

```python
def test_calls_set_up(self):
    spy = SpyCase("target")
    spy.run()
    assert spy.was_set_up

# in TestCase
def set_up(self):          # default hook: does nothing
    pass
def run(self):
    self.set_up()
    getattr(self, self.name)()
```

Making this pass touches two places (the spy and the base class). That is a large step for delicate bootstrap code; look for a path that changes only one method at a time.

## Use the new feature immediately

- Move per-test initialization (such as resetting the spy flag) into `setUp()` of the test subject.
- Move the repeated arrange lines of your own tests into the test class's `setUp()`. Each test method runs on a fresh instance, so the tests stay decoupled.
- A test may be simplified only if another test already covers what you remove. Once a setUp test exists, the running test no longer needs to assert the flag was unset beforehand.

## Workflow

1. Spot arrange code repeated across two or more tests.
2. If the hook does not exist, write a failing test that the runner calls it before the test method.
3. Add a no-op default hook in the base and call it from `run()`.
4. Move the repeated arrangement into `setUp()`, storing objects on the instance.
5. Remove assertions that are now covered by another test, never ones that are not.
6. Run the whole set in different orders, or each test alone, to confirm isolation.

## Red flags

- Fixtures created once at module or class level and mutated by tests.
- Tests that pass together but fail alone, or fail in a different order.
- A single bug producing a wall of red across unrelated tests.
- Removing an assertion "because it is redundant" without a test that covers it.
- Optimizing fixture creation before it is measurably slow.
- Globals or singletons written by fixtures.

## Related

- `../FirstStepsToXUnit/firstStepsToXUnit.md` — the spy and runner this builds on.
- `../CleaningUpAfter/cleaningUpAfter.md` — the matching tearDown hook for releasing resources.
- `../../Patterns/XUnitPatterns/xUnitPatterns.md` — Fixture and External Fixture.
- `../../../CleanCode/UnitTests/unitTests.md` — Independent tests and Build–Operate–Check.
