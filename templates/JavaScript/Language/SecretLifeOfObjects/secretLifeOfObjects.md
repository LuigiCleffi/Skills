---
name: js-objects-and-classes
description: "Objects as abstract data types: methods and this, prototypes, classes, #private members, getters/setters/statics, Map vs plain objects, polymorphism, symbols, the iterator protocol, inheritance and instanceof, based on Chapter 6 (The Secret Life of Objects) of Eloquent JavaScript. Use when designing a class or object interface, hiding internal state, using an object as a dictionary, making a type iterable, choosing between inheritance and composition, or debugging a lost this."
---

# The Secret Life of Objects

Treat every object type as an appliance: a small public interface over hidden internals. Keep state private, share behavior through the prototype, write code against interfaces rather than concrete types, and reach for inheritance last.

## Interfaces and encapsulation

- Decide the interface first: the few methods and properties callers may use. Everything else is an implementation detail you can rewrite freely.
- Use `#private` fields and methods for internals. They are enforced by the language, unlike the old `_underscore` convention. Private fields must be declared in the class body.
- A group of cooperating types is often the real unit of design; do not force every concept into one class.
- If something can be a plain function over plain data, prefer that to a stateful object (see `js-modules`).

```js
export class RandomSource {
  #max;
  constructor(max) { this.#max = max; }
  next() { return Math.floor(Math.random() * this.#max); }
}
```

## Methods and `this`

- A method is a property holding a function; `this` is bound by *how* it is called (`obj.method()`), not where it was defined.
- Detaching a method (`const f = obj.method; f()`, passing `obj.method` as a callback) loses `this`. In strict code (classes, modules) `this` becomes `undefined` and fails loudly.
- Arrow functions do not have their own `this`; they see the enclosing one. Use them for callbacks inside methods.
- Fix detached callbacks with an arrow wrapper (`() => obj.method()`), `.bind(obj)`, or an arrow-function class field when the method is always used as a handler.
- `fn.call(thisArg, ...args)` sets `this` explicitly; reserve it for borrowing generic methods.

## Prototypes and classes

- Property lookup walks the prototype chain: own properties first, then the prototype, up to `Object.prototype` (whose prototype is `null`).
- `class` creates a constructor function whose `.prototype` holds the methods; instances get per-instance data in the constructor or class fields. Methods live once on the prototype, fields live on every instance.
- A constructor's own prototype (`Object.getPrototypeOf(Rabbit)`) is `Function.prototype`; the prototype of its instances is `Rabbit.prototype`. Do not confuse the two.
- Class constructors throw if called without `new`; prefer `class` over hand-written constructor functions with `.prototype` patching.
- Assigning a property always creates an own property that shadows the prototype's; it never mutates the shared one. Never mutate built-in prototypes (`Array.prototype.x = ...`).
- `Object.create(proto)` makes an object with a chosen prototype; `Object.create(null)` makes one with none.

## Getters, setters, statics

- Use `get`/`set` to expose computed or validated properties while storing one canonical representation (e.g. store Celsius, expose Fahrenheit).
- Keep getters cheap and side-effect free; a getter that does I/O or random work surprises readers.
- Use `static` methods for alternative constructors (`Temperature.fromFahrenheit(212)`) and type-level helpers. Inside a static method `this` is the class, so `new this(...)` respects subclasses.

## Maps versus plain objects

- A plain object used as a dictionary inherits keys such as `toString` (`"toString" in obj` is `true`) and only supports string/symbol keys.
- Use `Map` for dynamic keys, non-string keys, frequent add/delete, or when size and insertion order matter; use `Set` for membership.
- When you must use an object as a map, check with `Object.hasOwn(obj, key)` and enumerate with `Object.keys`/`Object.entries` (own keys only), or create it with `Object.create(null)`.

```js
const ages = new Map([["Ana", 39]]);
ages.has("toString");          // false
Object.hasOwn({ x: 1 }, "x");  // true
```

**Current note:** `Object.groupBy` and `Map.groupBy` replace hand-rolled grouping into dictionaries; `structuredClone` copies Maps and Sets, unlike JSON round-trips.

