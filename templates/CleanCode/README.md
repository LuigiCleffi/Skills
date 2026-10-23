## AI Skills

Before writing, reviewing, refactoring, or extending code, find the skills
that apply to the task in the table below and read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed.

| Skill | Use when |
|---|---|
| `./Mindset/cleanCodeMindset.md` | Weighing speed against quality, technical debt, a big rewrite, or the Boy Scout Rule. |
| `./MeaningfulNames/ROOT.md` | Naming or renaming anything, or reviewing names. Entry point for the naming skills. |
| `./Functions/functions.md` | Writing a function, or splitting, shortening, or simplifying one (nesting, flag arguments, long parameter lists, side effects). |
| `./Comments/comments.md` | Adding, auditing, or removing comments and docstrings. |
| `./Formatting/formatting.md` | Ordering code in a file, blank lines, line and file length, or a team style guide. |
| `./ObjectsAndDataStructures/objectsAndDataStructures.md` | Getters and setters, classes vs. plain records/DTOs, type switches vs. polymorphism, the Law of Demeter. |
| `./ErrorHandling/errorHandling.md` | Code that can fail: exceptions, error types, result types, null, error messages. |
| `./Boundaries/boundaries.md` | Adopting or wrapping a third-party library, SDK, or API, learning tests, or coding against an API that doesn't exist yet. |
| `./UnitTests/unitTests.md` | Writing or reviewing unit tests, test structure, F.I.R.S.T., flaky or slow tests. |
| `./Classes/classes.md` | Designing a class or module, its size and cohesion, SRP, Open–Closed, Dependency Inversion. |
| `./Systems/systems.md` | Wiring and bootstrapping, dependency injection, factories, keeping frameworks out of domain code, cross-cutting concerns. |
| `./SimpleDesign/simpleDesign.md` | Judging whether a design is good enough, over-engineering, YAGNI, or breaking ties between other guidelines. |
| `./Concurrency/concurrency.md` | Threads, async tasks, locks, shared mutable state, races, deadlocks, or shutdown of workers. |
| `./SuccessiveRefinement/successiveRefinement.md` | Working code that has grown tangled as features were added, or deciding when to stop and clean. |
| `./PolishingGoodCode/polishingGoodCode.md` | A final cleanup pass on code that is already good and tested. |
| `./LegacyRefactoring/legacyRefactoring.md` | Refactoring inherited or legacy code with weak or unknown test coverage. |
| `./SmellsAndHeuristics/smellsReview.md` | Reviewing a whole piece of code for smells, or citing a heuristic code such as G5 or N7. |

# Context for AI: Clean Code as a Working Standard

## 1. Purpose of This Document

This document explains the principles the AI should follow when writing, reviewing, refactoring, or extending code in this project.

Clean Code skills will be added over time. When a skill applies to a task, the AI must consult and follow it. This document provides the basic context behind those skills and explains why they matter.

The goal is not just to write code that works today. The goal is to write code that works, is easy to understand, and can be changed safely tomorrow.

## 2. Why We Miss Deadlines

Projects do not always fall behind because developers work too slowly or because a task was poorly estimated. Often, development gets slower because every new change must deal with complexity that has built up in the existing code.

When code is confusing, even a small change may require someone to:

- Search through several parts of the system to find the relevant behavior.
- Guess what the original author intended.
- Check whether a change could cause unexpected side effects.
- Work around mixed responsibilities and complicated dependencies.
- Fix bugs caused by earlier changes.
- Repeat tests and investigations because the existing behavior is hard to trust.

As a result, time is spent not only building features, but also trying to understand, protect, and work around the code that is already there.

**Messy code creates technical interest:** a rushed decision may save a few minutes now, but make many future changes more expensive. As this pattern repeats, it becomes harder to estimate work and deliver on time.

This does not mean that every delay is caused by code quality. Changing requirements, external dependencies, communication, team capacity, and estimates also matter. However, code quality is one factor the team can directly improve.

