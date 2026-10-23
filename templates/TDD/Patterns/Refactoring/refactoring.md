---
name: tdd-refactoring
description: Small-step refactorings for changing a design under green tests (Reconcile Differences, Isolate Change, Migrate Data, Extract Method, Inline Method, Extract Interface, Move Method, Method Object, Add Parameter, Method Parameter to Constructor Parameter), based on Chapter 31 (Refactoring) of Test-Driven Development: By Example. Use when unifying two similar pieces of code, changing a data representation (one to many, old format to new), extracting or inlining methods, introducing an interface for a second implementation or a test double, moving logic to the object it talks to, taming a method with many temporaries, or threading a new parameter through callers.
---

# Refactoring

Change the design, even radically, in small steps that keep every passing test green. In TDD a refactoring only has to preserve the tests you already have, for example turning a constant into a variable. That puts an obligation on you: write enough tests that "safe with respect to the tests" means "safe". "All tests pass" is no excuse when you know there's a problem. Write more tests.

## Reconcile Differences

**Problem:** two similar pieces of code should become one.
**Answer:** bring them closer step by step, and merge them only when they are identical.
- This works at every scale. Make two loops identical, then merge them. Make two branches of a conditional identical, then drop the conditional. Do the same for two methods, or two classes.
- Avoid leap-of-faith refactorings that rely on a long chain of reasoning. Take steps whose safety the tests can confirm.
- Work backwards when useful: picture the trivial last step and head for it. For example, to remove subclasses, make each subclass's methods identical to the superclass's until the subclass is empty, then replace references to it with the superclass.

## Isolate Change

**Problem:** you need to change one part of a multi-part method or object.
**Answer:** first isolate the part that has to change, then change it.
- Tools: Extract Method (most common), Extract Object, Method Object.
- If the change turns out to be trivial once isolated, you may inline the isolation again. Don't do it automatically: weigh the cost of an extra method against the value of an explicit concept.

## Migrate Data

**Problem:** you need to change a representation.
**Answer:** duplicate the data temporarily.

Internal first (change the representation, then the interface):
1. Add a field in the new format.
2. Set it everywhere the old format is set.
3. Read from it everywhere the old format is read.
4. Delete the old format.
5. Change the external interface to reflect the new format.

API first (change the interface, then the representation):
1. Add a parameter in the new format.
2. Translate it into the old internal representation.
3. Delete the old parameter.
4. Replace uses of the old format with the new one.
5. Delete the old format.

One to Many always creates this problem. Moving from a single item to a collection is a refactoring while the collection holds one element:

```python
class Suite:
    def __init__(self):
        self.tests = []              # 1. new format alongside the old
    def add(self, test):
        self.test = test             # old: delete once nothing reads it
        self.tests.append(test)      # 2. set both
    def run(self, result):
        for t in self.tests:         # 3. read the new format
            t.run(result)
```

The same approach works for switching between equivalent protocols, for example an old iterator API and a new one.

## Extract Method

**Problem:** a long, complicated method is hard to read.
**Answer:** turn a small part of it into its own method and call that.
1. Find a region that deserves its own name. Loop bodies, whole loops and branches are common candidates.
2. Check that the region doesn't assign to temporaries declared outside it.
3. Copy the region into a new method and compile.
4. Add a parameter for each outer variable or parameter it uses.
5. Call the new method from the original.

Prefer the IDE's automated version. Use it to understand code ("what should we call this part?") and to remove duplication between two methods that are partly alike. If you have extracted so far that you can't see the way forward, inline the pieces back and extract again.

## Inline Method

**Problem:** control flow or data has become too twisted or scattered.
**Answer:** replace the method call with the method's body.
1. Copy the method.
2. Paste it over the call.
3. Substitute the actual arguments for the formal parameters. If an argument has side effects (for example `reader.next()`), assign it to a local first.

Use it to experiment with control flow (what if the expression reduced itself instead of the bank reducing it?), and to unwind layers of abstraction that have become too clever so you can re-abstract based on real needs.

## Extract Interface

