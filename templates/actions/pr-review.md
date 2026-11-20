---
name: pr-review
description: "Help a person review someone else's pull request: summarize what it changes in three lines (with a diagram when the flow changed), point to the commits and files no automated check looked at, then walk the reviewer through the decisions only a person can judge, one at a time, each with the file and line, the test that proves it, and the command to try it. Turns the reviewer's notes into change requests, suggestions, and questions, drops what a project rule already decides, and drafts the review for the reviewer to publish. Does not hunt for bugs line by line. Use when the user says \"help me review PR\", \"review this pull request with me\", or pastes a pull request link to review."
---

# pr-review — A Second Pair of Eyes for the Reviewer

## Purpose and ownership

Automated checks and `code-review` find what rules can find. What is left for a person are judgments: is this the right behavior, the right trade-off, the right place. `pr-review` saves the reviewer's time for those. The reviewer decides and publishes; `pr-review` prepares.

## Workflow

### 1. What it is about

Read the pull request's body, its linked issue or spec, and the diff. Write three lines: what changes for the user, the main technical change, and the risk. When a flow between components changed, add a small Mermaid diagram of the new flow.

### 2. What nobody checked

List the commits and files that no automated layer covers: no test touches them, no check runs on them (the checks config, the CI workflow), or they were changed by a merge or a fix-up commit late in the branch. These are where a person should look first.

### 3. Decisions for a person

Walk the reviewer through each decision that needs judgment, **one at a time**, and wait for their view before the next:

- What was decided, at `file:line`.
- The alternative that was not taken, if visible.
- The test that proves the behavior (or that none does).
- The command to try it locally.

Typical decisions: a new rule of the business, a changed contract other code uses, a migration, a permission, a default value, a deleted behavior.

### 4. Shape the reviewer's notes

Turn each note into:

- **Change request**: must change before the merge, with why.
- **Suggestion**: optional, with the benefit.
- **Question**: something to understand, not an order.

Drop a note that a written project rule already decides (cite the rule instead), and merge duplicates.

### 5. Draft the review

Write the review as the reviewer would post it: a short overall comment, then each note on its line. Show the draft. Publish only when the reviewer says so (`gh pr review <number> --comment|--request-changes|--approve --body-file <file>` and line comments), and only what they approved.

## Guardrails

- Never approve, request changes, comment, or merge without the reviewer's explicit OK.
- Never present a guess as a finding: mark it as a question.
- Never rewrite the author's code; suggest.

## Completion criteria

`pr-review` is complete when the reviewer has the summary, knows what nothing else checked, went through each decision, and has a draft review in their words that they chose to publish or not.
