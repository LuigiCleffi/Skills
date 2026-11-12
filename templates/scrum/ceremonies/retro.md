---
name: scrum-retro
description: "Sprint Retrospective ceremony of the Scrum team. After the Sprint Review, the PM asks each role what helped, what hurt, and what to change, using the sprint's log, impediments, and metrics as evidence; keeps at most three concrete improvements, each with an owner role, as working agreements or backlog items; and closes the sprint."
---

# Sprint Retrospective

## Purpose

Improve how the team works. The retrospective looks at the process, the tools, the instructions, and the agreements, not at the product, which the Sprint Review covered.

| | |
|---|---|
| **Facilitator** | PM |
| **With** | PO, Tech Lead, Dev, DBA, DevOps; the user is welcome but not required |
| **When** | Right after the Sprint Review |
| **Input** | The sprint file: daily log, impediments, approvals, review results, metrics; `docs/scrum/agreements.md` |
| **Output** | Up to three improvements recorded; the sprint Closed |

## Steps

1. **[PM] Show the evidence.** Summarize the sprint from the file: items committed and accepted, tasks blocked and for how long, review findings sent back, gates that waited, rework after the review.
2. **[Each role] Report.** In one or two lines each, grounded in the evidence: what helped, what hurt. Name a concrete event, not a general feeling.
3. **[PM] Check the agreements.** For each existing agreement: did it help? Keep, change, or remove it.
4. **[PM] Pick improvements.** At most three, the ones that would have prevented the biggest problems this sprint. Each has:
   - A concrete change: "the DBA reviews migrations before Dev starts the task that depends on them", not "communicate better".
   - An owner role.
   - Where it goes: `docs/scrum/agreements.md` for a way of working; the backlog, through the PO, for work such as a missing test script or pipeline step; `docs/scrum/definition-of-ready.md` or `definition-of-done.md` for a check that was missing.
5. **[PM] Record and close.** Write the retrospective section of the sprint file, update the agreements, and set the sprint to Closed.
6. **[PM] Hand off.** Tell the user with the [cycle handoff](../handoff.md), cycle `NN.Retro`: what the sprint delivered, what the team will change, and the next ceremony as step 1.

## Exit

- The sprint file is complete and Closed.
- Each improvement has an owner and a place where the next sprint will see it.

The next sprint starts with [Backlog Refinement](refinement.md) if fewer items are Ready than its limit, otherwise with [Sprint Planning](planning.md).
