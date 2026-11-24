---
name: harness
description: "Run a change through the whole spec-driven workflow in order, and keep the evidence: classify the request (feature, fix, or chore), open a run in docs/harness/, run each stage the mode needs (plan, research, spec-definition, spec-checklist, strategy, ddd, bdd, uiux, the knowledge and ADR gates, dev with tdd, review, code-review), record each stage as done with its record, or skipped with a reason, and close the run. Declares the triggers a change hits (schema, permission, public contract, concurrency, new entity, cross module), which decide how deep the run goes. Keeps docs/harness/active.json, which the installed gate script (harness/gate.mjs) reads to warn about (or block) edits to production code and tests until every pre-code stage is settled, and checks each stage's record before it counts as done. Use for any request that will change guarded code; for a question or a change to docs only, no run is needed."
---

# harness — Spec-Driven Delivery, Enforced

## Purpose and ownership

Each workflow in this kit is good on its own. Without something that runs them in order, an agent under pressure skips to the code, and the spec, the model, the scenarios, and the gates become optional. `harness` is that something:

- It **classifies** the request and picks the stages it needs: the mode sets the kind of work, and the triggers set how deep it goes.
- It **runs** them in order, invoking each workflow instead of repeating it.
- It **records** every stage in a run file: done with the record it produced, or skipped with a reason. Nothing is skipped silently.
- It **checks** the order and the records. `docs/harness/active.json` tells the gate script which run is active and which stages are settled; until every pre-code stage is, an edit to a guarded path (production code and tests) gets a warning, or is refused when the project chose to block. A stage counts as done only when its record passes the checks in `harness/config.json`.

`harness` owns `docs/harness/` and `harness/config.json`. It does not write specs, models, scenarios, decisions, or code itself; the stage workflows do.

An idea that is not yet a clear request goes through `actions/explore.md` first, when installed; the run opens once the person decides to go ahead. After the pull request is merged, `actions/finish.md` closes the run and cleans up.

## The stages

| # | Stage | Workflow | Produces | Feature | Fix | Chore |
|---|---|---|---|---|---|---|
| 1 | `plan` | `ProductDefinition/plan.md` | product plan | ● | | |
| 2 | `research` | `actions/research.md` | RS notes, proposed rules, questions | ● | | |
| 3 | `spec` | `ProductDefinition/specs/spec-definition.md` | `SpecifyRequirements.md` | ● | ◆ | |
| 4 | `spec-checklist` | `ProductDefinition/specs/spec-checklist.md` | checklist, all items Ready | ● | | |
| 5 | `reproduce` | `actions/tdd.md` | a failing test or exact reproduction steps | | ● | |
| 6 | `strategy` | `actions/strategy.md` | `StrategyBrief.md` | ● | | |
| 7 | `ddd` | `actions/ddd.md` | `DomainModel.md`, glossary | ◆ | ◆ | |
| 8 | `bdd` | `actions/bdd.md` | feature files, failing scenarios | ● | | |
| 9 | `uiux` | `actions/uiux.md` | `UIUXDecisions.md` | ● | | |
| 10 | `knowledge-gate` | `actions/knowledge.md` | rules consulted | ● | ● | |
| 11 | `adr-gate` | `actions/adr.md` | ADRs consulted or recorded | ● | ● | ● |
| 12 | `tasks` | `actions/dev.md` (Plan the tasks) | `docs/harness/tasks/<slug>.md`, each task with files, change, and a Verify command | ◆ | ◆ | |
| 13 | `dev` | `actions/dev.md` + `actions/tdd.md` | code, tests, checks run | ● | ● | ● |
| 14 | `review` | `actions/review.md` | findings resolved | ● | ● | ● |
| 15 | `qa` | `actions/qa.md` | QA report with **Verdict:** PASS | ● | ● | |
| 16 | `code-review` | `actions/code-review.md` | review of the committed diff | ● | ● | |

● = the stage is in the mode. ◆ = the stage joins the mode when the run declares a trigger (see Depth). Stages 1 to 12 are the **pre-code stages**: the gate script requires each one the run needs to be settled before guarded code changes. The modes, their triggered stages, and the triggers are defined in `harness/config.json`, so a project can tighten or loosen them.

A stage whose workflow is not installed is recorded `n/a: not installed`. A stage that does not apply is recorded `skipped: <reason>` ("skipped: no user-facing surface"). A stage is never skipped without a reason, and `dev` follows the reasons the workflows themselves give for skipping (for example "DDD: not applicable").

