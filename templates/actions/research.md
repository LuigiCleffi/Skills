---
name: research
description: "Research the business domain of a feature before it is specified: the laws, regulations, standards, industry practice, competitor behavior, and domain vocabulary that shape its business rules. Search online, weigh the sources, and write a research note (RS-NNNN) in docs/knowledge/research/ with a citation for every claim, then turn the findings into proposed business rules and the questions the user must answer before spec-definition. Use after plan and before spec-definition when the domain is unfamiliar, regulated, or rule-heavy, and on demand from ddd or bdd when a rule's real-world meaning is unclear. Never confirms a rule, never decides product intent."
---

# research — Domain Research Before the Specification

## Purpose and ownership

A specification is only as good as the business knowledge behind it. When the domain is regulated, specialized, or new to the team, the rules that matter most (tax rounding, refund law, retention periods, medical dosage limits, financial cut-off times) come from outside the project. A spec written without them gets them wrong, and the code faithfully implements the mistake.

`research` brings that knowledge in, with sources, and hands it to the people who decide:

- It writes **research notes** (`docs/knowledge/research/RS-NNNN-topic.md`) with a citation for every claim.
- It proposes **business rules** (`BR-NNNN`, status **Proposed**) through `knowledge` in capture mode.
- It produces the **questions** the user must answer before `spec-definition` can treat a finding as a requirement.

`research` owns its research notes. It does not confirm rules, change product intent, write specs, or write code.

## Position in the workflow

```text
plan → research → spec-definition → spec-checklist → [strategy] → ddd → bdd → ...
          ▲                                                     │      │
          └──────────── on demand: what does this rule mean in the real world? ┘
```

Run it:

- **After `plan`, before `spec-definition`**, when the feature touches a regulated area (payments, tax, health, privacy, employment, accessibility law), a specialized domain the plan does not explain, or rules that vary by country, state, or industry.
- **On demand** from `spec-definition`, `ddd`, or `bdd` when a rule's real meaning, boundary, or exception is unclear.

Skip it when the domain is fully defined by the user and the existing knowledge base, and record "Research: not needed (reason)".

## Skill boundaries

- `plan`: says what the product is for and who it serves. `research` reads the plan to scope its questions; it never rewrites the plan.
- `knowledge`: owns the gate, the rules, and the glossary. `research` writes its notes there and proposes rules through capture mode.
- `spec-definition`: decides which findings become requirements, after the user answers the questions `research` raised.
- `strategy`: reviews positioning and market strategy against the marketing books. Competitor *features and rules* belong here; competitor *positioning* belongs to `strategy`.
- `ddd`: takes the vocabulary and turns it into the glossary and the model.

Do not copy another skill's full workflow into this skill. Invoke it and use its output.

## Inputs

- The product plan and the request: the domain, the users, the markets and jurisdictions, the scope.
- The knowledge gate (`knowledge`, consult mode): what is already known, so it is not researched twice. Extend a current research note instead of writing a second one on the same topic.
- The user's own knowledge. Ask what they already know, which sources they trust, and which jurisdictions and dates apply, before searching.

## Source quality

Weigh every source. Prefer the highest tier that answers the question, and say which tier each claim rests on.

| Tier | Sources | Use for |
|---|---|---|
| **1 — Primary** | Laws and regulations from the official gazette or government site, standards bodies (ISO, W3C, IETF, PCI SSC), regulator guidance, official API or platform documentation | What is required. |
| **2 — Authoritative secondary** | Professional bodies, major law or accounting firm briefings, peer-reviewed papers, the documentation of established vendors in the domain | Interpretation and practice. |
| **3 — Practice** | Competitor products and help centers, reputable industry publications, case studies | What others do; never what is required. |
| **4 — Community** | Forums, Q&A sites, blog posts, AI-generated summaries | Leads to verify in a higher tier. Never cite alone. |

Note for every claim: the jurisdiction or scope, the version or effective date, and the date you read it. A rule that is true in one country, or was true last year, is not a rule for this project until the user says it applies.

## Workflow

### 1. Frame the questions

From the plan and the request, write the research questions as the business would ask them: "How long must a customer be allowed to return a product bought online in Brazil?", not "refund law". List the jurisdictions, customer types, and dates that matter. Show the list to the user when the scope is unclear, and ask which questions they already know the answer to.

### 2. Consult the knowledge gate

Run `knowledge` in consult mode for the subject. Drop questions a confirmed rule or a current research note already answers; note which existing notes may be out of date.

### 3. Search

- Search with the web tools available (web search, page fetch, a documentation MCP). If none are available, say so, and hand the user the questions and the sources to check instead of answering from memory.
- **Keep the project private.** Search for the domain question, never with the project's name, customer names, internal code names, or confidential details.
- Go to the primary source behind a secondary claim whenever it exists.
- Look for exceptions, thresholds, and recent changes as hard as for the main rule; they are where specs go wrong.
- When sources disagree, keep both and say which is stronger and why.

### 4. Write the research note

Write `docs/knowledge/research/RS-NNNN-short-topic.md`, numbered in sequence:

```markdown
# RS-NNNN: [Topic]

**Status:** Current | Outdated (see RS-MMMM)
**Questions:** the research questions this note answers
**Scope:** jurisdictions, customer types, products, and dates covered
**Researched:** YYYY-MM-DD

## Findings
1. [Claim, as one plain sentence.] — Tier 1, [Source title](URL), section/article, effective YYYY-MM-DD, read YYYY-MM-DD.
2. ...

## Conflicts and uncertainty
Where sources disagree, where interpretation is needed, and what would settle it (a lawyer, an accountant, the regulator, the user).

## Proposed rules
- BR-NNNN (Proposed): [rule], from findings 1 and 2.

## Questions for the user
1. [A decision only the business can make, with the options the findings allow and a recommendation.]

## Not found
Questions the research could not answer, and where to look next.
```

Every finding has a source with a URL or an exact reference. A claim without a source is left out, or moved to *Not found*.

### 5. Propose rules and terms

For each finding that implies a business rule, run `knowledge` in capture mode: a rule with status **Proposed**, the research note as its source, and examples at the boundaries the research found. Add the domain terms to the glossary through `ddd`'s format, marked as proposed in the note until `ddd` settles them.

### 6. Hand off

Give `spec-definition` (or the stage that asked):

- The research note path and the questions answered.
- The proposed rules, and the **questions for the user** that must be answered before those rules become requirements.
- The uncertainty that needs a professional (legal, tax, medical, financial) rather than more searching.

`spec-definition` asks the user; each answer moves a rule to **Confirmed** or **Retired** through `knowledge`.

## Guardrails

- Never present research as legal, tax, medical, or financial advice. Say when a finding needs a qualified professional before it is built on.
- Never confirm a rule, and never write a finding into a spec as a requirement. Findings are inputs; the user decides.
- Never cite a source you did not read, and never fill a gap from memory. Say "not found".
- Never send confidential project information to a search engine or outside service.
- Mark notes **Outdated** when a later note or a change in the law replaces them, and keep them in the register.
- Do not write production code or tests.

## Completion criteria

Research is complete when each question is answered with cited findings or listed as not found, conflicts and uncertainty are explicit, the implied rules are captured as Proposed and routed from the knowledge gate, the note is in the register, and the user has the questions that turn findings into requirements.
