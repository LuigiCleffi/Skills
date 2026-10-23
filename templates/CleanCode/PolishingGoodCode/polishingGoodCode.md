---
name: clean-code-polishing-good-code
description: Improving code that is already well-written and well-tested, picking the remaining nits, based on Chapter 15 (JUnit Internals) of Clean Code, where a respected, fully covered module is still made cleaner. Use whenever the user asks to polish, tidy, refine or do a final cleanup pass on reasonably good code, asks for nitpick-level review, says code works and is tested but could be nicer, or when the AI does a last refinement pass on its own output. Also use when applying the Boy Scout Rule to decent code during a nearby change.
---

# Polishing Good Code

Even code written by skilled authors, with full test coverage, can be improved. The Boy Scout Rule (`../Mindset/cleanCodeMindset.md`) applies to good code too. This skill is the final-pass workflow, the small, precise improvements that separate good code from clean code.

## Preconditions

- **Run the tests and check coverage first.** With full coverage you can make many small changes with confidence. If coverage is thin, add tests before polishing (see `../LegacyRefactoring/legacyRefactoring.md`).
- **Review the tests as well.** Could they be simpler or more obvious?
- **Respect the existing quality.** Acknowledge what's good. The goal is to refine it, not to impose your own taste.

## The nit-picking pass

Work through the code in small steps, running tests after each one. The case study's actual moves make a useful checklist:

1. **Remove scope or type encodings** in names, such as `f` or `m_` prefixes on fields.
2. **Encapsulate conditionals.** Turn an opaque boolean expression at the top of a function into a well-named predicate method (`should_not_compact()`).
3. **Make names unambiguous.** If a local variable has the same name as a field but means something different (the expected string vs. the compacted expected string), rename one of them.
4. **Prefer positive conditionals.** Invert `if not can_be_compacted()` into a positive form when that reads more naturally.
5. **Make function names describe everything they do.** A function called `compact` that sometimes doesn't compact, and also formats, should be named `format_compacted_comparison`.
6. **Split functions that do two things.** Separate the computing from the formatting so each function does one thing.
7. **Use consistent conventions.** If some helpers set fields while others return values, pick one style for that group.
8. **Fix names that describe the wrong quantity.** An "index" that's really a length, or that's 1-based when the reader expects 0-based, should be renamed and normalized.
9. **Expose hidden temporal coupling.** If `find_common_suffix` silently depends on `find_common_prefix` having run first, make the ordering structural, for example a single `find_common_prefix_and_suffix` that calls the other first. Passing an argument just to force the order is weaker, because the order looks arbitrary and someone may "simplify" it away.
10. **Encapsulate boundary conditions.** Scattered `+1`/`-1` corrections usually mean the representation is off by one somewhere. Fix the representation and most of the adjustments disappear.
11. **Delete conditions that no longer matter.** After the changes, some special-case `if` may become unnecessary. Remove it, with the tests as proof.
12. **Reorder functions topologically** so each is defined after its first caller and the file reads top-down.

## Mindset

- **Refactoring is iterative trial and error.** You may undo an earlier change once a later one shows a better path. That's normal and doesn't mean the earlier step was wasted.
- **Each step should be small enough to verify instantly.**
- **Stop when the remaining changes are only matters of taste.** Report what you changed and why, and point to the specific heuristic each change satisfies.

## Output guidance

When polishing for a user, present the changes as a short list of what was changed and why, with the resulting code. Keep behavior identical, and say that the tests should still pass, or show that they do if they can be run.