## Modes

Choose the mode from the request and tell the user which one and why. When in doubt, choose the stricter mode.

- **Feature:** new or changed behavior a user or another system will notice.
- **Fix:** existing behavior is wrong against an existing spec, rule, or contract. If fixing it needs a new rule or changes agreed behavior, it is a feature.
- **Chore:** no behavior change: dependencies, build, refactoring under green tests, configuration, tooling.

No run is needed for a question, an explanation, or a change to documentation only.

## Depth

The mode says what kind of work it is; the triggers say how much design it needs. Ceremony should follow risk, not habit: a one-line copy change and a new billing table are both features, and only one needs a domain model.

Declare a trigger when the change does any of these (the defaults in `harness/config.json`):

| Trigger | The change |
|---|---|
| `schema` | changes a database schema, a migration, or persisted data |
| `permission` | changes who may see or do something: authentication, authorization, roles, tenants |
| `public-contract` | changes an API, event, file format, or other contract another system depends on |
| `concurrency` | lets two requests, jobs, or users race on the same data |
| `new-entity` | introduces a new domain entity, aggregate, or table |
| `cross-module` | changes two or more modules or bounded contexts together |

With no trigger, the run needs only the mode's stages. With at least one, the mode's triggered stages join it (◆ in the table): `ddd` and `tasks` for a feature; `spec`, `ddd`, and `tasks` for a fix, since a fix whose cause is in the design is no longer a one-line fix. `tasks` makes the risky change a list of small steps, each with the command that proves it. If you can describe the whole change in one sentence and no trigger applies, keep the run light.

Name each trigger with its evidence when you open the run ("schema: adds a `refund_window` column"). When one shows up later, declare it then; its stages join the run as pending, and guarded code waits for them again. Triggers with `paths` in the config are also detected: an edit to a migration in a run that did not declare `schema` is reported by the gate.

## Escaped defects

A fix for a defect that reached a user or QA after the code was reviewed is an **escaped defect**. Open its run with what shipped it (`escapedFrom`: the run, PR, or release), so the run record says `**Escaped:** yes`. Such a run closes only when the edge-case battery, `docs/qa/edge-cases.md`, has a row that would have caught it: add one in the same change (the `tdd` workflow says how), or name the row that already covers it, and pass it as the battery case when closing.

That is how the battery learns: each escape becomes a case every later test list checks. `node harness/gate.mjs escapes` counts fix runs, escaped defects, and the ones with a battery case, per month, from the run records; a month with more escapes than the one before is a reason to look at which stage let them through.

## Files

```text
docs/harness/
  active.json                          ← the run the gate script checks (one at a time)
  runs/YYYY-MM-DD-short-slug.md        ← one record per run, kept after it closes
harness/
  config.json                          ← modes, guarded paths, enforcement switch
  gate.mjs                             ← the gate script (hook and CLI)
```

### `docs/harness/active.json`

```json
{
  "run": "docs/harness/runs/2026-11-12-refund-window.md",
  "mode": "feature",
  "triggers": ["schema"],
  "stages": {
    "plan": "done",
    "research": "done",
    "spec": "done",
    "spec-checklist": "done",
    "strategy": "skipped: internal back-office feature",
    "ddd": "done",
    "bdd": "done",
    "uiux": "skipped: no user-facing surface",
    "knowledge-gate": "done",
    "adr-gate": "done",
    "dev": "pending",
    "review": "pending",
    "code-review": "pending"
  },
  "records": {
    "plan": "docs/plan.md",
    "research": "docs/knowledge/research/RS-0001-consumer-refund-law.md",
    "spec": "specs/refund-window/SpecifyRequirements.md",
    "ddd": "specs/refund-window/DomainModel.md",
    "bdd": "features/refunds.feature"
  }
}
```

Each stage value is `pending`, `done`, `skipped: <reason>`, or `n/a: <reason>`. A stage marked `done` must point to a record that exists, and when `harness/config.json` has checks for that stage under `"records"`, the record must pass them; the gate script checks both.

### Run record (`docs/harness/runs/YYYY-MM-DD-short-slug.md`)

```markdown
# Run: [request in one line]

**Mode:** Feature | Fix | Chore — [why]
**Triggers:** none | schema (adds a refund_window column); ...
**Escaped:** yes — introduced by <run, PR, or release>; battery case: EC-15   (fix runs for an escaped defect only)
**Opened:** YYYY-MM-DD   **Closed:** YYYY-MM-DD
**Status:** Open | Closed | Abandoned

| Stage | Status | Record | Notes |
|---|---|---|---|
| plan | done | docs/plan.md | |
| research | done | RS-0001 | 2 proposed rules confirmed by the user |
| ... | | | |

## Approvals
The user's confirmations, with dates and their own words: open questions answered, rules confirmed, ADRs accepted, commits approved.

## Result
What changed, the checks run and their results, the review findings and how each was resolved, what remains.
```