**Problem:** you need a second implementation of some operations.
**Answer:** create an interface containing the shared operations.
1. Declare the interface. If the interface should take the current class's name, rename the class first.
2. Make the existing class implement it.
3. Add the needed methods to the interface, widening visibility if necessary.
4. Change type declarations from the class to the interface wherever possible.

Naming: with a real second variant (Rectangle and Oval), the name is usually easy (`Shape`). When the second implementation is a Crash Test Dummy or Mock Object, resist `IFile` and `File`. Ask what the class really assumes. Perhaps the interface is `File` and the class is `DiskFile`.

## Move Method

**Problem:** a method, or part of one, belongs on another object.
**Answer:** add it to the class where it belongs, then call it there.
1. Copy the method.
2. Paste it into the target class with a suitable name, and compile.
3. If it references the original object, pass that object as a parameter. If it reads the original's fields, pass them in. If it assigns the original's fields, give up.
4. Replace the original body with a call to the new method.

Trigger: a method sends two or more messages to another object (`bounds.right() - bounds.left()`, `bounds.bottom() - bounds.top()`). Move that logic to the other object (`bounds.area()`). It's easy to spot, the mechanics are quick and safe, and the result is often illuminating. To move only part of a method, use Extract Method, then Move Method, then Inline Method on the remaining one-line method.

## Method Object

**Problem:** a complicated method has many parameters and local variables, so Extract Method produces long, ugly signatures.
**Answer:** turn the method into an object.
1. Create a class whose constructor takes the method's parameters.
2. Make the locals into fields as well.
3. Add `run()` with the original body.
4. In the original method, create the object and call `run()`.

Now you can extract methods freely, because the fields form a shared namespace. This also prepares the code for a whole new kind of logic. For example, with cash-flow calculation in an object, you can test-drive a net-present-value variant separately and plug it in with one step.

## Add Parameter

**Problem:** a method needs more information.
**Answer:**
1. If the method is declared in an interface, add the parameter there first.
2. Add the parameter to the method.
3. Let compiler or type-checker errors show you each caller to update.

This is usually an extension step: the first test passed without the information, and a new case needs it. It's also part of Migrate Data (add the new parameter, remove uses of the old one, then remove the old one).

## Method Parameter to Constructor Parameter

**Problem:** the same parameter is passed to many methods of one object.
**Answer:** pass it once, to the constructor.
1. Add the parameter to the constructor.
2. Add a field with the same name, and set it in the constructor.
3. One reference at a time, change `param` to `self.param`.
4. When no references remain, remove the parameter from the method and its callers.
5. Remove the now-redundant `self.` prefixes if your language allows it, and give the field a proper name.

Reverse it when a field is used by only one method.

## Applying it

1. Start green. Run the tests before touching anything.
2. Pick the refactoring that makes the next step trivial. Isolate the change first if it touches only part of a method.
3. Take one mechanical step and run the tests. Repeat.
4. Prefer automated IDE refactorings, and do the manual ones in the steps listed above.
5. If a step depends on reasoning you can't check with tests, add a test or take a smaller step.
6. Finish by deleting the old format, the old parameter or the duplicate. Don't leave both in place.

## Red flags

- Merging two "almost identical" methods or classes in one jump.
- Changing a representation in one big edit instead of duplicating it temporarily.
- Extract Method producing five- or six-parameter signatures (use Method Object instead).
- A method that mostly interrogates another object's getters (use Move Method).
- Interfaces named `IThing` only because a test double was needed.
- "Tests pass, so the refactoring is safe" while you know a case isn't covered.
- Leftover old fields or parameters after a migration.

## Related

- `../DesignPatterns/designPatterns.md`: the patterns these refactorings lead to (Composite, Imposter, Template Method).
- `../GreenBarPatterns/greenBarPatterns.md`: One to Many and getting to green before refactoring.
- `../MasteringTDD/masteringTDD.md`: how big refactoring steps should be.
- `../../XUnitExample/HowSuiteItIs/howSuiteItIs.md`: Migrate Data in practice (single test to suite).
- `../../../CleanCode/Functions/functions.md`: small methods, short parameter lists.
- `../../../CleanCode/LegacyRefactoring/legacyRefactoring.md`: refactoring code that has few tests.
