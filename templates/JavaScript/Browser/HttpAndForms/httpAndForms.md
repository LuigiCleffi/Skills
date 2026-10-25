---
name: js-http-and-forms
description: "HTTP requests and responses, fetch, URL encoding, CORS, resource-oriented API design, HTTPS, form fields, focus, submit handling, file reading and client-side storage, based on Chapter 18 (HTTP and Forms) of Eloquent JavaScript. Use when calling an HTTP API from the browser, designing endpoints, handling form submission or validation, reading user-selected files, persisting data in localStorage, or reviewing fetch error handling."
---

# HTTP and Forms

Speak HTTP deliberately: choose the method that matches the effect, check the status yourself, encode every dynamic URL part, and treat the server as the authority on data. In forms, intercept submission, read fields through the DOM's own properties, and keep the UI honest while a request is in flight.

## The protocol

- A request is a method, a path, headers and an optional body; a response is a status, headers and an optional body.
- Methods: `GET` reads (safe, no side effects, may be prefetched or repeated by the browser), `PUT` creates or replaces at a known URL, `DELETE` removes, `POST` sends data or creates under a collection. `PUT` and `DELETE` should be idempotent.
- Status classes: 2xx success, 3xx redirect/not modified, 4xx the client's fault (400 invalid, 401/403 auth, 404 missing, 405 method not allowed, 409 conflict), 5xx the server's fault.
- Header names are case-insensitive; send `Content-Type` with every body.
- Prefer resource-oriented interfaces (`PUT /users/larry` with a JSON document) over RPC-style endpoints: they let HTTP caching, conditional requests and standard tooling work for you.
- Anything secret or that must arrive unmodified goes over HTTPS only.

## fetch

- `fetch` resolves as soon as headers arrive, **even for 404 or 500**. It rejects only on network failure, CORS refusal or abort. Always check `response.ok` (status 200–299).
- The body is read once, asynchronously: `await response.json()`, `.text()`, `.blob()`. Invalid JSON rejects.
- Options: `method`, `headers`, `body` (string, `FormData`, `URLSearchParams`, `Blob`), `signal`.
- Relative URLs resolve against the document: `"/x"` replaces the path, `"x"` replaces the last path segment.

```js
export class HttpError extends Error {
  constructor(status, body) { super(`HTTP ${status}`); this.status = status; this.body = body; }
}
export async function requestJSON(url, {body, ...options} = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {Accept: "application/json",
              ...(body !== undefined && {"Content-Type": "application/json"}),
              ...options.headers},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.status === 204 ? null : response.json();
}
```

**Current note:** use `AbortController` / `AbortSignal.timeout()` to cancel or time-limit requests; `fetch` is also global in Node 18+.

## URLs and encoding

- Encode every dynamic path segment with `encodeURIComponent` (`"How to Idle"` → `How%20to%20Idle`); never concatenate raw user input into a URL.
- Build query strings with `URLSearchParams` and full URLs with `new URL(path, base)`; they encode correctly.
- Form `GET` submissions put fields in the query string; `POST` puts them in the body as `application/x-www-form-urlencoded`.
- Never put personal or secret data in query strings: they land in logs, history and referrers.

## Cross-origin requests

- Browsers block scripts from reading responses from other origins unless the server opts in with `Access-Control-Allow-Origin` (CORS).
- A CORS failure is a server configuration matter; do not "fix" it in client code or with wildcard origins on credentialed endpoints.

## Form fields

- Read text fields, selects and textareas via `.value` (always a string; convert with `Number(...)`), checkboxes and radios via `.checked`, multi-selects via `select.selectedOptions`, files via `input.files`.
- `"input"` fires on every edit; `"change"` fires when a text field loses focus after editing (immediately for checkboxes, radios, selects).
- `form.elements` is indexable by position and by `name`; `field.form` links back.
- Radio buttons with the same `name` are one group. Wrap fields in `<label>` (or use `for`) so clicking the label activates the field and screen readers announce it.
- Focus: `focus()`, `blur()`, `document.activeElement`; prefer the `autofocus` attribute; `tabindex="0"` makes an element focusable in document order; avoid positive `tabindex`.
- Disable a submit button while its request is pending so impatient double clicks do not repeat the action; re-enable in `finally`.

