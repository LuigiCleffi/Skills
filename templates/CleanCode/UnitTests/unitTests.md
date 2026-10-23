---
name: clean-code-unit-tests
description: Writing clean, readable, maintainable unit tests and practicing TDD, based on Chapter 9 (Unit Tests) of Clean Code. Use whenever the AI writes or reviews unit tests, the user asks how to structure tests, whether test code needs the same quality as production code, about test-driven development, given-when-then or build-operate-check, test helpers or test DSLs, how many asserts per test, flaky, slow or order-dependent tests, or the F.I.R.S.T. properties.
---

# Unit Tests

Test code is as important as production code. Tests keep production code flexible, maintainable and reusable, because with a trustworthy suite you aren't afraid to change anything.

## The three laws of TDD

1. Don't write production code until you have a failing unit test.
2. Don't write more of a test than is enough to fail. A test that doesn't compile counts as failing.
3. Don't write more production code than is enough to pass the currently failing test.

These keep you in a very short cycle, measured in seconds to minutes, so tests and code grow together and the tests cover nearly everything. When the user practices TDD, follow the cycle: red, green, refactor. When `actions/tdd.md` is installed, it defines the test-first workflow; this skill defines what a clean test looks like. Otherwise, still write the tests alongside the code, not as an afterthought.

## Keep tests clean

Dirty tests are worse than no tests, maybe even more than having none. As production code evolves, messy tests become hard to change. They then turn into a burden, get blamed for slowing the team down, and are eventually thrown away. Without tests, the code rots, because no one dares to clean it.

Hold test code to the same standard as production code: good names, small functions, no duplication and clear structure.

## What makes a test clean

**Readability, readability, readability.** Say a lot with few expressions, and remove irrelevant detail.

- Use the **Build–Operate–Check** pattern (also called Arrange–Act–Assert or Given–When–Then). Build the test data, operate on it, and check the result. Keep each part visually distinct and short.
- Hide setup noise behind well-named helpers so the test shows only what matters to it.

**Domain-specific testing language.** Build up helper functions and fixtures that let tests read in domain terms:

```
def test_get_page_hierarchy_as_xml():
    make_pages("PageOne", "PageOne.ChildOne", "PageTwo")
    submit_request("root", type="pages")
    assert_response_is_xml()
    assert_response_contains("<name>PageOne</name>", "<name>PageTwo</name>", "<name>ChildOne</name>")
```

This testing API grows out of refactoring duplicated test code. It isn't designed up front.

**A dual standard.** Test code must be simple and expressive, but it doesn't need to be as efficient as production code. It runs in a test environment, so readability wins over small performance concerns that would matter in production. For example, a test may build a readable string representation of state and assert on that, if it makes the test clearer.

## Asserts and concepts

- **One assert per test** is a good guideline. A test with one assertion reaches a single, easily understood conclusion. Given–When–Then naming plus extracted helpers (or a Template Method base for the shared Given/When) makes this practical.
- **One concept per test** is the better rule. Don't let one test function check several unrelated behaviors in sequence. Split those into separate tests. Several asserts are fine when together they verify one concept.
- Aim to minimize the number of asserts per concept and test exactly one concept per test function.

## F.I.R.S.T.

- **Fast.** Slow tests don't get run often, so problems are found late and cleanup stops.
- **Independent.** No test sets up the next one. Each can run alone and in any order. Dependent tests cascade failures and hide the real defect.
- **Repeatable.** Tests pass in any environment: production-like, QA, a laptop with no network. Otherwise there's always an excuse for failures. Control time, randomness, network and file system.
- **Self-validating.** Tests pass or fail as a boolean outcome. Nobody should have to read logs or compare files by hand.
- **Timely.** Write tests just before the production code that makes them pass. Code written first often turns out hard to test.

## Writing tests: workflow

1. Name the test after the behavior (`test_rejects_withdrawal_exceeding_balance`), not the method.
2. Write the Given/When/Then structure first, using helper functions that don't exist yet. That defines your testing language.
3. Implement the helpers, keeping setup details out of the test body.
4. Assert one concept. Prefer specific assertions with good failure messages.
5. Check F.I.R.S.T.: no sleeps, no shared mutable state, no reliance on real clocks or network. Use fakes or injected dependencies instead.
6. Refactor the tests themselves: remove duplication into fixtures and helpers without hiding what's being tested.

## Reviewing tests: red flags

Long test functions covering several behaviors; magic literals with no explanation; copy-pasted setup; tests depending on execution order; sleeps or real time; assertions on incidental details that make tests brittle; commented-out or skipped tests with no reason given.
