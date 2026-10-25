---
name: js-regular-expressions
description: "Writing correct, readable, safe regular expressions in JavaScript: syntax, flags, groups and named captures, anchors and look-around, greedy versus lazy, backtracking and ReDoS, replace with functions, global/sticky lastIndex pitfalls, matchAll, Unicode, escaping dynamic patterns, and Date parsing gotchas, based on Chapter 9 (Regular Expressions) of Eloquent JavaScript. Use when validating or parsing strings, extracting fields, writing search-and-replace, building a RegExp from user input, or reviewing a regex for correctness or performance."
---

# Regular Expressions

A regex is a sharp tool with an awkward handle. Use it for patterns it expresses cleanly, anchor it, make it Unicode-aware, prefer lazy and unambiguous repetition, and switch to a real parser when the pattern stops being readable.

## Creating patterns

- Prefer literals (`/\d+/`) for fixed patterns. Use `new RegExp(string, flags)` only when the pattern is built at run time; then backslashes must be doubled (`"\\s"`).
- Escape special characters (`\ ^ $ . | ? * + ( ) [ ] { } /`) when you mean them literally: `/A\+/`.
- Never splice raw user input into `new RegExp`. Escape it first.

```js
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const wordRe = name => new RegExp(`(?<=^|\\s)${escapeRegExp(name)}(?=$|\\s)`, "iu");
```

**Current note:** `RegExp.escape(string)` is now standard in recent engines; use it when your runtime supports it.

## Building blocks

- Character sets: `[abc]`, ranges `[0-9]`, negation `[^01]`. Inside brackets most specials lose meaning (`[\d.]`).
- Shorthands: `\d \w \s` and negations `\D \W \S`; `.` matches anything but line terminators (add the `s` flag to include them, instead of the `[^]` trick).
- Quantifiers: `+` (1+), `*` (0+), `?` (0 or 1), `{n}`, `{n,m}`, `{n,}`.
- Groups: `( )` captures, `(?: )` groups without capturing, `|` chooses between alternatives (scope it with a group).
- Flags: `i` case-insensitive, `g` global, `y` sticky, `u` Unicode, `s` dotAll, `m` multiline anchors, `d` match indices.

## Unicode

- Without `u`, `.` and quantifiers act on UTF-16 code units, so emoji and other astral characters break (`/<.>/` fails on `"<🌹>"`).
- `\w` and `\b` only know ASCII letters, digits and `_`; `é` or `ß` are "nonword". For human text use `\p{L}` (letters), `\p{N}`, `\p{P}`, `\p{Script=Greek}`, which require `u`.
- Keep `\d` when you will convert digits with `Number`, which only understands ASCII digits.
- Default to `u` on every new regex.

**Current note:** the `v` flag (a superset of `u`) adds set operations (`[\p{L}--[a-z]]`), string properties such as `\p{RGI_Emoji}`, and stricter escaping; prefer it where supported.

## Anchors and look-around

- A match can start anywhere. For validation, anchor both ends: `/^\d{4}$/u`. Missing anchors give code that "mostly works" and then accepts `"100-1-30000"`.
- With the `m` flag `^`/`$` match at line boundaries; without it, at input boundaries.
- `\b` is a word boundary (ASCII-only notion of "word").
- Look-ahead `(?=x)` / `(?!x)` and look-behind `(?<=x)` / `(?<!x)` assert context without consuming it.

## Extracting data

- `re.test(s)` for yes/no. `re.exec(s)` or `s.match(re)` (non-global) for the first match with groups and `index`. `s.search(re)` for an index only.
- Use named groups and destructure `groups`; numbered indexes are fragile when the pattern changes.
- An unmatched optional group yields `undefined`; a repeated group keeps only its last match.
- Always handle a `null` result before destructuring.

```js
const DATE = /^(?<month>\d{1,2})-(?<day>\d{1,2})-(?<year>\d{4})$/u;
function parseUsDate(text) {
  const m = DATE.exec(text);
  if (!m) throw new RangeError(`Not a date: ${text}`);
  const { year, month, day } = m.groups;
  return new Date(Number(year), Number(month) - 1, Number(day));
}
```

- `Date` months are zero-based (December is 11) while days are one-based; timestamps are milliseconds since 1970 UTC. `Date.now()` gives the current timestamp; `getYear` is obsolete, use `getFullYear`.

**Current note:** prefer ISO 8601 strings and `Intl.DateTimeFormat` for formatting; `Temporal` replaces most `Date` pitfalls where available.

