---
name: clean-code-formatting
description: Laying out source code vertically and horizontally so it communicates structure, based on Chapter 5 (Formatting) of Clean Code. Use whenever the user asks how to organize or order code within a file, where to put variable declarations or helper functions, how long files or lines should be, about blank lines, spacing, alignment or indentation, or wants a team style guide or formatter config. Also use when the AI restructures a file and must decide the order of functions and declarations.
---

# Formatting

Formatting is communication, and communication is a professional developer's first job. Working code changes over time, but the style and discipline of its layout outlive any particular version. Treat formatting as important, but not religiously.

## First: team rules win

If the project has a formatter or linter (Prettier, Black, gofmt, rustfmt, clang-format, ESLint and so on) or a style guide, follow it. Don't hand-format against it. Consistency across a codebase beats any individual's preference. A team should agree on one style and automate it. The guidance below covers what formatters don't decide: ordering, grouping, blank lines and file size.

## Vertical formatting

**File size.** Smaller files are easier to understand. Well-maintained projects routinely keep most files in the low hundreds of lines. Treat a file in the thousands of lines as a strong signal that it needs splitting.

**Newspaper metaphor.** A file should read like a news article. Its name is the headline, and it should be enough to tell whether you're in the right place. The top gives the high-level concepts and algorithms. Detail increases as you go down, with the lowest-level helpers at the bottom.

**Vertical openness.** Separate distinct thoughts with blank lines: between imports and code, between functions, and between logical groups within a function (though too many groups inside a function is itself a smell).

**Vertical density.** Keep lines that belong together tight. Don't break up closely related declarations with blank lines or noise comments.

**Vertical distance.** Concepts that are closely related should be close together, so readers don't have to hop around the file.
- **Variables:** Declare them as close to their first use as possible. Declare loop variables in the loop.
- **Instance variables / fields:** Put them in one well-known place, usually the top of the class. Don't scatter them.
- **Dependent functions:** If one calls another, put them close together, with the caller above the callee where possible.
- **Conceptual affinity:** Functions that share a naming scheme or perform variants of the same task belong together even if they don't call each other.

**Vertical ordering.** Call dependencies should point downward: high level first, details below. This lets readers skim the top and stop once they've got the gist.

## Horizontal formatting

**Line width.** Keep lines short. Most lines in healthy codebases are well under 80 characters. A limit around 100–120 is a reasonable ceiling, and you should never need to scroll horizontally.

**Horizontal openness and density.** Use spaces to show relationships:
- Put spaces around assignment and lower-precedence operators, and fewer around higher-precedence ones, so the visual grouping mirrors evaluation (`b*b - 4*a*c`). Many formatters normalize this, so defer to them.
- No space between a function name and its opening parenthesis, because they belong together. Use a space after commas in argument lists.

**Horizontal alignment.** Avoid lining up variable names or values in columns. It draws the eye to the wrong thing, and formatters destroy it. If a list of declarations is so long it seems to need alignment, the real problem is that the list is too long.

**Indentation.** Indentation shows scope hierarchy. Don't collapse short `if`s, loops or functions onto one line just because they're small. Keep the structure visible.

**Dummy scopes.** If a loop body is intentionally empty, make that obvious with an indented `pass` or an empty body on its own line. Never leave a lone semicolon hidden at the end of the line.

## Applying it

When restructuring a file:
1. Put the public, high-level entry points first.
2. Place each helper below its first caller, roughly in call order.
3. Group fields together at the top.
4. Move local declarations down to just before first use.
5. Add blank lines between concepts; remove the ones that split up a concept.
6. Run the project's formatter last.

When asked for a team style guide, keep it short, automate as much as possible with tooling config, and use a small, well-formatted example file as the real reference.
