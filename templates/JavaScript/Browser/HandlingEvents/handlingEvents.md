---
name: js-events
description: "Browser event handling: addEventListener and removal, event objects, propagation and delegation, default actions, keyboard, pointer, touch, scroll, focus and load events, timers, debouncing and throttling, and web workers, based on Chapter 15 (Handling Events) of Eloquent JavaScript. Use when wiring UI interactions, handling keyboard or pointer input, implementing drag, shortcuts, debounce or throttle, cleaning up listeners, or moving heavy work off the main thread."
---

# Handling Events

Let the browser notify you instead of polling: register listeners with `addEventListener`, delegate from a stable ancestor, read what you need from the event object, keep handlers short, and always have a way to remove what you add.

## Registering and removing

- `target.addEventListener(type, handler, options)` works on elements, `window`, `document`, workers and more; any number of listeners can coexist. Avoid `onclick =` properties and attributes, which allow only one handler.
- Removal needs the **same function reference**; anonymous inline handlers cannot be removed. Name them or use an `AbortController`.

```js
const controller = new AbortController();
button.addEventListener("click", onSave, { signal: controller.signal });
window.addEventListener("keydown", onKey, { signal: controller.signal });
// teardown: removes both
controller.abort();
```

- **Current note:** options `{ once: true }` for one-shot handlers, `{ passive: true }` for scroll/touch handlers that never call `preventDefault`, and `{ signal }` for grouped cleanup.
- Components that add listeners must remove them on teardown, especially on `window`/`document`; leaked listeners keep objects alive and fire for unmounted UI.

## Event objects

- Handlers receive an event with `type`, `target` (where it originated), and `currentTarget` (where this listener is registered), plus type-specific data.
- Mouse/pointer: `button` (which button changed: 0 left, 1 middle, 2 right), `buttons` (bitmask currently held: 1 left, 2 right, 4 middle), `clientX/Y` (viewport) and `pageX/Y` (document).
- Keyboard: `key` is the produced value (`"a"`, `"A"`, `"Enter"`, `"ArrowUp"`); `code` is the physical key (`"KeyA"`). Use `key` for shortcuts that follow the label, `code` for layout-independent game controls. Check `ctrlKey`, `shiftKey`, `altKey`, `metaKey` for combinations.

## Propagation and delegation

- Most events bubble from the target up through ancestors to `window`; the innermost handler runs first. `focus`, `blur`, and `load` do not bubble (**Current note:** use `focusin`/`focusout` when you need bubbling focus events).
- `stopPropagation()` hides the event from ancestors; use sparingly, since it breaks delegation and analytics elsewhere.
- Delegate: one listener on a container handles events for many (and future) children. Use `event.target.closest(selector)` and confirm the match is inside the container.

```js
list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !list.contains(button)) return;
  actions[button.dataset.action]?.(button.closest("li").dataset.id);
});
```

## Default actions

- Links navigate, forms submit, arrow keys scroll, right-click opens a menu. Handlers run first; `preventDefault()` cancels the default.
- Cancel defaults only when you replace the behaviour (custom shortcut, client-side form submit). Breaking expected behaviour harms usability and accessibility.
- Some defaults cannot be cancelled (browser shortcuts like closing a tab); `scroll` fires after scrolling already happened.

## Input sources

- **Keyboard:** `keydown` repeats while a key is held; guard against duplicated actions with `event.repeat`. Key events target the focused element (or `body`). Do not reconstruct typed text from key events; listen to `input` on fields and read their `value` (IME and virtual keyboards skip key events).
- **Mouse:** `mousedown` → `mouseup` → `click` (on the nearest common ancestor) → `dblclick`. For drags, listen for movement on `window` after the press so the drag survives leaving the element, and stop when `buttons === 0`.
- **Touch:** `touchstart`/`touchmove`/`touchend` expose `touches` (multiple points). **Current note:** prefer Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `setPointerCapture`), which unify mouse, pen and touch with one code path.
- **Scroll:** fires often; keep handlers cheap or use `IntersectionObserver` for visibility logic.
- **Focus:** `focus`/`blur` on fields; on `window` they signal tab or window switches.
- **Load:** module and `defer` scripts run after parsing, so `DOMContentLoaded`/`load` waits are rarely needed. `beforeunload` is for unsaved-work warnings only; browsers ignore custom messages.

## Event loop, timers and workers

- Handlers run on the event loop; a slow handler freezes all interaction. Keep them short and push heavy work elsewhere.
- `setTimeout`/`clearTimeout`, `setInterval`/`clearInterval`, and `requestAnimationFrame`/`cancelAnimationFrame` return ids for cancellation; clearing an invalid or fired id is harmless.
- **Debounce** (act after input pauses) and **throttle** (act at most every N ms) high-frequency events:

```js
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
search.addEventListener("input", debounce((e) => runSearch(e.target.value), 300));
```

- Web Workers run code on another thread with no shared globals; communicate via `postMessage` and `message` events. Data is copied with the structured clone algorithm (richer than JSON: `Map`, `Date`, typed arrays), or transferred for `ArrayBuffer`s.

## Workflow

1. Choose the narrowest stable element for the listener; delegate for lists and dynamic content.
2. Register with `addEventListener` and an `AbortSignal` tied to the component lifetime.
3. In the handler, guard on `target`/`closest`, extract data, then call a plain function with that data (keep logic out of the handler).
4. Call `preventDefault()` only where you take over the behaviour; mark passive listeners.
5. Debounce or throttle high-frequency events; offload CPU-heavy work to a worker.
6. On teardown, abort the controller and cancel timers and animation frames.

## Red flags

- Inline `on*` attributes or multiple assignments to `el.onclick`.
- `removeEventListener` with a fresh arrow function (never removes anything).
- Per-item listeners added in a render loop for large or changing lists.
- `stopPropagation()` used to "fix" a bug in an ancestor's handler.
- Blanket `preventDefault()` on keydown or touch, breaking scrolling, typing, or accessibility.
- Expensive work directly in `scroll`, `mousemove`, `resize`, or `input` handlers.
- Drag logic that listens only on the element, or mouse-only interactions with no touch/pointer path.
- Timers and global listeners that outlive the UI that created them.

## Testing notes

- Keep handler bodies thin and unit-test the plain functions they call with plain data.
- In DOM tests, dispatch realistic events (`new KeyboardEvent("keydown", { key: "Enter", bubbles: true })`) or use a user-event library; assert outcomes, not handler calls.
- Use fake timers to test debounce and throttle deterministically.
- Test cleanup: after teardown, dispatching the event must have no effect.
- Acceptance tests should drive the real interaction (click, type, press keys) including keyboard-only paths.

## Related

- `../DocumentObjectModel/documentObjectModel.md` — the nodes events target.
- `../ProjectPlatformGame/projectPlatformGame.md` — tracking held keys for continuous input.
- `../HttpAndForms/httpAndForms.md` — form, input and change events.
- `../../Language/AsynchronousProgramming/asynchronousProgramming.md` — the event loop and timers.
- `../../Language/HigherOrderFunctions/higherOrderFunctions.md` — wrapping handlers (debounce, throttle).
- `../../../CleanCode/Functions/functions.md` — small handlers that delegate to named functions.
- `../../../BDD/CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` — automating interactions.
