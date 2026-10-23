---
name: clean-code-systems
description: Keeping architecture clean at the system level, based on Chapter 11 (Systems) of Clean Code. Use whenever the user asks about application wiring or bootstrapping, where to construct objects, factories, dependency injection or IoC containers, separating startup or composition from runtime logic, keeping frameworks out of domain code, cross-cutting concerns like transactions, logging, security or persistence, evolving architecture incrementally rather than big design up front, when to adopt standards or frameworks, or domain-specific languages.
---

# Systems

No single person can manage all the details of a city, yet cities work. They have the right levels of abstraction and modularity so that people can work on parts without understanding the whole. Software systems need the same thing. Clean code at the function and class level isn't enough; the system needs separation of concerns too.

## 1. Separate constructing a system from using it

Startup, which builds and wires objects together, is a different concern from runtime logic. Mixing them is a common mess:

```
def get_service(self):
    if self._service is None:
        self._service = MyServiceImpl(...)   # lazy init inside business code
    return self._service
```

This hard-codes a dependency on a concrete class and its constructor arguments. It makes testing harder, since you need a fake or real implementation. It also mixes two responsibilities, and when repeated across the codebase it scatters the wiring strategy everywhere. Instead, use one of these:

- **Separation of main.** Construct everything in `main`, or modules called from `main`, often called the composition root. The rest of the application assumes its collaborators already exist and are wired. Dependencies point from `main` toward the application, never the other way.
- **Factories.** When the application must decide when to create something, such as a line item during order processing, give it an abstract factory interface. The application controls timing, while the construction details live on the `main` side.
- **Dependency injection.** An object doesn't create its dependencies. It receives them through constructor arguments, setters or a framework container. This is Inversion of Control applied to dependency management, and it supports the Single Responsibility Principle. Prefer constructor injection and keep containers at the edges. Plain manual injection is often enough.

## 2. Scale up incrementally

It's a myth that systems must be designed right the first time. Like cities, which pave and widen roads as they grow, good architecture can evolve **if concerns are properly separated**. Build today's stories, then refactor and expand to support tomorrow's. Software, unlike physical buildings, can change shape if it's kept modular.

## 3. Keep domain logic free of framework concerns

Architectures that force domain objects to inherit from framework base classes, implement container interfaces or embed persistence code tie business logic to infrastructure. The book's historical example is EJB2. That makes the logic hard to test and the system hard to evolve. Write domain logic as plain objects (POJOs or the equivalent) that know nothing about the framework.

**Cross-cutting concerns** such as persistence, transactions, security, caching and logging naturally cut across object boundaries. Handle them declaratively and modularly, outside the domain code, using the tools of your stack: decorators or annotations, middleware, interceptors, proxies, aspect-oriented frameworks, or transaction boundaries at the service layer. Avoid copying the same logging or transaction code into every method.

Modern note: the book discusses Java proxies, Spring AOP, JBoss AOP and AspectJ. The lasting principle isn't any particular tool. It's that infrastructure shouldn't invade domain code.

## 4. Test-drive the system architecture

If domain logic is decoupled from architecture concerns, you can start with a simple, decoupled architecture, deliver working stories quickly, and add infrastructure as needed. A big design up front tends to prevent adapting to change, because of the psychological cost of discarding prior work and because early decisions constrain later ones. Have a general vision of scope and goals, but stay able to change course.

## 5. Optimize decision making

Modularity allows decisions to be made by the people best placed to make them. Postpone decisions until the **last responsible moment**, when the most information is available. A premature decision is made with suboptimal knowledge.

## 6. Use standards wisely, when they add demonstrable value

Standards make it easier to reuse ideas and components, recruit experienced people and connect components. But don't adopt a heavyweight standard or framework because it's popular if a lighter design serves the actual need. Ask what concrete value it adds.

## 7. Systems need domain-specific languages

Good DSLs, whether small embedded APIs or scripting languages, minimize the gap between domain concepts and the code that implements them. They let all levels of abstraction, from policy to detail, be expressed in domain terms. A fluent, well-named internal API is often enough.

## Applying it

When reviewing or designing system structure:
1. Find where objects are constructed. Is wiring scattered through business code? Move it to the composition root, factories or injection.
2. Do domain classes import framework or infrastructure modules? Push that to adapters or the edges.
3. Are cross-cutting concerns duplicated in every method? Centralize them with the stack's declarative mechanism.
4. Is a big framework or standard being adopted without a clear payoff? Ask for the concrete benefit.
5. Is a decision being made too early? Identify what you'd learn by waiting and whether the design can stay open until then.
