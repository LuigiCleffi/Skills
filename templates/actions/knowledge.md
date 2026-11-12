---
name: knowledge
description: "Keep the project's business knowledge base in docs/knowledge/: the ubiquitous language glossary, one file per business rule (BR-NNNN) with its source and where the code enforces it, and the research notes behind them. Before specifying, modeling, writing scenarios, implementing, or reviewing, pass the knowledge gate: read docs/knowledge/README.md, match the task against its routing table, and read only the rules and notes it points to. When a rule, term, or domain fact is learned from the user, the code, or research, capture it in the same change. Owns docs/knowledge/ and its gate; never production code, product intent, or architecture decisions."
---

# knowledge — Business Knowledge Base and the Knowledge Gate

## Purpose and ownership

Business rules are the knowledge a project loses most easily. They live in a conversation, a spec that is never reread, or a condition buried in a service, and the next session (human or agent) rediscovers them or breaks them. ADRs keep the architecture's memory; `knowledge` keeps the **business's** memory:

- **The glossary:** the ubiquitous language, one meaning per term per bounded context.
- **The rules:** one file per business rule, with where it came from, how sure we are, and where the code enforces it.
- **The research notes:** what was learned about the domain from outside the project, with citations.
- **The gate:** `docs/knowledge/README.md`, the only knowledge file an agent reads first. It routes from *what the task is about* to the rules and notes that govern it.

This is retrieval the agent can audit: plain files in git, reviewed like code, found through a routing table and `grep` instead of a similarity score.

`knowledge` owns `docs/knowledge/`. It does not change product intent, decide architecture, write production code, or write tests.

## Position in the workflow

```text
plan → research → spec-definition → spec-checklist → [strategy] → ddd → bdd → uiux → dev → review → code-review
  │        │             │                │                          │      │      │      │       │          │
  └────────┴─────────────┴────────────────┴──────────────────────────┴──────┴──────┴──────┴───────┴──────────┘
                     consult the gate before deciding; capture every rule, term, and fact learned
```

Like `adr`, `knowledge` is not a stage that runs once. It has three modes:

- **Consult** — before a stage decides or judges behavior, pass the gate. Always run it; it is cheap when nothing matches.
- **Capture** — when a rule, term, or domain fact is learned, write it down in the same change.
- **Harvest** — learn the rules the existing code already enforces, so the knowledge base starts from the project as it is.

## Skill boundaries

- `plan`, `spec-definition`, `spec-checklist`: decide **what** the product does. A confirmed rule they produce is captured here with the spec as its source; a rule here that a spec contradicts is a product question for the user, not a silent overwrite.
- `research`: gathers outside knowledge and writes the research notes. It proposes rules; it never confirms them.
- `ddd`: owns the content of the glossary and the domain model. It writes glossary entries into `docs/knowledge/glossary.md`, and links invariants (`DM-NN`) to the rules (`BR-NNNN`) they enforce.
- `bdd`: illustrates each confirmed rule in scope with scenarios and links them from the rule.
- `adr`: architecture only. A business rule is never an ADR, and a technical decision is never a business rule.
- `dev`: consults the gate, implements confirmed rules, and records where each one is enforced.
- `review` and `code-review`: check the diff against the rules the gate routes to.

Do not copy another skill's full workflow into this skill. Invoke it and use its output.

## What goes where

| Kind | File | Example |
|---|---|---|
| A term and its meaning | `glossary.md` | "Settlement: the transfer of captured funds to the merchant, once per business day." |
| A business rule | `rules/BR-NNNN-short-title.md` | "A refund may be requested up to 30 days after delivery." |
| Outside knowledge and its sources | `research/RS-NNNN-topic.md` | What the consumer-protection law in force says about refund windows. |
| An architectural decision | `docs/adr/` (through `adr`) | "Store money as integer minor units." |
| What the feature must do | the spec (through `spec-definition`) | "FR-07: the customer can request a refund from the order page." |

A **business rule** is a statement about how the business works that stays true regardless of the screen, the code, or the technology: a constraint, a calculation, an eligibility condition, a lifecycle, a deadline, a limit, a permission in business terms. When unsure, ask: *would a domain expert recognize and own this sentence?* If yes, it is a rule.

