---
name: clean-code-objects-vs-data
description: Choosing between objects that hide data behind behavior and data structures that expose data, and applying the Law of Demeter, based on Chapter 6 (Objects and Data Structures) of Clean Code. Use whenever the user asks whether to add getters and setters, whether to use a class or a plain record/struct/dataclass/DTO, whether to switch on types or use polymorphism, has long chains like a.getB().getC().doX(), asks about the Law of Demeter, anemic models, or Active Record classes carrying business rules.
---

# Objects and Data Structures

## Data abstraction

Hiding implementation isn't just a matter of putting a layer of getters and setters over fields. Real abstraction exposes the essence of the data, not its storage. Compare:
- `point.x`, `point.y` versus `point.set_cartesian(x, y)` and `point.r`, `point.theta`, which together hide whether storage is cartesian or polar.
- `vehicle.fuel_tank_capacity_gallons` and `vehicle.gallons_of_gasoline` versus `vehicle.percent_fuel_remaining()`.

Don't blindly add getters and setters for every field. Think about the most abstract way to represent what the client needs.

## The anti-symmetry

- **Objects** hide their data behind abstractions and expose functions that operate on it.
- **Data structures** expose their data and have no meaningful behavior.

They're opposites, with opposite strengths:

| | Adding a new function | Adding a new type |
|---|---|---|
| Procedural code over data structures | Easy: write one function | Hard: every function must change |
| OO code with polymorphism | Hard: every class must change | Easy: add one class |

So the idea that "everything is an object" is a myth. When you expect new kinds of things, use objects and polymorphism. When you expect new operations over a fixed set of things, use data structures and functions (or the Visitor pattern in OO languages, or sum types plus pattern matching in languages that have them). Pick deliberately for each part of the system.

## The Law of Demeter

A method `f` of class `C` should only call methods on:
- `C` itself,
- objects created by `f`,
- objects passed as arguments to `f`,
- objects held in fields of `C`.

It shouldn't call methods on objects returned by those calls. Talk to friends, not strangers.

**Train wrecks.** A chain like `ctxt.get_options().get_scratch_dir().get_absolute_path()` couples the caller to the entire internal structure. Splitting it into separate lines makes it more readable but doesn't fix the coupling.

**Whether it's a violation depends on what's being navigated.** If those are plain data structures with public fields, navigating them is natural and fine. If they're objects with behavior, navigating their internals breaks encapsulation.

**Hiding structure.** When objects are involved, ask why the caller wants the data. Then tell the object to do that job: replace the chain above with `ctxt.create_scratch_file_stream(class_file_name)`. Tell, don't ask.

## Avoid hybrids

Half-object, half-data-structure classes, with real behavior plus public fields or getters that other code uses procedurally, get the worst of both: it's hard to add new functions and hard to add new types. Decide which one each class is.

## DTOs and Active Records

- **Data transfer objects** are plain records with public fields and no behavior. They're excellent for boundaries such as database rows, API payloads and parsed messages, often as the first stage of translation into domain objects. Use dataclasses, records, structs or plain typed objects.
- **Active Records** are DTOs with navigation methods like `save` and `find`. Don't put business rules in them, because that creates a hybrid. Keep them as data structures and put business rules in separate objects that hide their internal data, possibly backed by the Active Record.

## Applying it

When reviewing or designing a class, ask:
1. Is this meant to be an object or a data structure? Make it fully one or the other.
2. Are the getters and setters exposing representation rather than meaning? Replace them with intention-level methods.
3. Are there chains through objects? Move the behavior to the object that owns the data.
4. Is there a type switch repeated across functions? If new types are likely, consider polymorphism; if new operations are likely, the switch over a data structure may be right.
