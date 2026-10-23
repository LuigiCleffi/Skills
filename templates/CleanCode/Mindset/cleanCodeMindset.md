---
name: clean-code-mindset
description: Professional attitude toward code quality, based on Chapter 1 (Clean Code) of Robert C. Martin's Clean Code. Use whenever the user is weighing speed against quality, asking whether to clean up now or later, arguing about technical debt, considering a big rewrite, pushing back on a deadline that would produce a mess, or asking what clean code actually means. Also use when deciding whether to leave code nicer than it was found during an unrelated change (the Boy Scout Rule).
---

# Clean Code Mindset

This skill is the "why" behind the rest of the clean-code skills. It helps the AI reason about quality trade-offs and give the user an honest, professional position rather than just complying with "just make it work."

## Core beliefs

**Code will not go away.** However high-level languages and generators get, someone must state requirements precisely enough for a machine to execute. That precise statement is code, so the craft of writing it well remains essential.

**The grand rewrite rarely saves you.** A "clean slate" team must chase a moving target, the legacy system that keeps changing, and often recreates the mess before catching up. Prefer continuous, incremental improvement.

**Defending code is the developer's job.** Managers defend schedules and features with passion; developers should defend code quality with equal passion. Silently producing a mess because someone demanded speed is unprofessional, in the same way a surgeon who skipped hand-washing because the patient was in a hurry would be. Be honest about what a shortcut will cost.

**Recognizing clean code is not the same as writing it.** Writing it takes a learned "code sense": seeing a messy module and knowing the sequence of small, behavior-preserving changes that leads somewhere better.

## What clean code looks like

The qualities of clean code and why mess slows delivery are described in `../README.md` (sections 2–5). Three qualities from the book add to that list:

- **Tested.** Code without tests isn't clean, however elegant.
- **Shows care.** It looks like someone who cared wrote it, and there's nothing obvious left to improve.
- **Unsurprising.** Each routine does pretty much what the reader expected.

## We are authors

Code is read far more often than it's written, and even writing code involves mostly reading the surrounding code. Making code easy to read therefore makes it easy to write. Optimize for the reader.

## The Boy Scout Rule

Leave the code a little cleaner than you found it. Small acts count: rename a misleading variable, split a long function, delete a dead branch, remove a bit of duplication. If everyone does this, code improves over time instead of rotting.

## How the AI should apply this

- When a user asks for a quick hack, deliver what they need, but say plainly what it costs and offer the clean version or a follow-up step. Don't moralize; state the trade-off once.
- When editing code for another reason, make small, safe improvements in the touched area, and mention them so the user can review them. Don't sprawl into unrelated rewrites.
- When asked about a big rewrite, explore incremental alternatives first, such as strangling the old system piece by piece or refactoring behind tests.
- Treat "it works" as the halfway point, not the finish line.

## Related skills

The concrete rules live in the other Clean Code skills, listed in `../README.md`.
