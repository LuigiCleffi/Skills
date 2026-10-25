---
name: js-project-robot
description: "Design lessons from a small simulation: minimal state, persistent (immutable) data with transitions that return new state, behavior as plain functions with explicit memory, data-first graph modeling, breadth-first search, and measuring strategies fairly, based on Chapter 7 (Project: A Robot) of Eloquent JavaScript. Use when modeling application or domain state, writing reducers or state transitions, tempted to create a class per noun, implementing pathfinding or graph search, or comparing alternative algorithms."
---

# Project: A Robot

Model the world as the smallest set of values that defines it, and make every change produce a new value instead of mutating the old one. Keep behavior in plain functions that take state in and return decisions out. That makes code easy to reason about, test, and compare.

## Do not make every noun an object

- "It sounds like an object" is not a reason to write a class. A class per concept (robot, parcel, place) yields a web of objects each holding mutable state, which is hard to understand and easy to break.
- Ask instead: what is the *minimal* data that fully describes the situation? Everything else is derived.
- Represent relationships as data (a graph as `{ node: [neighbors] }` or a `Map`) built once from raw input, not as object references between instances.

```js
function buildGraph(edges) {
  const graph = new Map();
  const link = (a, b) => graph.set(a, [...(graph.get(a) ?? []), b]);
  for (const [a, b] of edges) { link(a, b); link(b, a); }
  return graph;
}
```

## Persistent state and transitions

- A transition is a method or function `(state, action) => newState`. It never modifies `state`; it copies what changes and shares what does not.
- Return the same state object for an invalid action (or throw, if invalid actions are programmer errors) so callers can detect "nothing happened" by identity.
- Use `map`/`filter`/spread to derive new collections; never `push`/`splice` on state you received.
- Old states remain valid: undo, history, time-travel debugging, and diffing come for free.

```js
class Village {
  constructor(place, parcels) { this.place = place; this.parcels = parcels; }
  move(to, graph) {
    if (!graph.get(this.place)?.includes(to)) return this;
    const parcels = this.parcels
      .map(p => (p.place === this.place ? { ...p, place: to } : p))
      .filter(p => p.place !== p.address);
    return new Village(to, parcels);
  }
}
```

- `Object.freeze` makes writes fail (silently in sloppy code, with a `TypeError` in strict/module code) but is shallow and costs a little. Use it at boundaries or in development builds when accidental mutation is a real risk; otherwise rely on convention and review.

**Current note:** non-mutating array methods (`toSorted`, `toReversed`, `toSpliced`, `with`) and `structuredClone` make persistent updates easier; libraries such as Immer give structural sharing for large state trees.

## Behavior as functions with explicit memory

- Model an agent, strategy, or policy as a function `(state, memory) => { action, memory }`. Any memory it needs is passed in and returned, never hidden in globals or closures you cannot inspect.
- This makes strategies interchangeable (polymorphism by function signature) and deterministic given their inputs.
- Keep the driver loop (`run(state, strategy, memory)`) separate from strategies and from the transition logic.
- Isolate randomness: pass a random source in, or generate inputs up front, so runs can be reproduced.
- Start with the dumbest strategy that could work, then improve it while measuring.

## Graph search

- Breadth-first search finds a shortest path in an unweighted graph: keep a work list of `{ at, route }`, process it in order, and skip nodes already reached.
- Track visited nodes in a `Set` for O(1) checks; do not scan the work list with `some` for each neighbor.
- Decide explicitly what happens when no route exists: return `null` (and handle it) rather than assuming the graph is connected.
- For weighted edges use Dijkstra or A*; consider a well-tested package before writing one.

```js
function findRoute(graph, from, to) {
  const work = [{ at: from, route: [] }];
  const seen = new Set([from]);
  for (const { at, route } of work) {
    for (const next of graph.get(at) ?? []) {
      if (next === to) return [...route, next];
      if (!seen.has(next)) { seen.add(next); work.push({ at: next, route: [...route, next] }); }
    }
  }
  return null;
}
```

## Measuring alternatives

- Compare strategies on the *same* generated tasks, many of them (e.g. 100), and report averages. Different random tasks per strategy make comparisons meaningless.
- Keep the measurement harness separate from the strategies so it works for any function with the strategy signature.

## Workflow

1. Write down the minimal state that defines the situation; derive everything else.
2. Convert raw input into a convenient data structure once, at the boundary.
3. Implement each change as a pure transition returning new state; leave inputs untouched.
4. Express decisions as functions of `(state, memory)`; pass memory explicitly.
5. Keep the driver loop, transitions, and strategies in separate units (later, separate modules).
6. Handle impossible cases (no route, invalid move) explicitly.
7. Measure improvements on shared, reproducible inputs before claiming one is better.

## Red flags

- A class for every noun in the spec, each with setters, mutating each other.
- Transition functions that `push`, `splice`, or assign into the state they receive.
- Hidden mutable module-level state that strategies read or write.
- `Math.random()` buried deep in logic, making failures unreproducible.
- Search that assumes success and returns `undefined` silently on a disconnected graph.
- Linear scans for "already visited" inside nested loops.
- Performance claims based on one or two hand-picked runs.

## Testing notes

- Pure transitions are the easiest code to test first: build a state literal, apply one action, assert on the new state, and assert the old state is unchanged.
- Inject the random source or generate fixtures with a fixed seed so tests and scenarios are deterministic.
- Scenarios map naturally to "Given state, When action, Then new state"; keep step definitions calling transitions, not poking internals.
- Test strategies against small hand-built graphs with known shortest paths, including the unreachable case.

## Related

- `../../Language/SecretLifeOfObjects/secretLifeOfObjects.md` — classes and interfaces, used sparingly.
- `../../Language/HigherOrderFunctions/higherOrderFunctions.md` — `map`/`filter` for non-mutating updates.
- `../../Language/BugsAndErrors/bugsAndErrors.md` — persistent data simplifies error recovery and testing.
- `../../Language/Modules/modules.md` — splitting the project into modules.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — data structures versus objects.
- `../../../CleanCode/SimpleDesign/simpleDesign.md` — minimal design that passes the tests.
- `../../../TDD/Patterns/TDDPatterns/tddPatterns.md` — evident data and isolated tests.
