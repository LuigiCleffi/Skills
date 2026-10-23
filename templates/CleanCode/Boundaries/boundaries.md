---
name: clean-code-boundaries
description: Integrating third-party libraries, frameworks, external APIs and not-yet-written code cleanly, based on Chapter 8 (Boundaries) of Clean Code. Use whenever the user adopts a new library or SDK, wants to wrap or isolate a vendor API, is passing raw library types (maps, response objects, ORM entities) around the codebase, wants to explore how a library behaves, asks about learning tests or adapters, worries about upgrading or swapping a dependency, or must code against an API that another team hasn't delivered yet.
---

# Boundaries

There's a natural tension at the edge of any system. Providers of libraries aim for broad applicability, while users want an interface focused on their own needs. Interesting things, including change, happen at boundaries, so they deserve deliberate design.

## 1. Don't let general-purpose interfaces leak

A broad library type, such as a generic map, a raw HTTP response, an ORM session or a vendor client, offers far more capability than your code needs. That capability includes operations you don't want anyone calling, such as `clear()` on a shared map. If it's passed around the system, every user becomes coupled to it, and every change to the library ripples everywhere.

Wrap it in a small class or module that exposes only what your application needs, in your domain's terms:

```
class Sensors:
    def __init__(self):
        self._by_id: dict[str, Sensor] = {}
    def get(self, sensor_id: str) -> Sensor:
        return self._by_id[sensor_id]
```

Now the casting, generics, error translation and library quirks live in one place, and the interface can evolve independently. You don't have to wrap every use of every collection. The point is to avoid passing boundary types through public APIs or across many modules.

## 2. Explore with learning tests

When adopting a library, don't learn it by trial and error inside production code. Write **learning tests**: small tests that call the library the way you intend to use it and assert what you expect it to do.

- They're controlled experiments that build your understanding quickly.
- They cost nothing extra, since you had to learn the API anyway, and they keep the knowledge in executable form.
- **On every upgrade, run them.** They immediately show behavioral changes in the new version.
- Even without learning tests, keep boundary tests that exercise the interface the way production code does. They make upgrades safe and so encourage staying current.

Process: write a test of the simplest thing you think should work, run it, read the error or docs, adjust, and repeat. Then package what you learned into your wrapper class.

## 3. Code against interfaces that don't exist yet

When another team's API or a subsystem isn't defined yet, don't block. Define the interface **you wish you had**, the one that's most convenient for your code:

1. Write your code against your own ideal interface (for example `Transmitter.transmit(frequency, stream)`).
2. Provide a fake implementation for tests.
3. When the real API arrives, write an **adapter** that bridges your interface to theirs.

This keeps your code clean and expressive, isolates the unknown in one place, and gives you a natural seam for boundary tests.

## 4. Clean boundaries

- Keep references to third-party specifics in very few places.
- Depend on something you control (your wrapper or interface) rather than something you don't.
- Use wrappers or adapters (or a facade, or an anti-corruption layer in DDD terms) to convert between their model and yours.
- Cover the boundary with tests that define what you expect from it.

## Applying it

When the AI introduces or touches a dependency:
1. Find where its types appear in signatures and how far they spread.
2. Propose a thin wrapper with domain names if it spreads beyond one module.
3. Translate its errors into domain errors (see `../ErrorHandling/errorHandling.md`).
4. Suggest or write learning or boundary tests for the behavior the code relies on.
5. For not-yet-available dependencies, define the desired interface plus a fake, and leave an adapter for later.