## Polymorphism and symbols

- Code written against an interface (a `toString` method, `length` plus indexes, an iterator) works with any object that provides it. Prefer this duck typing to `instanceof` checks.
- Override `toString` when an object needs a meaningful string form.
- Symbols are unique property keys; use them to add a protocol to objects without clashing with ordinary names. Well-known symbols (`Symbol.iterator`, `Symbol.asyncIterator`, `Symbol.toPrimitive`) plug into language features.

## The iterator protocol

- An object is iterable if `[Symbol.iterator]()` returns an iterator whose `next()` yields `{ value, done }`. Iterables work with `for/of`, spread, destructuring, `Array.from`, `new Set(...)`.
- Write iteration as a generator method: shorter and correct by construction.

```js
class Group {
  #members = [];
  static from(iterable) {
    const g = new this();
    for (const v of iterable) g.add(v);
    return g;
  }
  add(v) { if (!this.has(v)) this.#members.push(v); }
  has(v) { return this.#members.includes(v); }
  *[Symbol.iterator]() { yield* this.#members; }
}
```

**Current note:** iterator helpers (`Iterator.prototype.map/filter/take`, `Iterator.from`) let you transform iterators lazily without converting to arrays.

## Inheritance

- `class B extends A` makes `B.prototype` derive from `A.prototype`. Call `super(...)` before touching `this`; use `super.method()` to reach the parent implementation.
- Inheritance couples the subclass to the parent's internals and ties types together. Prefer composition (hold an `A`, delegate to it) and shared interfaces; subclass only for a genuine "is a specialized kind of" relation with a small, stable parent.
- Extending `Error` to create recognizable error types is the canonical good use (see `js-bugs-and-errors`).
- `instanceof` sees through the chain (`new LengthList() instanceof List`). It fails across realms (iframes, workers) and for structural look-alikes; use `Array.isArray` for arrays.

## Workflow

1. Name the type and write down its public interface: constructor/factories, methods, readable properties.
2. Ask whether a function over plain data would do; only create a class if it owns invariants or state.
3. Make all state `#private`; expose getters for read-only views.
4. Put shared behavior in methods (prototype); per-instance data in fields.
5. Add `static` factories for alternative construction paths.
6. Implement standard protocols (`Symbol.iterator`, `toString`, `toJSON`) instead of bespoke methods when callers expect them.
7. Prefer composition; justify each `extends`.

## Red flags

- `this` used inside a `function` callback, or a method passed as a callback without binding.
- Plain `{}` used as a dictionary of user-controlled keys checked with `in` or `obj[key]` truthiness (`"__proto__"`, `"constructor"`, `"toString"` collide).
- Public mutable fields that callers set directly to drive internal state.
- `_private` naming instead of `#private` in new code.
- Deep class hierarchies, or subclasses overriding many parent methods.
- Type switches on `instanceof`/`constructor.name` where polymorphism would do.
- Patching built-in prototypes or adding methods via `Class.prototype.x = ...` in application code.
- Getters with side effects; iterators that return the wrapped array's iterator while claiming custom behavior.

## Testing notes

- Test through the public interface only; private fields cannot (and should not) be reached from tests.
- Iterables: assert with `[...obj]` or `Array.from(obj)` and compare with `assert.deepStrictEqual`/`toEqual`.
- Polymorphism makes test doubles trivial: any object with the right methods is a valid fake; no mocking library needed.
- Static factories give acceptance tests readable fixture builders (`Order.fromLines(...)`).

## Related

- `../../Language/DataStructures/dataStructures.md` — objects and arrays as plain data.
- `../../Language/ProjectRobot/projectRobot.md` — when not to model concepts as stateful objects.
- `../../Language/BugsAndErrors/bugsAndErrors.md` — custom `Error` subclasses.
- `../../Language/Modules/modules.md` — module interfaces mirror object interfaces.
- `../../../CleanCode/Classes/classes.md` — small, cohesive classes.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects hide data, data structures expose it.
- `../../../TDD/Patterns/DesignPatterns/designPatterns.md` — design patterns that emerge under TDD.
