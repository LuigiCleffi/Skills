---
name: pr
description: "Open a pull request a person can review in minutes: check the change against its plan, run the checks, write the body from .github/pull_request_template.md in the user's words (what changed for the user, why, how a person tests it, before and after screenshots), post a QA script, then watch CI until it settles and fix what fails. Also triages review comments and checks the conditions before a merge. Use when the user says \"open a PR\", \"create the pull request\", \"ship it\", or the work on a branch is done; and when review comments arrive."
---

# pr — Open a Pull Request Someone Can Review

## Purpose and ownership

A pull request is read by a person with little time. It says what changed for the user, why, and how to see it, and it arrives green. `pr` owns the pull request's body, its QA comment, and following it until CI settles. It does not merge without the user.

## Before opening

1. **Commit everything** that belongs to the change; nothing is left only in the working tree.
2. **Compare the change with its plan.** With the harness, `node harness/gate.mjs scope`: each UNEXPECTED module is claimed in the plan or moved to its own pull request, each MISSING file is explained. Without it, read `git diff --stat <base>...HEAD` and ask the same questions.
3. **Run the checks.** With the checks group, `node checks/checks.mjs` must stamp the commit (or `--waive "<reason>"`, and the reason goes in the body). Otherwise run the project's tests, typecheck, and lint yourself.
4. **Have the QA report** when the change has behavior (`actions/qa.md`): its scenarios become the test steps.

## Write the body

Start from `.github/pull_request_template.md`. Rules:

- **Open with one sentence in the user's words**: what someone can do now that they could not before, or what no longer goes wrong. Not the file list, not the process.
- **"What was implemented"** lists changes by what they do for a person, one entry each. Internal refactors go in one line at the end, if at all.
- **"Why"** is the problem, in one or two sentences, linking the issue or spec.
- **"How to test it?"** lists steps a person does on the screen or the API: open, click, type, expect. No terminal commands there; they go in the QA comment.
- **Screenshots**: before and after, one row per step. Link images by a commit SHA (`https://github.com/<owner>/<repo>/blob/<40-char sha>/docs/qa/reports/.../step-1.png?raw=1`), never by branch name: the branch is deleted after the merge and the images break.
- **Say what is not done**: a scenario left MANUAL, a check waived, a known limit. A reviewer who finds it alone stops trusting the rest.
- **Leave out** questions to the reviewer that you could answer yourself, the story of how you worked, and praise of the change.
- **Deliberately below a standard** (no test for a path, a rule bent): allowed only with what it would cost to meet it, measured ("a test needs a fake payment provider, about a day"), and a follow-up.

## Open it and post the QA script

Open the pull request (`gh pr create --title "<type>: <what changes for the user>" --body-file <file>`). Then post one comment titled **QA script** with what a QA person runs to check the change by hand or rerun the proof: the `run.sh` from the QA report, the seed data or account it needs, and the manual scenarios. When the work came from an issue in a tracker you can reach, post the same comment there.

## Watch CI until it settles

Wait on the checks, not on a timer: `gh pr checks <number> --watch` (or poll `gh pr checks` until nothing is pending). When a job fails, read its log (`gh run view <run-id> --job <job-id> --log-failed`), fix the cause on the branch, commit, run the checks again, and push. Never rerun a failed job hoping it passes without saying why it failed; a flaky test is reported as one.

## Review comments

Sort each comment into one of:

- **Change request**: something wrong or missing. Fix it, reply with the commit that fixes it.
- **Suggestion**: a better way that is optional. Take it or reply with the reason not to.
- **Question**: answer it; if the answer belongs in the code (a name, a comment, a test), put it there too.

Never resolve a thread someone else opened without their answer, and never argue a point a written project rule already decides: cite the rule.

## Before a merge

The merge is the user's call. Before it, confirm: CI is green on the last commit, every change request is answered, the branch is up to date with its base (or the base moved only in unrelated files), and nothing in the body is out of date. After the merge, `actions/finish.md` cleans up.

## Guardrails

- Never open a pull request from uncommitted work or from a commit the checks did not pass.
- Never put secrets, tokens, or customer data in the body, comments, or screenshots.
- Never merge, close, or approve without the user.

## Completion criteria

`pr` is complete when the pull request is open with a body that follows these rules, the QA script is posted, CI is green (or each failure is explained to the user), and every review comment has an answer.
