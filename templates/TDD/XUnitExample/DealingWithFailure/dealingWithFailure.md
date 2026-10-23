---
name: tdd-dealing-with-failure
description: Unblocking a large failing test with a smaller, more granular test, and making a runner catch and record failures instead of crashing, based on Chapter 22 (Dealing with Failure) of Test-Driven Development: By Example. Use when a test runner, job runner, batch processor or plugin host must survive a failing unit of work and report it; when a big test is red and the next step is unclear; when testing a reporter separately from the code that feeds it; or when you notice a new risk mid-task (e.g. errors in setup) and are tempted to fix it right away.
---

# Dealing with Failure

When a coarse test is red and too much is missing, write a finer-grained test that pins down one piece, make it pass, then return to the big test and finish it quickly using the mechanism you just built. Problems you spot along the way go on the Test List, not into the code.

## Test the protocol, not the plumbing

- Decide the messages the collaborators will exchange (`test_started()`, `test_failed()`), then test the receiver directly with exactly those messages:

```python
def test_failed_result_formatting(self):
    result = TestResult()
    result.test_started()
    result.test_failed()
    assert result.summary() == "1 run, 1 failed"
```

- If the summary is right when those messages arrive in that order, the remaining problem shrinks to sending them at the right time. This is a **Child Test**: a smaller test carved out of a larger one.

## Catch failures where the unit of work runs

```python
def run(self):
    result = TestResult()
    result.test_started()
    self.set_up()
    try:
        getattr(self, self.name)()
    except Exception:
        result.test_failed()
    self.tear_down()
    return result
```

- Wrap only the test method at first. That is all the current tests demand.
- Notice what this leaves uncovered: an exception in `set_up()` still escapes and stops the run, which breaks test independence. Do not change the code until a test fails for that reason.

## No code without a failing test

Seeing a flaw is not a licence to fix it. Write it on the Test List ("catch and report errors in setUp"), finish the current item, then write the test that exposes the flaw and make it pass.

## Workflow

1. With the large test red, ask which single mechanism is missing.
2. Write a small test that exercises only that mechanism through its intended messages.
3. Make it pass (counting failures alongside runs).
4. Bring back the large test; wire the messages into the caller (a `try`/`except` around the unit of work).
5. See both tests green.
6. Record any risks you noticed as new Test List items instead of addressing them now.

## Applying it to tooling

- For any runner of user-supplied work (tests, jobs, hooks, migrations), the runner must convert a crash in one unit into a recorded failure and keep going.
- Test the reporter or result collector in isolation with direct messages; test the runner separately for sending the right messages.
- Decide explicitly which phases are protected (setup, body, teardown) and drive each with its own test.

## Red flags

- Staring at a big red test, adding code in many places at once.
- A bare `except` that swallows failures without recording them.
- One crashing unit of work aborting the whole run.
- Fixing a newly noticed problem with no test that shows it.
- Reporter logic tested only end-to-end through the runner.
- Field names that drift between the counter and the summary (count one thing, print another), which only a formatting test will catch.

## Related

- `../Counting/counting.md` — the shelved failing-method test this chapter completes.
- `../HowSuiteItIs/howSuiteItIs.md` — running many tests into one result.
- `../../Patterns/TestingPatterns/testingPatterns.md` — Child Test.
- `../../Patterns/XUnitPatterns/xUnitPatterns.md` — Exception Test and Assertion.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — handling exceptions without hiding them.
