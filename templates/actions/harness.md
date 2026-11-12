---
name: harness
description: "Run a change through the whole spec-driven workflow in order, and keep the evidence: classify the request (feature, fix, or chore), open a run in docs/harness/, run each stage the mode needs (plan, research, spec-definition, spec-checklist, strategy, ddd, bdd, uiux, the knowledge and ADR gates, dev with tdd, review, code-review), record each stage as done with its record, or skipped with a reason, and close the run. Keeps docs/harness/active.json, which the installed gate script (harness/gate.mjs) reads to block edits to production code and tests until every pre-code stage is settled. Use for any request that will change guarded code; for a question or a change to docs only, no run is needed."
---

# harness — Spec-Driven Delivery, Enforced

## Purpose and ownership

Each workflow in this kit is good on its own. Without something that runs them in order, an agent under pressure skips to the code, and the spec, the model, the scenarios, and the gates become optional. `harness` is that something:

- It **classifies** the request and picks the stages it needs.
- It **runs** them in order, invoking each workflow instead of repeating it.
- It **records** every stage in a run file: done with the record it produced, or skipped with a reason. Nothing is skipped silently.
- It **enforces** the order. `docs/harness/active.json` tells the gate script which run is active and which stages are settled; until every pre-code stage is, edits to guarded paths (production code and tests) are blocked.

`harness` owns `docs/harness/` and `harness/config.json`. It does not write specs, models, scenarios, decisions, or code itself; the stage workflows do.

## The stages

| # | Stage | Workflow | Produces | Feature | Fix | Chore |
|---|---|---|---|---|---|---|
| 1 | `plan` | `ProductDefinition/plan.md` | product plan | ● | | |
| 2 | `research` | `actions/research.md` | RS notes, proposed rules, questions | ● | | |
| 3 | `spec` | `ProductDefinition/specs/spec-definition.md` | `SpecifyRequirements.md` | ● | | |
| 4 | `spec-checklist` | `ProductDefinition/specs/spec-checklist.md` | checklist, all items Ready | ● | | |
| 5 | `reproduce` | `actions/tdd.md` | a failing test or exact reproduction steps | | ● | |
| 6 | `strategy` | `actions/strategy.md` | `StrategyBrief.md` | ● | | |
| 7 | `ddd` | `actions/ddd.md` | `DomainModel.md`, glossary | ● | | |
| 8 | `bdd` | `actions/bdd.md` | feature files, failing scenarios | ● | | |
| 9 | `uiux` | `actions/uiux.md` | `UIUXDecisions.md` | ● | | |
| 10 | `knowledge-gate` | `actions/knowledge.md` | rules consulted | ● | ● | |
| 11 | `adr-gate` | `actions/adr.md` | ADRs consulted or recorded | ● | ● | ● |
| 12 | `dev` | `actions/dev.md` + `actions/tdd.md` | code, tests, checks run | ● | ● | ● |
| 13 | `review` | `actions/review.md` | findings resolved | ● | ● | ● |
| 14 | `code-review` | `actions/code-review.md` | review of the committed diff | ● | ● | |

● = the stage is in the mode. Stages 1 to 11 are the **pre-code stages**: the gate script requires each one in the mode to be settled before guarded code can change. The modes and their stages are defined in `harness/config.json`, so a project can tighten or loosen them.

A stage whose workflow is not installed is recorded `n/a: not installed`. A stage that does not apply is recorded `skipped: <reason>` ("skipped: no user-facing surface"). A stage is never skipped without a reason, and `dev` follows the reasons the workflows themselves give for skipping (for example "DDD: not applicable").

## Modes

Choose the mode from the request and tell the user which one and why. When in doubt, choose the stricter mode.

- **Feature:** new or changed behavior a user or another system will notice.
- **Fix:** existing behavior is wrong against an existing spec, rule, or contract. If fixing it needs a new rule or changes agreed behavior, it is a feature.
- **Chore:** no behavior change: dependencies, build, refactoring under green tests, configuration, tooling.

No run is needed for a question, an explanation, or a change to documentation only.

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

Each stage value is `pending`, `done`, `skipped: <reason>`, or `n/a: <reason>`. A stage marked `done` that lists a record must point to a file that exists; the gate script checks it.

### Run record (`docs/harness/runs/YYYY-MM-DD-short-slug.md`)

