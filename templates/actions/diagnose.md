---
name: diagnose
description: "Find out why something does not work and fix it: probe with the doctor and the real state before theorizing, match the symptom against the project's known causes (docs/diagnose.md), fix what is code or one command, write the ready-to-send request for what depends on someone else, and explain in one or two plain sentences what it was and what was done. Use when the person says \"it's not working\", \"there's an error\", \"it doesn't open\", \"it broke\", \"I can't sign in\", \"it's slow\", \"the data doesn't load\", or sends a screenshot of an error; for a defect in shipped behavior that needs a test and a fix run, use the harness fix mode."
---

# diagnose — It Does Not Work

## Purpose

When something fails, the person needs it working again and a sentence saying why, not a stack trace. `diagnose` checks before it guesses, fixes what it can, and is honest about what it could not.

## Workflow

### 1. Probe before theorizing

- Run `node tools/doctor.mjs` when the project has it: runtime, dependencies, sign-ins, access. It only reads.
- Look at the real state, never assume it: is the app actually running, on the port you are looking at? Is the error from the app, the browser (open its console), or the server (read its log)? What changed last (`git log -3`, `git status`)?
- Reproduce the failure yourself before changing anything.

### 2. Match the known causes

Read `docs/diagnose.md` when it exists: a table of symptoms, the cause they almost always have here, and the fix, kept by the team. Check the most frequent causes first.

```markdown
| Symptom | Almost always | Fix |
|---|---|---|
| "the data doesn't load" | local credentials expired | `<sign-in command>` |
| "it doesn't open" | an old preview still holds the port | stop it, or start on another port |
| "it broke after my change" | an error in the last change | fix it, or undo it (`actions/undo.md`) |
```

### 3. Fix

- Fix it yourself when it is code (a broken build, a missing dependency, a type error) or one command. Say what you are about to run when it changes the machine.
- When the cause depends on someone else (a permission, a paid plan, a setting only an admin can change), write the request ready to send and say to whom; do not try to work around it.
- After the fix, show it working (the page loading, the test passing), not just that the error is gone.

### 4. Say it like a person

One or two sentences: what it was, and what you did. "Your local sign-in had expired. I renewed it and the data loads again." No logs, stack traces, or file names unless they ask. If you did not solve it, say what you tried and what is left; vague is worse than bad news.

### 5. Teach the table

When the cause was new or surprising, add a row to `docs/diagnose.md` (create it if needed): the next person with the same symptom gets the answer in seconds.

## Guardrails

- Never delete data, reset branches, or force anything to make an error go away.
- Never paste secrets into the conversation, a log, or the table.
- A defect in behavior users rely on, once understood, becomes a fix with a failing test (`actions/tdd.md`, or the harness fix mode).

## Completion criteria

`diagnose` is complete when the failure is reproduced, its cause is found (or what is missing to find it is stated), it is fixed and shown working or the request for someone else is written, the person got the plain explanation, and a new cause is in the table.
