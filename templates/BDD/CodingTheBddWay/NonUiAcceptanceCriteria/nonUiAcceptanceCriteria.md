---
name: bdd-non-ui-acceptance-criteria
description: "Covers automating acceptance criteria without driving the UI: balancing UI and non-UI scenarios by where business logic lives (thin client, rich single-page or mobile client, legacy without a service layer), table-driven business rules, spending conversation time on uncertain rules, testing under the skin at the controller layer (server MVC and client-side controllers), testing domain logic and batch, file or message processing directly, testing REST and other service APIs with production-like clients, inline JSON in scenarios, nonfunctional requirements such as performance expressed as business-meaningful scenarios with percentiles, and using scenarios to discover clean APIs by writing the code you wish you had, based on Chapter 9 (Automating acceptance criteria for non-UI requirements) of BDD in Action. Use when a business rule has many examples, deciding whether to automate a scenario through the UI, controller, service or domain layer, testing an API, microservice, message consumer, batch job or file import with Cucumber or behave, comparing JSON responses in steps, writing performance, load or other NFR scenarios, the UI suite is too slow, or the user mentions MockMvc, REST Assured, supertest, API acceptance tests, service layer tests, subcutaneous tests, Scenario Outline for business rules, JSON in Gherkin, k6, Gatling, JMeter, percentiles, SLAs or outside-in API design."
---

# Automating Acceptance Criteria for Non-UI Requirements

Automate each scenario at the lowest layer that still proves the business behavior it describes. Keep a few UI scenarios for journeys and on-screen rules, and run the bulk of business-rule examples against controllers, services or domain code, where they are faster, more precise and less fragile. Hold nonfunctional requirements to the same standard: business-meaningful, agreed examples that can be checked automatically.

## Balance UI and non-UI scenarios by architecture

Where the business logic lives decides where the scenarios run.

| Architecture | UI scenarios verify | Non-UI scenarios verify |
|---|---|---|
| Thin client, logic in a server-side service layer | Screen flow, validation messages, rendering of results, one end-to-end path | Business rules against the service API |
| Rich SPA or mobile client calling web services | Screen flow and client-side business logic | Rules in the web services; the API as a product in its own right |
| Legacy app with logic scattered across layers | Pragmatically, both UI behavior and rules, until seams exist | Whatever can be isolated; add seams as you refactor |

- Business logic that lives only in the UI can only be proven through the UI (or by unit tests of the client code).
- A thin, well-defined service API is a sign of good design; difficulty isolating a rule is design feedback, not a reason to push everything into browser tests.

## Separate journey scenarios from rule scenarios

A journey scenario deliberately glosses over the rule that decides the outcome; a rule scenario explores that rule with many examples.

```gherkin
@ui
Scenario: A member is told when a loan is approved instantly
  Given Tomas is a member eligible for instant approval
  When Tomas applies for a personal loan
  Then he should see that his loan is approved
  And he should receive a confirmation email

Rule: Instant approval depends on credit score and membership years

  Scenario Outline: Deciding the approval route
    Given an applicant with credit score <score> and <years> years of membership
    When the application is assessed
    Then the route should be <route>

    Examples:
      | score | years | route    |
      | 780   | 0     | instant  |
      | 700   | 3     | instant  |
      | 700   | 2     | manual   |
      | 579   | 10    | declined |
```

- Run one UI scenario per visibly different outcome (approved, manual, declined) and the full table against the decision service. Three browser tests plus a fast table, instead of every row through the UI.
- Tables are ideal for exploring a rule's positive and negative cases and its boundaries; add a notes column if it helps readers.
- Current note: the Gherkin `Rule:` keyword (Gherkin 6+) groups the examples for one rule, as above.

Spend discovery time where uncertainty is. Familiar mechanics (a standard login against an existing identity provider) need one example and a few counterexamples; new or risky rules deserve full three amigos sessions. When the examples start stating the obvious, move on.

## Choose the automation layer

