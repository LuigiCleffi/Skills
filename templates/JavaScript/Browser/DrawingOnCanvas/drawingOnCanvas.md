---
name: js-canvas
description: "Drawing with the 2D canvas API (context state, paths, curves, text, images and sprites, transformations, save/restore, redraw loops) and choosing between HTML, SVG and canvas, based on Chapter 17 (Drawing on Canvas) of Eloquent JavaScript. Use when rendering charts, games, image editing or animations in the browser, picking a graphics technology, debugging shapes that connect or vanish, or reviewing canvas code for leaked transforms and missed redraws."
---

# Drawing on Canvas

Treat a canvas as a pixel surface with no memory of what you drew: keep the scene in your own data, and redraw it from that data whenever it changes. Keep geometry in pure functions and confine the stateful drawing context to a thin render layer.

## Choosing a graphics interface

| Need | Prefer |
|---|---|
| Text that wraps, flows, is selectable or accessible | Plain HTML (overlay it on graphics if needed) |
| Crisp shapes at any zoom, per-shape event handlers, few changing parts | SVG (shapes are DOM nodes) |
| Thousands of small shapes, per-pixel work, image processing, games | Canvas (low cost per shape, no DOM tree) |
| 3D or GPU compute | `"webgl"` / `"webgpu"` contexts |

- SVG elements live in the SVG namespace; create them with `document.createElementNS("http://www.w3.org/2000/svg", "circle")`, not `createElement`.
- A canvas offers no hit testing: map pointer coordinates back to your model yourself.
- For simple displays any of the three works; pick the one that keeps the code simplest.

## Context state and the coordinate system

- Get a drawing interface with `canvas.getContext("2d")`; the origin is the top-left, y grows downward.
- Size the canvas with the `width`/`height` attributes or properties (default 300×150), not CSS alone: CSS stretches the bitmap and blurs it.
- Setting `width` or `height` clears the canvas and resets context state.
- Style lives on the context (`fillStyle`, `strokeStyle`, `lineWidth`, `font`, `textAlign`, `textBaseline`), not in method arguments. Every later call inherits it, so set what you need right before drawing.
- `fillRect`, `strokeRect`, `clearRect`, `fillText`, `strokeText` draw immediately without a path.

**Current note:** for sharp output on high-density screens, scale the backing store by `devicePixelRatio` and call `cx.scale(dpr, dpr)` once.

## Paths and curves

- A path is built by side effects: `beginPath()`, then `moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo`, `arc`, then `fill()` or `stroke()`.
- Always call `beginPath()` before a new shape; otherwise the next `stroke()` redraws every earlier segment too.
- `fill()` implicitly closes each subpath; `stroke()` does not. Call `closePath()` when the closing edge must be stroked.
- `arc(x, y, r, start, end)` uses radians, clockwise from the positive x-axis; `2 * Math.PI` is a full turn. An arc connects to the previous point unless you `moveTo` or start a new path.
- Bezier control points pull the curve; they are rarely on it. Compute them when you can.

```js
const TAU = 2 * Math.PI;
function drawPie(cx, slices, {x, y, r}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  let angle = -TAU / 4;                       // start at 12 o'clock
  for (const {count, color} of slices) {
    const sweep = (count / total) * TAU;
    cx.beginPath();
    cx.moveTo(x, y);
    cx.arc(x, y, r, angle, angle + sweep);
    cx.fillStyle = color;
    cx.fill();
    angle += sweep;
  }
}
```

**Current note:** `Path2D` objects make paths storable values (`cx.fill(path)`, `cx.isPointInPath(path, x, y)`), and `roundRect` covers rounded boxes.

## Text

- `fillText(text, x, y)` positions the alphabetic baseline by default; adjust with `textAlign` (`"center"`, `"end"`) and `textBaseline` (`"top"`, `"middle"`).
- `font` takes CSS shorthand (`"bold 16px sans-serif"`). Canvas does not wrap text; use `measureText` or put labels in HTML.
- Place labels around a circle with `Math.cos`/`Math.sin` of the slice's middle angle, flipping `textAlign` by side.

## Images and sprites

