---
name: clean-code-concurrency
description: Writing, structuring and testing concurrent and multithreaded code cleanly, based on Chapter 13 (Concurrency) and Appendix A (Concurrency II) of Clean Code. Use whenever the user writes or reviews code with threads, async tasks, locks, mutexes, synchronized blocks, thread pools, executors, shared mutable state, atomics or concurrent collections, sees intermittent, flaky or impossible-to-reproduce failures, race conditions, deadlocks or livelocks, needs graceful shutdown of workers, or asks whether concurrency will make code faster.
---

# Concurrency

Concurrency is a decoupling strategy: it separates **what** gets done from **when**. That can improve throughput and structure, but concurrent code is hard to get right. Code that's simple to follow single-threaded can become a nightmare once multiple threads and shared data are involved.

## Myths to correct

- *Concurrency always improves performance.* It helps only when there's a lot of wait time (such as I/O) that can be overlapped, or real parallel work across cores.
- *Design doesn't change.* Decoupling what from when usually changes the structure of the system considerably.
- *The container or framework handles it.* You need to know what your web server, framework or runtime is doing about concurrency and how to guard against its issues.

More balanced truths: concurrency adds overhead in performance and code, correct concurrency is complex even for simple problems, its bugs are rarely repeatable and so get dismissed as one-offs, and it often requires a fundamental change in design strategy.

## Why it's hard

Even `return ++last_id` isn't atomic. It compiles to several low-level steps, and two threads can interleave them to return the same id, or skip one. The number of possible interleavings explodes with code size. Most of them are fine, which is exactly why the broken ones hide. See `concurrencyDeepDive.md` for the worked analysis.

## Defense principles

**Single Responsibility.** Concurrency design is complex enough to be its own reason to change. Keep concurrency-related code separate from other code. Thread management, locking and scheduling shouldn't be tangled with business logic.

**Limit the scope of shared data.** Encapsulate shared data and minimize the places that touch it. The more places update it, the more likely someone forgets to protect one, the more duplicated the guarding effort, and the harder failures are to find.

**Use copies of data.** Avoid sharing whenever possible. Copy objects and treat them as read-only, or collect results per thread and merge them in one thread. Object creation is usually cheaper than locking.

**Make threads as independent as possible.** Ideally each thread processes its own request with its own data in local variables, as if it were alone in the world. Partition the data into independent subsets.

## Know your library

- Use the platform's thread-safe collections and concurrency utilities (for example `java.util.concurrent`, Python's `queue` and `concurrent.futures`, Go channels, .NET's `System.Collections.Concurrent`).
- Use executors and thread pools rather than spawning raw threads.
- Prefer non-blocking or atomic primitives where they fit.
- Know which common classes aren't thread-safe, such as many date formatters, database connections and standard containers.

## Know your execution models

Key terms:
- **Bound resources:** fixed-size resources such as connection pools and buffers.
- **Mutual exclusion:** only one thread may access a resource at a time.
- **Starvation:** some threads never get to proceed.
- **Deadlock:** threads each hold a resource the other needs.
- **Livelock:** threads keep reacting to each other and never make progress.

Classic models to recognize and map your problem onto:
- **Producer–consumer:** a bounded queue between producers and consumers, with signaling in both directions.
- **Readers–writers:** balancing throughput for many readers against timely updates by writers without starving either.
- **Dining philosophers:** competing for several shared resources, which risks deadlock and livelock.

Most concurrency problems you meet are variants of these. Learn the standard solutions.

## Beware dependencies between synchronized methods

Several individually synchronized methods on one shared object don't make a sequence of calls atomic. For example, "check `has_next()`, then call `next()`" can race. Avoid using more than one method on a shared object. When you must:
- **Client-based locking:** the client locks the server object around the whole sequence.
- **Server-based locking:** the server offers a single method that does the whole sequence atomically. This is usually best.
- **Adapted server:** an intermediary performs the locking when you can't change the server.

## Keep synchronized sections small

Locks are expensive and create contention, but critical sections must be guarded. Keep each critical section as small as possible. Don't hold a lock around I/O or long computations.

## Shutdown is hard

Graceful shutdown commonly fails through deadlock, with threads waiting for a signal that never comes. Consider shutdown early, design for it, and test it. Review existing algorithms for it before relying on them.

## Testing threaded code

Tests can't prove correctness, but good testing reduces risk:
- **Treat spurious failures as candidate threading issues.** Don't dismiss a "one-off."
- **Get non-threaded code working first.** Put logic in plain, thread-unaware objects and test them single-threaded.
- **Make threaded code pluggable.** Run it with one thread, several threads or varying numbers, with real or test doubles, and with doubles that run fast, slow or variably.
- **Make it tunable.** Make the thread count easy to configure, possibly at runtime.
- **Run with more threads than cores** to force more task switching and expose missing locks.
- **Run on different platforms and runtimes.** Threading behavior differs between operating systems.
- **Instrument code to force failures.** Inject yields, sleeps and random delays, by hand or automatically with tooling, to shake out rare interleavings. Run tests many times, under load.
- Use race detectors and thread analyzers where available (for example Go's `-race`, ThreadSanitizer, Java concurrency test harnesses).

## Applying it

When the AI writes or reviews concurrent code:
1. Identify all shared mutable state. Can it be eliminated, copied or confined to one thread?
2. Make sure concurrency mechanics are isolated from business logic.
3. Prefer library primitives, such as concurrent queues, pools, futures and atomics, over manual locks.
4. Check for multi-call sequences on shared objects; move them into a single atomic server-side operation.
5. Minimize lock scope, and check lock ordering to prevent deadlock (see `concurrencyDeepDive.md`).
6. Plan and test shutdown.
7. Suggest a testing strategy: single-threaded logic tests, then configurable stress tests with jitter and a race detector.

For a worked client/server example, throughput math, execution-path analysis, nonblocking alternatives and the four conditions for deadlock with ways to break each, read `concurrencyDeepDive.md`.