The run record is for people; `active.json` is for the gate. Keep them in step: update both whenever a stage changes status.

## Workflow

### 1. Open the run

1. Classify the request and state the mode with its reason, and the triggers it hits with their evidence (or "none").
2. If `docs/harness/active.json` already exists, a run is open. Continue it if this request belongs to it; otherwise ask the user whether to close, abandon, or pause it. One active run at a time.
3. Create the run record and `active.json` with every stage of the mode set to `pending`, and stages outside the mode left out.

### 2. Run the pre-code stages in order

For each pre-code stage of the mode, in the table's order:

1. **Decide whether it applies.** If not, record `skipped: <reason>` (or `n/a: not installed`) and move on.
2. **Invoke its workflow** with the outputs of the earlier stages. Do not copy the workflow; follow it.
3. **Respect its gate.** A stage is `done` only when its workflow's completion criteria are met: the plan and the spec have no open questions, the checklist marks the scope Ready, the domain model says **Open Questions: None.**, and so on. Run `node harness/gate.mjs validate <stage> <record>` before recording it: it checks the record's required headings, the "Open Questions: None." line, leftover placeholders and `[NEEDS CLARIFICATION]` markers, and the word budget. When a workflow needs the user, stop and ask; the run waits.
4. **Record** the status and the record path in `active.json` and the run record.

Two stages run as gates rather than producing documents: `knowledge-gate` (consult `actions/knowledge.md` for the subject, then capture every rule confirmed along the way) and `adr-gate` (consult `actions/adr.md`, and record each architectural decision the plan needs). Run them last before code, so they see everything the earlier stages decided.

### 3. Build

When every pre-code stage is settled, run `node harness/gate.mjs status`; it must report the run as ready. Then set `dev` to `pending` work and follow `actions/dev.md`, using the recorded spec, model, scenarios, decisions, and rules as its inputs instead of rerunning their stages. `dev` uses BDD scenarios as the outer loop and `tdd` as the inner loop.

If building shows a pre-code record is wrong (a missing rule, a model that does not fit, an infeasible UI decision), set that stage back to `pending`, go back to it with the user, and continue only when it is settled again. If it shows a trigger nobody declared (the change needs a migration after all), declare it. Either way the gate script reports code edits again until the run is ready, which is intended.

### 4. Review and close

1. Run `review` on the complete diff, and resolve its findings as `dev` describes. Record `review: done`.
2. Run `qa` for a feature or fix: one scenario per acceptance criterion and per applicable battery row, each run for real with evidence. Record `qa: done` with the report; a failed scenario goes back to `dev` first.
3. With the user's approval, commit. Then run `code-review` from a fresh session on the committed diff when the mode includes it, and record the result.
4. Capture every rule and term confirmed during the run through `knowledge`, and check every architectural decision has its ADR.
5. Write the result in the run record, set its status to **Closed**, and delete `docs/harness/active.json`.

A run that the user stops is set to **Abandoned** with the reason, and `active.json` is deleted.

## Context budget

Every turn rereads the whole conversation, so a run that does all its stages in one context pays for the plan's exploration again on every line of code. The records exist so it does not have to.