## 3. The Pressure to Deliver Can Create the Problem That Slows Us Down

Experienced developers often understand the cost of confusing code. Even so, under pressure, they may feel they have to ignore good practices to finish a task quickly.

The reasoning sounds reasonable: "I'll clean it up later," "It's just a one-time exception," or "We need to ship first."

The risk is turning an exception into the normal way of working. Temporary code stays in the project, other features begin to depend on it, and the next task has to build on top of that structure. The team keeps paying for earlier shortcuts.

The answer is not to seek perfection before every release or to refactor everything without a clear reason. It is to avoid unnecessary complexity and keep the code clear enough that the next change does not become more expensive than it needs to be.

**Sustainable speed means continuing to deliver predictably, not just finishing the current task a few minutes earlier.**

## 4. Clean Code Is More Than Good Looks

Clean Code is not simply well-formatted code with nice names that passes tests. Those things can help, but they do not guarantee that code is clear or easy to maintain.

Code can compile, pass its tests, and still be hard to understand, risky to change, or full of mixed responsibilities.

Clean Code should make intent clear and reduce the effort needed to understand behavior. In practice, this often means:

- **Clarity:** names, structure, and control flow communicate intent.
- **Clear responsibilities:** each function, module, or component has an understandable purpose.
- **Simplicity:** the solution avoids unnecessary abstractions, branches, and mechanisms.
- **Cohesion and low coupling:** related things stay together, and local changes do not require unrelated changes across the system.
- **Consistency:** code follows the project's established conventions.
- **Testability:** important behavior can be checked with confidence.
- **Maintainability:** another person can understand and change the code without having to reconstruct the entire system in their head.

These principles depend on context. No single rule automatically makes every piece of code clean. Decisions should take the problem, existing architecture, project conventions, and real trade-offs into account.

## 5. What Is Clean Code?

Clean Code is elegant code. It is harmonious, subtle, lightweight, simple, and natural in its structure. It is refined, polished, and purposeful. Its beauty comes not from decoration or clever tricks, but from the way its parts fit together with clarity and precision.

Reading clean code should feel natural. The reader should be able to follow its intent without constantly stopping to decipher its structure or reconstruct the author's reasoning. Reading it should be as satisfying as listening to a beautiful piece of music on the radio or observing a magnificent car whose design combines elegance with efficiency.

Clean Code makes complexity feel manageable. Its structure guides the reader naturally from one idea to the next. Every name, function, class, and module contributes to a coherent whole. Nothing exists merely to show off technical sophistication, and nothing unnecessary stands between the reader and the intent of the code.

**Clean Code is not merely code that works. It is code whose correctness, structure, and simplicity come together in an elegant and natural expression of intent.**

### 5.1. Elegance Through Simplicity and Natural Flow

Repetition of the same cycles, unnecessary branches, and duplicated logic are rarely elegant. They interrupt the natural flow of the code and make its structure harder to understand.

A clean implementation expresses an idea directly. Its control flow is easy to follow, its abstractions are justified, and its responsibilities are clearly arranged. The reader should not have to navigate unnecessary complexity to understand what the program is doing.

Elegance does not mean minimizing the number of lines at any cost. A short expression can be obscure, and a longer implementation can be perfectly clear. The objective is to minimize unnecessary mental effort while preserving correctness, clarity, and maintainability.

The best code often feels obvious after you read it. That apparent simplicity is the result of careful decisions, not the absence of thought.

### 5.2. Bad Code Encourages More Bad Code

Messy code tends to make the surrounding code messier.

When developers work in an unclear or poorly structured area, they are more likely to follow its existing patterns, introduce additional workarounds, and add new responsibilities to components that already do too much. Each change can make the next change harder.

Over time, disorder becomes self-reinforcing. The codebase accumulates exceptions, duplicated logic, hidden dependencies, and inconsistent conventions. What began as a small compromise gradually influences the design of the entire system.