```js
form.addEventListener("submit", async event => {
  event.preventDefault();
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  try {
    await requestJSON("/api/messages", {method: "POST",
      body: Object.fromEntries(new FormData(form))});
    form.reset();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
});
```

**Current note:** `new FormData(form)` collects named fields; built-in constraint validation (`required`, `pattern`, `setCustomValidity`, `form.reportValidity()`) and `form.requestSubmit()` cover most checks without custom code. Client validation is a convenience; the server must validate again.

## Files

- A file input is the user's grant to read that file; scripts cannot read arbitrary local files.
- `File` objects expose `name`, `size`, `type`; reading content is asynchronous.

**Current note:** prefer `await file.text()`, `file.arrayBuffer()` or `URL.createObjectURL(file)` over wrapping `FileReader` in a promise by hand.

## Client-side storage

- `localStorage` persists string values per origin until cleared; `sessionStorage` lasts for the session. Both are synchronous and size-limited.
- Store structured data with `JSON.stringify` and read with `JSON.parse(localStorage.getItem(key)) ?? defaults` (a missing key yields `null`).
- Wrap access in `try/catch`: storage can be disabled, full, or contain corrupted JSON.
- Never store tokens, passwords or personal data in web storage: any script on the origin (including injected ones) can read it.
- Route state changes through one function that updates the UI and persists, rather than writing storage from many places.

## Workflow

1. Define the resource, method and status codes for each interaction before writing the client call.
2. Wrap `fetch` once: status check, JSON handling, timeout, typed error. Reuse it everywhere.
3. Encode URL parts with `encodeURIComponent` / `URLSearchParams`.
4. Handle `submit` (not button clicks), call `preventDefault`, gather with `FormData`, validate, disable while pending.
5. Show failures to the user; never leave the UI silently stuck.
6. Persist only non-sensitive state; guard parse and access errors.

## Red flags

- `fetch(...).then(r => r.json())` with no `response.ok` check.
- A `GET` endpoint that changes data, or a `DELETE` that fails when the target is already gone.
- String-concatenated URLs with user input; secrets in query strings.
- Click handlers on submit buttons instead of a `submit` listener; missing `preventDefault`.
- Comparing `field.value` to a number without conversion.
- Inputs without labels; positive `tabindex` values.
- Buttons left enabled during in-flight requests, or never re-enabled after an error.
- Credentials or tokens in `localStorage`; unguarded `JSON.parse` of stored data.

## Testing notes

- Isolate the HTTP wrapper and test it against a stubbed `fetch` (or a local test server): success, 4xx, 5xx, invalid JSON, timeout, network error.
- Test form behavior at the DOM level: submit with `requestSubmit()`, assert `preventDefault` effects, disabled state while pending, error display.
- Acceptance scenarios exercise the API directly for rules and through the form for the user journey; seed and inspect state over HTTP rather than through storage internals.

## Related

- `../HandlingEvents/handlingEvents.md` — events, default actions, `preventDefault`.
- `../../Language/AsynchronousProgramming/asynchronousProgramming.md` — promises and `async` behind `fetch`.
- `../../Node/NodeJs/nodeJs.md` — the server side of HTTP.
- `../../Node/ProjectSkillSharingWebsite/projectSkillSharingWebsite.md` — a resource API and client end to end.
- `../../../CleanCode/ErrorHandling/errorHandling.md` — turning failures into explicit errors.
- `../../../BDD/CodingTheBddWay/NonUiAcceptanceCriteria/nonUiAcceptanceCriteria.md` — testing rules through the API.