- **The records are the handoff.** A stage reads the records of the earlier stages, not the conversation that produced them. Start `dev` and `code-review` from a fresh or compacted session (in Claude Code, `/compact` or a new session); the brief says so when that stage is next. Compact again after a long exploration, and start a new session (or `/clear`) for an unrelated request instead of mixing topics.
- **Spend effort where it decides.** `harness/config.json` sorts the stages under `context`: `deep` stages (plan, research, spec, strategy, ddd, uiux, adr-gate, tasks, review, code-review) decide what gets built and need the strongest model and high effort; `routine` stages (spec-checklist, reproduce, bdd, knowledge-gate, dev, qa) carry out what the records already decided, and a faster model is enough. The brief names the tier of the next stage. Both reviews stay `deep`, since a reviewer is never on a weaker model than the author (see *Agents, models, and effort*). When dev finds the records do not decide something, that is a pre-code stage going back to `pending`, not a reason to raise the effort. Move a routine job to a cheaper model only once it has passed there repeatedly, and never save on a stage that plans or judges: rework costs more than the tokens.
- **Read through the gates.** The knowledge gate, the ADR gate, and `docs/design/RULES.md` route to the few files a task needs; read those, and the section of a long file you need, not whole folders. Never paste a repository, a lockfile, generated code, or build output into context.
- **Keep command output short.** Look at `git diff --stat` before a full diff, then read the diff one file at a time. Run tests with a quiet or failures-only reporter and cut long output to what matters (`| tail -50`, `grep -n`). A record cites what a command showed ("42 passed"), never the whole log. When debugging a failure from its logs, read them in full: compressed output (a wrapper such as RTK, a summary reporter) is lossy, and the line it drops is often the cause.
- **Brief sub-agents tightly.** A sub-agent (the code-review axes, the QA fresh agent, a search) gets the goal, the files, and what done looks like, and returns a conclusion, not file dumps. Records and the questions you put to the user stay in full sentences: terse writing saves the most where the reader can infer least. So does every summary a later stage works from: the conversation is the agent's working memory, and replies trimmed to keywords leave it nothing to reason from.
- **Add agents for risk, not size.** Every sub-agent and role agent reads its own context from the start, so a team costs a multiple of one agent. Add one for a distinct risk axis (data, permissions, money, public contract, concurrency), never because the change is big.
- **Audit what loads before the first prompt.** Instruction files (AGENTS.md, CLAUDE.md), MCP tool schemas, and hooks are paid on every session. When a session starts expensive, look (in Claude Code, `/context`), keep AGENTS.md and CLAUDE.md as routing tables that point to files rather than manuals, and turn off MCP servers the project does not use. A code index or search tool (such as CodeGraph) saves the reading that finds a file, not the reading of the file; it is a second source of truth that goes stale, and a query can land in a module without loading the rules that govern it, which the territory reminder covers.

## The gate script

`harness/gate.mjs` has no dependencies beyond Node.js and runs in two ways:

- **As a Claude Code hook.** The installer can add a `PreToolUse` hook to `.claude/settings.json` that runs it before every file edit. An edit to a guarded path while the run is not ready gets a warning (shown to you and to the agent, once per session for the same problems), or is refused when `"enforce"` is `"block"`.
- **From the command line**, for any tool, a git pre-commit hook, or CI:
  - `node harness/gate.mjs status` — prints the active run and what is still pending, and what git shows: guarded files already changed, committed or not, since the run opened. `active.json` says what was recorded; git says what happened.
  - `node harness/gate.mjs check [paths...]` — reports any of the paths (default: the files staged in git) that is guarded while the run is not ready; it exits with an error only when `"enforce"` is `"block"`.
  - `node harness/gate.mjs validate <stage> <record>` — checks one record against the stage's checks.
  - `node harness/gate.mjs escapes` — escaped defects per month.
  - `node harness/gate.mjs scope [--base origin/main]` — the modules (first two folders of a path; `scope.depth` in the config) the branch touched that no record of the run names. Run it before `review` and before the pull request: a module in the list is a question, not a failure. Claim it in the plan or tasks record, or move its change to its own pull request. A stray module usually comes from a merge resolved wrong or a fix committed to the wrong branch.

### Warn or block

`"enforce"` is `"warn"` by default. A hook that blocks needs irreversible damage on the other side: a leaked secret, a hand-written migration, a force push. Skipping a stage is recoverable, and a gate that blocks recoverable mistakes gets switched off by the first person it stops twice, after which it protects nothing. So the gate tells the agent what is pending and lets the user see it; the run record and the review catch what is left. Set `"block"` only when the team has agreed to it, and use the guards group for the damage that does not come back.

When the Skills Code Kit MCP server is installed, prefer its tools to editing the files by hand: `harness_open_run` (with the triggers, and `escapedFrom` for an escaped defect), `harness_declare_triggers`, `harness_set_stage` (it refuses `done` when the record is missing or fails its checks, and `skipped` without a reason, and keeps the run record and `active.json` in step), `harness_status`, and `harness_close_run` (with `batteryCase` for an escaped defect).

`harness/config.json` sets what is guarded, what each mode and trigger requires, and how each record is checked:

