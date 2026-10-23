---
name: tdd-equality-for-all
description: Driving Value Object equality test-first and using Triangulate to generalize only when two examples demand it, based on Chapter 3 (Equality for All) of Test-Driven Development: By Example. Use when implementing equals/equality for a value type, when an object should behave like a value (immutable, compared by content), when aliasing bugs appear, or when unsure how to generalize from a faked implementation.
---

# Equality for All

Treat small domain values as Value Objects: immutable, every operation returns a new instance, and equality compares content. Test equality before thinking about how to implement it, and when you cannot see the general solution, Triangulate with a second example.

## Value Object

- Instance fields are set in the constructor and never change.
- Operations return new objects instead of mutating the receiver.
- Two instances with the same content are equal, so the type needs an equality method.
- If the type is used as a hash key, equality implies a matching hash. Add that to the Test List and handle it when it matters.
- Benefit: no aliasing. Sharing a value never lets one holder change it under another.

## Test equality first

Think about how to test equality, not how to implement it. Start with the simplest true case, and fake it.

```python
def test_equality():
    assert Dollar(5) == Dollar(5)
    assert Dollar(5) != Dollar(6)   # second example forces the real comparison

# Fake for the first assert:  def __eq__(self, other): return True
# After the second assert:    def __eq__(self, other): return self.amount == other.amount
```

## Triangulate

Generalize only when you have two or more examples and the second one requires a more general solution. Ignore the duplication between test and code for a moment and let the extra example force the change.

- Use it when you are unsure how to refactor toward the general case.
- If you can see how to remove the duplication and write the general solution, do that instead (Fake It plus refactoring, or Obvious Implementation). Do not write a test you do not need.
- When design ideas are not coming, Triangulate lets you approach the problem from another direction: vary the axes of variability you want to support and the answer often becomes clear.

## Keep the list honest

Edge cases that are common but not needed now (comparison with null, comparison with an unrelated type) go on the Test List, not into the code.

## Workflow

1. Notice that the type should be a value; let that suggest the operation (equality).
2. Write the simplest equality test; make it pass with the simplest code.
3. Do not refactor yet if the generalization is unclear; add a second, differing example.
4. Generalize so both examples pass at once.
5. Add hash, null and foreign-type comparisons to the list for later.
6. Now that values compare directly, look for fields that can become private.

## Red flags

- Mutable "value" types that cause aliasing bugs.
- Implementing equality before any test exercises it.
- Triangulating every trivial case when the general solution is already obvious.
- Generalizing from a single example when you are genuinely unsure.
- Overriding equality without considering hashing when the type is used as a key.

## Related

- `../DegenerateObjects/degenerateObjects.md` — Fake It and Obvious Implementation, the other two strategies.
- `../Privacy/privacy.md` — using the new equality to make tests expressive and fields private.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects that hide data behind behavior.
