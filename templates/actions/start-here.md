---
name: start-here
description: "Someone's first session in this project: check their machine with the doctor, fix what one command can, write the ready-to-send request for what depends on someone else, explain the project in five plain lines, and end by asking what they want to do. Use when the person says \"first time here\", \"I just cloned this\", \"how do I start\", \"explain this repo\", \"I don't know what to do\", or clearly does not know they can just ask; skip it when they already know what they want."
---

# start-here — The First Session

## Purpose

Someone new should leave this session having asked for the first real thing, not having read documentation. `start-here` unblocks them and gets out of the way.

## Workflow

### 1. Probe, do not ask

A newcomer cannot answer "do you have access to X?"; a command can. Run `node tools/doctor.mjs` (when the project has it; otherwise check the runtime, the package manager, the dependencies, and the sign-ins the README lists). It only reads.

- Fix what one command fixes, saying what you are about to run, and run the doctor again.
- For what depends on someone else (an access, an account, a key), show the request text the doctor prints, ready to send, and say to whom or in which channel. Then go on: almost everything else works without it. Say what will not work until it arrives.

### 2. Explain the project in five lines

In plain words, no jargon, in this order:

1. What this project is for, and who uses it.
2. What they can ask you to do here (build, change, fix, explain).
3. How they will see the result (a preview, a screenshot, a test run).
4. How to undo something they do not like ("go back to how it was").
5. How work is shared with others (a pull request, a deploy), and that nothing is shared without their OK.

Do not explain folders, frameworks, or tools unless they ask. None of that is their decision yet.

### 3. Pull the first request

End with one open question and a concrete example from this project: "What would you like to do first? For example: 'add a filter by date to the orders list'." When they answer, continue the normal way for that request.

## When they already know what they want

Skip all of it: run the doctor quietly, and if it is green, start on their request.

## Guardrails

- Never ask for or type a password, key, or token; they sign in themselves.
- Never install tools globally or change their machine's settings without saying what and getting a yes.

## Completion criteria

`start-here` is complete when the doctor is green (or every red item has its fix or its request sent), the person heard the five lines, and they made their first request.