- `drawImage(img, x, y)` draws at natural size; add width/height to scale; the 9-argument form copies a source rectangle into a destination rectangle, which is how sprite sheets work.
- An image must be loaded before it draws. Drawing an unloaded image silently does nothing, which is acceptable only inside a continuous redraw loop.
- Animate by clearing (`clearRect` or a full background fill) and redrawing each frame; step frames from time (`Math.floor(time / 60) % frames`), not a frame counter.

```js
async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();          // rejects if the image is broken
  return img;
}
```

**Current note:** prefer `requestAnimationFrame` over `setInterval` for animation, and `img.decode()` or `createImageBitmap()` over a bare `"load"` listener.

## Transformations

- `translate`, `scale`, `rotate` modify the current transform for everything drawn later, and they compose: each is applied in the already-transformed coordinate system, so order matters.
- Scaling by a negative factor mirrors around the origin; to mirror around a line `x = a`, translate to `a`, scale `(-1, 1)`, translate back by `-a`.
- Bracket every temporary transform (and style change) in `save()` / `restore()`. A function that transforms without restoring corrupts its caller's drawing.
- Recursive drawing (trees, fractals) needs `save`/`restore` around each branch so siblings start from the same origin.
- Transformed bitmap draws are slower; for many mirrored sprites, prerender the flipped version to an offscreen canvas once and reuse it.

```js
function withTransform(cx, draw) {
  cx.save();
  try { draw(cx); } finally { cx.restore(); }
}
```

**Current note:** `cx.resetTransform()` / `cx.setTransform(...)` reset absolutely; `OffscreenCanvas` lets rendering move into a worker.

## Scene redraw and viewports

- Separate the model (state) from the display. A display object exposes something like `syncState(state)` and `clear()`, and redraws the visible scene from state each frame.
- Keep a viewport in model units; convert with `(modelX - view.left) * scale`. Clamp it with `Math.max`/`Math.min` so it never shows outside the world.
- Draw only tiles that intersect the viewport (`Math.floor(left)` to `Math.ceil(left + width)`).

## Workflow

1. Decide HTML, SVG or canvas from the table above; justify canvas by volume or per-pixel needs.
2. Model the scene as plain data; write geometry (angles, layout, viewport math) as pure functions.
3. Write a render function that takes the context and the data; set every style it relies on.
4. Start each shape with `beginPath`; wrap every transform in `save`/`restore`.
5. Load images up front (await `decode`) or tolerate unloaded images in a redraw loop.
6. Drive animation with `requestAnimationFrame` and time deltas; clear before each frame.
7. Check sizing: attribute size, CSS size and `devicePixelRatio` agree.

## Red flags

- Strokes that grow heavier or shapes that connect unexpectedly: missing `beginPath`.
- A transform or `globalAlpha` set without `save`/`restore`, leaking into later drawing.
- Degrees passed to `arc` or `rotate`.
- Canvas sized only through CSS (blurry), or resized every frame (clears and resets state).
- Trying to "move" a drawn shape instead of redrawing from state.
- Click handling with no mapping from pixels back to the model.
- Hard-coded magic coordinates everywhere instead of parameterized shape functions.
- Long text or interactive controls drawn on canvas where HTML would do.

## Testing notes

- Unit-test the pure parts (slice angles, label positions, viewport clamping, sprite frame choice) without a canvas.
- For the render layer, pass a fake context that records calls and assert on the call sequence (e.g. `beginPath` before each `arc`, balanced `save`/`restore`).
- jsdom has no real canvas; use the `canvas` npm package or run in a real browser.
- In acceptance tests, assert visible outcomes through screenshot comparison with a tolerance, or expose model state for assertions; do not read pixels to infer business rules.

## Related

- `../ProjectPlatformGame/projectPlatformGame.md` — the state/display split this canvas display plugs into.
- `../DocumentObjectModel/documentObjectModel.md` — DOM-based drawing and positioning.
- `../HandlingEvents/handlingEvents.md` — `requestAnimationFrame` and pointer input.
- `../ProjectPixelArtEditor/projectPixelArtEditor.md` — canvas inside a component architecture.
- `../../../CleanCode/Functions/functions.md` — small parameterized drawing functions.
- `../../../BDD/CodingTheBddWay/UiAcceptanceCriteria/uiAcceptanceCriteria.md` — automating visual UI checks.
