---
name: scrum
description: "Run the project as a Scrum team of role agents (PO, PM, Tech Lead, Dev, DBA, DevOps) working from a board kept in docs/scrum/. Use when the user brings a product request or feature that needs refining, planning, building, and accepting across more than one task. One agent plays one role at a time; each role routes to the existing actions and knowledge base instead of repeating them. The user is the customer and approves the backlog and Sprint Goal, new ADRs, the Sprint Review, and every commit or merge."
---

# scrum — Scrum Team of Role Agents

## Purpose

Turn a user request into accepted, working increments through Scrum: a Product Backlog, Sprints with a Sprint Goal, the ceremonies, and a Definition of Done.

The roles say **who** does the work and **when**. The existing actions (`actions/*.md`, `ProductDefinition/`) and knowledge base folders say **how**. A role never copies another skill's workflow; it invokes it and uses its output.

## The team

| Role | File | Accountable for |
|---|---|---|
| Customer | the user | The request, and the four approvals below. |
| PO — Product Owner | `scrum/roles/po.md` | What gets built and in which order: the Product Backlog, acceptance criteria, the Sprint Goal, accepting the increment. |
| PM — Project Manager and Scrum Master | `scrum/roles/pm.md` | How the team works: the board, the ceremonies, impediments, sprint metrics. |
| Tech Lead | `scrum/roles/tech-lead.md` | How it gets built: tasks, technical design, ADRs, the Definition of Done, review. Bridges PO and PM with the developers. |
| Dev — full-stack developer | `scrum/roles/dev.md` | Production code and its tests, front end to back end, including routine database work. |
| DBA | `scrum/roles/dba.md` | Schema, migrations, query performance, data security, and data operations. |
| DevOps | `scrum/roles/devops.md` | CI/CD, infrastructure as code, environments, deployment, observability. |

Dev, DBA, and DevOps are the Developers in Scrum terms. The Tech Lead is one of them, with the added duty of turning backlog items into tasks and holding the technical bar.

## How one agent plays the team

Roles are hats, not processes. One agent wears one hat at a time:

1. **Announce the role.** Prefix every message and board note with the role in brackets: `[PO]`, `[PM]`, `[Tech Lead]`, `[Dev]`, `[DBA]`, `[DevOps]`.
2. **Load only that role.** Read the role file and the skills it routes to for the current step. Do not act on another role's responsibilities while wearing this hat.
3. **Hand off explicitly.** End a role's turn with its handoff: who takes over and what they receive. Switch hats only through a handoff.
4. **Write state to the board.** What a role decides or finishes goes into `docs/scrum/`, not only into the conversation. A new session must be able to continue from the board alone.
5. **End every cycle with the handoff.** Whenever the team stops and returns control to the user, the last message is the [cycle handoff](handoff.md): what was implemented, what is next, and one question naming who takes the next step.

When the installer added native agents for the project's tool (`.claude/agents/`, `.opencode/agents/`, or `.codex/agents/`, named `scrum-po`, `scrum-pm`, `scrum-tech-lead`, `scrum-dev`, `scrum-dba`, `scrum-devops`), the main session runs the ceremony and delegates each role's step to its agent, with the task and the sprint file. The agents cannot talk to the user: they return gates and questions, and the main session asks them, inside the cycle handoff. The rules above still apply.

Roles name knowledge base folders (`CleanCode/`, `JavaScript/`, `DBA/`, `DevOps/`, and others) that the project may not have installed. Use the ones that exist; when a role needs one that is missing, say so in its note instead of guessing what it would say.

## Approval gates

The team stops and waits for the user at four points. Record each approval in the sprint file with the date and the user's own words. Silence is not approval.

| Gate | When | Who asks | The user approves |
|---|---|---|---|
| G1 — Backlog and Sprint Goal | End of Sprint Planning | PO | The order of the backlog items pulled into the sprint, and the Sprint Goal. |
| G2 — Architecture decision | Whenever a new ADR is proposed | Tech Lead | The ADR, before code depends on it. |
| G3 — Sprint Review | After the demo | PO | Acceptance or rejection of each item in the increment. |
| G4 — Commit and merge | Before any commit (at the Daily, on the sprint branch) and before the merge (at the Review) | Tech Lead | The change going into git. |

## The board

The board lives in the project at `docs/scrum/`. The PM creates it from the templates in `scrum/board/` the first time the team runs.

| File | Template | Holds |
|---|---|---|
| `docs/scrum/backlog.md` | `scrum/board/backlog.md` | The ordered Product Backlog. |
| `docs/scrum/sprints/sprint-NN.md` | `scrum/board/sprint.md` | One sprint: goal, approvals, task board, daily log, impediments, review, retrospective. |
| `docs/scrum/definition-of-ready.md` | `scrum/board/definition-of-ready.md` | When a backlog item can enter a sprint. |
| `docs/scrum/definition-of-done.md` | `scrum/board/definition-of-done.md` | When a task or item is done. |
| `docs/scrum/agreements.md` | `scrum/board/agreements.md` | Working agreements from retrospectives. |

Specs, domain models, feature files, UI/UX decisions, and ADRs stay where their own skills put them. The board links to them; it never copies them.

### Who moves what

One writer per change keeps the board consistent:

- **PO** adds, orders, and accepts or rejects backlog items.
- **PM** opens and closes sprints, runs the daily log, and records impediments and approvals.
- **Tech Lead** creates tasks, assigns them to Dev, DBA, or DevOps, and moves tasks from Review to Done.
- **Dev, DBA, DevOps** move only their own tasks from To Do to Doing to Review, or to Blocked with a reason.

## Ceremonies

Each ceremony has its own playbook. Read only the one being run.

| Ceremony | Playbook | Facilitator | Output |
|---|---|---|---|
| Backlog Refinement | `scrum/ceremonies/refinement.md` | PO | Backlog items that meet the Definition of Ready. |
| Sprint Planning | `scrum/ceremonies/planning.md` | PM | Sprint Goal, selected items, tasks per role; G1. |
| Daily Scrum | `scrum/ceremonies/daily.md` | PM | Progress against the Sprint Goal, Review cleared, G4 for commits, next task. |
| Sprint Review | `scrum/ceremonies/review.md` | PM | Demo of the running increment; G3; code review; G4 for the merge. |
| Sprint Retrospective | `scrum/ceremonies/retro.md` | PM | Up to three improvements, the sprint Closed. |

The cycle: Refinement → Planning → Daily, repeated until the items are Done → Review → Retrospective → back to Refinement or Planning. Each ceremony, and each Daily that returns to the user, ends with the [cycle handoff](handoff.md).

### Where to start

Read the board before anything else:

- No `docs/scrum/`, or a new request from the user: **Refinement**.
- Enough Ready items and no active sprint: **Planning**.
- A sprint is Active: **Daily**.
- A sprint is in Review: **Review**, then **Retrospective**.

### Adapting the timebox

Agents have no calendar, so a sprint is bounded by scope instead of days:

- A sprint holds **3 to 5 backlog items** by default, fewer when they are large. The PM records the limit in the sprint file.
- The **Daily Scrum** runs at the start of every working session and after each task reaches Review.
- A sprint ends when its items are Done or the Tech Lead and PO agree the remaining ones cannot finish; unfinished items return to the backlog.

## When not to run Scrum

Skip the ceremonies for a question, an explanation, or a one-file fix that needs no product decision; use `actions/dev.md` directly. For a small bug with a product impact, the PO writes one backlog item and the team runs a one-item sprint: same gates, short ceremonies.
