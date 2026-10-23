---
name: clean-code-functions
description: Writing and refactoring functions and methods to be small, focused and readable, based on Chapter 3 (Functions) of Clean Code. Use whenever the AI writes a new function, or the user asks to refactor, shorten or split a long function, reduce nesting, remove boolean flag parameters, cut down a long parameter list, separate side effects, replace error codes with exceptions in a function, or asks how long a function should be. Also use when a function has sections, deep indentation, or both changes state and returns a value.
---

# Functions

Functions are the first unit of organization in a program. They're the verbs of the small language a program defines for its domain. These rules make that language read clearly.

## 1. Small, then smaller

- Functions should be short: a handful of lines, rarely more than about 20. There's no magic number, but if a function doesn't fit comfortably in your head, it's too long.
- Blocks inside `if`, `else` and `while` should ideally be one line, usually a call to a well-named function. This keeps the outer function small and lets the inner name document the intent.
- Indentation shouldn't exceed one or two levels. Nested structures are a sign to extract.

## 2. Do one thing

A function does one thing if all its steps are one level of abstraction below the function's name. Two practical tests:
- Can you extract another function from it with a name that isn't just a restatement of the implementation? If yes, it does more than one thing.
- Does it have "sections" (setup, validation, computation, output), perhaps separated by blank lines or comments? Functions that do one thing can't be reasonably divided into sections.

## 3. One level of abstraction per function

Don't mix high-level intent (`render_page()`) with mid-level steps (`path = parser.render(page_path)`) and low-level detail (`html.append("\n")`) in one body. Mixing levels makes it impossible to tell essential concepts from details, and details attract more details.

**Stepdown rule:** Order functions so the file reads top-down like a narrative. Each function is followed by the ones it calls, one level lower. You should be able to read it as a series of "To do X, we do Y and Z; to do Y, we..." paragraphs.

## 4. Switch statements and type dispatch

A switch or if-chain on a type code inherently does N things, and it tends to be duplicated wherever the type matters. That violates single responsibility and forces edits whenever a type is added. Hide such a switch once, in a factory that creates polymorphic objects. The rest of the system calls methods on those objects instead of switching. A single switch used only to create objects is acceptable.

## 5. Descriptive names

A small function that does one thing is easy to name well. Prefer a long, descriptive name to a short, cryptic one or a comment, and use the same verbs and nouns across related functions (`include_setup_pages`, `include_suite_setup_page`, `include_setup_page`). General naming rules live in `../MeaningfulNames/ROOT.md`.

## 6. Arguments

The fewer the better: zero is ideal, then one, then two. Three needs a strong reason, and more than three needs special justification. Arguments are hard to understand and multiply the test cases.

- **Single-argument forms** that readers expect: asking a question about the argument (`file_exists(path)`), transforming it and returning the result (`open_file(path) -> Stream`), or handling an event (`on_password_attempt_failed(count)`, where the name must make it clear it's an event). Avoid other single-argument shapes, especially one that mutates its argument in place instead of returning the new value.
- **Flag arguments** (booleans) announce that the function does two things. Split it: `render_for_suite()` and `render_for_single_test()` instead of `render(True)`.
- **Two arguments** are fine when the pair is naturally ordered and related (`Point(x, y)`). Otherwise ask whether one should be a method on the other, or a field of the class.
- **Three arguments** multiply ordering mistakes. `assert_equals(message, expected, actual)` is a classic source of bugs.
- **Argument objects:** When several values travel together, group them into a type: `make_circle(center: Point, radius)` rather than `make_circle(x, y, radius)`. This isn't cheating; it names a concept.
- **Variadic arguments** treated identically count as one list argument.
- **Verbs and keywords:** Make the name and argument read as a verb/noun pair (`write_field(name)`), or encode the arguments in the name (`assert_expected_equals_actual(expected, actual)`). Keyword or named arguments, where the language has them, fix much of this.

## 7. No side effects

A function that promises one thing and secretly does another is lying. A classic example is a `check_password()` that also initializes the session. This creates hidden temporal coupling, where the function can only be called at certain times. Either remove the side effect or put it in the name (`check_password_and_initialize_session()`), which then shows the function does two things.

**Output arguments:** Arguments should be inputs. If something must change state, make it a method on that object (`report.append_footer()` rather than `append_footer(report)`).

## 8. Command-query separation

A function should either change state or return information, never both. `if set("username", "bob")` is ambiguous: did it set the value, or check whether it was already set? Split it into `if attribute_exists(...)` and then `set_attribute(...)`.

## 9. Keep error handling out of the function's main job

Why exceptions (or the language's error idiom) beat error codes is covered in `../ErrorHandling/errorHandling.md`. At the function level:

- **Extract try/catch bodies.** A try/catch block mixes error handling with normal processing. Put the body of the `try` in its own function, and give the error handling its own function.
- **Error handling is one thing.** A function that handles errors should do nothing else. If `try` appears, it should be the first statement, and nothing should follow the `catch`/`finally`.
- **Avoid an error-code "dependency magnet."** A shared enum of error codes that everything imports forces wide recompiles or redeploys and discourages adding new errors. New exception types derived from a base type avoid this.

## 10. Don't repeat yourself

Each copy is another place to change and another chance for inconsistency. Extract shared logic. The forms duplication takes and how to remove each are in `../SimpleDesign/simpleDesign.md` (rule 2).

## 11. Structured programming

The rule of one entry and one exit (single `return`, no `break` or `continue`) mostly pays off in large functions. In small functions, early returns, `break` and `continue` are often clearer and are fine. Never use `goto`.

## 12. How to actually get there

Nobody writes functions like this on the first pass. Write the rough version first, cover it with tests, then refine. Rename, extract, reorder and remove duplication, keeping the tests passing at every step. When the AI writes new code, it should still do this refinement pass before showing the result.

## Refactoring checklist

1. Make sure tests exist, or write characterization tests first.
2. Extract each section or nested block into a named function.
3. Check that each function stays at one level of abstraction; push details down.
4. Remove flag arguments by splitting functions.
5. Group related arguments into objects.
6. Separate commands from queries, and remove or name side effects.
7. Pull try/catch bodies into their own functions.
8. Order functions top-down by the stepdown rule.
9. Run the tests after each step.
