---
name: explore
description: "Think an idea through before it becomes a plan, a spec, or a task: read what the repository and the knowledge base already say, ask what the person really wants, challenge it, and lay out two or three options with their cost, risk, and what each leaves out. Writes no plan, spec, or code; ends in a decision to go ahead (and with which option), to wait, or to drop it. Use when someone says \"I have an idea\", \"what if we\", \"how would we solve X\", \"a customer asked for Y\", \"is it worth it\", or brings a problem without a solution; not when the request is already clear enough to plan."
---

# explore — Think It Through Before Committing

## Purpose and ownership

Most wasted work starts as a solution nobody questioned. `explore` is the conversation before any artifact: it finds out what problem the idea solves, what already exists, and which ways to solve it are worth the cost, so the plan that follows starts from a choice instead of the first idea.

`explore` owns only the conversation and, when the person wants it kept, a short note. It writes no plan, spec, task, or code, and opens no harness run.

## Workflow

### 1. Read before asking

Look at what the repository already has for this: the code that would change, the knowledge base (`docs/knowledge/`) for the business rules it touches, the ADRs for decisions that constrain it, and earlier plans or specs on the same subject. Bring what you found into the conversation; do not ask what the files already answer.

### 2. Find the real problem

Ask, a few questions at a time:

- Who has the problem, and what do they do today instead?
- What happens if nothing is built?
- How would we know it worked, in something we can observe or count?

When the idea is stated as a solution ("add a button that..."), ask what it is for, and keep the answer as the problem.

### 3. Challenge it

Say plainly what could make the idea a bad bet: it solves a rare case, it duplicates something that exists, it conflicts with a confirmed rule or an ADR, it costs more than it returns, or the data it needs does not exist. One honest objection is worth more than agreement.

### 4. Lay out the options

Two or three options, always including the smallest one that would help (often a change to an existing flow, a setting, or a manual step) and, when it is honest, "do nothing for now". For each:

| Option | What it changes | Cost | Risk | Leaves out |
|---|---|---|---|---|

Say which one you would choose and why, in one or two sentences.

### 5. End in a decision

Close with one of:

- **Go ahead with option N**: the next step is `ProductDefinition/plan.md` (or `actions/harness.md` for a change to guarded code), starting from the problem, the success measure, and the chosen option.
- **Wait**: what has to be true first, or what to learn.
- **Drop**: why, in a sentence, so the idea is not raised again without new facts.

If the person wants it kept, write `docs/explore/YYYY-MM-DD-short-slug.md` with the problem, the options table, the decision, and what was learned. Rules learned along the way go to the knowledge base through `actions/knowledge.md`, not into this note.

## Guardrails

- Never write a plan, spec, task, or code while exploring; offer the next workflow instead.
- Never present a guess about the business as a fact; mark it as a question.
- Keep it short: an exploration that needs a document of its own is a plan.

## Completion criteria

`explore` is complete when the problem is stated in the person's words, the options are on the table with the one you recommend, and the person has decided to go ahead, wait, or drop it.
