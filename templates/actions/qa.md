---
name: qa
description: "Try to break a finished change before it reaches review of the commit or a person: one scenario per acceptance criterion, plus every row of the edge-case battery (docs/qa/edge-cases.md) that applies, each run for real (a test command, a Playwright or browser run, or exact manual steps) and recorded with its evidence in docs/qa/reports/. A failed scenario goes back to dev. Use after dev and review, before code-review and the pull request; for a QA person, to rerun the scenarios of a branch and get the report to check by hand."
---

# qa — Prove It Works, Scenario by Scenario

## Purpose and ownership

Tests written while building show that the code does what the developer understood. `qa` checks what was asked: every acceptance criterion and every known way this project breaks, run against the finished change, with evidence anyone can check again. The common failure it catches is a plausible implementation that does not handle an edge case.

`qa` owns `docs/qa/reports/`. It does not change production code or tests: a failure goes back to `dev`, which fixes it and asks for `qa` again.

## Inputs

- The acceptance criteria: the spec's user stories and scenarios (`SpecifyRequirements.md`), the feature files from `bdd`, the UI acceptance checks in `UIUXDecisions.md`, or, without a spec, the criteria in the task.
- The edge-case battery, `docs/qa/edge-cases.md`, when it exists.
- The branch with the change, built and runnable.

## Workflow

### 1. List the scenarios

Write one scenario per acceptance criterion, with the criterion's ID as its source (`US-1 AC-2`, `FR-04`, the scenario name from the feature file). Then add every battery row whose "Applies when" matches the change (`EC-06`). A row that matches but cannot apply here is listed as not applicable, with the reason.

Each scenario says what to do and what must happen, in the words a person testing the screen or the API would use.

Before the battery, write the answers to three questions about this change in the report, and add a scenario for each answer that is not covered yet:

1. **What is the worst value its input accepts?** For each field the change reads, shows, or stores: empty, the longest allowed, another language's characters, zero, negative, a date at the edge of a month or a time zone, a duplicate.
2. **What changes between two runs?** The clock, the order of results, randomness, retries, two requests at once, a cache.
3. **Who else goes through this code?** Other roles and tenants, another tab or device, and the consumers the diff does not touch: search the callers of what changed (`git grep -n "<function or endpoint>"`) and add a scenario for each one whose behavior could change.

