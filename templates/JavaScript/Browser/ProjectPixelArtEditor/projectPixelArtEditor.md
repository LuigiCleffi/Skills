---
name: js-project-pixel-art-editor
description: "Design lessons for a browser application built without a framework: a single immutable state, actions dispatched through one update function, components that sync to state, tools as pluggable strategies, pointer handling, load/save and undo history from immutable snapshots, based on Chapter 19 (Project: A Pixel Art Editor) of Eloquent JavaScript. Use when structuring UI state and data flow, writing components or reducers, adding undo, wiring pointer or file input, or reviewing UI code where parts update each other directly."
---

# Project: A Pixel Art Editor (UI architecture)

Keep one source of truth. The interface is drawn from the state; user actions become action objects passed to a single dispatch; a pure update function computes the next state; components resynchronize. State changes go through one well-defined channel, never sideways between widgets.

## Why one state

- Scattered state (each widget owns a piece and reads others when needed) forces every part to know every other part: adding a color picker means updating the color field, the cursor, and so on.
- With a single state value, a new view only reads state, and a new feature only dispatches actions. Nothing else changes.
- This is the core idea behind Redux, Elm, React state and Svelte stores; learn it without a framework, then recognize it in one.

## Immutable state values

- Model data as values that are replaced, not mutated: an update returns a new object and shares unchanged parts.
- Immutability makes three things cheap: change detection by identity (`old !== new`), redrawing a drag preview from the original snapshot, and undo history as a list of old values.
- Store a grid in one flat array (`pixels[x + y * width]`) behind accessor methods.

```js
class Picture {
  #pixels;
  constructor(width, height, pixels) {
    Object.assign(this, {width, height});
    this.#pixels = pixels;
  }
  static empty(width, height, color) {
    return new Picture(width, height, Array(width * height).fill(color));
  }
  pixel(x, y) { return this.#pixels[x + y * this.width]; }
  draw(changes) {
    const copy = this.#pixels.slice();
    for (const {x, y, color} of changes) copy[x + y * this.width] = color;
    return new Picture(this.width, this.height, copy);
  }
}
```

**Current note:** `array.with(i, v)`, `toSorted`, `toSpliced` return modified copies; `structuredClone` deep-copies plain data; `Object.freeze` in development catches accidental mutation.

## Actions, dispatch and the update function

- An action is a plain object describing intent (`{color: "#ff0000"}`, `{undo: true}`, or `{type: "setTool", tool}`).
- The update function is pure: `(state, action) => newState`. For simple apps, spread-merge works: `({...state, ...action})`.
- Prefer explicit `type` fields once actions carry logic; an unknown type should be visible (log or throw in development), not silently ignored.
- Dispatch is the only place that assigns state and tells the root component to sync. Side effects (network, storage) live at that edge, not inside reducers.

```js
function startApp(root, initialState, update) {
  let state = initialState;
  const dispatch = action => {
    state = update(state, action);
    root.syncState(state);
  };
  return dispatch;
}
```

## Components

- A component owns one DOM subtree (`dom`), is built from a state slice plus fixed config (dispatch, tools), and exposes `syncState(state)`.
- `syncState` updates only what changed: compare by identity (`if (this.picture === picture) return`).
- Parents pass children only the slice they need. A child that does not know the whole app receives a callback (e.g. `onPointerDown(pos)`) instead of dispatch, keeping it reusable.
- Components that never change or are always fully rebuilt can simply be functions returning a DOM node.
- A small `elt(type, props, ...children)` helper that assigns DOM properties (including `onclick`) keeps construction readable; it sets properties, not attributes.
- Controls (select, color input, buttons) read their value from state in `syncState`, so programmatic changes (e.g. a color picker tool) stay in sync automatically.

## Tools as strategies

