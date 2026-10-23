---
name: dba-introduction-to-java
description: Core Java language structures mapped to their PL/SQL equivalents for SQL and PL/SQL developers: blocks and declarations, primitive types, operators, if/switch/ternary logic, short-circuit operators, loops, simulating cursor FOR loops, try/catch/finally, classes and main methods, compiling with javac and running with java, based on Chapter 42 (An Introduction to Java) of Oracle Database 11g: The Complete Reference. Use when a PL/SQL developer asks how to write something in Java, translates PL/SQL logic to Java, starts writing Java that will talk to Oracle or run inside it, or confuses PL/SQL and Java terminology (block, exception, elsif, cursor loop).
---

# An Introduction to Java

Java and PL/SQL were designed independently, so the same words mean different things. Learn the mapping before writing Java for Oracle: Java is for logic and computation, it does not replace PL/SQL, and data-retrieval code should be tested in both before choosing.

## Terminology mapping

| PL/SQL | Java |
|---|---|
| Block: `declare / begin / exception / end` | Block: any `{ ... }`; a method body, an `if` branch or a loop body |
| Variables declared up front | Variables declared where needed, with a scope |
| `:=` assignment | `=` assignment; `==` comparison |
| `constant` | `final` |
| `if ... then ... elsif ... end if` | `if (...) { } else if (...) { } else { }` (no `then`, no `end if`) |
| `DECODE` / `CASE` expression | ternary `cond ? a : b`, or `switch` |
| `GREATEST(a, b)` | `Math.max(a, b)` |
| `raise` / exception section | `throw` / `try ... catch ... finally` |
| `when others` | `catch (Throwable t)` |
| Cursor FOR loop | `while (rs.next()) { ... }` over a JDBC `ResultSet` |
| Package procedure / function | Class method (`static` for class-level) |

## Declarations and types

```java
final double TAX_RATE = 0.2;
int orderCount = 0;
boolean shipped = false;
String customerName = "ACME";   // String is a class, not a primitive
```

- Primitives: `byte`, `short`, `int`, `long`, `float`, `double`, `char`, `boolean`. Variable-length text uses the `String` class.
- By convention variables start with a lowercase letter; statements end with `;`.
- Reserved words (`class`, `final`, `static`, `try`, `goto`, `const` and others) cannot name classes, methods or variables.

## Operators

- Arithmetic `* / + - %`; compound `*= /= %= += -=`.
- `count++` increments after use, `++count` before. Write `count++;` on its own; do not assign `count = count++;`, which leaves the value unchanged.
- Use parentheses to make evaluation order explicit.
- `&&` and `||` short-circuit: the right side runs only if needed, so put cheap or guarding tests first. `&` and `|` always evaluate both sides; use them only when both method calls must run.

## Control flow

```java
switch (statusCode) {
  case 1:  label = "OPEN";   break;
  case 2:  label = "CLOSED"; break;
  default: label = "UNKNOWN";
}
```

- `switch` needs `break` to avoid falling through; in this era `case` values are integers.
- Java has no `goto`; labeled `break label;` and `continue label;` jump out of or to the next iteration of a labeled statement.
- Loops: `while (cond) { }`, `do { } while (cond);` (body runs at least once), `for (int i = 0; i < n; i++) { }`.
- Java has no cursor FOR loop; iterate a JDBC result set with `while (rs.next())` and name the columns you select.

## Exceptions

```java
try {
  int qty = Integer.parseInt(args[0]);
  System.out.println(lineTotal(qty));
} catch (ArrayIndexOutOfBoundsException e) {
  System.err.println("Usage: java OrderTotal <qty>");
} catch (NumberFormatException e) {
  System.err.println("Quantity must be a whole number");
} finally {
  // release resources here (e.g. close a connection)
}
```

- A method may have many try/catch blocks; consolidating them keeps handling manageable.
- `finally` always runs, whatever happened in `try`; use it to clean up.
- Catch specific exceptions and tell the user what went wrong; do not swallow `SQLException` with an empty `catch`.

## Classes, compile and run

```java
public class OrderTotal {
  public static void main(String[] args) { /* entry point */ }
  public static double lineTotal(int qty) { return qty * 9.99; }
}
```

- The file name must match the public class: `OrderTotal.java`.
- `public` = callable by any class; `static` = class method; `void` = no return value.
- Every class has a constructor named after it; Java supplies a default one if none is written.
- Compile and run with the JDK (installed with the Oracle software): `javac OrderTotal.java`, then `java OrderTotal 3`. The JDK `bin` directory must be on `PATH` and your classes on `CLASSPATH`; follow the README under the Oracle home's `jdbc` directory for platform settings.

## Workflow

1. Identify the PL/SQL construct you would use and find its Java counterpart in the mapping.
2. Declare variables at first use with the narrowest scope.
3. Write control flow with braces on every block; use `break` in every `switch` case.
4. Wrap risky calls in try/catch with specific exceptions and a `finally` for cleanup.
5. Compile with `javac`, run with `java`, and test bad input (missing and non-numeric arguments).
6. For database work, move on to JDBC or Java stored procedures; keep set-based data work in SQL and PL/SQL.

## Red flags

- Treating a Java "block" as a PL/SQL block, or expecting a declarations section.
- `x = x++;` or `=` where `==` was meant.
- Missing `break` in `switch` cases.
- Using `&`/`|` where short-circuit `&&`/`||` was intended, or the reverse when side effects must run.
- Empty `catch` blocks.
- Rewriting working PL/SQL data access in Java without measuring both.

## Related

- `../JdbcProgramming/jdbcProgramming.md` — connecting Java to Oracle and running SQL.
- `../JavaStoredProcedures/javaStoredProcedures.md` — running Java classes inside the database.
- `../../PlSql/IntroductionToPlSql/introductionToPlSql.md` — the PL/SQL structures this chapter mirrors.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — exception design in Java code.
- `../../../../CleanCode/Functions/functions.md` — small, focused methods.
