# Edge-Case Battery

The cases this project's tests must cover whenever they apply. Each row is a
kind of input or situation that broke, or would break, a feature here.

`tdd` adds the rows that apply to the test list before writing tests, `bdd`
uses them when it looks for the boundary examples of a rule, and `review`
checks the diff's tests against them. A row that does not apply to a change
is skipped; a row that applies and is not tested is a finding.

## How the battery grows

Every defect that reached a user or QA after the code was reviewed (an
escaped defect) adds a row here, in the same change that fixes it, unless an
existing row already covers it. Name the defect in **Source**. The harness
does not close a fix run for an escaped defect until its row exists (see
`actions/harness.md`).

The `seed` rows are common defect classes to start with. Keep the ones this
project can hit, delete the rest, and rewrite them in the project's own
terms (its documents, its money, its screens) as real defects arrive.

| ID | Applies when | Case | Expected | Source |
|---|---|---|---|---|
| EC-01 | Any text input | Empty, only spaces, and leading or trailing spaces | Rejected or trimmed as the spec says, never stored as-is by accident | seed |
| EC-02 | Any text input with a limit | Exactly the limit, and one over | The limit is accepted; one over is refused with the limit in the message | seed |
| EC-03 | Names, addresses, free text | Accents, emoji, apostrophes, right-to-left text | Stored, searched, and shown unchanged | seed |
| EC-04 | Dates and times | Another time zone, a DST change, Feb 29, the last day of the month | The same instant everywhere it is shown and compared | seed |
| EC-05 | Numbers and money | Zero, negative, the locale's decimal separator, rounding of the last cent | Totals match to the cent; rounding follows the documented rule | seed |
| EC-06 | Any submit or payment | Double click, retry after a timeout, two tabs | One record, one charge | seed |
| EC-07 | Multi-step flows | Reload, browser back, and resume halfway | No lost data and no duplicate step | seed |
| EC-08 | Multi-tenant data | An ID that belongs to another organization or user | Not found, never someone else's data | seed |
| EC-09 | Any protected action | A user without the permission, and an expired session | Refused without side effects | seed |
| EC-10 | Shared records | Two people or jobs changing the same record | No lost update; the loser is told | seed |
| EC-11 | Any screen | A 390 px wide phone screen and 200% zoom | Nothing cut off or overlapping; every action reachable | seed |
| EC-12 | Network calls | A slow, failed, or partial response | A visible state, and a retry that does not duplicate | seed |
| EC-13 | Document and ID numbers | With and without punctuation, leading zeros, an invalid check digit | Normalized the same way on save and search; invalid ones refused | seed |
| EC-14 | Lists and pages | An empty list, exactly one page, the last page | A designed empty state; no missing or repeated item between pages | seed |
