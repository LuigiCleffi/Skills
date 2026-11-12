---
name: scrum-daily
description: "Daily Scrum ceremony of the Scrum team, adapted to agents: run at the start of every working session and each time a task reaches Review. The PM reads the task board, each developer role reports what moved, what comes next, and what blocks it, the Tech Lead reviews tasks in Review and asks the user before commits (G4), and the team picks the next task toward the Sprint Goal."
---

# Daily Scrum

## Purpose

Inspect progress toward the Sprint Goal and decide the next step. Short by design: it exists to pick the next task and clear what blocks it, not to discuss solutions at length.

| | |
|---|---|
| **Facilitator** | PM |
| **With** | Tech Lead, Dev, DBA, DevOps |
| **When** | At the start of every working session, and each time a task reaches Review |
| **Input** | The active `docs/scrum/sprints/sprint-NN.md` |
| **Output** | A daily log entry, updated impediments, and the next task in Doing |

## Steps

1. **[PM] Read the board.** Open the active sprint file. A new session continues from the board alone; do not rely on earlier conversation.
2. **[Dev, DBA, DevOps] Report.** Each role with tasks in the sprint gives three lines: what moved since the last Daily, what it takes next, what blocks it. Roles with nothing to report are skipped.
3. **[Tech Lead] Clear Review.** For each task in Review, run `actions/review.md` on its change and check `docs/scrum/definition-of-done.md`. Send findings back to the owner (task returns to Doing) or move the task to Done.
4. **[Tech Lead] Ask for G4.** When tasks reached Done, show the user what will be committed: the tasks, the files, and the checks that ran. Ask once for the group. Commit only after the user approves, on the sprint branch `sprint-NN` (create it from the main branch on the first commit), and record G4 in the sprint file. Never push or merge here; merging waits for the [Sprint Review](review.md).
5. **[PM] Handle impediments.** Record new ones, route them (product to the PO, technical to the Tech Lead, approvals to the user), and close the ones that cleared.
6. **[PM] Check the Sprint Goal.** Write one line: on track or at risk, and why. If at risk, ask the Tech Lead and PO whether to cut scope; the PO decides.
7. **[Tech Lead] Pick the next task.** The highest-ordered To Do task whose dependencies are Done. Its owner role moves it to Doing and works it following its role file.

8. **[PM] Hand off.** When the team stops to return control to the user (a gate, a question, or the end of the session), end with the [cycle handoff](../handoff.md), using the finished task's ID as the cycle ID.

When every item is Done, or the Tech Lead and PO agree the rest cannot finish, the PM sets the sprint to Review and starts the [Sprint Review](review.md).

## Log entry

Write one entry in the sprint's Daily log, under the date or session:

```
- [Dev] Moved: T-001-2 to Review. Next: T-002-1. Blocked by: nothing
- [DBA] Moved: T-001-1 to Done. Next: nothing assigned. Blocked by: nothing
- Toward the Sprint Goal: on track, 1 of 3 items Done
```
