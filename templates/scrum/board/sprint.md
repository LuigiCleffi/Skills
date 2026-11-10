# Sprint NN

Copied to `docs/scrum/sprints/sprint-NN.md` by the PM when Sprint Planning starts. Each section names the role that writes it.

- **Status:** Planning | Active | Review | Closed
- **Item limit:** _3 to 5 items_ (PM)
- **Sprint Goal:** _One sentence on the outcome this sprint delivers for the user._ (PO)

## Approvals (PM records)

Record the date and the user's own words. Silence is not approval.

| Gate | Date | Subject | User's answer |
|---|---|---|---|
| G1 — Backlog and Sprint Goal | | | |

Add one row per G2 (ADR), G3 (Sprint Review), and G4 (commit or merge).

## Selected items (PO)

| ID | Title | Acceptance criteria |
|---|---|---|
| PBI-001 | | `backlog.md#pbi-001` |

## Task board (Tech Lead creates; owners move)

**Status:** To Do → Doing → Review → Done, or Blocked with a reason.
Owners move their own tasks up to Review; only the Tech Lead moves Review to Done.

| ID | Item | Task | Owner | Status | Note |
|---|---|---|---|---|---|
| T-001-1 | PBI-001 | _Clear output, e.g. "migration adds orders.status with rollback"_ | DBA | To Do | |
| T-001-2 | PBI-001 | | Dev | To Do | |

## Daily log (PM)

One entry per Daily Scrum, newest last.

### _Date or session_

- **[Dev]** Moved: _…_ Next: _…_ Blocked by: _nothing_
- **[DBA]** Moved: _…_ Next: _…_ Blocked by: _nothing_
- **[DevOps]** Moved: _…_ Next: _…_ Blocked by: _nothing_
- **Toward the Sprint Goal:** _on track / at risk, and why_

## Impediments (PM)

| Opened | Task | Owner | Impediment | Routed to | Closed | Resolution |
|---|---|---|---|---|---|---|

## Sprint Review (PM facilitates; PO asks G3)

- **Demo:** _how the increment was run and what was shown_
- **Results:**

| ID | Meets Definition of Done | User's decision | Follow-up |
|---|---|---|---|

- **Backlog changes:** _items added, reordered, or returned_

## Retrospective (PM)

- **Helped:** _…_
- **Hurt:** _…_
- **Improvements (at most three, each with an owner role):**
  1. _…_ — owner: _role_ — goes to: `agreements.md` | backlog

## Metrics (PM, at close)

- Items committed: _n_ — accepted: _n_ — rejected: _n_ — returned to backlog: _n_
- Tasks that were Blocked: _n_, longest block: _…_