| Layer | How the step exercises the system | Strengths | Limits |
|---|---|---|---|
| Controller (under the skin) | Simulate a request into the controller; check the chosen view or response and the model data | Fast; covers routing, validation and wiring without a browser | Cannot prove the page renders correctly; harder to set up for long journeys; less convincing for non-technical readers |
| Domain/application code | Call the service or domain object directly with the example inputs | Fastest and most precise; ideal for calculations, eligibility, pricing, routing | Does not prove the components are wired together |
| Service API (remote) | Call the deployed HTTP/gRPC/messaging interface with a real client | Proves the contract other clients use; documents how to call it | Needs a running environment and controlled data |

In principle acceptance criteria are end to end; in practice, isolate a rule when it has well-defined inputs and outputs, and keep a few end-to-end scenarios to confirm the wiring and display. Make the choice explicit with tags (`@ui`, `@api`, `@domain`) so it is visible in reports.

### Controller level

```java
// Cucumber-JVM 7 + Spring MockMvc
@When("I open the status page for parcel {word}")
public void openStatus(String parcelId) throws Exception {
    result = mockMvc.perform(get("/parcels/{id}", parcelId)).andExpect(status().isOk());
}

@Then("I should see that it is {word}")
public void shouldSeeStatus(String expected) throws Exception {
    result.andExpect(view().name("parcel-status"))
          .andExpect(model().attribute("status", expected));
}
```

Client-side controllers and view models can be tested the same way with the UI framework's test utilities. Decide per scenario whether to use real collaborators (proves wiring, needs seeded data) or a stub (explores outcomes precisely). Current note: AngularJS and Jasmine-era setups are largely replaced by Angular, React or Vue with Jest or Vitest and Testing Library; cucumber-js can drive these directly.

### Domain logic, batch and message processing

Batch jobs, file imports, message consumers and back-office processes often have no meaningful UI. Feed the example input straight into the processing code.

```gherkin
Scenario: A claim file line is routed by claim type and amount
  Given a claim file containing:
    """
    CLM|88123|MOTOR|2450.00|2024-05-02
    """
  When the claim file is processed
  Then the claim should be queued as:
    | claimId | type  | amount  | queue        |
    | 88123   | MOTOR | 2450.00 | fast-track   |
```

When raw content clutters the scenario, use named known files (`motor_small.txt`, `property_large.txt`) in an Examples table, the same idea as personas. Wire production services into the steps through the project's dependency injection (Cucumber-JVM supports Spring, Guice and PicoContainer; cucumber-js uses the World; behave uses `context`).

### Service APIs

Treat a service consumed by several clients as its own product with its own scenarios. If you struggle to write clean examples with clear inputs and outcomes, the service design needs more thought.

```ts
// @cucumber/cucumber, Node 18+ fetch
When("I request the details of order {string}", async function (id: string) {
  this.response = await fetch(`${this.apiUrl}/orders/${id}`, { headers: this.authHeaders });
});

Then("I should receive:", async function (table: DataTable) {
  expect(this.response.status).toBe(200);
  const body = await this.response.json();
  expect(body).toMatchObject(coerce(table.hashes()[0])); // lenient: extra fields allowed
});
```

- Write the first version of the scenario in domain terms, readable by people who do not know JSON; it settles what the service must return.
- When the audience is technical (front-end developers consuming the API) and the payload is small and clean, a JSON doc string is fine; compare it leniently (order and extra fields ignored where the rule allows) with JSONassert, `toMatchObject` or `jsonpath` checks.
- Use the same client library the production consumers use, so the glue code doubles as a usage example.
- Current note: for Java, REST Assured and Spring's `WebTestClient` are common; in Node, supertest or Playwright's `request` fixture; in Python, `requests` or `httpx` from behave steps. For services owned by separate teams, consumer-driven contract tests (Pact) complement these scenarios.

## Nonfunctional requirements as scenarios

Performance, availability, security and accessibility requirements must earn their place by business value like any feature. Use conversation to find which ones matter, for which parts of the system, at what thresholds.

