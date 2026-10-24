---
name: tdd-design-patterns
description: "The design patterns that show up in TDD and when each one appears, either while writing a test or while refactoring away duplication (Command, Value Object, Null Object, Template Method, Pluggable Object, Pluggable Selector, Factory Method, Imposter, Composite, Collecting Parameter, Singleton), based on Chapter 30 (Design Patterns) of Test-Driven Development: By Example. Use when repeated null checks or duplicated conditionals appear, when a shared mutable object causes aliasing bugs, when two subclasses share a sequence, when a test needs a new variant of an existing object, when a collection should behave like one item, or when someone proposes a Singleton or a pattern up front."
---

# Design Patterns

In TDD, patterns are usually discovered, not planned. Some come up while you write a test and need to express a new scenario. Others come up while you refactor to remove duplication. Introduce a pattern when the tests or the duplication call for it, never as an up-front design phase.

## When each pattern shows up

| Pattern | Writing a test | Refactoring |
|---|---|---|
| Command | X | |
| Value Object | X | |
| Null Object | | X |
| Template Method | | X |
| Pluggable Object | | X |
| Pluggable Selector | | X |
| Factory Method | X | X |
| Imposter | X | X |
| Composite | X | X |
| Collecting Parameter | X | X |

## Command

**Problem:** invoking a computation needs to be more than a plain method call. You may need to log it, defer it or queue it.
**Answer:** make an object that represents the invocation. Give it all the parameters it needs, and run it through a generic protocol such as `run()` or `execute()`.
- Use it only when the call really needs to be concrete and manipulable. In languages with lightweight closures, a lambda is often enough.

## Value Object

**Problem:** an object is widely shared and its identity doesn't matter, but someone could mutate it behind your back (aliasing).
**Answer:** set its state when it is created and never change it. Every operation returns a new object.
- Callers must store the result (`total = total.plus(x)`), because the original never changes.
- Implement equality (and hashing): two 5 CHF values are equal even if they are different instances.
- Reach for it whenever the domain looks like algebra: money, units, geometric shapes, symbolic expressions.
- Address allocation cost only when real data and profiling show a problem.

```ts
test("plus returns a new value and leaves the original unchanged", () => {
  const five = Money.franc(5);
  expect(five.plus(Money.franc(2))).toEqual(Money.franc(7));
  expect(five).toEqual(Money.franc(5));
});
```

## Null Object

**Problem:** special cases (absence, "no policy") lead to `if (x != null)` checks spread across the code.
**Answer:** create an object for the special case that has the same protocol as the regular objects, and return it instead of null.
- The caller's code loses its conditionals, and nobody can forget a null check.
- Weigh the cost: a new class that removes a single conditional may not pay off. It pays when it removes many checks.

```ts
class PermissiveGuard implements Guard { canWrite(_path: string) {} }
const guardFor = (configured?: Guard): Guard => configured ?? new PermissiveGuard();
```

## Template Method

**Problem:** a sequence never changes (input/process/output, setUp/run/tearDown), but its steps vary.
**Answer:** write one method entirely in terms of other methods, and let subclasses specialize those steps.
- Give the steps sensible defaults (no-ops) where possible. If the sequence makes no sense without a step, make that step abstract or have it raise an error.
- Find it through refactoring rather than designing it up front. When two subclasses have two versions of a sequence, move them closer step by step and extract the parts that differ. What's left is the Template Method, which you can then pull up into the superclass.

## Pluggable Object

**Problem:** variation is expressed with explicit conditionals, and the same `if` starts appearing in several methods.
**Answer:** the second time you see the conditional, replace it with an object that has two or more implementations, and delegate to it.
- Example: a selection tool that branches on "a figure is selected" in `mouseDown`, `mouseMove` and `mouseUp` becomes a `SelectionMode` field with `SingleSelection` and `MultipleSelection` implementations. Only the place that creates the mode decides which one to use.
- In statically typed languages, declare an interface for the two (or more) implementations.

## Pluggable Selector

**Problem:** many subclasses, each overriding a single method, which is heavy machinery for very little variation. A switch on a field is no better, because the method name appears at creation, in the switch and in the method itself.
**Answer:** store the name of the method (or a function reference) and invoke it dynamically.
- It is easy to overuse, because dynamic dispatch makes it hard to trace who calls what. Use it only to clean up a simple case where each subclass has exactly one method. In modern languages, prefer storing a function value over reflection by name.

