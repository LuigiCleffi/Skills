---
name: js-project-platform-game
description: "Design lessons for real-time interactive apps: immutable state updated per time step, simulation separated from a swappable display, data-driven level parsing, polymorphic actors, collision checks, held-key input tracking, and a promise-based animation loop, based on Chapter 16 (Project: A Platform Game) of Eloquent JavaScript. Use when building games, simulations, animated dashboards, or any UI with a frame loop, or when separating model, rendering, and input in browser code."
---

# Project: A Platform Game

Model the world as immutable state advanced by a pure `update(state, dt, input)` function, render that state through a display object the model knows nothing about, and drive the loop with `requestAnimationFrame` and clamped time steps. This separation makes the hard part (the simulation) testable without a browser.

## Data-driven setup

- Describe content (levels, maps, fixtures) as readable data, such as a grid of characters or JSON, and parse it into the model once. Designers can edit data without touching code.
- Map symbols to meaning through a lookup table that holds either a static tile type or a factory (class with a static `create`). Adding a new kind is a new entry, not a new branch.
- Separate the static background (grid, never changes) from dynamic entities (actors with fractional positions). They have different update and render needs.
- Validate input data while parsing (consistent row lengths, unknown symbols) and fail loudly.

```js
const legend = { ".": "empty", "#": "wall", "+": "lava", "@": Player, o: Coin };
const tiles = rows.map((row, y) => [...row].map((ch, x) => {
  const kind = legend[ch];
  if (kind === undefined) throw new Error(`Unknown tile '${ch}' at ${x},${y}`);
  if (typeof kind === "string") return kind;
  actors.push(kind.create(new Vec(x, y), ch));
  return "empty";
}));
```

## Immutable state, pure updates

- Keep the running state in a small value object (`level`, `actors`, `status`). Each step returns a **new** state; old states stay intact, which enables replay, undo, debugging snapshots, and trivial comparisons.
- Model status as an explicit finite set (`"playing" | "won" | "lost"`); once terminal, updates stop changing it.
- Use tiny immutable value types (a `Vec` with `plus`, `times`) so geometry reads like math and never aliases mutable state.
- Shared constants per class (size, speed) belong on the class (static field or prototype), not recreated per instance or per getter call.

## Polymorphic actors

- Give every entity the same interface: `type`, `pos`, `size`, `update(dt, state, input)` returning a new actor, and `collide(state)` returning a new state. The world loop calls these without knowing concrete classes.
- Put behaviour with the entity that owns it (lava bounces, coins wobble, player reacts to keys); avoid a central `switch (actor.type)`.
- Only the player reads input; other actors ignore the argument. Passing input explicitly (instead of reading globals) keeps updates pure.

## Time steps and collision

- Advance motion by `speed * dt` with `dt` in seconds. Clamp `dt` (for example to 0.1 s) so a hidden tab or long pause cannot teleport objects through walls.
- Small steps allow simple collision: test the proposed position and cancel the move if blocked. Resolve axes separately so hitting a floor does not stop horizontal motion.
- Grid overlap: floor/ceil the rectangle's edges to find the cells it covers; treat out-of-bounds cells as walls so you never index outside the array.
- Axis-aligned rectangle overlap is four comparisons; keep it as a pure helper.
- Tuning constants (gravity, jump speed) are named, grouped, and easy to adjust; magic numbers inside formulas are not.

## Display as a swappable boundary

- The model never touches the DOM. A display object exposes a tiny interface (`constructor(parent, level)`, `syncState(state)`, `clear()`), and the game receives the display **class** as a parameter so DOM, canvas, or test doubles are interchangeable.
- Draw static parts once; redraw dynamic parts from state each frame. Rebuilding a handful of elements is simpler than tracking element-to-actor bookkeeping; optimise only when measurements demand it.
- Express visual state as classes on a wrapper (`game won`) and let CSS style descendants; keep colours and sizes in the stylesheet.
- Convert model units to pixels in exactly one place (a `scale` constant).
- Scroll with a dead zone around the centre rather than recentering every frame.

## Input as state

- For continuous actions, track which keys are **currently held** in an object updated on `keydown`/`keyup`, and let the update step read it. Event-per-press logic suits menus, not movement.
- Call `preventDefault()` only for keys the app uses (so arrows do not scroll the page).
- Register input listeners when a session starts and remove them when it ends (return an unregister function or use an `AbortSignal`); a global, never-removed tracker leaks.

```js
function trackKeys(names, signal) {
  const down = Object.create(null);
  const track = (e) => {
    if (!names.includes(e.key)) return;
    down[e.key] = e.type === "keydown";
    e.preventDefault();
  };
  window.addEventListener("keydown", track, { signal });
  window.addEventListener("keyup", track, { signal });
  return down;
}
```

## The loop and the flow

- Wrap `requestAnimationFrame` in a helper that computes clamped `dt` and stops when the frame callback returns `false`. Keep a handle to pause or cancel it.
- Represent one level/session as a function returning a promise that resolves with its outcome; compose the overall flow (levels, lives, retries) as a readable `async` loop.
- Pausing is just not scheduling the next frame while keeping state; resuming restarts the loop without a large `dt`.

## Workflow

1. Define the data format and a parser that produces static grid plus initial entities.
2. Define immutable state and value types; write `update(state, dt, input)` as a pure function.
3. Give each entity type `update` and `collide`; keep constants named and grouped.
4. Write the display behind a minimal interface; inject its class into the runner.
5. Add input tracking with explicit registration and cleanup.
6. Drive with a clamped `requestAnimationFrame` loop; expose session outcome as a promise.
7. Profile only if frames drop, then optimise rendering (reuse nodes, switch to canvas).

## Red flags

- Simulation code reading `document`, `window`, or global key state directly.
- Entities mutated in place during an update, so later entities see half-updated state.
- `dt` not clamped, or motion per frame instead of per second.
- A giant `switch` on entity type in the main loop.
- Display logic mixed into model classes (`toHTML` on actors).
- Global input listeners that are never removed.
- Collision checks that index arrays without bounds checks.

## Testing notes

- The pure update step is the core unit: given a state, `dt`, and held keys, assert the next state (player lands, coin collected, status becomes `"won"`).
- Build states from tiny inline level strings in tests; they double as readable fixtures (Evident Data).
- Inject a fake display and a fake frame scheduler to test the runner and session promises without a browser.
- Acceptance scenarios describe outcomes ("Given a level with one coin, When the player reaches it, Then the level is won") and can run against the model directly.

## Related

- `../../Language/ProjectRobot/projectRobot.md` — persistent data and pure state transitions.
- `../../Language/SecretLifeOfObjects/secretLifeOfObjects.md` — classes, polymorphism, static methods.
- `../DocumentObjectModel/documentObjectModel.md` — the DOM display and `requestAnimationFrame`.
- `../HandlingEvents/handlingEvents.md` — key events and listener cleanup.
- `../DrawingOnCanvas/drawingOnCanvas.md` — a canvas display for the same model.
- `../../../TDD/Patterns/DesignPatterns/designPatterns.md` — value objects and pluggable objects.
- `../../../CleanCode/Systems/systems.md` — separating construction, domain, and presentation.
