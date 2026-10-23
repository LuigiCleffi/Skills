---
name: uiux-internationalization
description: How to make a product ready for many languages and regions and then adapt it per market, covering internationalization (i18n) vs localization (l10n), planning target markets, externalized UI strings and message keys, ICU MessageFormat plurals, gender and select, never concatenating translated fragments, locale negotiation and user choice, BCP 47 locale tags (language, script, region, variant, Unicode extensions), date, time, time zone, number, currency, unit and list formatting with CLDR and the Intl APIs, collation and sorting, names, addresses and phone numbers, text expansion and truncation, fonts and Unicode, bidirectional text (bidi), right-to-left (RTL) layout and mirroring with CSS logical properties, culturally appropriate icons, colors and imagery, pseudo-localization, translation workflow, and localization testing and maintenance, based on the Internationalization and localization section of UI/UX Design Guide. Use when a spec mentions more than one language, country, currency or time zone, when adding a language switcher, translating the UI, extracting hardcoded strings, choosing an i18n library (i18next, react-intl/FormatJS, Lingui, gettext, Fluent), handling plurals, formatting dates, prices or numbers, storing timestamps, supporting Arabic, Hebrew, Persian or Urdu, flipping a layout for RTL, fixing truncated or overflowing translated labels, broken accents or mojibake, wrong decimal separators, wrong first day of week, names or addresses forms that reject real users, or when the user mentions i18n, l10n, locale, en-US, pt-BR, zh-Hant-TW, BCP 47, ISO 639, ISO 3166, CLDR, ICU, Intl.DateTimeFormat, Intl.NumberFormat, dir="rtl", bidi, <bdi>, logical properties, pseudo-localization or translation keys.
---

# Internationalization and localization

Internationalize once, in the architecture: no user-visible text, format or layout direction is hardcoded, so adding a market is a translation and configuration task, not a code change. Localize per market, deliberately: which locales, which formats, which content and imagery change, all decided from the spec's target markets and never guessed.

## i18n vs l10n

| | Internationalization (i18n) | Localization (l10n) |
|---|---|---|
| What | Engineering the product so it can be adapted | Adapting it for one locale |
| Who | Design and development | Translators, local reviewers, market owners |
| When | Before the first second locale; cheapest at the start | Per market, continuously |
| Output | String catalogs, locale-aware formatting, flexible and mirrorable layout, Unicode end to end | Translated catalogs, local formats, adapted images, symbols, colors, legal text |

Even a single-language product benefits from i18n basics (externalized strings, Intl formatting, UTC storage): they cost little early and are expensive to retrofit.

## Plan and analyze

Before designing, get from product/spec (send back as open questions if missing):

- Target locales at launch and later, with priority; default and fallback locale.
- Whether content (catalog, help, emails, legal) is translated or only the UI chrome.
- Currencies charged vs displayed, tax and price presentation, units (metric/imperial), regulatory text per region.
- Who translates (vendor, community, machine translation plus review) and the release cadence for translations.

## Locales and locale codes (BCP 47)

A locale tag identifies language plus the conventions to use. Use IETF BCP 47 tags, which the Intl APIs and CLDR expect.

| Subtag | Standard | Example |
|---|---|---|
| Language | ISO 639 (2 letters preferred, 3 when no 2-letter code exists) | `en`, `pt`, `fil` |
| Script | ISO 15924, four letters, only when it disambiguates | `zh-Hans`, `zh-Hant`, `sr-Latn` |
| Region | ISO 3166-1 alpha-2 or UN M.49 numeric | `pt-BR`, `en-GB`, `es-419` (Latin America) |
| Variant | Registered in the IANA subtag registry | `de-CH-1996` |
| Extension | Unicode `-u-` keys for preferences | `en-US-u-hc-h23` (24-hour), `th-TH-u-nu-thai` |

- Language and region are separate choices: a Spanish speaker in the US may want `es` text with US currency. Keep UI language and formatting region as separate settings when the spec's users need it.
- Sub-national variation (for example a state) is not part of the basic tag; model it in your own data, or with the `-u-sd-` subdivision extension if you really need it.
- Negotiate the locale: explicit user choice (persisted in the profile) first, then `Accept-Language`/`navigator.languages`, then the default. Do not lock language to IP geolocation, and do not use flags for languages (languages are not countries).
- Define a fallback chain (`pt-PT` → `pt` → default) so a missing string never renders a raw key.

## Strings and messages

