---
name: bdd-ui-acceptance-criteria
description: "Covers automating acceptance criteria through a web or mobile UI: when a scenario deserves a UI test (user journeys and business rules visible on screen) and when it should go below the UI, the cost of too many browser tests, why record-replay scripts fail at BDD, headless browsers and their limits, browser automation with Selenium WebDriver or Playwright, locator strategies (role, label, test id, name, link text, CSS, XPath, nested lookups), interacting with inputs, radios and selects, waiting for asynchronous pages without sleeps, test-friendly markup, and the Page Objects pattern (simple types and domain objects only, report state but no assertions, careful navigation), plus libraries that extend WebDriver, based on Chapter 8 (Automating acceptance criteria for the UI layer) of BDD in Action. Use when writing step definitions that drive a browser, choosing between UI and API-level automation, designing page objects or component objects, picking selectors, fixing flaky UI scenarios, timeouts, stale elements or AJAX races, replacing Thread.sleep, the UI suite is slow or brittle, adding data-testid attributes, or the user mentions Selenium, WebDriver, Playwright, Cypress, Appium, Serenity BDD, page object, locator, XPath, CSS selector, explicit wait, headless Chrome or end-to-end web tests."
---

# Automating Acceptance Criteria for the UI Layer

Use UI automation only for what the UI is responsible for: showing the user's journey through the system and showing how a business rule appears on screen. Everything else belongs below the UI. When you do drive the browser, hide every selector and wait inside page objects that speak the domain, so the scenarios survive redesigns.

## Decide whether the scenario needs a UI test

UI tests are the most convincing evidence for stakeholders (they mirror real use, produce screenshots for living documentation, and work as demos), and the most expensive to run and maintain.

Ask: is this scenario about how the user interacts with the application, or about logic that would be the same with any interface?

| Acceptance criterion | Level |
|---|---|
| The checkout shows a live strength meter while the user types a new password | UI: the feedback is the behavior |
| Passwords shorter than 12 characters or found in a breach list are rejected | Domain/API: test the policy directly with many examples |
| Members see a "reserve seat" option that guests do not | UI: a business rule rendered on screen |
| The discount is 15% for orders over 200 in loyalty tier Gold | Domain: table of examples, plus one UI scenario showing the discount is displayed |

- Cover the significant journeys through the UI, not every path. Exhaustive variations go to faster tests (see the non-UI skill).
- Expect most automated acceptance criteria in a healthy project to run below the UI; the UI layer is the narrow top of the pyramid.
- Never use record-replay scripts as acceptance tests. They are brittle, hide intent, duplicate every interaction and can only be recorded after the feature exists, so they cannot guide development. Current note: Playwright codegen and Selenium IDE still exist; use their output only as a hint for locators, then rewrite it into page objects.

## Speed and stability trade-offs

