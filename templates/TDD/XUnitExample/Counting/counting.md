---
name: tdd-counting
description: Choosing the order of tests, backing up when stuck, and growing a result/report object (run and failure counts, summary string) from a faked constant, based on Chapter 21 (Counting) of Test-Driven Development: By Example. Use when building a test result, report, summary or metrics object; when the next test turns out too hard and you are stuck; when a test needs infrastructure (like exception capture) that does not exist yet; or when deciding which test on the list to write next.
---

# Counting

Pick the next test because it will teach you something and you are confident you can make it pass. Grow a reporting object by faking its output first and replacing constants with computed values one at a time. When a test is too big, shelve it and write a smaller one that supports it.

## Order the tests deliberately

- The order in which tests are implemented matters. Before starting a test, check that it depends only on mechanisms that already exist.
- Example: tearDown-on-failure needs exception capture. Without capture, a mistake in that code would be invisible because failures are not reported. Do counting and failure capture first.
- If one test passes but you get stuck on the next, back up two steps (revert to the last green state before both) and choose differently. Treat each all-green run as a checkpoint you can return to.

## Make the report observable

- A test tool must say what it did: how many tests ran, how many failed, and which. If tests stop being invoked or results stop being reported, a count gives you a chance to notice.
- Have `run()` produce a result object rather than relying on the language's default error output.

## Fake It, then replace constants with variables

```python
def test_summary_counts_one_run(self):
    result = SpyCase("target").run()
    assert result.summary() == "1 run, 0 failed"

class TestResult:
    def __init__(self):
        self.run_count = 0
    def test_started(self):
        self.run_count += 1
    def summary(self):
        return f"{self.run_count} run, 0 failed"
```

Steps: return the literal string; turn the `1` into a field initialized to 1; initialize it to 0 and increment it from a `test_started()` message the runner sends. Leave the hard-coded `0 failed` alone: no test demands it yet. Instead write the next test, one where the test method raises.

## When the new test fails, go smaller

The failing-method test needs the runner to catch exceptions and record them, which is too much for one step. Put it on the shelf (keep it on the Test List) and write a smaller test that drives just the missing piece. Return to the shelved test once its support exists.

## Workflow

1. Choose the next Test List item whose prerequisites exist and that will teach something.
2. Write the test; make it pass with a faked return value.
3. Replace one constant at a time with state that is updated by a message from the caller.
4. Do not generalize parts no test exercises; write a new test that exercises them.
5. If that test is too big, shelve it, add a smaller supporting test to the list, and do that first.
6. If you are stuck, revert to the last all-green checkpoint and pick a different path.

## Red flags

- A runner or reporter whose only output is "OK" with no counts.
- Generalizing a value (like the failure count) without a test that would fail if it were wrong.
- Pushing on a test that needs infrastructure you have not built yet.
- Staying stuck rather than reverting to the last green state.
- A new test that is green on its first run: check that it can fail. In Python, `assert(expected, actual)` asserts a non-empty tuple and always passes.

## Related

- `../DealingWithFailure/dealingWithFailure.md` — the smaller test that unblocks failure counting.
- `../../Patterns/GreenBarPatterns/greenBarPatterns.md` — Fake It and Triangulate.
- `../../Patterns/RedBarPatterns/redBarPatterns.md` — One Step Test for choosing the next test, Do Over for backing up.
- `../../Patterns/TestingPatterns/testingPatterns.md` — Child Test, the smaller test that unblocks a big one.
- `../../Patterns/TDDPatterns/tddPatterns.md` — Test List.
- `../../MoneyExample/MakeIt/makeIt.md` — removing duplication between test and faked code.
