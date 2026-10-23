# Clean Code Heuristic Catalog (paraphrased)

Codes follow Chapter 17 of *Clean Code*. Each entry gives the smell, why it matters, and the typical fix. Modern notes mark advice that's dated or language-specific.

This catalog is a citation index. When a finding needs more than its one-line fix, use the skill that covers the topic in depth: comments (C) in `../Comments/comments.md`, functions (F) in `../Functions/functions.md`, names (N) in `../MeaningfulNames/ROOT.md`, tests (T) in `../UnitTests/unitTests.md`, and general heuristics in the skill for their subject (for example G5 in `../SimpleDesign/simpleDesign.md`, G23 and G36 in `../ObjectsAndDataStructures/objectsAndDataStructures.md`).

## Contents
- Comments: C1–C5
- Environment: E1–E2
- Functions: F1–F4
- General: G1–G36
- Java: J1–J3
- Names: N1–N7
- Tests: T1–T9

---

## Comments

**C1 Inappropriate information.** Information that belongs in another system, such as change history, authorship or ticket discussion, is sitting in comments. Comments should hold technical notes about the code. *Fix:* move it to version control or the issue tracker.

**C2 Obsolete comment.** A comment that's now old, irrelevant or wrong. Stale comments drift away from the code and mislead. *Fix:* update or delete it right away. Better still, don't write comments that are likely to go stale.

**C3 Redundant comment.** A comment that says what the code already says, such as `i += 1  # increment i`, or a docstring that only restates the signature. *Fix:* delete it.

**C4 Poorly written comment.** A comment that's rambling, vague or ungrammatical, or that states the obvious. *Fix:* if a comment is worth writing, write it well: brief, precise and carefully worded.

**C5 Commented-out code.** Its age and relevance are unknown, nobody dares delete it, and it rots. *Fix:* delete it. Version control keeps it.

## Environment

**E1 Build requires more than one step.** Building should take one simple command, with no manual checkouts, scattered scripts or hand-placed files. *Fix:* script it.

**E2 Tests require more than one step.** All tests should run with one command or one click. *Fix:* make running the tests trivial, so they get run constantly.

## Functions

**F1 Too many arguments.** Zero is best, then one, two or three. More than three is very questionable. *Fix:* group them into argument objects, or move the function onto the object that owns the data.

**F2 Output arguments.** Readers expect arguments to be inputs. *Fix:* if something must change state, make it a method of that object.

**F3 Flag arguments.** A boolean argument means the function does two things. *Fix:* split it into two functions.

**F4 Dead function.** A function that's never called. *Fix:* delete it.

## General

**G1 Multiple languages in one source file.** Mixing many languages in one file (SQL, HTML, JS and templates inside application code) confuses readers. *Fix:* minimize the number and extent of extra languages per file. Modern note: some mixing is idiomatic (JSX, single-file components), so keep it organized.

**G2 Obvious behavior is unimplemented.** By the principle of least surprise, a function or class should do what a reasonable programmer would expect. For example, a day-name parser should accept common abbreviations and different capitalizations. When it doesn't, users stop trusting it and have to read the code.

**G3 Incorrect behavior at the boundaries.** Code that works in the middle but fails at edges and corner cases. Don't rely on intuition. *Fix:* find every boundary condition and write a test for each.

**G4 Overridden safeties.** Turning off compiler warnings, suppressing serialization checks, or ignoring failing tests to get past an inconvenience. Each override invites a disaster later. *Fix:* keep the safeties on and fix the underlying issue.

**G5 Duplication.** One of the most important rules. Look for identical code (extract a function), repeated switch or if-chains on the same condition (use polymorphism), and similar algorithms that differ slightly (Template Method or Strategy). Every duplicate is a missed abstraction.

**G6 Code at the wrong level of abstraction.** High-level abstract concepts must be separated from low-level details. For example, a base or interface should contain only what applies to every implementation, with nothing specific to one of them. Misplacing even one item is hard to fix later, and lies and workarounds collect around it.

**G7 Base classes depending on their derivatives.** A base class shouldn't know its subclasses by name. *Fix:* keep base classes independent so they can be deployed and evolved separately. A rare exception is a closed, fixed set of subclasses.