Clean Code helps break this cycle. When a developer changes a component, the implementation should remain clear, cohesive, and consistent with the system's design. New code should preserve or improve the quality of the surrounding code rather than contribute to its deterioration.

**Every change is an opportunity to leave the code at least as clear and well-structured as it was before.**

### 5.3. Attention to Detail Is Part of Clean Code

Clean Code requires thorough attention to detail. A solution is not clean simply because its main path works or its implementation looks elegant at first glance.

Error handling must be complete and appropriate to the context. The AI should consider how failures occur, how they propagate, what resources must be released, and whether the system can recover safely. Reduced or superficial error handling is often a sign that important details have been overlooked.

The same principle applies to memory management, resource lifecycles, concurrency, and race conditions. A solution that appears simple but leaks resources, silently loses information, or behaves unpredictably under concurrent execution is not clean code.

Attention to detail also means considering edge cases, input validation, state transitions, side effects, and the boundaries between components. These concerns should not be treated as secondary tasks to address only when a problem becomes visible.

This does not mean adding defensive mechanisms everywhere or anticipating every imaginable failure. It means understanding the actual risks of the problem and handling them deliberately.

**Clean Code is the result of care applied consistently, especially to the details that are easy to overlook.**

### 5.4. One Responsibility, One Clear Purpose

Clean Code does one thing well. Poorly structured code often attempts to do many unrelated things at once.

A clean function has a clear purpose. A clean class has a coherent responsibility. A clean module groups related behavior behind an understandable boundary. Each exposes a focused responsibility without being surrounded by, or entangled with, unrelated implementation details.

This does not mean that every function must contain only one statement or that every class must be reduced to the smallest possible size. It means that each unit of code should have a cohesive purpose that can be understood without needing to understand everything around it.

When a function validates input, coordinates business logic, accesses the database, formats a response, and handles unrelated error scenarios, its purpose becomes difficult to describe. Changes to one responsibility can interfere with the others, increasing the risk of regressions.

A focused design makes responsibilities explicit and limits the amount of context required to understand each component. It also makes testing, debugging, reuse, and future changes easier.

**The goal is not to divide code into as many pieces as possible. The goal is to ensure that every piece has a clear reason to exist and a well-defined purpose.**

### 5.5. Elegance Must Serve Correctness

Elegance is not an excuse to sacrifice correctness, security, performance, or maintainability. Nor is it an invitation to introduce sophisticated abstractions simply because they look impressive.

A beautiful solution is one in which the design serves the problem. It is simple without being naive, expressive without being verbose, robust without being unnecessarily defensive, and efficient without becoming obscure.

The AI should seek this balance whenever it writes, reviews, refactors, or extends code.

Clean Code should feel natural to read because its structure reflects the problem clearly. It should feel refined because unnecessary complexity has been removed. And it should remain dependable because the details have been considered carefully.

The standard is not merely code that produces the correct result today. It is code that communicates its intent clearly, handles its responsibilities completely, and remains understandable as the system evolves.

## 6. Generating Code Is Not the Same as Writing Quality Code

The ability to produce syntactically valid code does not guarantee a good solution. It is like putting paint on a canvas versus knowing how to compose a painting: performing the action does not mean mastering the standards of quality.

AI can generate an implementation that looks convincing, compiles, and solves the immediate example while still introducing:

- Unnecessary complexity.
- Duplicated logic.
- Long functions or functions with too many responsibilities.
- Abstractions introduced too early.
- Unnecessary dependencies.
- Inconsistent error handling.
- Changes outside the requested scope.
- Code that conflicts with patterns already used in the project.

The AI must not treat the first working solution as the final solution by default. It should check whether the code is understandable, appropriate for the problem, consistent with the project, and safe to change later.

Quality should not be assumed based on a fluent explanation, a neat appearance, or the amount of code produced.

## 7. How the AI Should Make Decisions

When creating or changing code, the AI should follow this workflow:

