---
name: tdd-cleaning-up-after
description: Test-driving tearDown and other lifecycle hooks, and verifying call order with a Log String instead of a pile of flags, based on Chapter 20 (Cleaning Up After) of Test-Driven Development: By Example. Use when tests allocate external resources (files, sockets, DB connections, temp dirs) that must be released, when adding teardown/afterEach to a runner, when a test needs to assert the order in which hooks or callbacks fire, or when spy flags are multiplying.
---

# Cleaning Up After

A test that grabs an external resource in `setUp()` must release it before it finishes, or tests stop being independent. When the thing you need to verify is a sequence of calls, record the calls in a log string and assert the whole sequence at once.

## Replace flags with a Log String

- One boolean per hook (`was_set_up`, `ran`, `was_torn_down`) multiplies and still misses the point: the hooks must run in a specific order.
- Have the test subject append a token to a log on every call, then compare the log with the expected sequence.
- One log assertion can replace several flag tests. When it does, delete the redundant tests and rename the survivor after what it now proves (the whole lifecycle).

```python
class LifecycleSpy(TestCase):
    def set_up(self):     self.log = "set_up "
    def target(self):     self.log += "target "
    def tear_down(self):  self.log += "tear_down "

def test_lifecycle_order(self):
    spy = LifecycleSpy("target")
    spy.run()
    assert spy.log == "set_up target tear_down "
```

## Test first, even for the obvious hook

- Extend the expected log with the new token before touching the runner. Watch it fail, then add the call after the test method and a no-op default in the base class.
- An **Obvious Implementation** may still break somewhere unexpected (here, other test classes lacked the default hook). Running the new feature through the framework's own tests is what surfaces that.
- If the breakage is small and the fix is plain, fix forward; if it is not, back out and take a smaller step.

## Refactor reflexively, undo freely

- Extracting a fixture into `setUp()` and then inlining it again when only one test uses it is normal.
- Do the refactoring the current code suggests; do not wait for three uses to avoid the chance of undoing it. Spend your thinking on design, not on avoiding rework.

## Template Method

`run()` is a **Template Method**: a fixed skeleton (set up, run the test, tear down) with hooks subclasses override. Give every hook a do-nothing default in the base so subclasses implement only what they need.

## Workflow

1. Identify the resource or state the test must release.
2. If flags are piling up, switch the spy to a log string and update existing assertions to read it.
3. Merge tests the log makes redundant; rename the survivor.
4. Add the next token (e.g. `tear_down`) to the expected log; run and see red.
5. Call the hook in the runner's skeleton; add a no-op default in the base.
6. Run all tests, including other test classes, and fix any fallout.
7. Note on the Test List what is still not covered (here: tearDown when the test method fails).

## Red flags

- External resources opened in setup with no matching teardown.
- A growing set of booleans used to infer the order of calls.
- Several tests asserting overlapping fragments of one sequence.
- A lifecycle hook with no default implementation, so every subclass must define it.
- Keeping a setUp extraction that now serves a single test, just to avoid "undoing work".
- Assuming teardown runs after a failure without a test that shows it does.

## Related

- `../SetTheTable/setTheTable.md` — the setUp side of the fixture lifecycle.
- `../DealingWithFailure/dealingWithFailure.md` — catching failures so teardown and reporting can follow.
- `../../Patterns/TestingPatterns/testingPatterns.md` — Log String and other test doubles.
- `../../Patterns/DesignPatterns/designPatterns.md` — Template Method.
- `../../../CleanCode/UnitTests/unitTests.md` — independent, repeatable tests.