## Replacing

- `s.replace(re, repl)` replaces the first match; add `g` (or use `replaceAll` with a `g` regex or a plain string) for all.
- In replacement strings, `$1`, `$<name>` and `$&` (whole match) refer to captures.
- Pass a function for computed replacements; it receives the match, then each group, then offset and input (and `groups` when named groups exist).

```js
"1 lemon, 2 eggs".replace(/(?<n>\d+) (?<item>\p{L}+)/gu,
  (...args) => { const { n, item } = args.at(-1); return `${Number(n) * 2} ${item}`; });
```

## Greed and backtracking

- `+ * ? {}` are greedy: they take as much as possible and back off. This over-matches across delimiters (`/\/\*[^]*\*\//` eats from the first `/*` to the last `*/`).
- Use the lazy forms `+? *? ?? {}?`, or better, a negated set that cannot cross the delimiter (`'[^']*'`).
- Alternatives are tried in order; the first branch that leads to a full match wins.
- Nested or overlapping quantifiers (`/([01]+)+b/`, `(a|a)*`, `(\w+\s?)*$`) can backtrack exponentially on near-miss input: catastrophic backtracking, a denial-of-service risk (ReDoS) on untrusted input. Make each character matchable in only one way and cap input length.

## Global and sticky state

- Regexes with `g` or `y` are stateful: `exec` and `test` read and update `lastIndex`. Reusing one shared global regex across calls skips matches or returns `null` unexpectedly.
- `y` matches only exactly at `lastIndex`; `g` searches forward from it. Sticky is useful for tokenizers.
- `s.match(/x/g)` returns all matched strings without groups or indexes. To iterate matches with groups use `s.matchAll(re)` (requires `g`; it does not disturb the regex's `lastIndex`).

```js
for (const { 0: text, index } of input.matchAll(/\d+/g)) console.log(text, index);
```

## When to stop using regex

- Line-oriented formats are a good fit: split with `/\r?\n/`, then match each line with an anchored pattern, and throw on lines that match nothing.
- Nested or recursive structures (HTML, JSON, code, balanced brackets) need a parser. Use `JSON.parse`, `URL`, `URLSearchParams`, `DOMParser`, or a library.
- If a regex needs a paragraph of explanation, split it into named pieces or write code.

## Workflow

1. Write example strings that must match and must not match, including edge cases (empty, Unicode, CRLF, near misses).
2. Start from a literal with `u` (or `v`); anchor it if it validates a whole value.
3. Use named groups for anything you extract; handle `null`.
4. Prefer negated sets or lazy quantifiers over greedy `.*`.
5. Check for nested quantifiers and ambiguous alternatives; bound input size for untrusted text.
6. Escape any dynamic part; never reuse a `g`/`y` regex across unrelated inputs.
7. If readability collapses, replace the regex with a small parser.

## Red flags

- Validation regex without `^`/`$`.
- `\w`, `\b` or `[a-zA-Z]` used for names or other human text; no `u` flag.
- `new RegExp(userInput)` without escaping.
- Module-level `const re = /.../g` used with `test`/`exec` in a function called repeatedly.
- `.*` between delimiters; nested quantifiers like `(x+)+`.
- Destructuring `exec`/`match` results without a `null` check.
- Messages or branches based on numbered groups `m[3]` in a long pattern.
- `new Date(y, m, d)` with a one-based month.
- Regex used to parse HTML, JSON or nested syntax.

## Testing notes

- Drive the regex with a table of inputs and expected results (`for (const [input, ok] of cases) test(...)`) including must-not-match cases.
- Include non-ASCII, emoji, CRLF and very long near-miss inputs; add a timing guard for ReDoS-prone patterns.
- Test extraction by asserting the resulting data object, not the raw match array.
- In acceptance criteria, express formats as examples tables rather than as the regex itself.

## Related

- `../../Language/ValuesTypesOperators/valuesTypesOperators.md` — strings and their methods.
- `../../Language/BugsAndErrors/bugsAndErrors.md` — throwing on invalid input lines.
- `../../Language/Modules/modules.md` — reuse a parser package instead of a home-grown regex.
- `../../../CleanCode/MeaningfulNames/namingRules.md` — name patterns and groups by intent.
- `../../../TDD/Patterns/TestingPatterns/testingPatterns.md` — small focused tests for tricky code.
- `../../../BDD/CodingTheBddWay/BddAndUnitTesting/bddAndUnitTesting.md` — examples tables down to unit tests.
