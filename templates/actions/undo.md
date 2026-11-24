---
name: undo
description: "Put something back the way it was before the last change, one step at a time and recoverably: uncommitted changes are set aside with git stash (not deleted), the last saved step is reverted with a new commit (never reset or force-pushed), each step is confirmed with \"no\" as the default, and the restored state is shown. Says plainly that what is deployed did not change. Use when the person says \"undo\", \"go back\", \"I don't like it\", \"put it back\", \"I broke it\", \"cancel that\"."
---

# undo — Back to How It Was

## Purpose

People try things more freely when going back is easy and safe. `undo` is a version history nobody has to see: it goes back one step, keeps what it set aside, and shows the result.

## Workflow

### 1. Find the step to undo

Narrow it to the area the person means (the screen, the file, the folder), then look at its state:

```bash
git status --short -- <area>
git log -3 --format='%h %ar %s' -- <area>
```

- **Changes not saved yet** (the common case: it just happened): the step is those changes.
- **Everything saved**: the step is the last commit that touched the area.
- **Nothing before it** (the area was created in its only commit): there is no "before". Say so; removing the area entirely is a different request, and needs its own explicit yes.

### 2. Say what will happen and ask

Describe the step in plain words ("the color change on the orders page from 10 minutes ago") and what undoing it does. Ask for confirmation with **no** as the default answer: undoing throws work away from the screen, even when it is recoverable.

### 3. Undo, recoverably

- Unsaved changes: set them aside, do not delete them:
  ```bash
  git stash push --include-untracked -m "undo: <what>" -- <area>
  ```
  They come back with `git stash pop` if the person changes their mind.
- The last saved step: add a commit that reverses it:
  ```bash
  git revert --no-edit <commit>
  ```
  When that commit also touched other areas, revert only the area (`git checkout <commit>~1 -- <area>`, then commit "Undo <what>") and say so.

Never use `git reset --hard`, `git checkout .` on unsaved work, `git clean`, or a force push to undo: they lose work for good.

### 4. Show it

Show the restored state: a screenshot of the screen, the test passing, or the file as it was. "Done" without proof is the worst thing to say here. Then one sentence: "It's back to how it was. Nothing deployed changed; this is only in your copy." When the change had been deployed, say that undoing it there means deploying again, and ask if they want that.

### 5. One step at a time

To go back further, run the whole workflow again; each step is its own confirmation.

## Guardrails

- Never discard work without a way back.
- Never undo outside the area the person meant.
- Never deploy or push as part of undoing.

## Completion criteria

`undo` is complete when the person confirmed the step, it was undone recoverably (stash or revert), the restored state was shown, and they know whether anything deployed is affected.
