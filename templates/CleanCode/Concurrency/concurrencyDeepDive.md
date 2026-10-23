# Concurrency Deep Dive (from Appendix A, Concurrency II)

Read this when you need deeper reasoning: performance or throughput decisions, proving that a simple operation is unsafe, choosing a locking strategy, or diagnosing deadlock.

## Contents
1. Client/server example: adding threads responsibly
2. Possible paths of execution
3. Knowing your library
4. Dependencies between methods
5. Increasing throughput
6. Deadlock: four conditions and how to break each
7. Testing multithreaded code

## 1. Client/server example

A single-threaded socket server fails a throughput test. The quick fix is to spawn a new thread per incoming message. The test then passes, but the design has new problems:
- **Unbounded thread creation.** There's no limit, so load can exhaust the runtime's thread limit or the machine's memory.
- **Mixed responsibilities.** Socket management, client processing, threading policy and shutdown policy are all in one class.

A cleaner design splits these into classes: connection management, client processing, and a **scheduling policy** (single-threaded, thread-per-request, or a fixed pool via an executor). Then the threading policy can be changed and tested in one place, and the rest stays thread-unaware. This applies the Single Responsibility Principle: keep the concurrency code in a few small, focused classes.

First decide whether the work is **I/O bound** or **CPU bound**. Threads help I/O-bound work by overlapping waits. For CPU-bound work, more threads than cores won't help.

## 2. Possible paths of execution

Even `return ++last_id` compiles to several low-level steps: load the field, increment, store, return. With two threads, those steps can be interleaved in many orders. For N steps per thread and T threads, the count of interleavings is (N·T)! / (N!)^T. That's thousands of orders even for a single line. Most produce correct results; a few produce duplicate ids or a lost increment.

**Atomic** means an operation can't be interrupted partway. Few operations are atomic in practice. In many runtimes even 64-bit reads and writes aren't guaranteed atomic without special handling, and pre-/post-increment never is. Synchronizing the method, or using an atomic counter, collapses the possible paths to the correct ones.

Lesson: you don't need to read bytecode, but you must assume any read-modify-write on shared state is unsafe until guarded.

## 3. Knowing your library

- **Executor frameworks and thread pools** manage thread lifecycles and can return futures for results. A future lets you start independent work, such as two remote calls, in parallel and wait for both.
- **Nonblocking solutions.** Atomic types (atomic booleans, integers, references) use compare-and-swap. They optimistically attempt the update and retry if another thread changed the value first. Under typical contention this is often faster than locking.
- **Classes that aren't thread-safe** include many date and number formatters, database connections, standard non-concurrent collections and some I/O helpers. Even a "thread-safe" collection doesn't make check-then-act sequences safe. For example, "if the key is absent, insert it" needs an atomic `putIfAbsent`-style operation.

## 4. Dependencies between methods

Example: an iterator shared by threads, where each thread calls `has_next()` and then `next()`. Two threads can both see `has_next() == True` when only one item remains, and one of them fails. Options:
- **Tolerate the failure.** Catch it and clean up. This is sloppy, comparable to rebooting at midnight to fix memory leaks.
- **Client-based locking.** Works, but every client must remember to do it, and the locking code is duplicated.
- **Server-based locking.** Usually preferable: it removes duplication, performs better, reduces the chance of errors, enforces one policy and keeps shared state scoped. For example, replace the pair with `next_or_none()`.

## 5. Increasing throughput

Illustrative numbers: fetching a page is 1 second of I/O that uses 0% CPU, and parsing it is 0.5 seconds at 100% CPU.
- **Single thread:** 1.5 seconds per page.
- **Three threads:** the I/O waits overlap, so the CPU is kept busy parsing, and throughput approaches one page every 0.5 seconds, about three times better.

Adding threads beyond the point where the CPU or the bound resource is saturated gives nothing. Measure and tune the thread count.

## 6. Deadlock

All four of these conditions must hold for deadlock:
1. **Mutual exclusion:** resources can't be shared and are limited in number.
2. **Lock and wait:** a thread holds its resources while waiting for others.
3. **No preemption:** resources can't be taken from a thread.
4. **Circular wait:** T1 holds R1 and wants R2, while T2 holds R2 and wants R1.

Break any one of them:
- **Break mutual exclusion:** use resources that allow simultaneous use (atomics), or increase the number of resources to at least the number of competing threads, or check that all resources are free before taking any.
- **Break lock and wait:** don't wait. Check each resource, and if one is busy, release everything and start over. Risks: **starvation** (a thread never gets its full set) and **livelock** (threads keep backing off in lockstep).
- **Break preemption:** let a thread ask another to release resources, and have threads release everything and restart when asked. This is complex to manage correctly.
- **Break circular wait:** make all threads acquire resources in the same global order. This is the most common and usually simplest fix. Limits: the order may not match the order in which resources are actually needed, so locks may be held longer than necessary, and sometimes the order can't be known in advance.

## 7. Testing multithreaded code

To demonstrate a race, write a test that:
1. Records the shared starting value.
2. Starts two threads that each perform the operation once.
3. Waits for both to finish.
4. Asserts that the final value is the start value plus 2.
5. Repeats many times. A single pass proves nothing.

To make the failure show up, apply the strategies in `concurrency.md` (Testing threaded code). When the test fails even rarely, the bug is real.