1. **Understand before changing.** Investigate the relevant context, existing patterns, dependencies, and expected behavior.
2. **Check the available skills.** Find and follow any Clean Code skills and other task-specific instructions that apply.
3. **Solve the actual problem.** Implement the requested requirement without inventing features or unnecessarily expanding the scope.
4. **Choose the simplest suitable solution.** Avoid unnecessary complexity, but do not oversimplify in ways that harm clarity, safety, or correctness.
5. **Keep the project consistent.** Do not introduce a new pattern without a concrete reason when an existing pattern is valid.
6. **Verify the result.** Run, or recommend, tests and checks appropriate to the change. Never claim something was tested if it was not.
7. **Review the implementation.** Look for duplication, vague names, mixed responsibilities, side effects, error cases, and changes outside the scope.
8. **Explain important decisions.** Briefly describe meaningful choices, limitations, and checks that could not be performed.

## 8. What to Do When No Skill Covers a Case

This set of skills will grow over time. The absence of a specific skill is not permission to ignore code quality.

When no specific instruction exists, the AI should:

- Apply this document's principles and the conventions already present in the repository.
- Choose a simple, readable solution that fits the current architecture.
- Avoid inventing universal rules without considering the context.
- Explain uncertainty when it could significantly affect the implementation.
- If instructions conflict, identify the conflict and follow the most specific applicable instruction without hiding the decision.
- When a useful, reusable rule emerges, suggest it as a candidate for a future skill instead of silently creating a new rule.

Future skills should turn these principles into practical, testable guidance for specific types of work. They should build on this document rather than replace it with a disconnected collection of rules.

## 9. Deliver Quickly Without Making Messy Code the Norm

Clean Code does not mean perfectionism, overengineering, or endless refactoring. The AI should balance quality, scope, risk, and time.

To do that, it should:

- Avoid refactoring unrelated areas just because they could be improved.
- Avoid adding patterns, layers, or abstractions without a concrete benefit.
- Avoid deliberately duplicating logic to save thought when the duplication creates a real risk.
- Never sacrifice validation, security, or correctness just to appear faster.
- Make small, coherent changes when that reduces risk.
- Record known technical debt when it cannot be addressed within the task's scope.
- Distinguish improvements required for the task from optional improvements.

When choosing between alternatives, consider not only the immediate implementation cost, but also the future cost of reading, testing, debugging, and changing the code.

## 10. Quality Checks Before Finishing

Before considering a change complete, the AI should ask:

- Does the code clearly express what it is trying to do?
- Do the names help explain the intent?
- Does each function or component have a clear, coherent responsibility?
- Is there duplication or complexity that could be removed without harming the solution?
- Does the implementation follow the project's patterns and skills?
- Have relevant error cases and side effects been considered?
- Is the change appropriate for the requirement and within scope?
- Is there a suitable way to verify the behavior?
- Will another person be able to maintain this code without needing a long explanation from its author?
- Does the implementation feel natural to read, with a clear flow from one idea to the next?
- Have unnecessary abstractions, branches, and responsibilities been removed without sacrificing correctness?
- Does the solution demonstrate attention to detail in error handling, resource management, concurrency, and other relevant risks?

If an answer reveals an important problem, the AI should fix it before finishing or clearly explain why it remains.

These questions are a review guide, not a mechanical checklist that justifies adding abstractions or rewriting code without a good reason.

## 11. The Core Principle

**The goal is not just to make code work. The goal is to keep it easy to understand, verify, and change as the product evolves.**

The AI should treat code quality as part of the deliverable, not as an optional step for "when there is time." Clean Code is an ongoing effort to reduce complexity, guided by common sense and the real needs of the project.

The highest standard is code that combines correctness with elegance, simplicity with completeness, and efficiency with clarity. It should be natural to read, deliberate in its structure, attentive to important details, and focused on its responsibilities.

Every implementation should aim to solve the immediate problem while preserving the long-term health of the codebase.

Future Clean Code skills should explain how to apply these principles in specific situations. Whenever an applicable skill exists, the AI must consult and follow it. This document provides the context for understanding why those rules matter.