---
name: js-browser
description: "How JavaScript reaches and runs in the browser: HTTP and URLs, HTML structure and escaping, loading scripts and ES modules, the security sandbox, and cross-browser compatibility, based on Chapter 13 (JavaScript and the Browser) of Eloquent JavaScript. Use when adding scripts to a page, choosing script loading attributes, writing or injecting HTML, handling untrusted content, or deciding which browser APIs a project can rely on."
---

# JavaScript and the Browser

Treat the browser as a hostile, standards-based platform: serve valid HTML with a doctype and charset, load code as deferred ES modules, escape everything you put into markup, and rely on the sandbox only as a floor, not as your security design.

## Network basics an agent needs

- The web runs HTTP (now almost always HTTPS) over TCP. A request names a method and a resource path; the server returns a status, headers and a body.
- A URL has a scheme (`https:`), host (domain resolving to an IP address), optional port, path, query and fragment. Build and parse URLs with the `URL` and `URLSearchParams` classes, never with string concatenation.

```js
const url = new URL("/search", location.origin);
url.searchParams.set("q", userInput); // encoded correctly
```

- **Current note:** default to `https://`; browsers block many APIs (service workers, clipboard, geolocation) on insecure origins.

## HTML essentials

- Every document starts with `<!doctype html>` and `<meta charset="utf-8">`; omitting them triggers quirks mode and encoding bugs.
- Elements have opening and closing tags; attributes are `name="value"` pairs; some elements (like `<meta>`, `<img>`, `<input>`) are void and never close.
- The parser is error-tolerant and standardised (it inserts missing `<html>`, `<head>`, `<body>`, closes paragraphs), but write well-formed markup anyway; tolerance hides mistakes from reviewers and tools.
- Special characters in text must be entities: `&lt;`, `&gt;`, `&amp;`, and `&quot;` inside attributes. Any place you turn data into HTML is an escaping obligation.
- **Current note:** add `<meta name="viewport" content="width=device-width, initial-scale=1">` and `lang` on `<html>`; both affect accessibility and mobile layout.

## Loading JavaScript

- A plain `<script>` runs as soon as the parser reaches it, blocking parsing and seeing only the DOM above it.
- Prefer `<script type="module" src="...">`: modules are deferred by default, run in strict mode, have their own scope, and can `import` relative URLs.
- Use `defer` for classic scripts that need the DOM; use `async` only for independent scripts (analytics) whose execution order does not matter.
- Always close `<script>` tags, even with `src`; otherwise the rest of the page becomes script content.
- Do not put code in inline handler attributes (`onclick="..."`). They mix concerns, use global scope, and are blocked by a strict Content Security Policy. Attach listeners from modules with `addEventListener`.

```html
<script type="module" src="./app.js"></script>
```

- **Current note:** use import maps (`<script type="importmap">`) or a bundler for bare specifiers; browsers do not resolve `node_modules` names.

## The sandbox and security

- Page scripts cannot read local files or touch other sites' data; the same-origin policy isolates origins. Powerful features (camera, clipboard, notifications) require user permission.
- The sandbox protects the user from your page, not your page from its inputs. You remain responsible for:
  - **XSS:** never insert untrusted strings with `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`. Use `textContent` or DOM construction.
  - **Content Security Policy:** ship a CSP header that forbids inline script and `eval`.
  - **Third-party scripts:** each runs with full page privileges; pin versions and use Subresource Integrity (`integrity="sha384-..."`).
- Treat `location`, `document.referrer`, `postMessage` data, and storage contents as untrusted input.

## Compatibility

- Modern evergreen browsers (Chromium-based, Firefox, Safari) are largely consistent, but Safari and engine lag still matter. Check MDN compatibility tables or Baseline status before using a new API.
- Feature-detect, do not browser-sniff: `if ("share" in navigator) { ... }`.
- Decide and document the supported browser range (e.g. a browserslist query) and let tooling transpile or polyfill against it.
- Progressive enhancement: core content and links should work before or without JavaScript where feasible.

## Workflow

1. Start pages from a valid skeleton: doctype, charset, viewport, `lang`, title.
2. Load application code as a single module entry point (`type="module"`), not scattered inline scripts.
3. Wire behaviour with `addEventListener` in modules; keep markup free of handler attributes.
4. At every point where data meets HTML or URLs, choose a safe API (`textContent`, `URL`, `URLSearchParams`).
5. Check compatibility for any non-baseline API and feature-detect it.
6. Configure CSP and SRI for production and verify nothing inline is required.

## Red flags

- Missing doctype or charset; pages that rely on quirks mode.
- `innerHTML` or template strings built from user or server data without sanitising.
- Inline `onclick`/`onload` attributes, `javascript:` URLs, or `eval`/`new Function` in page code.
- Classic `<script>` in `<head>` without `defer` that queries the DOM.
- URLs assembled with `+` and manual `encodeURIComponent` sprinkled around.
- User-agent sniffing instead of feature detection.
- Third-party scripts from CDNs without pinned versions or integrity hashes.

## Testing notes

- Unit-test pure logic in Node; run DOM-dependent units in a DOM environment (jsdom, happy-dom) or a real browser runner.
- Write an XSS regression test: feed `<img src=x onerror=alert(1)>` through every rendering path and assert it appears as text.
- Acceptance tests (Playwright, WebDriver) should run on the browser matrix the project claims to support.
- Assert that the page loads with no console errors and no CSP violations as a cheap smoke check.

## Related

- `../DocumentObjectModel/documentObjectModel.md` — reading and changing the page safely.
- `../HandlingEvents/handlingEvents.md` — wiring behaviour with listeners.
- `../HttpAndForms/httpAndForms.md` — HTTP requests, `fetch`, and forms.
- `../../Language/Modules/modules.md` — ES module syntax and resolution.
- `../../../CleanCode/Boundaries/boundaries.md` — isolating third-party code.
- `../../../BDD/CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` — browser-level acceptance tests.
