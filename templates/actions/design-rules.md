---
name: design-rules
description: "Keep the project's interface rules: docs/design/RULES.md, one file of rules with stable IDs (laws, components, tokens, motion, data, writing, permissions, accessibility, verification, and a list of defects that must not come back), routed by what is being built, with the reasons in docs/design/BEHAVIOR.md. Turn a design decision into a rule, a UI defect found by QA or review into a DONT entry, and a disagreement between code and rules into a fix. Use when the user says \"add a design rule\", \"this keeps happening in the UI\", \"set up our interface rules\", or when uiux, ui-review, or qa finds a rule missing; never to build a screen."
---

# design-rules — The Interface Rules, With IDs

## Purpose and ownership

Without written rules, every screen re-decides the same things and the same defects return. `design-rules` keeps one file an agent reads before any UI work, with rules short enough to check and IDs stable enough to cite. It owns `docs/design/RULES.md` and `docs/design/BEHAVIOR.md`; it does not build screens.

## The files

- **`docs/design/RULES.md`**: the rules. A routing table first (what is being built → paths → which groups to read), then the groups: `L` laws in priority order, `K` components, `T` tokens and type, `M` motion, `D` data honesty, `W` writing, `P` permissions, `Z` accessibility, `V` verification, and `DONT`, the defects found in this product. Add groups the product needs (a group for an assistant's behavior, for a customer portal, for navigation).
- **`docs/design/BEHAVIOR.md`**: the reason behind each rule that is not obvious, by ID, with the story that produced it. Agents read it only when a rule is unclear.

## Workflow

### Set it up

Start from the installed starter. With the user, keep what fits, change what does not, and delete what the product does not need. Read the existing interface first (the design system, a well-made screen) so the rules describe what the product does at its best, not an ideal it does not follow. List the project's components where `K` points, and its tokens where `T` points.

### Add or change a rule

1. **Write it as something checkable**: what is never or always true, in one or two sentences ("Every number carries a reference"). A rule nobody can check is advice; put it in `BEHAVIOR.md`.
2. **Give it the next ID in its group.** IDs are never reused or renumbered; a removed rule stays as `~~L04~~ removed: <why>`.
3. **Say where it applies** in the routing table, when it is about specific paths.
4. **Write the reason** in `BEHAVIOR.md` when it is not obvious.
5. **Ask the user** before adding or changing a law (`L`): laws decide conflicts.

### Turn a defect into a DONT

When `qa`, `ui-review`, or a review finds a UI defect no rule prevented, add a `DONT` row: what never to do, where it was found (the pull request or report), and the rule it breaks, or a new rule when none covers it. The list is how the rules learn; each later `ui-review` scans it.

### Resolve a disagreement

What is shipped and verified wins over the file, and the file over prose docs. When the code does something better than a rule says, propose changing the rule. When the code breaks a rule by mistake, it is a defect: send it to `dev` with the rule's ID.

## Used by

- `uiux` reads the rules the routing table points to before deciding screens, and cites IDs in its decisions.
- `ui-review` and `qa` check `V` and scan `DONT`, and cite the ID of each finding.
- `review` and `code-review` cite rule IDs in UI findings.
- With the harness, the edit hook reminds the agent which groups govern a path, from the routing table.

## Guardrails

- Never write a rule that only this screen needs; that is a decision for `uiux`.
- Never renumber IDs.
- Never change a law without the user.

## Completion criteria

`design-rules` is complete when the rule is checkable, has its ID, appears in the routing table where it applies, has its reason when needed, and the change was approved by the user when it touched a law.
