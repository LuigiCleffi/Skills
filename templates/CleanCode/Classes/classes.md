---
name: clean-code-classes
description: Designing classes and modules that are small, cohesive and organized for change, based on Chapter 10 (Classes) of Clean Code. Use whenever the user asks how big a class should be, whether to split a class, about the Single Responsibility Principle, cohesion, god classes, ordering members inside a class, encapsulation and test access, or about making a class open for extension and closed for modification, or depending on abstractions instead of concrete classes. Also use when the AI designs a new class or module.
---

# Classes

Functions are the first level of organization. Classes, or modules in non-OO languages, are the next one up. The same values apply: small, focused and easy to change.

## Class organization

Follow the language's convention. A sensible default (the Java convention) is:
1. Public constants.
2. Private static or class-level variables.
3. Private instance variables (fields).
4. Public functions.
5. Private helpers, placed right after the public function that uses them (stepdown rule).

Public fields are rarely justified.

**Encapsulation.** Keep fields and helpers private by default. Loosening visibility so a test can reach something is acceptable as a last resort, since tests rule. But first look for a way to keep things private, such as testing through the public API or extracting the helper into its own class.

## Classes should be small

Measure size by **responsibilities**, not lines.

- **The name test.** Try to describe the class in about 25 words without "if," "and," "or" or "but." If you can't, it has more than one responsibility.
- Vague names like `Processor`, `Manager` and `Super` often mean the class aggregates too much.
- A class with dozens of public methods is clearly too big. But a class with five methods can also be too big if they serve two unrelated purposes.

## Single Responsibility Principle

A class or module should have **one reason to change**. For example, a class that both tracks version information and manages GUI components has two reasons to change. Extract `Version` into its own class.

Many developers fear that lots of small classes make the system hard to understand. They don't. A system of many small classes has no more moving parts than one with a few large ones. The question is whether you want your tools in a toolbox with labeled drawers or dumped in a heap. Every sizable system has a lot of logic; organize it so people can find things and only need to understand what's relevant right now.

## Cohesion

A class should have a small number of fields, and each method should use one or more of them. The more fields each method uses, the more cohesive the class. Aim for high cohesion: the class's methods and data belong together as one logical whole.

**Cohesion falls naturally into many small classes.** When you extract part of a big function and promote its locals to fields so the new helpers can share them, cohesion drops: some fields are used only by some methods. That's a signal to split those fields and methods into their own class. Breaking up large functions therefore often reveals the right class structure.

## Organizing for change

Every change risks breaking something. Structure classes so changes touch as little as possible.

**Open–Closed Principle.** Classes should be open for extension and closed for modification. Consider a single `Sql` class with methods for `select`, `insert`, `update` and so on. Adding a new statement type means opening the whole class, and every change risks breaking the others. Instead, use an abstract `Sql` with one subclass per statement (`SelectSql`, `InsertSql`, ...). Adding a statement type means adding a class, and nothing existing changes. Each class is tiny and easy to test.

Don't restructure speculatively. If a class is small and stable, leave it. Restructure when you actually need to open it for a change.

**Isolate from change (Dependency Inversion).** Code that depends on concrete details is at risk when those details change, and it's hard to test. Depend on abstractions instead:

```
class Portfolio:
    def __init__(self, exchange: StockExchange):   # interface
        self._exchange = exchange
```

In tests, inject a fixed-price fake exchange. In production, inject the real client. Classes become decoupled, testable and reusable, and changes in one don't ripple into others.

## Applying it

When designing or reviewing a class:
1. Write its one-sentence responsibility. If it has an "and," split it.
2. Map which methods use which fields. Clusters of methods sharing a subset of fields suggest a new class.
3. Check whether a likely new requirement would mean editing existing code, or only adding new code.
4. Check whether it depends on concrete external details (I/O, vendors, clocks) that should be behind an interface.
5. Order members per convention, with helpers below their callers.
