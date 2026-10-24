---
name: bdd-and-unit-testing
description: "Covers low-level BDD as TDD with a specification mindset: outside-in development from a failing scenario to step definitions to unit specs to production code, writing the code you would like to have in step definitions, letting acceptance criteria fan out into low-level specifications, deciding per collaborator whether to implement now, use a minimal implementation or stub/mock it, table-driven unit specs, behavior-named tests (should/When...), RSpec-style describe/context/it tools, Spock-style given/when/then/where, and fluent assertions, based on Chapter 10 (BDD and unit testing) of BDD in Action. Use when going from a pending Gherkin scenario to code, deciding which unit tests a step needs, naming test classes and methods, choosing between unit specs and scenario examples, using mocks to discover collaborators, parameterizing tests from example tables, or when the user mentions outside-in, double loop, BDD vs TDD, RSpec, Jest describe/it, Spock, JUnit 5 @ParameterizedTest, AssertJ, Hamcrest, Chai, should-style names or test-per-method smells."
---

# BDD and Unit Testing

BDD does not stop at the acceptance scenario: the same idea, specify behavior with concrete examples before writing code, continues down to classes and functions. Work outside-in: a failing scenario defines the goal, its step definitions sketch the API you wish you had, and unit-level specifications drive each piece of that API into existence until the scenario passes.

## BDD, TDD and who reads what

- Low-level BDD is TDD done with a specification mindset: test first, minimal code, refactor, but every test is phrased as a behavior a future developer can read.
- Both levels specify behavior; only the audience changes. Scenarios speak to the whole team in business language. Unit specs speak to the developers who will maintain the code: defaults, edge cases, contracts between classes.
- Keep the boundary from `actions/bdd.md`: the bdd workflow owns feature files, step definitions and glue; `tdd` owns unit specs; `dev` owns production code. This skill describes how those pieces hand off to each other.

## The outside-in loop

1. Pick one acceptance criterion of the current story (one scenario, or one row group of an outline).
2. Automate it as a pending scenario: wire step definitions that compile but are not implemented.
3. Implement the steps by writing the calls you would like to make to the application, even though the classes do not exist yet.
4. For each piece of that imagined API with nontrivial behavior, write a failing unit spec, make it pass with the least code, refactor.
5. Ask "what must the system still do for this scenario to pass?" and repeat. When the scenario is green, the criterion is done; move to the next one.

Why bother: code traces back to a business outcome, APIs are designed from the caller's side, and anything you write that no scenario needs is a signal of either a missing scenario or waste.

## Step definitions are design sketches

The first time a step touches application code is a design decision. Write the call you would want to read:

```gherkin
Rule: Overdue invoices accrue a late fee
  Scenario: Fee charged after the grace period
    Given an invoice of 1000.00 due on 2026-03-01
    When it is still unpaid on 2026-03-20
    Then a late fee of 15.00 should be added
```

```ts
// features/step_definitions/invoice.steps.ts  (@cucumber/cucumber)
Given("an invoice of {float} due on {string}", function (amount: number, due: string) {
  this.invoice = Invoice.issue({ amount: Money.of(amount), dueOn: LocalDate.parse(due) });
});
When("it is still unpaid on {string}", function (day: string) {
  this.fee = this.invoice.lateFeeOn(LocalDate.parse(day));
});
Then("a late fee of {float} should be added", function (expected: number) {
  expect(this.fee).toEqual(Money.of(expected));
});
```

`Invoice.issue` and `lateFeeOn` do not exist yet; the step has just specified them. Keep the step thin: it should delegate to the domain, not compute the fee itself.

- Before naming new classes, check the domain language agreed during discovery (glossary, spec, existing model). Step code is where the ubiquitous language becomes types and method names.
- Some steps are trivial (store a value for later steps). Do not write unit specs for those.

## From step to unit specs: the fan-out

One high-level criterion usually hides several low-level rules. "A late fee of 15.00 should be added" fans out into: no fee inside the grace period, fee computed from the outstanding amount, rounding, partial payments, a cap.