- All user-visible text, including `alt`, `aria-label`, titles, emails, push notifications, server error messages and validation messages, lives in catalogs keyed by meaning (`checkout.payButton`), not by English text.
- Never build sentences by concatenation or embed variables positionally; word order differs. Use full messages with named placeholders.
- Plurals and grammatical variation go through ICU MessageFormat (or Fluent), which follows CLDR plural categories (`zero, one, two, few, many, other`); English's two forms are not universal.
- Give translators context: a description per key, screenshots, maximum length where the layout truly constrains it.

```json
{
  "cart.items": "{count, plural, =0 {Your cart is empty} one {# item in your cart} other {# items in your cart}}",
  "invite.sent": "{gender, select, female {She invited you} male {He invited you} other {They invited you}}"
}
```

## Formats

Format at the edge, in the user's locale; store and transmit canonical values.

| Data | Store / transmit | Display |
|---|---|---|
| Instant in time | UTC, ISO 8601 (`2026-03-01T14:00:00Z`) | `Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone })` in the user's time zone |
| Calendar date (birthday, due date) | `YYYY-MM-DD` with no time zone | Locale date format; do not shift it by time zone |
| Numbers | Numeric type | `Intl.NumberFormat` (decimal and grouping separators vary: `1,234.5` vs `1.234,5` vs `1 234,5`) |
| Money | Integer minor units or decimal, plus ISO 4217 code | `Intl.NumberFormat(locale, { style: 'currency', currency })`; never convert currency implicitly in formatting |
| Units | Canonical unit (meters, grams) | Per-locale unit system decided in the spec; `Intl.NumberFormat` `style: 'unit'` |
| Lists, relative time | Data | `Intl.ListFormat`, `Intl.RelativeTimeFormat` |
| Sorting, search | Unicode text, normalized (NFC) | `Intl.Collator(locale)`; accent- and case-insensitive search where expected |

- Week start, 12/24-hour clock, and calendar system come from the locale (CLDR), not from hardcoded assumptions.
- Names, addresses and phone numbers: do not force first/last name, uppercase, ASCII or a fixed postal code pattern. Use a single "full name" field plus an optional "what should we call you" when the spec allows; use per-country address schemas; store phones in E.164.

## Layout, text and typography

- Plan for text expansion: translations are often 30–40% longer than English, and short labels can double or triple. Let containers grow and wrap; avoid fixed widths and text baked into images.
- Truncation is a last resort: when used, show the full text on focus/hover and to screen readers.
- Unicode end to end: UTF-8 in files, HTTP headers, database columns and collations; count characters in grapheme clusters (`Intl.Segmenter`), not bytes or UTF-16 code units, when enforcing limits.
- Fonts must cover every target script with appropriate line height (some scripts need more vertical space); set `lang` on `<html>` and on any embedded passage so browsers and screen readers choose glyphs and pronunciation correctly.
- Support input methods (IME) for CJK: do not submit or validate on every keystroke during composition (`compositionstart`/`compositionend`).

## Bidirectional text and RTL

Arabic, Hebrew, Persian and Urdu read right to left and commonly mix in left-to-right runs (numbers, brand names, URLs).