```json
{
  "enforce": "warn",
  "state": "docs/harness/active.json",
  "guarded": ["src/**", "lib/**", "app/**", "packages/**", "server/**", "client/**", "test/**", "tests/**"],
  "unguarded": ["**/*.md", "docs/**"],
  "triggers": {
    "schema": { "description": "changes a database schema, a migration, or persisted data", "paths": ["**/migrations/**", "**/*.prisma"] },
    "concurrency": { "description": "two requests, jobs, or users can race on the same data", "paths": [] }
  },
  "modes": {
    "feature": { "stages": ["plan", "research", "spec", "spec-checklist", "strategy", "bdd", "uiux", "knowledge-gate", "adr-gate"], "triggered": ["ddd", "tasks"] },
    "fix": { "stages": ["reproduce", "knowledge-gate", "adr-gate"], "triggered": ["spec", "ddd", "tasks"] },
    "chore": { "stages": ["adr-gate"], "triggered": [] }
  },
  "records": {
    "spec": { "headings": ["Problem Statement", "Functional Requirements", "Edge Cases", "Success Criteria"], "forbid": ["[NEEDS CLARIFICATION"], "maxWords": 3000 },
    "ddd": { "headings": ["Bounded Context", "Ubiquitous Language", "Invariants"], "require": ["Open Questions: None."], "maxWords": 2500 },
    "tasks": { "blocks": { "pattern": "^#{2,4} TASK-\\d+", "fields": ["Files", "Change", "Verify"], "commands": ["Verify"] } },
    "qa": { "headings": ["Scenarios"], "require": ["**Verdict:** PASS"], "forbid": ["| FAIL |"] }
  }
}
```

(Abridged: the installed file lists every trigger and record check.) A record check can list `headings` the record must have, text it must `require` or must not contain (`forbid`), `blocks` (every block starting with a matching line must fill the named fields, and `commands` fields must hold a command in backticks), `limits` (at most `max` lines matching a pattern, such as three user stories per spec), and a `maxWords` budget. The budget is there because an agent reads every record of the run before writing code, and a 6,000-word spec crowds out the code it is about; when a record is over, split the work or cut repetition, and raise the budget only if the user agrees.

Adjust `guarded`, the trigger `paths`, and the record checks to the project when the run is first opened, and tell the user what changed. The gate can be switched off with `"enforce": "off"` or, for one shell, `HARNESS_GATE=off` (`warn` and `block` work there too). Only the user turns it off.

The gate is a guard against skipping stages by accident, not a security boundary: an agent can write `active.json` itself. Never mark a stage settled to get past the gate. The run record and the user's approvals are the evidence that it was.

## With the Scrum team

When `scrum/README.md` is installed, the ceremonies decide when each stage runs. The Tech Lead opens one run per backlog item in Sprint Planning (mode Feature, or Fix for a defect), declares its triggers, fills its pre-code stages from the records Refinement and Planning produced, and closes it when the item is Done. The gate then flags Dev, DBA, and DevOps tasks whose item has not been designed.

## Agents, models, and effort

Spend follows how much can go wrong, not how important the work feels:

- **Match the check to the artifact.** A doc or a record gets a factual check (do the paths, IDs, and commands it cites exist?). Code, migrations, and ambiguous requirements get an adversarial review in a fresh context.
- **One reviewer by default.** The default review is one fresh-context agent with the whole rule set. Add a second agent only for a distinct risk axis (data, permissions, money, public contract, concurrency), never just because the diff is big; a big diff is split, not multiplied (see `actions/code-review.md`).
- **The reviewer is never on a weaker model than the author.** A review cheaper than the work it judges approves what it cannot see.
- **Diagnose a miss before escalating.** When an agent got something wrong, ask whether it did not know (it lacked the context or the capability: give it the missing file, or a stronger model) or did not try (it skipped a step it could do: raise the effort, or make the step a check). Changing the model for a "did not try" miss changes nothing.

## Guardrails

- Never mark a stage `done` before its workflow's completion criteria are met, or `skipped` without a reason.
- Never edit `active.json` to get around the gate, or turn the gate off, without the user asking. A warning is not permission: settle what it lists, or tell the user why the edit cannot wait.
- Never leave out a trigger to keep the run light; declare it with its evidence.
- Never commit, push, or merge without the user's approval.
- Never run a stage's workflow from memory; read and follow the installed file.
- Keep one active run at a time, and never delete a run record.
- Preserve unrelated user changes in the repository.

## Completion criteria

A run is complete when every stage of its mode is `done`, `skipped` with a reason, or `n/a`; each `done` stage links to its record; the review findings are resolved or reported; the confirmed rules and decisions are captured in the knowledge base and the ADRs; the run record has its result and status **Closed**; and `docs/harness/active.json` is gone.
