---
name: clean-code-error-handling
description: Handling errors so code stays readable and robust, based on Chapter 7 (Error Handling) of Clean Code. Use whenever the user asks how to handle failures, design exception types or error hierarchies, write try/catch/finally or equivalent, choose between returning error codes, null/None, exceptions or result types, wrap a third-party API's exceptions, write good error messages, or remove endless null checks. Also use when the AI writes code that can fail (I/O, network, parsing, external calls).
---

# Error Handling

Error handling matters, but if it obscures the logic it's wrong. Clean code is readable and robust, and the two goals don't conflict once error handling is treated as a separate concern.

## 1. Use exceptions (or your language's idiom) rather than return codes

Return codes and error flags clutter the caller, which must check immediately and tends to forget. With exceptions, the main algorithm reads linearly and the error handling sits apart from it.

Language note: where explicit error values are the idiom (Go `error`, Rust `Result`, functional `Either`), use them. Apply the spirit by propagating with the idiomatic shorthand, keeping the happy path linear and handling errors at the layer that can actually do something about them.

## 2. Write the try/catch/finally first

A `try` block works like a transaction: execution may abort anywhere inside it, and the `catch` must leave the program in a consistent state. When writing code that can fail:
1. Start with a test that forces the failure.
2. Write the try/catch and the error path first, with the scope defined.
3. Then build the logic inside, test-driven.

This keeps the error contract explicit from the beginning.

## 3. Prefer unchecked exceptions (Java-specific; generalize)

In Java, checked exceptions break encapsulation. A low-level function that adds a new exception forces every signature above it to change. The book recommends unchecked exceptions for most application code. The general lesson for any language is not to let low-level failure types ripple up through every signature. Translate them at layer boundaries. Checked or typed errors are reasonable for critical libraries where the caller must handle the case.

## 4. Provide context with exceptions

A stack trace tells where an error happened but not what was being attempted. Error messages should say which operation failed and why, with the relevant identifiers or values. For example, "Failed to load invoice 4821 from /data/inv.json: file not found" is far better than "IOError". Include enough to diagnose the problem from logs alone, but never secrets.

## 5. Define exception classes by how callers handle them

Don't classify errors by where they come from if every caller treats them the same. If three different library exceptions all lead to "log and retry," wrap them into one type. Wrapping a third-party API is especially valuable:

```
class LocalPort:
    def open(self):
        try:
            self._inner.open()
        except DeviceResponseError as e:
            raise PortDeviceFailure(e) from e
        except ATM1212UnlockedError as e:
            raise PortDeviceFailure(e) from e
```

This minimizes dependence on the vendor, lets you change libraries, makes testing with fakes easy, and gives you an error vocabulary that fits your domain. Use separate exception types only when callers need to catch them separately.

## 6. Define the normal flow (Special Case pattern)

Sometimes an exception or a null check sits in the middle of business logic for an expected situation:

```
try:
    total += expense_dao.get_meals(employee_id).total
except MealExpensesNotFound:
    total += meal_per_diem()
```

Instead, make the DAO return a special-case object, `PerDiemMealExpenses`, whose `.total` is the per diem. The caller just reads `total += expenses.total`. The special case is encapsulated in an object, and the main flow has no exceptions in it.

## 7. Don't return null

Returning null pushes a check onto every caller, and one missed check becomes a crash far from its cause. Instead:
- Throw an exception, or return a special-case object.
- For collections, return an empty collection.
- Use the language's option type (`Optional`, `Option`, `T | None` with type checking) so absence is explicit and enforced.
- When a third-party API returns null, wrap it once at the boundary.

## 8. Don't pass null

Passing null into functions is worse than returning it, because most functions can't do anything sensible with it. Make "no null arguments" the default convention, and use types or non-null annotations so the type checker enforces it. Assertions and argument checks help catch mistakes, but they don't fix the design.

## Checklist when writing failure-prone code

1. What can fail? Write a test for each failure.
2. Who can actually handle it? Handle it there. Elsewhere, let it propagate.
3. Are third-party errors wrapped into domain errors at the boundary?
4. Do the messages name the operation, the input and the cause?
5. Is there any null returned or passed? Replace it with empty values, special cases, option types or exceptions.
6. Is the happy path readable without mentally filtering out error handling? If not, extract the error handling into its own functions.
