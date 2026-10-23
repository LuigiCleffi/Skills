---
name: clean-code-comments
description: Deciding when a code comment helps and when it should be replaced with clearer code or deleted, based on Chapter 4 (Comments) of Clean Code. Use whenever the user asks whether to comment code, asks the AI to add comments or docstrings, asks to clean up or audit comments, has commented-out code, changelog or author headers, banner or position markers, or closing-brace comments, or when the AI is writing code and is tempted to explain something in a comment. Also use for decisions about mandatory docstring or javadoc policies.
---

# Comments

A well-placed comment can be very helpful. A sloppy or stale one can do real harm, because code changes and comments don't move with it. Every comment is, in a sense, an admission that the code couldn't speak for itself. Sometimes that's unavoidable, but try the code first.

## Core principle

**Comments don't make up for bad code.** When you feel the urge to explain a confusing passage, clean the passage instead. Clear code with few comments beats complex code with many.

**Explain yourself in code.** Often a well-named function or variable replaces the comment entirely:

```
# Check whether employee is eligible for full benefits
if (employee.flags & HOURLY_FLAG) and employee.age > 65:
```
becomes
```
if employee.is_eligible_for_full_benefits():
```

## Comments worth writing

- **Legal.** Copyright and license headers required by policy. Keep them short and refer to the license file rather than pasting the full text.
- **Informative.** For example, the expected format of a regular expression. Even so, a better name or a dedicated class often makes it unnecessary.
- **Intent.** Why a non-obvious decision was made, such as a workaround or a deliberate tradeoff.
- **Clarification.** Translating an obscure argument or return value from a library you can't change. Be careful: a clarifying comment that's wrong is worse than none.
- **Warning of consequences.** For example: "Not thread-safe; create one per call," or "this test takes ten minutes." Use framework features like skip or ignore markers with a reason where they exist.
- **TODO.** Notes about work that should happen but can't now. Scan for them regularly; they aren't an excuse to leave bad code.
- **Amplification.** Stressing that something which looks trivial is important ("the trim here is crucial; leading spaces break the parser").
- **Docs for public APIs.** Good docstrings or reference docs on a public library API are valuable. They must be accurate.

## Comments to avoid or remove

- **Mumbling.** Vague comments written because it felt like one was needed, which force the reader to look elsewhere to understand them.
- **Redundant.** Comments that restate the code and take longer to read than the code itself.
- **Misleading.** Subtly inaccurate descriptions, such as "returns when closed is true" when the code actually waits and then times out.
- **Mandated.** Policies like "every function needs a docstring" or "every variable needs a comment" produce clutter and lies. Document what deserves it.
- **Journal or changelog headers.** Version control does this.
- **Noise.** For example, `# Default constructor` or `"""The name."""` on a `name` field.
- **Using a comment where a function or variable would do.** Extract and name it instead.
- **Position markers and banners** (`######## Actions ########`). These are rarely justified. If they're everywhere, people stop seeing them.
- **Closing-brace comments** (`} // end while`). These signal that the function is too long. Shorten it instead.
- **Attributions and bylines** ("Added by Rick"). Version control tracks authorship.
- **Commented-out code.** Delete it. Version control remembers it. Others will be afraid to delete it and it will pile up.
- **HTML or markup inside comments** that makes them hard to read in the editor. Formatting is the doc tool's job.
- **Nonlocal information.** A comment describing system-wide facts, such as a default port set elsewhere, that the local code doesn't control. It goes stale silently.
- **Too much information.** Historical discussion, RFC excerpts or long background. Link to the source instead.
- **Inobvious connection.** A comment whose relationship to the code needs its own explanation.
- **Function headers on short functions.** A good name beats a header.
- **Detailed docs on non-public internals.** These are as much maintenance burden as help.

## Workflow when asked to "add comments"

1. First, see whether renaming, extracting functions or introducing explanatory variables removes the need. Offer those changes.
2. Add comments only for intent, warnings, non-obvious constraints, and public API documentation.
3. Never add comments that narrate what each line does.
4. Write any comment carefully: concise, accurate, correctly spelled, and in the context of the code it sits next to.

## Workflow when auditing comments

Classify each comment as keep, rewrite, replace with code, or delete, and give a one-phrase reason. Delete commented-out code and journal headers outright and note that version control preserves them.

## Note on mandated docs

If the user's project or team requires docstrings (for example a public SDK, or a linter rule), comply. Make them useful by documenting parameters' meaning, units, errors raised and examples, rather than restating the signature.