```markdown
# Run: [request in one line]

**Mode:** Feature | Fix | Chore — [why]
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

1. Classify the request and state the mode with its reason.
2. If `docs/harness/active.json` already exists, a run is open. Continue it if this request belongs to it; otherwise ask the user whether to close, abandon, or pause it. One active run at a time.
3. Create the run record and `active.json` with every stage of the mode set to `pending`, and stages outside the mode left out.

### 2. Run the pre-code stages in order

For each pre-code stage of the mode, in the table's order:

1. **Decide whether it applies.** If not, record `skipped: <reason>` (or `n/a: not installed`) and move on.
2. **Invoke its workflow** with the outputs of the earlier stages. Do not copy the workflow; follow it.
3. **Respect its gate.** A stage is `done` only when its workflow's completion criteria are met: the plan and the spec have no open questions, the checklist marks the scope Ready, the domain model says **Open Questions: None.**, and so on. When a workflow needs the user, stop and ask; the run waits.
4. **Record** the status and the record path in `active.json` and the run record.

Two stages run as gates rather than producing documents: `knowledge-gate` (consult `actions/knowledge.md` for the subject, then capture every rule confirmed along the way) and `adr-gate` (consult `actions/adr.md`, and record each architectural decision the plan needs). Run them last before code, so they see everything the earlier stages decided.

### 3. Build

When every pre-code stage is settled, run `node harness/gate.mjs status`; it must report the run as ready. Then set `dev` to `pending` work and follow `actions/dev.md`, using the recorded spec, model, scenarios, decisions, and rules as its inputs instead of rerunning their stages. `dev` uses BDD scenarios as the outer loop and `tdd` as the inner loop.

If building shows a pre-code record is wrong (a missing rule, a model that does not fit, an infeasible UI decision), set that stage back to `pending`, go back to it with the user, and continue only when it is settled again. The gate script then blocks code edits again until it is, which is intended.

### 4. Review and close

1. Run `review` on the complete diff, and resolve its findings as `dev` describes. Record `review: done`.
2. With the user's approval, commit. Then run `code-review` from a fresh session on the committed diff when the mode includes it, and record the result.
3. Capture every rule and term confirmed during the run through `knowledge`, and check every architectural decision has its ADR.
4. Write the result in the run record, set its status to **Closed**, and delete `docs/harness/active.json`.

A run that the user stops is set to **Abandoned** with the reason, and `active.json` is deleted.

## The gate script

`harness/gate.mjs` has no dependencies beyond Node.js and runs in two ways:

- **As a Claude Code hook.** The installer can add a `PreToolUse` hook to `.claude/settings.json` that runs it before every file edit. An edit to a guarded path is blocked, with the reason shown to the agent, unless an active run has every pre-code stage of its mode settled.
- **From the command line**, for any tool, a git pre-commit hook, or CI:
  - `node harness/gate.mjs status` — prints the active run and what is still pending.
  - `node harness/gate.mjs check [paths...]` — exits with an error when any of the paths (default: the files staged in git) is guarded and the run is not ready.

When the Skills Code Kit MCP server is installed, prefer its tools to editing the files by hand: `harness_open_run`, `harness_set_stage` (it refuses `done` without an existing record and `skipped` without a reason, and keeps the run record and `active.json` in step), `harness_status`, and `harness_close_run`.

`harness/config.json` sets what is guarded and what each mode requires:

```json
{
  "enforce": true,
  "state": "docs/harness/active.json",
  "guarded": ["src/**", "lib/**", "app/**", "packages/**", "server/**", "client/**", "test/**", "tests/**"],
  "unguarded": ["**/*.md", "docs/**"],
  "modes": {
    "feature": ["plan", "research", "spec", "spec-checklist", "strategy", "ddd", "bdd", "uiux", "knowledge-gate", "adr-gate"],
    "fix": ["reproduce", "knowledge-gate", "adr-gate"],
    "chore": ["adr-gate"]
  }
}
```

Adjust `guarded` to the project's real source and test folders when the run is first opened, and tell the user what changed. The gate can be switched off with `"enforce": false` or, for one shell, `HARNESS_GATE=off`. Only the user turns it off.

The gate is a guard against skipping stages by accident, not a security boundary: an agent can write `active.json` itself. Never mark a stage settled to get past the gate. The run record and the user's approvals are the evidence that it was.

## With the Scrum team

When `scrum/README.md` is installed, the ceremonies decide when each stage runs. The Tech Lead opens one run per backlog item in Sprint Planning (mode Feature, or Fix for a defect), fills its pre-code stages from the records Refinement and Planning produced, and closes it when the item is Done. The gate then blocks Dev, DBA, and DevOps tasks whose item has not been designed.

## Guardrails

- Never mark a stage `done` before its workflow's completion criteria are met, or `skipped` without a reason.
- Never edit `active.json` to get around the gate, or turn the gate off, without the user asking.
- Never commit, push, or merge without the user's approval.
- Never run a stage's workflow from memory; read and follow the installed file.
- Keep one active run at a time, and never delete a run record.
- Preserve unrelated user changes in the repository.

## Completion criteria

A run is complete when every stage of its mode is `done`, `skipped` with a reason, or `n/a`; each `done` stage links to its record; the review findings are resolved or reported; the confirmed rules and decisions are captured in the knowledge base and the ADRs; the run record has its result and status **Closed**; and `docs/harness/active.json` is gone.
