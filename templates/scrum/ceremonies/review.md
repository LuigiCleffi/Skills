---
name: scrum-review
description: "Sprint Review ceremony of the Scrum team. The team demos the running increment, the PO checks each item against its acceptance criteria, the user accepts or rejects each item (item acceptance), the Tech Lead runs code-review on the sprint branch from a fresh session, and the user approves the merge (merge approval). The PO updates the backlog with what was learned."
---

# Sprint Review

## Purpose

Show the user what the sprint built, working, and decide together what happens next. The user inspects the increment; the backlog adapts to what they say.

| | |
|---|---|
| **Facilitator** | PM |
| **With** | PO, the user, Tech Lead, Dev, DBA, DevOps |
| **When** | The sprint is set to Review |
| **Input** | The active sprint file, the sprint branch, the items' acceptance criteria |
| **Output** | The item acceptance decision per item, the backlog updated, and the sprint branch merged or held with a reason |

## Steps

### Prepare

1. **[Tech Lead] Confirm Done.** Every item shown must meet `docs/scrum/definition-of-done.md`. Items that do not are listed as not done; they are not demoed.
2. **[DevOps] Run the increment.** Start the application from the sprint branch the way the project runs it. If it does not start, that is the first finding of the review.

### Numbers of the sprint

When `tools/cycle-metrics.mjs` is installed, the PM runs `node tools/cycle-metrics.mjs --since <sprint start> --until <sprint end> --markdown` and adds the table to the sprint record: pull requests merged, time to merge, time to a first look, pull requests nobody else looked at, size, CI failures, reverts, releases, and escaped defects, each next to the previous sprint of the same length. Every number in the review comes from that table; a number it could not read stays "n/a" and is never estimated. The three that got worst become questions for the retrospective.

### Demo and accept

3. **[Dev, DBA, DevOps] Demo.** For each Done item, walk its acceptance criteria one by one in the running application: the action and the observed result. Use the browser or API, not a description of the code. The DBA shows migrations forward and back when an item changed the schema.
4. **[PO] Check the criteria.** Mark each criterion met or not met, with what was observed.
5. **[PO] Ask the user to accept or reject each item.** For each item: what was asked, what was shown, and whether each criterion was met. Ask the user to accept or reject each item, and for any feedback.
6. **[PM] Record.** Write each decision in the sprint's Review section and in the Approvals table, with the user's words.

### Update the backlog

7. **[PO] Adapt the backlog.**
   - Accepted items: status Accepted.
   - Rejected items: status Rejected, with the reason. The PO decides with the user whether to rework them as a new item or remove the change. Removing it is a revert the Tech Lead proposes and asks the user to approve before committing it.
   - Not done items: back to Ready or Refined, at the order the PO chooses.
   - New ideas from the user's feedback: new items, status New.

### Review the code and merge

8. **[Tech Lead] Run `actions/code-review.md`** from a fresh session on the sprint branch against the main branch. Blocking findings become tasks for the next sprint, or are fixed now if the user prefers, with a new commit approval for the fix.
9. **[Tech Lead] Ask the user for merge approval.** Show the accepted items, the code-review result, and any reverts. Merge or open a pull request only after the user approves; never push or merge on the team's own initiative. Write the pull request from `.github/pull_request_template.md`, following "Pull Requests" in `AGENTS.md`; the demo steps are its "How to test it?" steps.
10. **[PM] Close the review.** Fill the sprint's Metrics and hand off to the [Retrospective](retro.md).

## Exit

- Every item in the sprint has an accept or reject decision from the user or a "not done" mark.
- The backlog reflects the user's feedback.
- The sprint branch is merged with the user's merge approval, or held with the reason recorded.