**G8 Too much information.** A wide, deep interface forces many interactions to get anything done, and increases coupling. *Fix:* expose as little as possible. Keep the public surface small, minimize fields and functions, hide data and helpers, and avoid protected members that exist only for subclasses.

**G9 Dead code.** Code that's never executed: impossible branches, catch blocks for exceptions that are never thrown, unused utilities. It drifts out of date with the conventions around it. *Fix:* delete it.

**G10 Vertical separation.** Things defined far from where they're used. *Fix:* declare locals just above their first use, and put private helpers just below their first caller.

**G11 Inconsistency.** Similar things done in different ways. *Fix:* choose conventions deliberately and follow them everywhere. Use the same naming patterns for similar concepts.

**G12 Clutter.** Empty default constructors, unused variables, uncalled functions and uninformative comments. *Fix:* remove them.

**G13 Artificial coupling.** Things that don't depend on each other are tied together, for example a general enum defined inside a specific class, or a general static function placed in an unrelated class for convenience. *Fix:* put things where they belong, even if that takes a moment's thought.

**G14 Feature envy.** A method that is more interested in another class's data than its own, using its getters heavily. *Fix:* move the logic to the class that owns the data, unless that would violate another principle. For example, it's acceptable to keep report formatting out of the domain class.

**G15 Selector arguments.** A trailing `False` or an enum argument that picks behavior. It's unclear at the call site and combines several functions into one. *Fix:* split it into separately named functions.

**G16 Obscured intent.** Dense expressions, cryptic names, Hungarian notation and magic numbers hide what the author meant. *Fix:* make the intent visible with names and explanatory variables.

**G17 Misplaced responsibility.** Code placed where it's convenient for the author instead of where readers will look for it. *Fix:* put each function and constant where a reader would naturally expect it, guided by the principle of least surprise.

**G18 Inappropriate static.** Static functions are fine when they don't operate on one instance and are unlikely to need polymorphic behavior, like `max(a, b)`. But a calculation that might vary by type, such as pay calculation by employee kind, should be an instance method. *Fix:* when in doubt, prefer non-static.

**G19 Use explanatory variables.** Break a complex calculation into intermediate values with meaningful names. More explanatory variables are generally better than fewer.

**G20 Function names should say what they do.** In `date.add(5)`, are the units days, weeks or hours? Does it mutate the date or return a new one? *Fix:* use names like `add_days_to(5)` or `days_later(5)`. If you have to read the body to know what it does, rename it.

**G21 Understand the algorithm.** Code is often made to work by adding flags and special cases until the tests pass, without understanding why it works. *Fix:* before calling it done, make sure you truly understand the solution. Refactoring it into a clear form is often the best way to get there.

**G22 Make logical dependencies physical.** If a module relies on a fact about another module, such as a report class assuming a page size, it should ask for that fact explicitly rather than assume it. *Fix:* move the knowledge to its owner and depend on it explicitly.

**G23 Prefer polymorphism to if/else or switch/case.** Most type-based switches should be polymorphism. Rule of thumb: allow at most one switch per type of selection, and only where it creates polymorphic objects for the rest of the system. (This is consistent with Ch. 6: use a switch over data structures only where you expect new functions rather than new types.)

**G24 Follow standard conventions.** The team should follow one coding standard based on industry norms, and the code itself should be the main example of it. Everyone follows it, even where they'd personally prefer otherwise.

**G25 Replace magic numbers with named constants.** This applies to any unexplained token, not just numbers: `"John Doe"` used as a sentinel, `86400`, `7`. Some literals are self-explanatory in context, such as `* 2` in a doubling formula or `0` and `1` in obvious places, and don't need names.

**G26 Be precise.** Don't assume the first query result is the only one, don't use floating point for currency, don't skip locks or transactions because conflicts "won't happen," and don't declare a broad type where a specific one is intended. Handle ambiguities and imprecision on purpose, not by laziness.

**G27 Structure over convention.** Enforce design decisions with structure rather than naming rules or conventions. For example, an abstract method that subclasses must implement is more reliable than a naming convention they're expected to follow.

**G28 Encapsulate conditionals.** Extract boolean logic into a well-named function: `if should_be_deleted(timer)` rather than `if timer.has_expired() and not timer.is_recurrent()`.

**G29 Avoid negative conditionals.** Positive conditions are easier to read: `if buffer.should_compact()` rather than `if not buffer.should_not_compact()`.

