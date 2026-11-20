---
name: finish
description: "Clean up after a pull request is merged: confirm the merge reached the base branch, close the harness run with its result, remove the worktree (which frees its slot) and delete the merged branches, note what the run taught, and suggest a version tag when the project tags releases. Use when the user says \"finish\", \"wrap up\", \"clean up\", \"it's merged\", \"done with this feature\", or after a merge; not before the pull request is merged."
---

# finish — Close Out a Merged Change

## Purpose and ownership

A merged pull request leaves things behind: a branch, a worktree holding a port and a database, a harness run still open, and lessons nobody wrote down. `finish` closes each one, in an order that never deletes work that did not reach the base branch.

`finish` deletes only what is proven merged, and asks before anything it cannot prove.

## Workflow

### 1. Prove the merge

Fetch the base branch and confirm the branch's last commit is in it:

```bash
git fetch origin
git merge-base --is-ancestor <branch-head> origin/main && echo merged
```

A squash merge leaves no shared commit: confirm instead that the pull request is merged (`gh pr view <number> --json state,mergedAt`), and compare the branch's diff with what landed. If neither proves it, stop and tell the user; delete nothing.

### 2. Close the harness run

When a harness run is open for this change, set `code-review` and every other post-code stage to done or skipped with a reason, write the result (what shipped, the pull request link, anything left for later), and close it: `harness_close_run` with the MCP server, or by editing the run record and `docs/harness/active.json` as `actions/harness.md` describes. A fix run for an escaped defect closes only with its battery case.

### 3. Remove the worktree and branches

From the main checkout, not from inside the worktree:

```bash
git worktree remove <path>        # refuses when it has uncommitted work: ask, do not force
git branch -d <branch>            # -d, not -D: refuses an unmerged branch
git push origin --delete <branch> # only if the host did not delete it on merge
```

With `tools/worktree-slot.mjs`, the slot is freed once git no longer lists the worktree, and its resources are remembered: `node tools/worktree-slot.mjs --orphans` lists them (the database name, the ports) and, with `"cleanup"` set in `tools/worktree.json` and `--yes`, drops them. Ask before running it. Never use `--force` or `-D` to get past a refusal: the refusal means work would be lost.

### 4. Keep what it taught

In the run record's result (or a short note to the user when there was no run), write what would have made this change faster or safer: a rule for the knowledge base, a case for the edge-case battery (`docs/qa/edge-cases.md`), a check for `checks/config.json`, or a routing mistake for the routing eval. Capture each one with its own workflow; a lesson left in chat is lost.

### 5. Suggest a tag

When the project tags releases, say which version the change calls for (patch for a fix, minor for a feature, major for a breaking change) and the command, and let the user run it.

## Guardrails

- Never delete a branch, worktree, or database before the merge is proven.
- Never force a removal; report what blocked it.
- Never push tags or publish on your own.

## Completion criteria

`finish` is complete when the merge is proven, the run is closed with its result, the worktree and merged branches are gone (or the user decided to keep them), each lesson is captured where it belongs, and a tag is suggested when the project uses them.