- Write a unit spec for each rule that has real logic. Skip specs for plain getters, setters and constructors; they get exercised by the specs that need them. A test that only says "has a dueDate field" documents nothing about why.
- Unit specs cover technical edge cases the business does not care to see in scenarios: zero, the exact boundary, one past it, empty collections, invalid input.
- Re-expressing one scenario example as a unit spec is fine as the starting point for implementation; do not mirror every example table row at both levels unless each level adds information.

```ts
describe("Late fee", () => {
  it("is zero while the invoice is within the grace period", () => {
    const invoice = anInvoice().dueOn("2026-03-01").amount(1000).build();
    expect(invoice.lateFeeOn(day("2026-03-15"))).toEqual(Money.zero());
  });

  it.each`
    daysLate | expectedFee
    ${14}    | ${0}
    ${15}    | ${15}
    ${45}    | ${30}
    ${200}   | ${50}
  `("charges $expectedFee when paid $daysLate days late", ({ daysLate, expectedFee }) => {
    const invoice = anInvoice().dueOn("2026-03-01").amount(1000).build();
    expect(invoice.lateFeeOn(day("2026-03-01").plusDays(daysLate))).toEqual(Money.of(expectedFee));
  });
});
```

How many unit specs to write per table: if each row exercises different logic, one spec per boundary; if the rule is data-driven and identical for every row, one representative spec and let the scenario outline cover the rest. Duplicating every business row means two places to change when the rule changes.

## Collaborators you discover on the way

Writing the code you would like to have applies to production code too. When `lateFeeOn` needs a fee policy that does not exist, pick one of three moves:

| Move | When | Cost |
|---|---|---|
| Implement it now | Small, obvious behavior | Can balloon; park the current spec (`it.skip`, `@Disabled`) and remember to restore it |
| Minimal real implementation | You want to feel the API before committing | Test becomes an integration test; may get slow |
| Stub or mock it | Complex collaborator, unclear rules, or a slow boundary | More test setup; but you define the contract explicitly and stay on one red test |

```ts
it("adds the fee the policy returns for the days overdue", () => {
  const policy: FeePolicy = { feeFor: vi.fn().mockReturnValue(Money.of(15)) };
  const invoice = anInvoice().dueOn("2026-03-01").withPolicy(policy).build();

  expect(invoice.lateFeeOn(day("2026-03-20"))).toEqual(Money.of(15));
  expect(policy.feeFor).toHaveBeenCalledWith(19, Money.of(1000));
});
```

The mock encodes a contract ("given 19 days and 1000, the policy answers"). Afterwards, specify the real `TieredFeePolicy` directly with its own boundary cases, so the contract is honored by a real implementation and not only by the mock.

## Naming specs as behavior

- Name tests after what the unit should do, not after the method: `should_waive_fee_inside_grace_period`, not `testLateFee`. Method names change during refactoring; behavior rarely does.
- Name the test class or outer `describe` after the context: `WhenAnInvoiceIsOverdue`, `describe("Late fee")`. It need not match a production class that may not exist yet.
- "Should" invites the question "should it, always?", which surfaces missing cases. It is not an RFC 2119 "nice to have": anything in an acceptance criterion is required, and a criterion found not to matter is deleted.
- If the framework forces a `test` prefix (Python `unittest`), use `test_that_...`.
- Nest contexts (`describe` / `context` / nested classes) so the run output reads like a spec outline.

## Choosing the low-level tool

- Any xUnit tool works with descriptive names and given/when/then structure in the body.
- RSpec-family tools (RSpec, Jest, Vitest, Mocha, Jasmine, NSpec) use `describe`/`it` and print documentation-style output (`rspec --format documentation`, `jest --verbose`, `vitest --reporter=verbose`).
- Spock makes given/when/then and `where:` tables first-class, without separate feature files; good when unit specs are example-heavy.