- Set `dir="rtl"` and `lang` at the document root for RTL locales; use `dir="auto"` on user-generated content and `<bdi>` around inserted values whose direction is unknown (user names, search terms).
- Write layout with CSS logical properties so it mirrors automatically: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`, `border-start-start-radius`.
- Mirror directional elements (back/forward arrows, progress direction, breadcrumbs, sliders, drawer side); do not mirror non-directional ones (play button, clocks, logos, checkmarks, media timelines, phone numbers).
- Text inputs follow the content direction; caret and selection must behave correctly with mixed runs. Test with real mixed strings, not just translated labels.

```css
.card { padding-inline-start: 1rem; border-inline-start: 4px solid var(--accent); text-align: start; }
.icon-forward:dir(rtl) { transform: scaleX(-1); }
```

## Culture: icons, imagery, color and tone

- Icons and gestures do not mean the same thing everywhere (hand gestures, mailbox, owl, checkmark vs cross for "correct"). Prefer abstract, widely recognized symbols with text labels.
- Colors carry cultural meaning (red as danger vs luck, white for mourning); color never carries meaning alone anyway (see `../Affordance/affordance.md`).
- Images with people, holidays, food, maps and borders need local review; disputed borders and place names can be legal issues.
- Tone and directness of microcopy adapt per market: high-context cultures may find blunt errors rude, low-context ones may find indirect copy unclear. Decide the voice per locale with local reviewers.

## Test and maintain

- Pseudo-localization in CI or dev builds (accented, expanded, bracketed strings such as `[Ŝàvé çĥàñĝéš ~~~]`) reveals hardcoded text, truncation and concatenation before any translator is involved; add an RTL pseudo-locale for mirroring.
- Automated checks: no missing keys per locale, placeholders match between source and translation, ICU syntax valid, no hardcoded strings (lint rule).
- Visual regression snapshots for the longest locale, an RTL locale and a CJK locale on key screens.
- Native-speaker review in context for each launch locale, including RTL and bidi behavior; usability testing with users from target markets, with their consent and local privacy rules respected.
- Maintenance: a translation pipeline where new keys block release or fall back visibly in staging only, ownership per locale, and a process for reporting translation bugs.

## Decisions to hand off

| Decide | Dev implements | tdd / acceptance verifies |
|---|---|---|
| Launch locales, default and fallback chain | Locale config, negotiation order, persisted user preference | Tests: explicit choice beats `Accept-Language`; unknown locale falls back; no raw keys rendered |
| UI language vs formatting region (one setting or two) | Settings model and Intl locale per concern | Acceptance scenario for `es` language with `US` region if in scope |
| String externalization and message format (ICU/Fluent, library) | Catalogs, keys with descriptions, lint against hardcoded text | Lint passes; plural tests for counts 0, 1, 2, 5, 21 in each locale with complex plurals |
| Date/time policy: storage in UTC, display time zone source, calendar dates without zone | Data types, Intl formatting at the edge | Tests across time zones and DST transitions; date-only values never shift |
| Currency and units per market | ISO 4217 amounts, unit conversion rules from spec | Formatted output per locale matches expected snapshots |
| Name, address, phone schemas | Flexible fields, per-country address format, E.164 | Acceptance with real-world samples (single names, non-Latin scripts, no postal code) |
| RTL support and mirroring rules | Logical CSS, `dir`/`lang`, `<bdi>`, mirrored icon list | RTL pseudo-locale snapshots; bidi strings render in correct order |
| Text expansion budget and truncation rule | Flexible layout; tooltip/accessible full text when truncated | Pseudo-localization snapshots show no clipping on key screens |
| Locale-specific content and imagery review | Content per locale in CMS or catalogs | Native review sign-off recorded per locale before release |

Send to product/spec as open questions, never assume: which markets and languages, whether content beyond the UI is translated, which currencies are charged, legal text per region, and who owns translation quality.

## Workflow

1. Extract target markets, languages, currencies and regional rules from the spec; list gaps as open questions.
2. Choose the locale model (BCP 47 tags, negotiation, fallback, language vs region settings).
3. Decide the string and message format and the translation pipeline.
4. Define format policies for time, numbers, money, units, names and addresses.
5. Define layout rules: expansion budget, truncation, fonts, logical properties, RTL mirroring list.
6. Identify culturally sensitive icons, imagery, color and tone per locale for local review.
7. Specify the test plan: pseudo-localization, missing-key checks, plural and time zone tests, RTL and CJK snapshots, native review.
8. Record the decisions table in the UI/UX decisions record for dev and tdd.

## Red flags

- Hardcoded strings in components, server errors or emails; English text used as keys.
- Sentences built by concatenating translated fragments or `count + " items"`.
- `if (count === 1)` plural logic.
- Dates formatted with manual string templates, timestamps stored in local time, birthdays shifted by time zone.
- Prices as floats, or currency symbol hardcoded next to a number.
- Flags used as language selectors; language forced by IP.
- `margin-left`/`left`/`text-align: left` throughout a product with RTL in scope.
- Fixed-width buttons sized for English; text inside images.
- First/last name and ZIP code required for every user worldwide.
- Translations shipped without in-context native review.

## Related

- `../../actions/uiux.md` — the workflow that consults this skill and records the decisions.
- `../Affordance/affordance.md` — accessibility, non-color cues and microcopy style that localization must preserve.
- `../Implementation/implementation.md` — design tokens and components that must support logical properties and flexible text.
- `../Testing/testing.md` — usability testing with users from each target market.
- `../TaskAnalysis/taskAnalysis.md` — how tasks differ by market and culture.
- `../../ProductDefinition/plan.md` — where target markets and languages should be defined (when installed).
- `../../ProductDefinition/specs/spec-checklist.md` — where missing locale requirements go back as open questions (when installed).
- `../../actions/dev.md` — implements locale handling and formatting.
- `../../actions/tdd.md` — writes plural, time zone and fallback tests first.
- `../../DBA/PostgreSQL/DataTypes/dataTypes.md` — text, `timestamptz` and numeric types for storing localized data canonically (when installed).
