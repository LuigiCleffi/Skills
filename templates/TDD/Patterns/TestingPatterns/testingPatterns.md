---
name: tdd-testing-patterns
description: "Detailed techniques for writing individual tests (shrinking an oversized test, faking expensive collaborators, checking communication and call order, forcing error paths, ending a session), based on Chapter 27 (Testing Patterns) of Test-Driven Development: By Example. Use when a test needs too many changes to pass, code depends on a database, network or other slow or global resource, you must verify callbacks, observers or call order, error-handling code is untested, or you are ending a work session solo or committing to a shared branch."
---

# Testing Patterns

These are the hands-on techniques for writing tests. Keep the red/green/refactor rhythm by shrinking tests that are too big; replace expensive or awkward collaborators with simple stand-ins; let the test itself observe communication; force rare errors deliberately; and leave each session in the right state for whoever comes next.

## Child Test

**Question:** How do you get a test case running that turns out to be too big? **Answer:** Write a smaller test for the broken part, get it running, then reintroduce the big one.

- The red/green/refactor rhythm is worth extra effort to protect; even ten minutes red is a warning.
- First learn the lesson: why was it too big, what would have made it smaller?
- Then delete or disable the big test, write child tests for A, B and C, make them pass, and bring the parent back.
- Keeping both the parent and the child red for a few minutes is possible; notice whether it changes how you work and choose accordingly.

## Mock Object

**Question:** How do you test an object that relies on an expensive or complicated resource? **Answer:** Create a fake version of the resource that answers with constants.

- Classic case: the database. It is slow to start, hard to keep clean, ties tests to a network location, and is a rich source of errors.
- Most tests use an in-memory stand-in that expects a given request and returns canned results; an unexpected request fails loudly.
- Mocks improve readability: the test shows why the answer is two orders, instead of a real dataset that somehow yields 14.
- You cannot use mocks easily if the resource lives in a global (including a Singleton). Pass the dependency in; it usually touches fewer methods than feared and cleans up the design.
- Mocks push you to think about each object's visibility, reducing coupling.
- Risk: the mock may not behave like the real thing. Mitigate with a test suite you can run against both the mock and the real object.

```python
def test_order_lookup():
    db = FakeDatabase(expect="orders for customer 123",
                      returns=["Order 2", "Order 3"])
    assert OrderService(db).orders_for(123) == ["Order 2", "Order 3"]
```

## Self Shunt

**Question:** How do you test that one object communicates correctly with another? **Answer:** Have the object under test talk to the test case instead of the object it expects.

```python
class ResultListenerTest(unittest.TestCase):
    def test_notifies_listener(self):
        self.count = 0
        result = TestResult()
        result.add_listener(self)
        WasRun("test_method").run(result)
        self.assertEqual(1, self.count)

    def start_test(self):          # the test case is the listener
        self.count += 1
```

- Reads better than a separate listener class: the start and end values of the counter sit in one place.
- May require Extract Interface. Decide whether extracting is easier than black-box testing; extracted interfaces often gain more implementations soon.
- In statically typed languages you must implement the whole interface, so prefer narrow interfaces. Unused methods return a sensible value or throw, depending on whether you want to know they were called.

## Log String

**Question:** How do you test that messages are called in the right order? **Answer:** Keep a log in a string and append to it whenever a message is called.

```python
def test_template_method_order():
    test = WasRun("test_method")
    test.run(TestResult())
    assert test.log == "setUp test_method tearDown "
```

- Each hook appends its name; the assertion shows the whole sequence at a glance.
- Especially useful for Observer, where notifications must arrive in order. If order does not matter, keep a set of strings and compare sets.
- Combines well with Self Shunt: the test implements the shunted interface by appending to the log and returning reasonable values.

## Crash Test Dummy

**Question:** How do you test error code that is unlikely to run? **Answer:** Invoke it anyway, with a special object that throws instead of doing real work.

- Assume untested code does not work. Test error paths if you want them to work.
- Instead of actually filling the disk, fake a file whose create method raises.
- Like a Mock Object, but you only sabotage the one method you need. Inline overrides (anonymous subclasses, small local classes, stubs) keep the sabotage visible in the test.

```python
def test_save_reports_full_disk():
    class FullFile(File):
        def create(self):
            raise IOError("disk full")
    with pytest.raises(IOError):
        save_as(FullFile("foo"))
```

## Broken Test

**Question:** How do you leave a programming session when working alone? **Answer:** Leave the last test broken.

- Like stopping a writing session mid-sentence: when you return, the failing test is an obvious, concrete place to resume, and making it pass is quick.
- A failing test does not make the program less finished; it makes its state visible.

## Clean Check-in

**Question:** How do you leave a programming session when working on a team? **Answer:** Leave all the tests running.

- Teammates do not know what changed since they last looked; they need to start from confidence. Never check in on red.
- The check-in suite may be larger than the one you run every minute; run the full suite as long as it is not annoyingly slow.
- If an integration test fails at check-in, the simplest rule is to throw away your work and start over: you did not know enough. This encourages frequent check-ins.
- A looser rule: fix and retry, but give up after a few minutes so you do not hog integration.
- Commenting out (or skipping) tests to make the suite pass is forbidden.

## Workflow

1. Test needs too many changes: stop, write Child Tests for the parts, then restore it.
2. Slow, remote or global dependency: inject it and use a Mock Object; keep a shared suite to check mock and real agree.
3. Verifying notifications or callbacks: Self Shunt; for ordering, add a Log String.
4. Error path: Crash Test Dummy that throws from the one method involved.
5. Ending solo work: leave one Broken Test as the bookmark. Committing to shared code: Clean Check-in, all green.

## Red flags

- Staying red for long because the test bundles several unfinished behaviors.
- Tests hitting a real database or network for ordinary logic; expected results nobody can explain.
- Dependencies reached through globals or Singletons, so they cannot be swapped.
- Separate listener or spy classes that scatter setup and expectations across files.
- Order-sensitive behavior verified only implicitly, or not at all.
- Catch blocks and error branches that no test ever executes.
- Pushing red to a shared branch, or skipping and commenting out tests to get green.

## Related

- `../RedBarPatterns/redBarPatterns.md` — One Step Test and Do Over, the alternatives to an oversized test.
- `../GreenBarPatterns/greenBarPatterns.md` — making each child test pass.
- `../TDDPatterns/tddPatterns.md` — Isolated Test, which mocks make practical.
- `../../../CleanCode/UnitTests/unitTests.md` — readable, repeatable tests (F.I.R.S.T.).
- `../../../CleanCode/ErrorHandling/errorHandling.md` — designing the error paths Crash Test Dummy exercises.