## Factory Method

**Problem:** you need flexibility in what gets created, such as returning a different class later, but constructors pin down the concrete class.
**Answer:** create the object through a method instead of a constructor.
- Typical TDD use: tests that call `new Dollar(5)` prevent you from introducing `Money`. Switching them to `Money.dollar(5)` keeps the tests stable while the implementation class changes.
- The cost is indirection: readers must remember the method creates an object. If you don't need the flexibility, use a constructor.

## Imposter

**Problem:** you need a new variation in a computation, and adding conditionals would spread across many methods.
**Answer:** introduce a new object with the same protocol as an existing one but a different implementation.
- While writing a test: no existing object expresses the new scenario, so swap in an imposter (an `OvalFigure` where a `RectangleFigure` was) and keep the rest of the test the same.
- While refactoring: Null Object (absence behaves like presence) and Composite (many behave like one) are both imposters. As with all refactoring, the search for them is driven by removing duplication.
- If there is one obvious place for an `if` and it duplicates nothing, just write the `if`.

```ts
test("draws an oval through the same medium as a rectangle", () => {
  const brush = new RecordingMedium();
  new Drawing([new OvalFigure(0, 10, 50, 100)]).display(brush);
  expect(brush.log()).toBe("oval 0 10 50 100\n");
});
```

## Composite

**Problem:** an object's behavior is the combined behavior of a list of other objects.
**Answer:** make it an imposter for its components, so that both implement the same interface.
- Example: `Transaction` and `Account` both implement `Holding.balance()`. An account sums its holdings, so an "overall account" is simply an account that contains accounts. No new class and no duplicated summing loop.
- The model may not match the real world (transactions don't really have balances), but the simpler code usually makes up for it.
- You can't always tell ahead of time whether a collection is just a collection or a Composite. Introduce it when the duplication appears.

## Collecting Parameter

**Problem:** the result of an operation is spread across many cooperating objects.
**Answer:** pass a parameter into the operation, and let each object add its part of the result to it.
- Commonly follows Composite. `TestResult` collecting outcomes from many tests is an example.
- Introduce it when the expected results get more sophisticated. A flat string can be concatenated, but an indented tree needs a writer that is passed down through each node.

```ts
toString(): string { const w = new IndentingWriter(); this.writeTo(w); return w.contents(); }
writeTo(w: IndentingWriter) {
  w.line("+"); w.indent(); this.augend.writeTo(w); this.addend.writeTo(w); w.outdent();
}
```

## Singleton

**Problem:** providing a global variable in a language without them.
**Answer:** don't. Spend the time thinking about the design instead. Pass dependencies in explicitly.

## Applying it

1. Write the test for the behavior you need. Don't start from the pattern.
2. If the test needs a new variant of an existing role, consider an Imposter. If it needs the same thing called a different way, consider a Factory Method.
3. Get to green with the simplest code, even if it's a conditional.
4. Refactor when duplication appears: a repeated conditional suggests Pluggable Object or Null Object, a duplicated sequence suggests Template Method, a duplicated aggregate suggests Composite (plus Collecting Parameter for the results).
5. Re-run the tests after every step. Back out a pattern that adds more code than the duplication it removes.

## Red flags

- The same `if (x == null)` or `if (kind == ...)` check in two or more methods.
- Mutable shared objects (money, dates, coordinates) causing "changed behind my back" bugs.
- Parallel classes like `OverallAccount` that duplicate the summing logic of `Account`.
- A hierarchy of one-method subclasses, or a switch that mirrors method names.
- Patterns introduced "for future flexibility" without a test or duplication that requires them.
- Singletons or other global state used to reach collaborators.
- Factory methods everywhere when plain constructors would do.

## Related

- `../Refactoring/refactoring.md`: the small, safe steps used to introduce these patterns.
- `../GreenBarPatterns/greenBarPatterns.md`: get to green first, then refactor toward a pattern.
- `../../MoneyExample/MakinObjects/makinObjects.md`: Factory Method introduced to decouple tests from subclasses.
- `../../MoneyExample/AbstractionFinally/abstractionFinally.md`: Expression and Sum as Imposter and Composite.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md`: polymorphism versus conditionals.
- `../../../CleanCode/SimpleDesign/simpleDesign.md`: removing duplication as the driver of design.