```groovy
def "fee depends on days overdue"() {
  expect:
  new TieredFeePolicy().feeFor(daysLate, Money.of(1000)) == Money.of(fee)
  where:
  daysLate | fee
  14       | 0
  15       | 15
  200      | 50
}
```

Current note: Spock 2 runs on the JUnit Platform. JUnit 5 replaces the JUnit 4 `Parameterized` runner with `@ParameterizedTest` plus `@CsvSource` or `@MethodSource`, and `@Ignore` with `@Disabled`. In JavaScript, Jest and Vitest (`it.each`, `describe.each`) have largely displaced Jasmine and Mocha for new projects. FEST-Assert is no longer maintained; AssertJ is its successor.

## Fluent assertions and readable test code

- Test code is sample code: when an old spec fails, someone must understand what it demonstrated and how before deciding to fix the code or the spec.
- Use builders or named parameters for test data (`anInvoice().dueOn(...).amount(...)`) instead of positional constructors whose argument order readers must guess.
- Prefer expressive matchers over loops and conditionals in tests: `expect(fees).toHaveLength(3)`, `assertThat(lines).extracting("sku").contains("A1", "B2")`, `assertThat(ages, everyItem(lessThan(18)))`. Logic in a test is a place for the test itself to be wrong.
- `expect`/`should` style describes intent; `assert` style describes verification after the fact. Either is fine; be consistent per codebase.

## Workflow

1. Take one acceptance criterion from the current story; confirm its scenario exists and fails (or is pending).
2. Implement its step definitions as thin calls to the API you wish existed, using the agreed domain vocabulary.
3. List the low-level rules that API implies; mark trivial ones (no spec) and logic-bearing ones (spec).
4. For each logic-bearing rule: write one failing, behavior-named unit spec, write the least code, refactor code and spec names.
5. For each new collaborator, choose implement now, minimal implementation, or stub/mock; if mocked, schedule the real implementation's own specs.
6. Add technical edge cases at unit level; keep business examples in the scenario.
7. Rerun the scenario; when green, refactor across both levels and move to the next criterion.

## Red flags

- Production code written before any failing scenario or unit spec asks for it.
- Step definitions containing business logic, or reaching into private state instead of the public API.
- Test names like `testCalculate`, `test1`, or one test class per production class by reflex.
- Dedicated tests for getters, setters and constructors.
- Every business example duplicated row by row in unit tests, so a rule change breaks two suites.
- Mocks whose contracts are never verified against a real implementation.
- Several skipped tests left behind after "implement it now" detours.
- Loops, ifs or try/catch inside test bodies to compute the expected value.
- Code with no scenario or spec tracing it to a requirement.

## Related

- `../../../actions/bdd.md` — the workflow that owns scenarios and step definitions and hands off to tdd.
- `../../../actions/tdd.md` — the inner loop that owns unit specs.
- `../../../actions/dev.md` — production code driven by both loops.
- `../AcceptanceTests/acceptanceTests.md` — keeping step definitions and acceptance glue maintainable.
- `../UiAcceptanceCriteria/uiAcceptanceCriteria.md` — when the outer loop drives a UI rather than the domain.
- `../NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — automating criteria against services and domain code.
- `../../DefiningRequirements/AutomatingScenarios/automatingScenarios.md` — wiring pending scenarios and step definitions.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — unit specs as technical living documentation.
- `../../../TDD/Patterns/TDDPatterns/tddPatterns.md` — Test List and Test First (when installed).
- `../../../TDD/Patterns/RedBarPatterns/redBarPatterns.md` — choosing the next test (when installed).
- `../../../TDD/Patterns/GreenBarPatterns/greenBarPatterns.md` — Fake It and Triangulate for the minimal step (when installed).
- `../../../TDD/Patterns/TestingPatterns/testingPatterns.md` — Mock Object and Child Test (when installed).
- `../../../CleanCode/UnitTests/unitTests.md` — clean, readable test code (when installed).