**G30 Functions should do one thing.** Split functions that perform a sequence of separate operations into one function per operation.

**G31 Hidden temporal couplings.** When calls must happen in a certain order, make the order impossible to get wrong. For example, have each step return the input the next step needs, so the data flow forces the sequence.

**G32 Don't be arbitrary.** Structure code for a reason, and make that reason visible in the structure. If the structure looks arbitrary, others will feel free to change it. A public class nested inside an unrelated class is an example.

**G33 Encapsulate boundary conditions.** Put boundary handling such as `level + 1` in one place, as a named variable like `next_level`, rather than scattering `+1` and `-1` across the code.

**G34 Functions should descend only one level of abstraction.** The statements in a function should be one level below the operation its name describes. Separating levels is one of the most important refactoring functions, and one of the hardest to do well.

**G35 Keep configurable data at high levels.** Defaults and configuration constants that are known at a high level shouldn't be buried in low-level functions. Pass them down as arguments from the top, or keep them in configuration.

**G36 Avoid transitive navigation.** Don't let a module reach through a collaborator to that collaborator's collaborators (`a.get_b().get_c().do_something()`). This is the Law of Demeter, or "writing shy code." *Fix:* have the immediate collaborator offer the needed service, so changes to the structure don't spread through the system.

## Java (language-specific; apply only with judgment)

**J1 Avoid long import lists by using wildcards.** The book suggests that if you use two or more classes from a package, you import the whole package with a wildcard. *Modern note:* most current style guides and linters discourage wildcard imports because they're ambiguous and can cause conflicts, and IDEs manage import lists automatically. Follow the project's convention. The remaining valid point is not to let imports become clutter.

**J2 Don't inherit constants.** Don't implement an interface just to gain access to its constants. That hides where they come from. *Fix:* use static imports or qualified names. Generalizes to other languages as: don't use inheritance to get access to shared values.

**J3 Constants versus enums.** Use enums instead of `public static final int` codes. Enums can carry methods and fields, which makes them expressive and type-safe. This applies to any language with real enums or sum types.

## Names

**N1 Choose descriptive names.** Don't rush. Meanings drift as software evolves, so revisit names often. Good names make up most of what makes code readable.

**N2 Choose names at the right level of abstraction.** Don't name an abstraction after one implementation. For example, a `Modem` interface's `dial(phone_number)` assumes phone lines. `connect(locator)` fits the abstraction better.

**N3 Use standard nomenclature where possible.** Use pattern names (`Decorator`, `Factory`), language conventions (`to_string`), and the project's agreed vocabulary (its ubiquitous language).

**N4 Unambiguous names.** Choose names that make the workings clear. A long name that's precise is better than a short one that's vague, for example `rename_page_and_optionally_all_references` rather than `do_rename`.

**N5 Use long names for long scopes.** `i` is fine in a five-line loop. Something visible across a module needs a descriptive name. Name length should track scope size.

**N6 Avoid encodings.** No type or scope prefixes (`m_`, `f`, `str_`), and no subsystem prefixes on every name. Modern environments make them unnecessary.

**N7 Names should describe side effects.** If `get_oos()` also creates the stream when it's missing, call it `create_or_return_oos()`. Don't hide what a function does behind a simple verb.

## Tests

**T1 Insufficient tests.** A suite should test everything that could possibly break, not just what "seems like enough." As long as there are untested conditions or calculations, the tests are insufficient.

**T2 Use a coverage tool.** Coverage reports reveal gaps in the testing strategy and highlight untested branches.

**T3 Don't skip trivial tests.** They're cheap, and their value as documentation exceeds their cost.

**T4 An ignored test is a question about an ambiguity.** When a requirement is unclear, express the question as a skipped test with a note, rather than guessing silently.

**T5 Test boundary conditions.** Algorithms are often right in the middle and wrong at the edges.

**T6 Exhaustively test near bugs.** Bugs cluster. When you find one, test that function thoroughly.

**T7 Patterns of failure are revealing.** The way tests fail, for example all inputs longer than five characters, can point straight at the cause. Complete, well-ordered test cases make such patterns visible.

**T8 Test coverage patterns can be revealing.** Looking at what is and isn't executed by the passing tests helps explain why the failing ones fail.

**T9 Tests should be fast.** Slow tests don't get run. Do what you must to keep them fast.