```gherkin
Feature: Order confirmation latency
  Scenario: Confirmations keep up with a sale-day peak
    Given the order service is deployed in the performance environment
    When a recorded sale-day peak hour is replayed at 3 times its volume
    Then 95% of confirmations should be sent within 5 seconds
    And 100% of confirmations should be sent within 20 seconds
    And no order should be lost
```

- Express thresholds as percentiles and outcomes the business recognizes, not CPU or memory figures.
- Base load on observed production traffic (record and replay anonymized data) or, for a new system, on agreed usage estimates.
- Automate by having the step launch a scriptable load tool, wait for it, parse its results and assert the percentiles. Current note: k6, Gatling, JMeter and Locust are the common open-source choices; The Grinder is no longer active.
- Monitor low-level metrics (CPU, memory, GC, DB time) during the run but do not assert on them; use them to diagnose when the business-level scenario fails.
- Run these scenarios in a dedicated, production-like environment and usually on a schedule, not on every commit.

## Discovering the design

Each layer is the user of the layer below, so each boundary is an API. Automating a scenario is a chance to design that API from the caller's side.

- In the step definition, write the call you wish existed (`const report = await birthdays.forWeekOf(date)`), then let the compiler or IDE generate the missing type and method.
- Repeat inside the production code: write the collaborator calls you would like, then implement them. The API reflects what is convenient to use, not what was easy to build.
- This is where the outer BDD loop hands over to the inner loop: the newly imagined classes are specified with unit-level tests (see the BDD and unit testing skill and tdd).

## Workflow

1. List the scenarios for the story; mark each as journey, on-screen rule, or business rule.
2. Locate where each rule is implemented (client, controller, service, domain, batch) and pick the lowest layer that proves it; tag accordingly.
3. Keep one UI scenario per visibly distinct outcome; move combinatorial examples into Scenario Outlines run at the service or domain level.
4. Write step definitions that call the chosen layer through the Technical layer (API client, controller harness, service facade), using production-like clients and DI wiring.
5. Compare structured results leniently and through domain fields, not raw strings.
6. For NFRs, agree business thresholds and load profiles, script the load tool, assert only on business-level percentiles, record low-level metrics for diagnosis.
7. Use any awkwardness in writing clean examples or calls as design feedback, and drive the new components with tdd.

## Red flags

- Every row of a rule table executed through the browser.
- No end-to-end scenario at all, so nothing proves the layers are wired together.
- Controller-level tests passing while the page shows the wrong message (no UI check of rendering).
- Step definitions that build raw HTTP requests or parse JSON inline instead of using a client class.
- Strict string equality on JSON payloads, failing on field order or harmless extra fields.
- Performance "requirements" stated as average response time or CPU usage with no business owner.
- Load tests with invented data that does not resemble production traffic.
- Scenarios for a service that cannot state clear inputs and outputs, accepted without questioning the service design.

## Related

- `../AcceptanceTests/acceptanceTests.md` — layers, hooks and data setup shared by all automation levels.
- `../UiAcceptanceCriteria/uiAcceptanceCriteria.md` — the few scenarios that should drive the UI.
- `../BddAndUnitTesting/bddAndUnitTesting.md` — the inner loop that implements the APIs discovered here.
- `../../DefiningRequirements/DefiningFeatures/definingFeatures.md` — finding examples and counterexamples for rules.
- `../../DefiningRequirements/FeatureInjection/featureInjection.md` — working backward from the outcome, applied to API design.
- `../../TakingBddFurther/BuildProcess/buildProcess.md` — where API and NFR suites run in the pipeline.
- `../../../actions/bdd.md` — the workflow that owns these scenarios and glue code.
- `../../../actions/tdd.md` — driving the newly discovered components.
- `../../../actions/dev.md` — outer loop during implementation.
- `../../../UIUX/Testing/testing.md` — performance, load and accessibility testing practices (when installed).
- `../../../DevOps/Practices/Monitoring/monitoring.md` — collecting the metrics used to diagnose NFR failures (when installed).
- `../../../DevOps/Practices/DeliveryPipeline/deliveryPipeline.md` — staging performance and acceptance stages (when installed).
- `../../../CleanCode/Systems/systems.md` — separating construction and use, dependency injection (when installed).
