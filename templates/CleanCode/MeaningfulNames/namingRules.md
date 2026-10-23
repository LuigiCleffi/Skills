---
name: clean-code-naming
description: Choosing good names for variables, functions, classes, modules and files, based on Chapter 2 (Meaningful Names) of Clean Code. Use whenever the user asks what to call something, wants a rename, complains that code is hard to understand because of names, asks about naming conventions, prefixes, Hungarian notation, or I-prefixed interfaces, or when the AI itself is writing new code and must pick identifiers. Also use when reviewing a diff where names are vague (data, info, manager, temp, x2) or misleading.
---

# Meaningful Names: Naming Rules

Names are the most frequent design decision in code. Taking a minute longer to choose a good one, and renaming freely when a better one appears, pays back many times over.

## Rules

**1. Reveal intent.** Covered in depth by `namesThatRevealTheirPurpose.md`. Read it for intent-revealing names; the rules below cover everything else.

**2. Avoid disinformation.**
- Don't call something `account_list` unless it really is a list; use `accounts` or `account_group`.
- Avoid names that differ in tiny ways (`XYZControllerForEfficientHandlingOfStrings` vs `XYZControllerForEfficientStorageOfStrings`).
- Avoid lowercase `l` and uppercase `O` as names because they look like 1 and 0.
- Don't reuse words with established meanings for something else.

**3. Make meaningful distinctions.**
- Number series (`a1, a2`) and noise words (`Info`, `Data`, `Object`, `The`, `variable`, `string`) don't distinguish anything.
- `Product` vs `ProductInfo` vs `ProductData` tells the reader nothing. If two names must differ, the difference should tell the reader which is which.
- `get_active_account()` vs `get_active_accounts()` vs `get_active_account_info()` side by side is a trap.

**4. Use pronounceable names.** Programmers discuss code out loud. `gen_ymdhms` is worse than `generation_timestamp`.

**5. Use searchable names.** Single letters and bare literals can't be found with search. Name constants (`MAX_CLASSES_PER_STUDENT`, not `7`). Name length should match scope size: short names are fine for a three-line loop, and long-lived names need to be descriptive.

**6. Avoid encodings.**
- Don't encode the type in the name (Hungarian notation, `str_name`, `phone_string`). Type systems and IDEs already know the type, and encodings go stale when the type changes.
- Drop member prefixes like `m_` or `_m`. Small classes and editor highlighting make them unnecessary, and readers learn to ignore them anyway.
- For interfaces, prefer leaving the interface unadorned (`ShapeFactory`) and marking the implementation if needed (`ShapeFactoryImpl`, or better, a descriptive name like `CachedShapeFactory`). The `I` prefix is a distraction. **Exception:** follow the language's strong convention where one exists (for example C# uses `IShape`). Team and ecosystem conventions win.

**7. Avoid mental mapping.** Readers shouldn't have to translate your names into the real concept in their heads. Clarity beats cleverness. Loop counters `i, j, k` are fine in tiny scopes; `r` meaning "the lowercased URL without host" is not.

**8. Classes and objects are nouns.** Examples: `Customer`, `WikiPage`, `AddressParser`. Avoid vague nouns like `Manager`, `Processor`, `Data` and `Info` that hide what the class actually does. A class name shouldn't be a verb.

**9. Methods are verbs.** Examples: `post_payment`, `delete_page`, `save`. Accessors, mutators and predicates follow the language's convention (`get_`/`set_`/`is_`, or properties). When constructors are overloaded, prefer named factory methods that describe the arguments: `Complex.from_real_number(23.0)` over `Complex(23.0)`.

**10. Don't be cute.** Use `kill()` rather than `whack()`, and `abort()` rather than `eat_my_shorts()`. Jokes and slang only work for readers who share the reference.

**11. One word per concept.** Pick one of `fetch`, `retrieve` or `get` for the same idea and use it everywhere. Don't mix `controller`, `manager` and `driver` for the same role.

**12. Don't pun.** Don't use the same word for two different ideas. If `add` means "sum two values" in most classes, a method that inserts into a collection should be `insert` or `append`, not `add`.

**13. Use solution-domain names.** Readers are programmers, so use well-known computer science terms, pattern names and algorithm names: `JobQueue`, `AccountVisitor`, `LruCache`.

**14. Use problem-domain names** when there's no technical term. Code about business concepts should use the business's vocabulary so a maintainer can ask a domain expert.

**15. Add meaningful context.** `state` alone is ambiguous, while `address.state` inside an `Address` class is clear. Put names in context with well-named classes, functions and modules. Use a prefix (`addr_state`) only as a last resort.

**16. Don't add gratuitous context.** Don't prefix every class with the app's initials (`GSDAccount`). It fights autocomplete and adds no information. Shorter names are better as long as they're clear.

## Workflow when naming or renaming

1. State in one sentence what the thing is or does. The key nouns and verbs in that sentence are the candidate names.
2. Check the name against the surrounding vocabulary. Is this concept already named elsewhere? Reuse that word.
3. Match length to scope.
4. If the user's language or team has a convention (PEP 8, Go's short receivers, C#'s `I` prefix), follow it over these guidelines.
5. When renaming, rename everywhere with tooling. Don't be afraid to rename: everyone benefits, and good names are discovered over time.

## Output guidance

When suggesting names, give the top choice with a one-line reason, plus one or two alternatives if the choice is close. When reviewing, point out the specific identifier, why it misleads, and the replacement.
