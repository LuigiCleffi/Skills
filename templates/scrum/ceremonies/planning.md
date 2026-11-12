---
name: scrum-planning
description: "Sprint Planning ceremony of the Scrum team. The PM opens the sprint file, the PO proposes the Sprint Goal and the Ready items that serve it, the Tech Lead designs them (ADR gate, ddd, uiux) and breaks them into tasks owned by Dev, DBA, or DevOps, and the user approves the backlog and Sprint Goal (G1) before any work starts."
---

# Sprint Planning

## Purpose

Agree why this sprint matters, what it delivers, and how the team will build it, and get the user's approval before work starts.

| | |
|---|---|
| **Facilitator** | PM |
| **With** | PO, Tech Lead, Dev, DBA, DevOps; the user for G1 |
| **When** | The previous sprint is Closed, and enough items are Ready |
| **Input** | Ready items in `docs/scrum/backlog.md`, `docs/scrum/agreements.md`, records linked from the items |
| **Output** | `docs/scrum/sprints/sprint-NN.md` with the Sprint Goal, selected items, task board, and G1 recorded; status Active |

If fewer items are Ready than the sprint needs, run [Backlog Refinement](refinement.md) first.

## Steps

### Why: the Sprint Goal

1. **[PM] Open the sprint.** Copy `scrum/board/sprint.md` to `docs/scrum/sprints/sprint-NN.md`, numbering from the last sprint. Set status Planning and the item limit (3 to 5 by default). Read the working agreements aloud to the team.
2. **[PO] Propose the Sprint Goal and the items.** One sentence on the outcome for the user, and the top Ready items that serve it, within the limit. An item that does not serve the goal waits for a later sprint.

### How: design and tasks

3. **[Tech Lead] Design each item.**
   - Pass the ADR gate with what the item is about to decide or touch, and the knowledge gate (`actions/knowledge.md`) with its business subject, when installed.
   - When `actions/harness.md` is installed, open one harness run for the item and record each design step below as its stage, so the gate script lets its tasks change code only once the item is designed.
   - New or changed domain concepts or rules: `actions/ddd.md`.
   - A user-facing surface: `actions/uiux.md`.
   - A new architectural decision: propose it with `actions/adr.md` and ask the user for **G2**. Tasks that depend on it stay To Do until it is approved.
4. **[Tech Lead] Break items into tasks.** Each task has one owner role (see the assignment table in `scrum/roles/tech-lead.md`), one clear output, and its item ID. Order them so the work others depend on comes first: usually DBA and DevOps tasks, then Dev.
5. **[Dev, DBA, DevOps] Check the tasks.** Each owner confirms its tasks are clear and small enough to finish in one session, or asks the Tech Lead to split or clarify them.
6. **[Tech Lead and PO] Fit the sprint.** If the tasks show the selection is too large for the Sprint Goal, the PO drops the lowest-value items; the goal changes only if the PO agrees.

### Approval

7. **[PO] Ask the user for G1.** Show the Sprint Goal, the selected items in order with their acceptance criteria, and a one-line summary of the tasks. Ask one question: approve, or what to change.
8. **[PM] Record and start.** Record the user's answer in the Approvals table. If approved, set the sprint to Active, the selected items to In Sprint, and run the first [Daily Scrum](daily.md). If changes were requested, return to the step they affect.

## Exit

- G1 is recorded with the user's words.
- Every selected item has tasks with an owner, and every task blocked by a pending G2 is marked so.
