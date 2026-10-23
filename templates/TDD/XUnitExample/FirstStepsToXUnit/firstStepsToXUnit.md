---
name: tdd-first-steps-to-xunit
description: Bootstrapping test-first development of tooling that must verify itself (a test runner, assertion library, linter, build step), and the core xUnit mechanic of a test case that runs a named method, based on Chapter 18 (First Steps to xUnit) of Test-Driven Development: By Example. Use when the user asks to build a test framework, test harness, plugin runner or self-checking tool; when there is no test infrastructure yet to run the first test; when a test runner "runs" but you cannot tell whether a test method was actually invoked; or when dynamic method dispatch by name (getattr, reflection) is being introduced.
---

# First Steps to xUnit

When the code under test is the tool that runs the tests, you cannot trust the tool to check its own first step. Verify the first tiny step by hand, then use the smallest working mechanism to automate every check after it, moving in very small steps until the bootstrap is over.

## The bootstrap problem

- Test infrastructure, runners, harnesses and checkers have a chicken-and-egg start: the thing that would report failures does not exist yet.
- Break the loop with a **hand-checked proto-test**: a few lines that print a value before and after the action, and you read the output. Once that is right, replace the prints with assertions run by the new mechanism.
- Use the language's built-in `assert` (or a plain exit code) as the only trusted primitive until your own reporting exists.
- Bootstrapping is the worst case for TDD. Take steps so small they feel silly; big steps here produce code you believe works when it does not.

## Start with a Test List

Before any code, write the to-do list of behaviors the tool needs, in the order you expect to tackle them. For a test framework: invoke the test method, call setUp first, call tearDown after, call tearDown even on failure, run several tests, report collected results. Work the list one item at a time and add items as you discover them.

## Prove the method actually ran

Use a test subject that records whether it was called (a spy flag). Check the flag is unset before running and set after. A runner that silently skips the method is the most dangerous bug a test tool can have, so this is the first test.

```python
class SpyCase(TestCase):
    def __init__(self, name):
        super().__init__(name)
        self.ran = False
    def target(self):
        self.ran = True

def test_runs_named_method():
    spy = SpyCase("target")
    spy.run()
    assert spy.ran
```

## Make it work, then generalize

1. **Fake It**: `run()` first calls the one hard-coded method directly.
2. **Replace constants with variables**: look the method up by the stored name (`getattr(self, self.name)`). This is a **Pluggable Selector**; it is handy in a framework but makes code hard to analyze statically, so keep it out of ordinary application code.
3. Generalize from the concrete example the test gives you, not from reasoning alone.

## Split, then extract the superclass

- When one class does two jobs (here: recording that a method ran, and dispatching to a method by name), separate them so each can be worked on alone.
- Create an empty base class, make the existing class extend it, then move the shared attribute up, then the method that uses only that attribute. Put operations next to the data they use.
- Run the tests after every move.

## Workflow

1. Write the Test List for the tool.
2. Write a proto-test that prints state before and after; check the output by eye.
3. Make it pass with the most direct code possible.
4. Route the call through the real public entry point (`run()`), still green.
5. Generalize hard-coded choices into data (method name as a parameter).
6. Extract the reusable part into a base class, one move at a time, running the check after each.
7. Replace the printed proto-test with a real test written in the new framework, and cross the item off.

## Red flags

- Writing a large chunk of runner code before any check exists; "it seems to work" with no evidence the test body ran.
- A test tool whose own tests only pass because nothing is executed.
- Printing and eyeballing output after the mechanism to automate the check already exists.
- Several refactoring moves batched without running the tests between them.
- Reflection or name-based dispatch spreading into application code because it was convenient in the framework.
- Skipping tiny steps because "it is obvious": the ability to drop to tiny steps is exactly what bootstrapping needs.

## Related

- `../SetTheTable/setTheTable.md` — the next step: a fresh fixture per test via setUp.
- `../XUnitRetrospective/xUnitRetrospective.md` — the full test sequence for building an xUnit.
- `../../Patterns/XUnitPatterns/xUnitPatterns.md` — Test Method, Fixture and the other xUnit patterns.
- `../../Patterns/DesignPatterns/designPatterns.md` — Pluggable Selector and its trade-offs.
- `../../MoneyExample/MultiCurrencyMoney/multiCurrencyMoney.md` — the to-do list and red/green rhythm on a simpler domain.
- `../../../CleanCode/UnitTests/unitTests.md` — what a clean test looks like once the framework exists.
