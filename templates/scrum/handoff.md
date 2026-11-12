---
name: scrum-handoff
description: "Cycle handoff of the Scrum team: the short message the team writes to the user every time it stops and hands control back. Says which cycle ended, what was implemented, what is next, and ends with one question naming who takes the next step. Use at the end of every ceremony, every task that reaches Done, and every turn that returns to the user."
---

# Cycle Handoff

## Purpose

Make the next step obvious. Whenever the team stops and hands control back to the user, it ends with this message, so the user never has to read the board or the log to know where things stand and what to say next.

A **cycle** is any stretch of work that ends by returning to the user: a ceremony, a task that reached Done, a gate that needs an answer, or the end of a session.

| | |
|---|---|
| **Written by** | PM, from the sprint file; with native agents, the main session |
| **When** | The last message of every turn that returns control to the user |
| **Input** | The active `docs/scrum/sprints/sprint-NN.md` and `docs/scrum/backlog.md` |
| **Output** | The message below, in the conversation; nothing new on the board |

## The message

Copy this shape. Keep the headings and the emojis; replace everything in braces.

```markdown
# We are at the end of cycle {NN}.{cycle_id}

### Here is what we implemented:

1. {Item or task ID and title}

   1.1 {What was implemented, in one or two plain sentences: what the user can now do or see}

2. {…}

## Here is what is next, champ 🏆 🚀

{One line on where the feature stands: "We are still cooking to finish this feature", "This feature is done and accepted", or "We are blocked on your answer".}

Here is what you need to know about the next steps:

1. {Next step, with its owner role in brackets}
2. {…}

{The question}
```

## Filling it in

- **Cycle ID.** `{NN}` is the sprint number; `{cycle_id}` is the task ID (`T-002-1`) when a task finished, or the ceremony name (`Refinement`, `Planning`, `Daily`, `Review`, `Retro`) otherwise. Before the first sprint, use `00`.
- **What we implemented.** Only what changed in this cycle, read from the board, not from memory. Write in the user's terms: behavior and outcomes, not files and functions. When nothing was built, as in Refinement or Planning, list what was decided instead and rename the heading to "Here is what we decided".
- **Next steps.** At most three, in order, each with the role that owns it. The first one is what happens if the user says "go". Take them from the task board, the backlog, and open impediments.
- **No new facts.** Every line must already be on the board. If it is not, write it to the board first.

## The question

End with exactly one question. It names the first next step and who takes it, and offers two answers, the recommended one first:

1. **Call the role that owns step 1** to work it with the user. For example: "Would you like to call the PO to help you plan 1. {ABC}?"
2. **Let the team move on alone** up to the next gate. For example: "Or can I move along and brainstorm it with the product team (PO, Tech Lead)?"

When a gate (G1 to G4) is pending, the gate *is* the question: ask it instead, in the words its ceremony uses, and list the gate as next step 1. Never ask a gate and another question in the same handoff.

## Example

```markdown
# We are at the end of cycle 02.T-002-1

### Here is what we implemented:

1. T-002-1 — Order status on the order page

   1.1 Customers now see whether their order is Paid, Shipped, or Delivered, updated as soon as the status changes. Committed on `sprint-02` with your G4.

## Here is what is next, champ 🏆 🚀

We are still cooking to finish this feature.

Here is what you need to know about the next steps:

1. [PO] Refine PBI-004, the shipping email: it still has no acceptance criteria.
2. [Tech Lead] Break PBI-004 into tasks for the Dev.

Would you like to call the PO to help you plan 1. the shipping email? Or can I move along and brainstorm it with the product team?
```