- Represent interchangeable behaviors as a map of name to function: `{draw, fill, rectangle, pick}`. The UI lists `Object.keys(tools)`; adding a tool is adding an entry.
- A tool receives `(position, state, dispatch)` and may return a move handler for drags. Returning a function to continue an interaction is a clean protocol for gestures.
- Recompute drag previews from the state at gesture start (the rectangle tool redraws from the original picture), so intermediate frames never accumulate.
- Flood fill is graph search: a work list plus a visited `Set`, bounded by the grid edges, using 4-neighbors.

## Pointer input

- Convert client coordinates to model coordinates with `getBoundingClientRect()` and `Math.floor((clientX - rect.left) / scale)`.
- Ignore non-primary buttons; stop tracking when `buttons === 0`; skip moves that stay on the same cell.
- Remove move listeners when the gesture ends.

**Current note:** use Pointer Events (`pointerdown`/`pointermove`/`pointerup` with `setPointerCapture`) to handle mouse, touch and pen in one path, and `touch-action: none` on the canvas instead of `preventDefault` on `touchstart`.

## Load, save and undo

- Save by rendering to an offscreen canvas at scale 1 and triggering a download link (`download` attribute, `canvas.toBlob` + `URL.createObjectURL`, then revoke the URL).
- Load through a file input; decode into an image, draw it to a canvas, and read pixels with `getImageData` (RGBA bytes; format hex with `n.toString(16).padStart(2, "0")`). Cap dimensions to protect performance.
- Undo is a state concern: keep `done` (previous pictures) in state and handle `{undo: true}` in the update function. Throttle snapshots by time so a drag is one undo step.
- An undo button derives `disabled` from `state.done.length === 0`.

## Configuration with defaults

- Accept an options object and destructure with defaults: `function start({state = initial, tools = baseTools} = {})`. Callers override only what they need, and tests inject fakes.

## Workflow

1. Write down the state shape; keep it minimal and serializable.
2. Define actions and a pure update function; test it first.
3. Build components top-down, each with `dom` and `syncState`, receiving only the slice it needs.
4. Route every user event to `dispatch`; never let one component set another's DOM.
5. Add behaviors (tools, commands) as entries in a map with a shared signature.
6. Put history, persistence and network effects at the dispatch edge.
7. Optimize `syncState` with identity checks and partial redraws only after it works.

## Red flags

- A widget that reads or writes another widget's DOM or fields to stay in sync.
- State mutated in place (`state.picture.pixels[i] = c`) so identity checks miss changes and undo breaks.
- Network calls, `localStorage` or `Date.now()` scattered through reducers instead of the dispatch edge.
- A growing `if/else` on tool names instead of a lookup map.
- Event listeners added per gesture and never removed.
- Separate mouse and touch code paths that drift apart.
- Undo implemented by reversing operations by hand when snapshots of immutable values would do.
- Full redraw of everything on every keystroke in a large view, without measuring.

## Testing notes

- The update function and model classes (`Picture.draw`, flood fill, history) are pure: test them first with plain values, no DOM.
- Test tools with a fake `dispatch` that records actions, and a small fixture picture.
- Test components with jsdom or a browser runner: build with a state, call `syncState` with a new one, assert DOM changes; inject callbacks to observe output.
- Acceptance scenarios drive real pointer events and assert on observable state (exported picture, undo availability) rather than pixel inspection.

## Related

- `../HttpAndForms/httpAndForms.md` — form controls, file inputs, labels.
- `../DrawingOnCanvas/drawingOnCanvas.md` — canvas rendering used by the picture view.
- `../HandlingEvents/handlingEvents.md` — event registration and removal.
- `../../Language/ProjectRobot/projectRobot.md` — persistent data and immutable state.
- `../../Node/ProjectSkillSharingWebsite/projectSkillSharingWebsite.md` — the same action/dispatch design with a server.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — data versus behavior trade-offs.
- `../../../TDD/Patterns/DesignPatterns/designPatterns.md` — Command and pluggable behavior.
