---
name: clean-code-simple-design
description: Kent Beck's four rules of simple design as presented in Chapter 12 (Emergence) of Clean Code, used to let good design emerge through testing and refactoring. Use whenever the user asks how to judge whether a design is good enough, how to prioritize between removing duplication, clarity and fewer classes, whether an abstraction is over-engineered, how to apply YAGNI, or wants a simple decision rule for refactoring. Also use as a tie-breaker when other clean-code guidelines pull in different directions.
---

# Simple Design (Emergence)

Four simple rules, applied in priority order, help good designs emerge. They also make deeper principles like the Single Responsibility and Dependency Inversion principles easier to apply. A design is "simple" if it:

1. **Runs all the tests.**
2. **Contains no duplication.**
3. **Expresses the intent of the programmer.**
4. **Minimizes the number of classes and methods.**

## Rule 1: Runs all the tests

First, the system must demonstrably work as intended. A design that can't be verified is questionable, however elegant it is on paper.

Making a system fully testable pushes it toward a better design. Classes that are easy to test tend to be small and single-purpose. Tight coupling makes testing hard, so writing tests drives you toward dependency injection, interfaces and abstractions. So testability isn't only a verification goal; it's a design force.

## Rules 2–4: Refactoring

With tests in place, you can keep the code clean without fear. After every few lines, pause and ask whether you just made the design worse. If so, clean it up and run the tests. In this step you can apply anything you know about good design: raise cohesion, lower coupling, separate concerns, modularize, shrink functions and classes, and improve names.

### Rule 2: No duplication

Duplication is the primary enemy of a well-designed system. It adds work, risk and complexity. It takes several forms:
- Identical lines.
- Similar lines that can be massaged to look identical, then extracted.
- Duplicated implementation of the same idea. For example, `is_empty()` with its own logic when it could just call `size() == 0`.
- Repeated algorithm skeletons that differ in a few steps. Use the Template Method pattern, passing functions, or strategies.

Removing even small duplication, a few lines at a time, often reveals hidden responsibilities, such as a helper that really belongs in another class. That leads to reuse and better structure.

### Rule 3: Expressive

Code is easy to write when you understand the problem deeply, and hard for the next person to read. Most of the cost of a project is long-term maintenance, so make intent clear:
- Choose good names (see `../MeaningfulNames/ROOT.md`).
- Keep functions and classes small.
- Use standard nomenclature and pattern names (`Command`, `Visitor`, `Decorator`) so the design is communicated quickly.
- Write well-crafted unit tests. They're documentation by example.
- **Care.** The most important way to be expressive is to try. Spend a little time making each piece readable for the next person, often your future self.

### Rule 4: Minimal classes and methods

Even good rules can be pushed too far. The previous rules shouldn't produce an explosion of tiny classes and methods created out of dogma, such as "every class needs an interface" or "data and behavior must always be in separate classes." Keep the total count of functions and classes low. This is the **lowest priority**: tests, no duplication and expressiveness come first, but don't create structure that serves no purpose.

## Using the rules as a decision procedure

When choosing between two versions of code:
1. Do both pass the tests? A version that doesn't (or can't be tested) loses.
2. Which has less duplication of code and knowledge?
3. Which communicates intent more clearly to a reader?
4. If they're still tied, which has fewer moving parts?

When reviewing a proposed abstraction, ask whether it removes real duplication or makes intent clearer. If neither, it's probably unnecessary. Apply rule 4 and leave it out until a real need appears (YAGNI).

## Caveat

No set of rules replaces experience. These rules are condensed experience, and following them helps developers absorb good principles faster.
