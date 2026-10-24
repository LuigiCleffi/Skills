---
name: tdd-abstraction-finally
description: "Finishing an abstraction by implementing the remaining interface operations with tests written for future readers, following compiler ripples, and running short experiments you discard if they fail, based on Chapter 16 (Abstraction, Finally) of Test-Driven Development: By Example. Use when completing stubbed interface methods, when a test is longer than the code it drives, when deciding how to construct test inputs for clarity, when weighing whether TDD pays off, or when an implementation-detail experiment is not working out."
---

# Abstraction, Finally

Finish the abstraction one operation at a time. Write each test so a future reader understands it, even if that makes the test longer than the code. Follow the compiler when a new interface declaration ripples. Try small experiments, and delete them when they do not work out cleanly.

## Tests are written for readers

- Build inputs the way that communicates most directly. Constructing the composite explicitly says more than producing it as a side effect of another operation.
- It is normal for a test to be longer than the code it drives. If several tests share long setup, extract a Fixture.

```python
def test_sum_times():
    five_bucks, ten_francs = Money.dollar(5), Money.franc(10)
    bank = Bank()
    bank.add_rate("CHF", "USD", 2)
    total = Sum(five_bucks, ten_francs).times(2)
    assert bank.reduce(total, "USD") == Money.dollar(20)
```

## Completing the interface

- Implement the operation on the composite first; once it works there, declaring it on the interface is a single step.
- The declaration may force visibility or signature changes in every implementer. Let the compiler list them.
- Identical bodies in two implementers (both `plus` methods creating a sum) hint at a future abstract base. Note it; do not act until it pays.

## Experiments you can throw away

- A test on internal shape (asserting the result's concrete type) is acceptable as an experiment to steer a change.
- If there is no clean way to make it pass, delete the test and move on. Do not keep tests you dislike and cannot satisfy cleanly.

## Is TDD paying off?

- Expect roughly as many test lines as production lines.
- To compare with your current style, measure, and include debugging, integration and explanation time, not just typing speed.

## Workflow

1. Take the next stubbed operation from the Test List.
2. Write its test on the composite, with inputs built for clarity.
3. Implement it on the composite.
4. Declare it on the interface; follow compiler errors through every implementer.
5. Run all tests; cross the item off.
6. If an experiment test cannot pass cleanly, delete it and record the decision.
7. Note duplication across implementers for the retrospective.

## Red flags

- Test inputs built indirectly so the reader must reverse-engineer the scenario.
- Trimming a test's clarity just to make it shorter than the code.
- Keeping an implementation-detail test that never went green cleanly.
- Judging TDD by lines per hour without counting debugging and integration.
- Adding an abstract base class the moment two methods match.

## Related
- `../MixedCurrencies/mixedCurrencies.md` — where these stubs were added.
- `../MoneyRetrospective/moneyRetrospective.md` — reviewing the remaining duplication and the whole session.
- `../../Patterns/XUnitPatterns/xUnitPatterns.md` — Fixture for shared setup.
- `../../Patterns/TestingPatterns/testingPatterns.md` — Evident Data and readable tests.
- `../../Patterns/DesignPatterns/designPatterns.md` — Composite.
- `../../../CleanCode/UnitTests/unitTests.md` — readability first in tests.
