---
name: clean-code-smells-review
description: Reviewing code for code smells using the coded heuristic catalog (C1-C5, E1-E2, F1-F4, G1-G36, J1-J3, N1-N7, T1-T9) from Chapter 17 (Smells and Heuristics) of Clean Code. Use whenever the user asks for a code review, a PR or diff review, a code-quality audit, a list of what is wrong with some code, to identify code smells, or a maintainability assessment, or references a heuristic code like G5 or N7. Use this rather than the individual chapter skills when the request is to find problems across a whole piece of code rather than to fix one specific aspect.
---

# Code Smells and Heuristics Review

Chapter 17 condenses the whole book into a catalog of smells and heuristics, each with a short code. This skill turns that catalog into a review procedure. The full catalog, paraphrased with modern notes, is in `heuristicsCatalog.md`. **Read it before doing a review** so you can cite codes accurately.

These are heuristics, not laws. Each finding should explain the concrete cost to this code, not just quote a rule.

## Review procedure

1. **Understand the purpose first.** Read the code, its tests and any description, and identify the language and its idioms. Project conventions and the language's style override any heuristic, especially the dated Java-specific ones.
2. **Scan by category**, in this order, because it moves from the highest-impact issues to cosmetic ones:
   - **General (G)**: duplication (G5), wrong abstraction level (G6, G34), misplaced responsibility (G17), feature envy (G14), hidden temporal coupling (G31), boundary handling (G3, G33), obscured intent (G16, G19, G25, G28), polymorphism over repeated switches (G23).
   - **Functions (F)**: too many arguments, output arguments, flag arguments, dead functions.
   - **Names (N)**: descriptive, at the right abstraction level, unambiguous, scope-appropriate length, no encodings, side effects named.
   - **Tests (T)**: missing tests, untested boundaries, skipped tests, slow tests.
   - **Comments (C)**: obsolete, redundant, commented-out code, misplaced information.
   - **Environment (E)**: whether build and tests take one step.
   - **Java (J)**: only for Java, and with care (see the notes in the catalog).
3. **Rank the findings** by impact: correctness risk first (G3, G4, G26, G31, T1, T5), then changeability (G5, G6, G17, G23, G36), then readability (names, comments, formatting).
4. **Suggest fixes concretely**: the specific change, ideally a small code snippet, and which other skill holds deeper guidance if relevant (for example `../Functions/functions.md` for F1–F3).
5. **Acknowledge what's good.** A review that's all negatives hides the signal.

## Output format

When `actions/review.md` is installed, follow its finding structure, severity levels and coverage section, and put the heuristic code in each finding title (for example `[Medium] G5 Duplication`). Otherwise give a two-or-three-sentence summary, then findings ordered by importance (code, location, what, why it matters, suggested fix), then smaller nits grouped as one-liners, then one or two lines on what's good.

Keep each finding tight. Don't report the same root cause under several codes; give the primary code and mention related ones in passing.

## Calibration

- Don't flag every short variable name or every comment. Flag the ones that actually hurt the reader.
- Size limits (function length, argument counts) are signals to look closer, not automatic violations.
- When a heuristic conflicts with the language's idiom, follow the idiom and don't report it. For example, J1 recommends wildcard imports, which most modern style guides discourage, and Go's convention of short names is fine in small scopes.
