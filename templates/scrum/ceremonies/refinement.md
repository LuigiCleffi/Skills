---
name: scrum-refinement
description: "Backlog Refinement ceremony of the Scrum team. The PO, with the Tech Lead, turns the user's request into backlog items that meet the Definition of Ready: story, testable acceptance criteria, specification and examples when needed, technical risks, and the ADRs that govern them. Run when a new request arrives or before Sprint Planning when fewer Ready items exist than the sprint limit."
---

# Backlog Refinement

## Purpose

Make the top of the backlog Ready, so Sprint Planning chooses between clear items instead of discovering what they mean.

| | |
|---|---|
| **Facilitator** | PO |
| **With** | Tech Lead; the DBA or DevOps when the Tech Lead asks for them; the user for product questions |
| **When** | A new request arrives, or fewer items are Ready than the next sprint's item limit |
| **Input** | The user's request, `docs/scrum/backlog.md`, existing specs and records |
| **Output** | Items marked Ready in `docs/scrum/backlog.md` |

## Steps

1. **[PM] Prepare the board.** If `docs/scrum/` does not exist, create it from `scrum/board/`. Hand off to the PO.
2. **[PO] Capture the request.** Add one item per outcome the user asked for, with the story and the user's own words. Status: New.
3. **[PO] Split large requests.** An item must fit one sprint. Split by user-visible outcome, not by layer: "customer sees order status" rather than "database part" and "UI part".
4. **[PO] Specify what the item needs, and only that.**
   - A new product or a vague request: `ProductDefinition/plan.md`.
   - A feature with rules or several cases: `spec-definition`, then `spec-checklist`.
   - A customer-facing change: `strategy`.
   - Business rules worth illustrating: `bdd`, discovery only, for the examples.
   - A small, clear item: the story and acceptance criteria in the backlog are enough.

   Ask the user every material product question, one at a time. Status: Refined.
5. **[Tech Lead] Check feasibility.** Pass the ADR gate (`actions/adr.md`, consult mode). Note risks, dependencies, and whether the DBA or DevOps is needed; ask them when the impact is unclear. Send any question that changes scope back to the PO.
6. **[PO and Tech Lead] Estimate and check readiness.** The Tech Lead gives a relative estimate (1, 2, 3, 5, 8) with the developers' view. Items larger than 8 return to step 3. Walk `docs/scrum/definition-of-ready.md`; mark the item Ready only when every check holds.
7. **[PO] Order the backlog.** Put the most valuable Ready items first. Note why when the order is not obvious.

## Exit

- The items the next sprint needs are Ready, or the PO has told the user what blocks them.
- Every open question is recorded on its item with who answers it.

Hand off to the PM for Sprint Planning.
