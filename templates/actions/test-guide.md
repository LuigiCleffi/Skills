---
name: test-guide
description: "Write a manual test guide for a merged change: numbered scenarios a person follows on the screen, built from the story, the spec, and the code as merged, using the exact labels the screens show (read from the code). The developer approves the guide before it is shared. Writes docs/qa/guides/<change>.md. Use when the user says \"write a test guide\", \"how does QA test this\", \"manual test steps\", or before handing a merged change to QA or to the people who will use it."
---

# test-guide — Steps Anyone Can Follow

## Purpose and ownership

A person testing by hand needs steps that match the screen in front of them: the button says "Save changes", not "submit". `test-guide` writes those steps from what was actually merged. It owns `docs/qa/guides/`.

## Workflow

### 1. Read the change as merged

Read the story or issue, the spec's acceptance criteria, and the code at the merge commit (`git show <merge-sha>`, not the branch, which may have moved). Note every screen, route, and role the change touches.

### 2. Take the labels from the code

Find the text the user sees for every control and message in the steps: button labels, menu items, field labels, toasts, error messages, from the components and the translation files. Search them, for example:

```bash
git grep -n -E '"(Save changes|Refund|Order not found)"' -- src/
```

Use the label as the user sees it, in the language they use. When a label comes from data (a product name), say which record to use.

### 3. Write the scenarios

```markdown
# Test guide: Refund within the window

**Merged in:** abc1234   **Needs:** a store account with one delivered order younger than 30 days

## T-01 Refund an order within 30 days (FR-001)

1. Sign in as the store account.
2. Open **Orders** and select the delivered order.
3. Click **Refund**, then **Confirm refund**.
4. Expected: the toast **Refund requested** appears and the order shows **Refund pending**.

## T-02 Refund is refused after 30 days (FR-002)
...
```

One scenario per acceptance criterion, plus the edge cases from the QA report worth checking by hand. Each step is one action; each scenario ends in what must be seen. Say what data and account each scenario needs, and never use real customer data.

### 4. Approval

Show the guide to the developer of the change. Share it (link it in the pull request, the issue, or the release notes) only after they approve it: a wrong step costs the tester more than no step.

## Guardrails

- Never write a label you did not find in the code.
- Never include credentials; say which test account to use.
- Never test or point testers at production unless the user says so.

## Completion criteria

`test-guide` is complete when every acceptance criterion has a scenario with steps that use the real labels, the data each needs is named, and the developer approved the guide.
