---
name: tdd-how-suite-it-is
description: Composing tests into suites with Composite and accumulating results with Collecting Parameter, plus changing an interface under test, based on Chapter 23 (How Suite It Is) of Test-Driven Development: By Example. Use when building or using a test suite, a group runner, or any tree where a single item and a group must answer the same calls; when results from many runs must be gathered into one report; when a list of near-identical invocation lines appears; or when a method signature change breaks many existing tests.
---

# How Suite It Is

Duplication in how tests are invoked points to a missing design element: a suite. Make the suite and a single test interchangeable (Composite), and have the caller pass in the result object that every test writes to (Collecting Parameter).

## Duplication as a design signal

A block of lines each running one test and printing its own summary is duplication. Treat it as a cue to find the missing abstraction: the ability to compose tests and run them together. Isolated tests are of little use if you can only run one at a time.

## Composite: one interface for one and many

- A suite holds tests and must respond to the same messages as a single test case, so a suite can contain tests or other suites.
- Start from the test you want to write:

```python
def test_suite_collects_all(self):
    suite = TestSuite()
    suite.add(SpyCase("target"))
    suite.add(SpyCase("broken"))
    result = TestResult()
    suite.run(result)
    assert result.summary() == "2 run, 1 failed"
```

## Collecting Parameter: let the caller own the result

The suite needs one shared result across all its tests, but each test's `run()` creates its own. Options:

- **Default argument** in Python: rejected. The default is evaluated once and silently shared between calls.
- **Split `run()` in two** (allocate, then run with a given result): rejected because no good names come to mind, which signals a poor split.
- **Allocate in the caller**: chosen. `run(result)` takes the collector and returns nothing; tests and suites add to it.

```python
class TestSuite:
    def __init__(self):
        self.tests = []
    def add(self, test):
        self.tests.append(test)
    def run(self, result):
        for test in self.tests:
            test.run(result)
```

## Changing the interface under green

- Changing `run()` breaks every existing test that called it with no argument. Update each call site, run, and only then refactor.
- Each updated test now creates a result: that is fixture duplication, so move it to `setUp()`. Accept a small readability cost for less repetition.
- Beck admits he wrote part of the implementation before the suite test passed. The better route: Fake It to get green, then refactor toward the real design.

## Workflow

1. Notice repeated per-test invocation code; write a failing test for running a group.
2. Fake It to green if the real change spans several classes.
3. Make the group respond to the same messages as its elements.
4. If a shared accumulator is needed, pass it in from the caller.
5. Update all callers to the new signature; get back to green.
6. Factor the repeated result creation into the fixture.
7. Replace the invocation block with one suite that runs everything into one result.
8. Add remaining work to the Test List (e.g. build a suite automatically from a test class).

## Red flags

- A `run_all` that loops over tests but merges separately returned results by hand.
- A group type whose method names or signatures differ from its elements.
- Mutable default arguments used to share state.
- A method split whose parts you cannot name.
- Writing implementation for a red test instead of faking to green first.
- Hand-maintained lists of test names that drift from the real test methods.

## Related

- `../DealingWithFailure/dealingWithFailure.md` — the failure recording each test sends to the shared result.
- `../XUnitRetrospective/xUnitRetrospective.md` — the Test interface that suites and cases share.
- `../../Patterns/DesignPatterns/designPatterns.md` — Composite and Collecting Parameter.
- `../../Patterns/XUnitPatterns/xUnitPatterns.md` — All Tests and suite organization.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — removing duplication to reveal design.
