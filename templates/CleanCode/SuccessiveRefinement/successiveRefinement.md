---
name: clean-code-successive-refinement
description: Turning a working but messy module into a clean design through many tiny, test-protected steps, based on Chapter 14 (Successive Refinement, the Args case study) of Clean Code. Use whenever the user's own recent code works but has grown tangled as features were added, they are about to bolt on yet another case (another type, option, format or branch) to an if-chain or switch, they ask how to refactor without breaking things, whether to rewrite, or when to stop adding features and clean up. Also use when the AI's own first draft works but is messy.
---

# Successive Refinement

Clean code isn't written in one pass. You write a rough draft that works, then refine it. The skill is knowing **when to stop and clean**, and **how to clean without ever breaking the system**.

## The story in brief

A command-line argument parser started out tidy when it supported only boolean flags. Adding string arguments and then integer arguments made it rot quickly. It accumulated parallel maps per type, type-specific parsing branches, scattered error codes, and more conditionals everywhere for each new type. The code still worked, but each new type made it noticeably worse, and more types were coming. So the author stopped adding features and refactored. The end result has one small class per argument type, all sharing a marshaling interface, so adding a new type means adding one class plus one line to register it.

## When to stop and clean

Stop adding features when:
- Each new feature requires touching several places in parallel (another map, another branch, another error code).
- You can see that the next one or two planned features will make the structure much worse.
- You're tempted to "just bulldoze through and clean up later." Later rarely comes, and cleaning a mess gets more expensive the longer it waits.

Messy code that works isn't finished. Getting it working is only the first half of the job. Rot is cheap to fix when it's fresh and expensive once it has dug in, so don't let it start.

## How to clean: incrementalism

**Don't make large structural changes in the name of improvement.** Many programs never recover from a big "improvement," because it's very hard to get them working the same way again.

Instead:
1. **Have a test suite that runs quickly and covers the behavior.** If there isn't one, write it first. These tests are what make refactoring safe.
2. **Make a series of tiny changes.** Each change moves the structure a little toward the goal and leaves the system working. Run the tests after every change.
3. **Never leave the system broken.** If a change breaks tests, fix it or revert it right away. Don't stack more changes on top of a red build.
4. **Introduce the new structure next to the old one, migrate callers one by one, then delete the old code.** For example, add the new abstraction, route one type through it, check the tests pass, route the next, and so on, then remove the old maps and branches.
5. **Tolerate temporary awkwardness.** Partway through, the code may look odd, with things in an interim base class or duplicate paths. That's fine as long as the tests pass and it's heading somewhere better.
6. **Keep going past "good enough."** After the main restructure, repeat the smaller passes: names, function size, duplication, error handling, and putting things in the right module.

## Typical moves in such a refactor

- Replace parallel per-type data structures with one polymorphic abstraction (one class or strategy per variant).
- Replace a type switch repeated across functions with a single dispatch, so new variants are added rather than edited in (Open–Closed).
- Gather scattered error codes and messages into a dedicated error type with a clear message builder.
- Split the main class so parsing, storage, error reporting and querying have separate homes.
- Move type-specific logic out of the general class into each variant's class.

## Applying it

When the user has working but tangled code, or the AI's own draft is like that:
1. Name the growth axis, meaning what keeps being added (types, formats, rules), and show how each addition currently touches several places.
2. Propose a target structure where an addition touches one place.
3. Confirm there are tests, or write characterization tests first.
4. Lay out the refactor as an ordered list of small, individually safe steps, and say that the tests should be run after each one.
5. Carry out the steps, or guide the user through them, without bundling them into one giant rewrite.
6. Finish with a polishing pass.

Related: `../PolishingGoodCode/polishingGoodCode.md` covers refining code that's already decent, and `../LegacyRefactoring/legacyRefactoring.md` covers inherited code with weak tests.
