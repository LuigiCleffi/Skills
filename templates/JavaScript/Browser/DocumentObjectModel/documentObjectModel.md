---
name: js-dom
description: "Reading and changing the page through the DOM tree: node types, traversal, querying with selectors, creating and moving nodes, attributes and data-*, styling and classes, layout cost, and requestAnimationFrame animation, based on Chapter 14 (The Document Object Model) of Eloquent JavaScript. Use when writing code that queries, builds, updates, styles, measures, or animates page elements, or reviewing DOM code for XSS, layout thrashing, or brittle selectors."
---

# The Document Object Model

Treat the DOM as a live tree you change through small, safe abstractions: find elements by stable selectors, build nodes with `textContent` rather than HTML strings, toggle classes instead of hand-setting styles, and batch reads and writes so the browser lays out once.

## The tree

- `document.documentElement` is the root `<html>`; `document.head` and `document.body` are shortcuts.
- Node kinds: elements (`nodeType === Node.ELEMENT_NODE`, 1), text (3), comments (8). Whitespace between tags creates text nodes, so `childNodes` and `firstChild` often return text.
- Prefer element-only links: `children`, `firstElementChild`, `nextElementSibling`, `parentElement`, `closest(selector)`.
- Recursive functions fit the tree naturally; for full traversal consider `TreeWalker` or a selector instead of hand-written recursion.

## Finding elements

- Do not navigate fixed paths ("second child of the sixth child"); they break whenever markup changes.
- Use `querySelector` (first match or `null`) and `querySelectorAll` (static `NodeList`). Scope queries to a container element to avoid accidental global matches.
- `getElementsByTagName`/`ByClassName` and `childNodes` return **live** collections that shrink as you remove nodes. Iterating them while mutating skips items; copy first with `Array.from` or `[...list]`.
- Hook behaviour to stable hooks such as `data-*` attributes or roles, not to styling class names that designers may rename.

```js
const list = root.querySelector("[data-role='todo-list']");
for (const item of list.querySelectorAll("li.done")) item.remove();
```

- **Current note:** `NodeList` supports `forEach` and `for...of`; convert to an array only when you need `map`/`filter`.

## Creating and moving nodes

- `document.createElement(tag)` plus `textContent` (or `createTextNode`) is XSS-safe. `innerHTML` with any untrusted data is not.
- A node lives in exactly one place: inserting it elsewhere moves it.
- **Current note:** use the modern methods `append`, `prepend`, `before`, `after`, `replaceWith`, `replaceChildren`, and `remove`; they accept strings (as text) and multiple nodes, unlike `appendChild`/`insertBefore`/`replaceChild`.
- Wrap repetitive construction in a small helper so code reads like the structure it builds:

```js
function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}
table.append(h("tr", {}, h("td", { textContent: name }), h("td", { className: "num", textContent: height })));
```

- Build large subtrees off-document (or in a `DocumentFragment`) and insert once.
- Use `<template>` elements and `cloneNode(true)` for repeated markup structures.

## Attributes and properties

- Standard attributes map to properties (`link.href`, `input.value`, `img.alt`); the property may be normalised (absolute URL) while `getAttribute` returns the raw text.
- Custom data belongs in `data-*` attributes, read through `element.dataset` (`data-user-id` → `dataset.userId`).
- `class` is exposed as `className`; prefer `classList.add/remove/toggle/contains`.
- Boolean attributes (`hidden`, `disabled`) are present-or-absent; use the property (`el.hidden = true`) or `toggleAttribute`.

## Styling

- Keep visual rules in CSS; from JavaScript toggle classes or state attributes. Reserve `element.style` for truly dynamic values (computed positions, sizes).
- Inline styles win over stylesheet rules and are hard to override; overuse creates specificity fights.
- Style properties are camelCased (`style.fontFamily`) and string-valued; lengths need units (`${x}px`). A unitless non-zero length is silently ignored.
- Hide with `hidden` or a class (`display: none`) rather than deleting nodes you will show again.
- **Current note:** use CSS custom properties (`el.style.setProperty("--x", ...)`) to pass values from JS to CSS.

## Layout and performance

- Reading geometry (`offsetWidth`, `clientHeight`, `getBoundingClientRect()`, `scrollTop`) forces the browser to compute layout if the DOM changed. Alternating writes and reads in a loop causes layout thrashing.
- Batch: read everything first, then write everything; or compute the final result and write once.
- `getBoundingClientRect()` is viewport-relative; add `scrollX`/`scrollY` for document coordinates. **Current note:** `pageXOffset`/`pageYOffset` are legacy aliases of these.
- **Current note:** prefer `ResizeObserver` and `IntersectionObserver` to polling sizes or scroll positions.

## Animation

- Never animate with a busy loop; the browser cannot paint until your script yields. Schedule each frame with `requestAnimationFrame`.
- Base motion on elapsed time (the timestamp passed to the callback), not on a fixed step per frame, so speed is stable when frames drop.
- Keep the frame id to cancel with `cancelAnimationFrame`. Prefer CSS transitions or the Web Animations API (`el.animate`) for simple declarative motion; animate `transform` and `opacity` rather than `top`/`left`.

```js
let last;
function frame(now) {
  const dt = last === undefined ? 0 : (now - last) / 1000;
  last = now;
  angle += dt * speed;
  sprite.style.transform = `translate(${Math.cos(angle) * 200}px, ${Math.sin(angle) * 20}px)`;
  id = requestAnimationFrame(frame);
}
let id = requestAnimationFrame(frame);
```

## Workflow

1. Identify the container element once and scope all queries to it.
2. Select elements by stable `data-*` or semantic hooks.
3. Build new content with `createElement`/helpers and `textContent`; insert in one operation.
4. Express visual state as classes or attributes; let CSS do the styling.
5. Separate reads from writes; measure once per frame at most.
6. Drive animation with `requestAnimationFrame` and elapsed time; stop it when no longer needed.

## Red flags

- `innerHTML +=` or template strings with data interpolated into markup.
- Fixed traversal chains (`parentNode.parentNode.children[2]`).
- Mutating while looping over a live `HTMLCollection`.
- Long lists of `el.style.x = ...` for static looks that belong in CSS.
- Geometry reads inside loops that also mutate the DOM.
- `setInterval` or `while` loops for animation; per-frame movement independent of time.
- Missing units on style lengths; `className =` overwriting other classes.

## Testing notes

- Render into a fresh container per test (jsdom/happy-dom or a browser runner) and remove it afterwards.
- Query in tests as users perceive the page: by role, label, or text (Testing Library style), not by CSS classes.
- Keep rendering functions pure where possible (data in, node out) so they can be unit-tested without global state.
- Layout and animation need a real browser; cover them in a few acceptance tests and keep the math in pure, unit-tested functions.

## Related

- `../JavaScriptAndTheBrowser/javaScriptAndTheBrowser.md` — escaping and script loading.
- `../HandlingEvents/handlingEvents.md` — responding to user input on these nodes.
- `../DrawingOnCanvas/drawingOnCanvas.md` — when the DOM is the wrong drawing surface.
- `../ProjectPlatformGame/projectPlatformGame.md` — a DOM-based display layer.
- `../../Language/ProjectProgrammingLanguage/projectProgrammingLanguage.md` — recursive tree walking.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — hiding raw structure behind helpers.
- `../../../BDD/CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` — user-centred UI checks.