- Every page load and browser round trip costs time; browser differences and environment problems (wrong browser version, network latency) cause failures unrelated to your code.
- Headless runs are faster to parallelize, but a headless engine is not identical to every real browser. If important logic lives in the client, also run the key journeys on the real browsers you support.
- Current note: PhantomJS is discontinued and HtmlUnit has weak JavaScript support. Use headless modes of real browsers instead (Chrome/Edge/Firefox via Selenium 4, or Playwright's Chromium, Firefox and WebKit). Appium remains the WebDriver-based option for native mobile apps.

## Browser automation tools

Current note: Selenium WebDriver (now Selenium 4, W3C protocol, with Selenium Manager resolving drivers automatically) is still widely used, especially on the JVM and with Serenity BDD. Playwright and Cypress are now common alternatives with built-in auto-waiting and tracing; Playwright pairs naturally with `@cucumber/cucumber` or `playwright-bdd`. Pick the tool the team will maintain; the patterns below apply to all of them.

```ts
// features/support/world.ts  (@cucumber/cucumber + Playwright)
import { setWorldConstructor, World, Before, After } from "@cucumber/cucumber";
import { chromium, Browser, Page } from "playwright";

export class ShopWorld extends World {
  browser!: Browser; page!: Page;
}
setWorldConstructor(ShopWorld);

Before({ tags: "@ui" }, async function (this: ShopWorld) {
  this.browser = await chromium.launch();
  this.page = await this.browser.newPage({ baseURL: process.env.APP_URL });
});
After({ tags: "@ui" }, async function (this: ShopWorld) {
  await this.browser?.close();
});
```

## Locating elements

Prefer locators that express meaning and survive styling changes. Order of preference:

1. Accessible role and name, label, or visible text (`getByRole("button", { name: "Place order" })`, `getByLabel("Email")`). These also catch accessibility regressions.
2. A stable test hook (`data-testid`) or a unique `id`/`name` on semantically significant elements.
3. Link text for navigation links (breaks when copy changes; acceptable when the copy is the requirement).
4. Scoped CSS selectors (`#cart .line-item .price`), always narrowed to a container so a similar element elsewhere is not matched.
5. XPath only when you must select by text content or relative position and nothing else works; it is verbose and fragile.

- Narrow by nesting: find the container first, then search inside it (`page.getByRole("navigation").getByRole("link", { name: "Orders" })` or `driver.findElement(By.id("main-nav")).findElement(By.linkText("Orders"))`). Simpler than one long selector.
- Match class names with "contains" semantics, not exact equality; frameworks add extra classes.
- Make the application test-friendly: ask for ids, names, labels or test ids on every element a scenario needs. Frameworks that generate random ids, canvas-only widgets or opaque plugins make UI automation slow and brittle; raise this as a design concern early.

## Interacting with elements

- Typing simulates keystrokes; clear the field first if it may hold a value (Playwright `fill` replaces; WebDriver needs `clear()` then `sendKeys`).
- Read the current value of inputs from their value (`inputValue()`, `getAttribute("value")`); a `textarea`'s content comes from its text in WebDriver.
- Radios and checkboxes: target the specific option (`getByLabel("Express delivery")` or `input[name='shipping'][value='express']`), then check it.
- Drop-downs: use the tool's helper (`selectOption`, WebDriver `Select.selectByVisibleText`) rather than clicking options.

## Waiting for asynchronous pages

Single-page apps update without a page load, so the tool cannot know when the page is ready. Wait for a specific condition, never for a fixed time.

```ts
await page.getByLabel("Destination").fill("Lis");
await expect(page.getByRole("option", { name: "Lisbon" })).toBeVisible(); // retries until visible or timeout
```

```java
// Selenium 4: explicit wait on a condition
new WebDriverWait(driver, Duration.ofSeconds(5))
    .until(d -> d.findElements(By.cssSelector(".suggestions li")).size() > 0);
```

- Global implicit waits slow every lookup and interact badly with explicit waits; do not mix them.
- An element that is present but not yet populated (a total recalculated after an option changes) needs a wait on its content, not on its presence.
- `sleep` in a UI step is a defect. Replace it with a condition on what the user would wait for.

Current note: Java waits now take `Duration` and plain lambdas (no Guava `Function` needed); Playwright's web-first assertions and auto-waiting actions remove most explicit waits.

## Page objects

A page object models a page, a view of a single-page app, or a reusable component (menu, cart summary, search box), and offers business-named methods. It lives in the Technical layer and is the only place that knows selectors.

```ts
export type CartLine = { product: string; quantity: number; price: number };

export class CartPage {
  constructor(private page: Page) {}

  async open() { await this.page.goto("/cart"); }

  async setQuantity(product: string, quantity: number) {
    const row = this.page.getByRole("row", { name: new RegExp(product) });
    await row.getByLabel("Quantity").fill(String(quantity));
  }

  async lines(): Promise<CartLine[]> {
    return this.page.locator("[data-testid=cart-line]").evaluateAll(rows =>
      rows.map(r => ({
        product: r.querySelector("[data-testid=name]")!.textContent!.trim(),
        quantity: Number((r.querySelector("input") as HTMLInputElement).value),
        price: Number(r.querySelector("[data-testid=price]")!.textContent!.replace(/[^\d.]/g, "")),
      })));
  }

  async checkoutIsEnabled(): Promise<boolean> {
    return this.page.getByRole("button", { name: "Checkout" }).isEnabled();
  }
}
```

Design rules:

- **Expose only simple types and domain objects.** Accept and return strings, numbers, dates, booleans, domain records or other page objects; never return `WebElement`, `Locator` or raw HTML. Parsing (prices, dates) happens inside the page object.
- **Report state; do not assert.** The step decides what to check. Assertion methods inside page objects bloat them with one-off checks.
- **Keep failure messages informative.** A bare boolean assertion fails with "expected true"; add a message or use assertions that describe the element (`await expect(checkoutButton).toBeEnabled()`).
- **Navigation is a style choice.** Returning the next page object (`menu.openCart()` returns `CartPage`) reads fluently, but only when the destination is always the same. If the outcome depends on business logic (login succeeds or shows an error), let the step choose which page object it expects; otherwise business rules leak into the page object.
- One page object per significant view or component; compose components into pages.

```ts
Then("the cart should contain {int} {string}", async function (qty: number, product: string) {
  const lines = await this.cart.lines();
  expect(lines).toContainEqual(expect.objectContaining({ product, quantity: qty }));
});
```

Current note: Thucydides is now Serenity BDD (WebDriver integration, page objects, Screenplay). Geb (Groovy) and Watir (Ruby) still exist; WatiN is no longer maintained. FEST-Assert's successor is AssertJ. In Java, the `PageFactory`/`@FindBy` style still works, but plain `By` locators resolved at call time avoid stale-element issues with dynamic pages.

## Workflow

1. For each scenario, decide UI or below-UI with the "interaction vs underlying logic" question; tag UI scenarios (`@ui`).
2. Keep the scenario declarative; write the Business Flow steps first in domain terms.
3. Identify the views and components touched; create or extend one page object each, with business-named methods returning domain values.
4. Choose locators by the preference order; request test hooks or labels from the team where missing.
5. Replace every fixed delay with a wait on a user-visible condition.
6. Run headless locally and in CI; run key journeys on the supported real browsers; capture screenshots and traces on failure for the report.
7. Move any combinatorial examples you find yourself scripting through the UI down to domain or API tests.

## Red flags

- Most acceptance scenarios drive a browser, and the suite takes longer than the team will wait.
- Scenarios written as click-by-click scripts or exported from a recorder.
- Selectors or `driver`/`page` calls inside step definitions.
- Page objects returning elements, or containing `expect`/`assertThat`.
- `sleep`, `Thread.sleep` or retry loops added to "fix" flakiness.
- Long absolute XPath or positional CSS (`div:nth-child(7) > span`).
- Page objects deciding where a login or submit "should" go based on business conditions.
- Every validation variant of a form rule tested through the browser.

## Related

- `../AcceptanceTests/acceptanceTests.md` — the three layers; page objects form the Technical layer.
- `../NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — where business-rule examples should run instead.
- `../BddAndUnitTesting/bddAndUnitTesting.md` — unit-level coverage of UI components and logic.
- `../../DefiningRequirements/AutomatingScenarios/automatingScenarios.md` — wiring scenarios to step definitions.
- `../../TakingBddFurther/LivingDocumentation/livingDocumentation.md` — screenshots and reports from UI runs.
- `../../../actions/bdd.md` — owner of feature files and UI glue code.
- `../../../actions/uiux.md` — UI design decisions that UI scenarios verify.
- `../../../actions/dev.md` — the outer loop during implementation.
- `../../../UIUX/Testing/testing.md` — E2E, accessibility and cross-browser testing strategy (when installed).
- `../../../UIUX/Implementation/implementation.md` — building test-friendly, accessible markup (when installed).
- `../../../CleanCode/Boundaries/boundaries.md` — wrapping third-party automation APIs (when installed).
