# Context for AI: Clean Code as a Working Standard

## 1. Purpose of This Document

This document explains the principles the AI should follow when writing,
reviewing, refactoring, or extending code in this project.

Clean Code skills will be added over time. When a skill applies to a
task, the AI must consult and follow it. This document provides the
basic context behind those skills and explains why they matter.

The goal is not just to write code that works today. The goal is to
write code that works, is easy to understand, and can be changed safely
tomorrow.

## 2. Why We Miss Deadlines

Projects do not always fall behind because developers work too slowly or
because a task was poorly estimated. Often, development gets slower
because every new change must deal with complexity that has built up in
the existing code.

When code is confusing, even a small change may require someone to:

-   Search through several parts of the system to find the relevant
    behavior.
-   Guess what the original author intended.
-   Check whether a change could cause unexpected side effects.
-   Work around mixed responsibilities and complicated dependencies.
-   Fix bugs caused by earlier changes.
-   Repeat tests and investigations because the existing behavior is
    hard to trust.

As a result, time is spent not only building features, but also trying
to understand, protect, and work around the code that is already there.

**Messy code creates technical interest:** a rushed decision may save a
few minutes now, but make many future changes more expensive. As this
pattern repeats, it becomes harder to estimate work and deliver on time.

This does not mean that every delay is caused by code quality. Changing
requirements, external dependencies, communication, team capacity, and
estimates also matter. However, code quality is one factor the team can
directly improve.

## 3. The Pressure to Deliver Can Create the Problem That Slows Us Down

Experienced developers often understand the cost of confusing code. Even
so, under pressure, they may feel they have to ignore good practices to
finish a task quickly.

The reasoning sounds reasonable: "I'll clean it up later," "It's just a
one-time exception," or "We need to ship first."

The risk is turning an exception into the normal way of working.
Temporary code stays in the project, other features begin to depend on
it, and the next task has to build on top of that structure. The team
keeps paying for earlier shortcuts.

The answer is not to seek perfection before every release or to refactor
everything without a clear reason. It is to avoid unnecessary complexity
and keep the code clear enough that the next change does not become more
expensive than it needs to be.

**Sustainable speed means continuing to deliver predictably, not just
finishing the current task a few minutes earlier.**

## 4. Clean Code Is More Than Good Looks

Clean Code is not simply well-formatted code with nice names that passes
tests. Those things can help, but they do not guarantee that code is
clear or easy to maintain.

Code can compile, pass its tests, and still be hard to understand, risky
to change, or full of mixed responsibilities.

Clean Code should make intent clear and reduce the effort needed to
understand behavior. In practice, this often means:

-   **Clarity:** names, structure, and control flow communicate intent.
-   **Clear responsibilities:** each function, module, or component has
    an understandable purpose.
-   **Simplicity:** the solution avoids unnecessary abstractions,
    branches, and mechanisms.
-   **Cohesion and low coupling:** related things stay together, and
    local changes do not require unrelated changes across the system.
-   **Consistency:** code follows the project's established conventions.
-   **Testability:** important behavior can be checked with confidence.
-   **Maintainability:** another person can understand and change the
    code without having to reconstruct the entire system in their head.

These principles depend on context. No single rule automatically makes
every piece of code clean. Decisions should take the problem, existing
architecture, project conventions, and real trade-offs into account.

## 5. Generating Code Is Not the Same as Writing Quality Code

The ability to produce syntactically valid code does not guarantee a
good solution. It is like putting paint on a canvas versus knowing how
to compose a painting: performing the action does not mean mastering the
standards of quality.

AI can generate an implementation that looks convincing, compiles, and
solves the immediate example while still introducing:

-   Unnecessary complexity.
-   Duplicated logic.
-   Long functions or functions with too many responsibilities.
-   Abstractions introduced too early.
-   Unnecessary dependencies.
-   Inconsistent error handling.
-   Changes outside the requested scope.
-   Code that conflicts with patterns already used in the project.

The AI must not treat the first working solution as the final solution
by default. It should check whether the code is understandable,
appropriate for the problem, consistent with the project, and safe to
change later.