When time is short, order the scenarios by risk (money, permissions, data loss, other tenants' data first) and say which ones were not run.

### 2. Check the change against the tasks

Before running anything, compare what changed with what was planned. With the harness, run `node harness/gate.mjs scope`; without it, compare `git diff --name-only <base>...HEAD` with the files the tasks name. Two lists come out:

- **MISSING CHANGE**: a file a task names that the branch never changed. A task may be undone; find out before testing the behavior it was meant to add.
- **UNEXPECTED CHANGE**: a module the branch changed that no task names. Ask whether it belongs: a merge resolved wrong or a fix committed to the wrong branch shows up here.

Write both lists in the report. Neither is a failure by itself, but each item needs an answer: done elsewhere, claimed in the plan, or sent back to `dev`.

### 3. Run each one for real

Choose the most direct way that proves the behavior, in this order:

1. **An automated test that already covers it** (from `tdd` or `bdd`): run it and record the command and its result.
2. **A browser run** for anything a user sees: Playwright when the project has it, otherwise your own browser tools. Take a screenshot of the state that proves the result and save it under `docs/qa/reports/<report>/`.
3. **An API or command-line call** for behavior without a screen: record the exact request and the relevant part of the response.
4. **Exact manual steps** only when none of the above can run here: write them so a person can follow them, and mark the result `MANUAL` until someone does.

Never mark a scenario passed because the code looks right. Never edit a test to make a scenario pass.

A result says what the proof varied: not "ok", but "refunded on day 30 and refused on day 31". A passed scenario on something risky (authentication, permissions, another tenant's data, money, a migration, a deletion) must also be shown to **fail without the change**: run the same scenario on the base, in a separate worktree (`git worktree add ../base-check $(git merge-base origin/main HEAD)`), or with the change reverted in a scratch commit. A test that passes on both sides tests nothing; say so and fix the scenario.

Put every command you ran, in order, in `docs/qa/reports/<report>/run.sh`, one comment line per scenario ID above its commands, so anyone can rerun the proof and get the same results:

```bash
#!/usr/bin/env bash
# Rerun the QA of feature/refund-window. Needs the app running (npm run dev).
set -euo pipefail

# QA-01 Refund within 30 days is accepted
npm test -- refunds

# QA-03 Another store's order ID shows "not found"
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $STORE_B_TOKEN" http://localhost:3000/orders/123
```

Browser runs go in as the Playwright command that runs them. Manual steps stay in the report, not in the script. Never put real credentials in it: read them from environment variables, and say which ones at the top.

### 4. Decide each result

- `PASS`: the observed result matches what must happen, with evidence.
- `FAIL`: it does not. Write what happened instead, with the evidence, and send it to `dev`.
- `BLOCKED`: it could not run (no seed data, a service down). Say what is missing.
- `MANUAL`: it needs a person; the steps are in the report.
- `NOT VERIFIED`: it was not run, for lack of time or access. Say why. Never round it up to `PASS`.

When the diff touches screens, run `actions/ui-review.md` (when installed) and add its findings to the report; a Critical finding is a `FAIL`.

Last, check that this is what was asked: give a fresh agent (a subagent with no memory of the work) only the original request or spec and the diff, and ask: "Does this change do what was asked, all of it and nothing else? List what is missing and what was not asked for." Put its answer in the report and resolve each point.

### 5. Write the report

`docs/qa/reports/YYYY-MM-DD-short-slug.md`:

```markdown
# QA: [change in one line]

**Branch:** feature/refund-window   **Commit:** abc1234
**Verdict:** PASS | FAIL | PARTIAL
**Rerun:** `bash docs/qa/reports/2026-11-19-refund-window/run.sh`

## Change against the tasks

MISSING CHANGE: none.
UNEXPECTED CHANGE: `src/essay` (1 file): not ours, sent back to dev to move to its own pull request.

## Scenarios

| ID | Scenario | Source | How | Result | Evidence |
|---|---|---|---|---|---|
| QA-01 | Refund within 30 days is accepted | US-1 AC-1 | `npm test -- refunds` | PASS | 12 passed |
| QA-02 | Double click on "Refund" refunds once | EC-06 | Playwright | PASS | qa-02.png |
| QA-03 | Another store's order ID shows "not found" | EC-08 | API call | FAIL | 200 with the order; see below |

## Not applicable

EC-11 (390 px screen): the change has no screen.

## Failures and what is left

QA-03: GET /orders/123 as store B returned store A's order. Sent back to dev.
```

The verdict is `PASS` only when every scenario passed; `PARTIAL` when the rest passed and some are `MANUAL` or `BLOCKED` with the reason; `FAIL` otherwise.

### 6. Hand back

On `FAIL`, hand the failures to `dev` and run `qa` again on the fix: rerun the failed scenarios and the ones near them. On `PASS`, the change goes on to `code-review` and the pull request; the pull request's "How to test it?" steps can come from the scenarios.

When a scenario fails because of a kind of input the battery does not list, propose a new battery row with it.

## With the harness

`qa` is a post-code stage of feature and fix runs, after `review` and before `code-review`. Record it done with the report as its record; the gate checks that the report says **Verdict:** PASS and has no `FAIL` row. A `PARTIAL` report can close the run only if the user accepts the manual or blocked scenarios: record that in the run's approvals and set the stage `skipped: <reason>` for what is left.

## Guardrails

- Never change production code or tests; report.
- Never mark a scenario passed without running it, or a run without its evidence.
- Never test against production or with real customer data.
- Keep evidence small: the screenshot or output lines that prove the result, not whole logs.

## Completion criteria

`qa` is complete when the change was checked against the tasks and every MISSING or UNEXPECTED item has an answer, every acceptance criterion and every applicable battery row has a scenario, every scenario has a result with its evidence or the reason it could not run, `run.sh` reruns every automated scenario, the report has its verdict, and every failure is back with `dev`.