## The knowledge gate (`docs/knowledge/README.md`)

```markdown
# Knowledge Base — Gate

Read this file before specifying, modeling, implementing, or reviewing
behavior. Find every row whose "About" or "Paths" matches the task, then
read only those files. Confirmed rules are binding; a change to one goes
to the user.

Glossary: [glossary.md](glossary.md)

## Routing

| About… | Keywords | Paths | Read |
|---|---|---|---|
| Refunds, returns, chargebacks | refund, return, chargeback, reversal | `src/billing/refunds/**` | [BR-0003](rules/BR-0003-refund-window.md), [BR-0004](rules/BR-0004-refund-to-original-method.md), [RS-0001](research/RS-0001-consumer-refund-law.md) |
| Customer tiers and discounts | tier, loyalty, discount, coupon | `src/pricing/**` | [BR-0001](rules/BR-0001-tier-thresholds.md) |

## Register

| ID | Title | Kind | Status | Updated |
|---|---|---|---|---|
| [BR-0003](rules/BR-0003-refund-window.md) | Refund window is 30 days after delivery | Rule | Confirmed | 2026-03-02 |
| [RS-0001](research/RS-0001-consumer-refund-law.md) | Consumer refund law in force | Research | Current | 2026-03-01 |
```

Rules for the gate:

- **Every rule and research note has at least one routing row.** What the gate does not route to, agents never find.
- **Rows describe subjects in business words** ("refunds", "customer tiers"), with keywords and paths to widen the match.
- **Superseded and retired entries leave the routing table** and stay in the register with their status.
- Keep the gate readable in one pass. When it outgrows that, split it by bounded context (`docs/knowledge/<context>/README.md`) and make the top gate route to the context gates.

## Glossary format (`docs/knowledge/glossary.md`)

```markdown
| Term | Context | Meaning | Avoid | Code name | Rules |
|---|---|---|---|---|---|
| Settlement | Payments | Transfer of captured funds to the merchant, once per business day | payout, transfer | `Settlement` | BR-0007 |
```

If the project already keeps a glossary elsewhere (`docs/glossary.md`, a wiki export), use it and point the gate to it instead of creating a second one.

## Rule file format (`rules/BR-NNNN-short-title.md`)

Number rules in sequence and never renumber them.

```markdown
# BR-NNNN: [The rule as one plain sentence]

**Status:** Proposed | Confirmed | Superseded by [BR-MMMM](BR-MMMM-....md) | Retired
**Context:** [bounded context, from the glossary]
**Source:** [who or what established it: the user on YYYY-MM-DD, spec FR-07, RS-0001, or "harvested from src/... (unconfirmed)"]
**Confirmed by:** [the person who confirmed it, and when; empty while Proposed]
**Updated:** YYYY-MM-DD

## Statement
The rule, precise enough to test: conditions, values, units, time zones, rounding, who it applies to.

## Examples
| Situation | Expected outcome |
|---|---|
| Delivered 2026-03-01, refund requested 2026-03-31 | Accepted |
| Delivered 2026-03-01, refund requested 2026-04-01 | Rejected: window closed |

## Exceptions
Cases the rule does not cover, or that override it, each with its own source.

## Rationale
Why the business has this rule (law, contract, policy, risk), or "Rationale not recorded".

## Where it is enforced
- Spec: FR-07
- Model: DM-03 in `DomainModel.md`
- Scenarios: `features/refunds.feature` "Refund after the window closes"
- Code: `src/billing/refunds/refundPolicy.ts`

## Gate entries
The routing rows this rule adds to `docs/knowledge/README.md`.
```

Every rule needs **Statement**, **Source**, and **Status**. **Examples** turn a rule into something `bdd` and `tdd` can use directly; add at least one per rule, with the boundary case.

## Status and trust

| Status | Meaning | How agents treat it |
|---|---|---|
| **Confirmed** | A decider (the user, the product owner, or someone they named) confirmed it. | Binding. Follow it; a change goes to the user. |
| **Proposed** | Captured from research, harvested from code, or inferred, and not yet confirmed. | Not binding. Tell the user it affects the task and ask before building on it. |
| **Superseded** / **Retired** | Replaced or no longer true. | Follow the successor, or nothing. |

Only a decider moves a rule to **Confirmed**. Research and code tell you what *is*, or what others do; only the business decides what *should be*.

## Workflow

When the Skills Code Kit MCP server is installed, its `knowledge_gate` tool runs consult mode's matching and returns the matched records, and `capture_rule` writes a rule with its gate rows in one step. They follow the same rules as below.

### Consult mode — pass the gate

Run at the start of `spec-definition`, `ddd`, `bdd`, `uiux`, `dev`, `review`, and `code-review`.

1. **State what the task is about.** One line: the business subject ("refunds for marketplace orders"), the bounded context, and the paths you expect to change or judge.
2. **Open the gate.** Read `docs/knowledge/README.md`. If it does not exist, note "Knowledge gate: no records yet", consider harvest mode when the task touches existing business logic, and continue.
3. **Match.** Select every routing row whose subject, keywords, or paths match. Also look up each domain term of the task in the glossary.
4. **Read only the matched files.**
5. **Apply them.** Confirmed rules bind the task. Proposed rules are questions for the user. A rule that contradicts the spec or the request is a conflict: stop on that item and ask, showing both.
6. **Report.** List the rules and notes consulted and how each constrains the work, or "Knowledge gate: no matching records".

### Capture mode — write it down

Run whenever a stage learns something about the business: the user answers a question, a spec is approved, `ddd` settles a term, `bdd` discovers an example that changes an outcome, `dev` finds a rule in the code, or `research` reports.

1. **Check it is new.** Search the register and `grep` the rules for the same subject. If a rule exists, update its examples or enforcement links; if the rule itself changed, write a new rule that supersedes it.
2. **Write the entry** in the format above, with the source exactly as it happened. A rule stated by the user is **Confirmed** with the user and date; anything else is **Proposed**.
3. **Update the gate in the same change:** routing rows and a register row.
4. **Link both ways:** from the rule to the spec, model, scenarios, and code that enforce it, and from those records back to the rule ID where they have a place for it.

### Harvest mode — learn the project

Run when the gate is empty or thin and the task touches existing business logic, or when the user asks to "learn the project".

1. **Pick a scope.** One bounded context or module at a time, starting with the one the current task touches. Never harvest the whole codebase in one pass.
2. **Read for rules, not structure.** Validations, guards, state transitions, calculations, constants with business meaning (limits, rates, deadlines), permission checks, scheduled jobs, error messages shown to users, test names and fixtures, and database constraints.
3. **Write each rule as Proposed**, with `harvested from <path>:<line>` as its source, the code as its enforcement, and examples taken from the tests when they exist. Record what the code does, not what you think it should do; note an apparent bug as an open question on the rule.
4. **Harvest terms** into the glossary from the domain names in the code, flagging names the code uses differently from the spec or the user.
5. **Ask the user to confirm in batches.** Show the proposed rules in one list, grouped by subject, and ask which are right, which are wrong, and which are accidents of the code. Update the statuses with their answers.

## Guardrails

- Never mark a rule **Confirmed** without a decider's confirmation, and never invent a rule to fill a gap.
- Never record an architectural decision, an implementation detail, or a UI preference as a business rule.
- Never put secrets, personal data, or customer records in the knowledge base. Examples use invented values.
- One rule per file. Split a rule that states two independent things.
- Keep sources honest: "harvested from code" and "found in research" are never presented as "the business decided".
- Never leave a rule or note out of the gate, or a gate row pointing to a missing or superseded file.
- Do not write production code or tests.
- Preserve unrelated user changes in the repository.

## Completion criteria

Consult mode is complete when the task's subject, context, and paths were stated, the gate and glossary were read, every matched file was read and applied or its conflict raised, and the consulted records were reported.

Capture mode is complete when the knowledge has its own entry with an honest source and status, the gate routes to it, and it is linked to the records and code that enforce it.

Harvest mode is complete when the scoped module's rules and terms are recorded as Proposed with code sources, routed from the gate, and the user has been asked to confirm them.