Quality should not be assumed based on a fluent explanation, a neat
appearance, or the amount of code produced.

## 6. How the AI Should Make Decisions

When creating or changing code, the AI should follow this workflow:

1.  **Understand before changing.** Investigate the relevant context,
    existing patterns, dependencies, and expected behavior.
2.  **Check the available skills.** Find and follow any Clean Code
    skills and other task-specific instructions that apply.
3.  **Solve the actual problem.** Implement the requested requirement
    without inventing features or unnecessarily expanding the scope.
4.  **Choose the simplest suitable solution.** Avoid unnecessary
    complexity, but do not oversimplify in ways that harm clarity,
    safety, or correctness.
5.  **Keep the project consistent.** Do not introduce a new pattern
    without a concrete reason when an existing pattern is valid.
6.  **Verify the result.** Run, or recommend, tests and checks
    appropriate to the change. Never claim something was tested if it
    was not.
7.  **Review the implementation.** Look for duplication, vague names,
    mixed responsibilities, side effects, error cases, and changes
    outside the scope.
8.  **Explain important decisions.** Briefly describe meaningful
    choices, limitations, and checks that could not be performed.

## 7. What to Do When No Skill Covers a Case

This set of skills will grow over time. The absence of a specific skill
is not permission to ignore code quality.

When no specific instruction exists, the AI should:

-   Apply this document's principles and the conventions already present
    in the repository.
-   Choose a simple, readable solution that fits the current
    architecture.
-   Avoid inventing universal rules without considering the context.
-   Explain uncertainty when it could significantly affect the
    implementation.
-   If instructions conflict, identify the conflict and follow the most
    specific applicable instruction without hiding the decision.
-   When a useful, reusable rule emerges, suggest it as a candidate for
    a future skill instead of silently creating a new rule.

Future skills should turn these principles into practical, testable
guidance for specific types of work. They should build on this document
rather than replace it with a disconnected collection of rules.

## 8. Deliver Quickly Without Making Messy Code the Norm

Clean Code does not mean perfectionism, overengineering, or endless
refactoring. The AI should balance quality, scope, risk, and time.

To do that, it should:

-   Avoid refactoring unrelated areas just because they could be
    improved.
-   Avoid adding patterns, layers, or abstractions without a concrete
    benefit.
-   Avoid deliberately duplicating logic to save thought when the
    duplication creates a real risk.
-   Never sacrifice validation, security, or correctness just to appear
    faster.
-   Make small, coherent changes when that reduces risk.
-   Record known technical debt when it cannot be addressed within the
    task's scope.
-   Distinguish improvements required for the task from optional
    improvements.

When choosing between alternatives, consider not only the immediate
implementation cost, but also the future cost of reading, testing,
debugging, and changing the code.

## 9. Quality Checks Before Finishing

Before considering a change complete, the AI should ask:

-   Does the code clearly express what it is trying to do?
-   Do the names help explain the intent?
-   Does each function or component have a clear, coherent
    responsibility?
-   Is there duplication or complexity that could be removed without
    harming the solution?
-   Does the implementation follow the project's patterns and skills?
-   Have relevant error cases and side effects been considered?
-   Is the change appropriate for the requirement and within scope?
-   Is there a suitable way to verify the behavior?
-   Will another person be able to maintain this code without needing a
    long explanation from its author?

If an answer reveals an important problem, the AI should fix it before
finishing or clearly explain why it remains.

These questions are a review guide, not a mechanical checklist that
justifies adding abstractions or rewriting code without a good reason.

## 10. The Core Principle

**The goal is not just to make code work. The goal is to keep it easy to
understand, verify, and change as the product evolves.**

The AI should treat code quality as part of the deliverable, not as an
optional step for "when there is time." Clean Code is an ongoing effort
to reduce complexity, guided by common sense and the real needs of the
project.

Future Clean Code skills should explain how to apply these principles in
specific situations. Whenever an applicable skill exists, the AI must
consult and follow it. This document provides the context for
understanding why those rules matter.
