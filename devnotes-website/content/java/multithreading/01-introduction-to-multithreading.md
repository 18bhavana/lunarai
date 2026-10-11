---
title: Introduction to Multithreading
subtitle: Processes vs threads, concurrency vs parallelism, why backends use threads, what threads share, and the costs and risks that the rest of this topic teaches you to control.
order: 1
---

## Introduction

> [!NOTE]
> **Interview importance:** multithreading is one of the most heavily tested areas for experienced Java backend developers — almost every interview has at least one concurrency question.

Every Java backend is multithreaded, whether you write a single `new Thread()` or not. Tomcat serves each HTTP request on a worker thread, HikariCP hands out connections to many threads at once, `@Async` and `@Scheduled` run on thread pools, and the JVM itself runs garbage-collector and JIT-compiler threads alongside your code.

This topic goes from the basics — what a thread is and how to start one — through synchronization, the Java Memory Model, locks, atomics, executors, `CompletableFuture`, concurrent collections and virtual threads, to Spring's `@Async` and classic coding scenarios.

## Program, Process and Thread

| Term | Meaning |
| --- | --- |
| **Program** | Code on disk — a `.jar` file is just bytes until it runs |
| **Process** | A running program with its **own memory space**, file handles and resources. Each `java -jar app.jar` starts one JVM process |
| **Thread** | A **path of execution inside a process**. A process has one or more threads that share its memory |

```tree
JVM process
  Heap | shared by all threads — objects, static fields
  Metaspace | shared — class metadata
  main thread | own stack, own program counter
  http-nio-8080-exec-1 | own stack, own program counter
  http-nio-8080-exec-2 | own stack, own program counter
  GC and JIT threads | JVM housekeeping
```

### What Threads Share — and What They Don't

| Shared by all threads | Private to each thread |
| --- | --- |
| Heap — every object created with `new` | Stack — local variables and method-call frames |
| Static fields | Program counter — the next instruction to run |
| Class metadata (Metaspace) | `ThreadLocal` values |
| Open files, sockets, connection pools | |

> [!IMPORTANT]
> **Local variables are thread-safe by construction** — each thread has its own copy on its own stack. Problems start only when threads share **mutable objects on the heap**. Almost every concurrency bug in this topic comes from that one fact.

## Process vs Thread

| Process | Thread |
| --- | --- |
| Own memory space | Shares the process's memory |
| Heavyweight to create (OS allocates address space) | Lighter to create (but still an OS resource) |
| Communicates via IPC — sockets, pipes, files | Communicates by reading and writing shared objects |
| A crash usually doesn't affect other processes | An uncaught error affects only that thread, but corrupted shared state affects all |
| Context switch is expensive | Context switch is cheaper |

## Why Use Multiple Threads?

- **Responsiveness** — a server can keep accepting requests while others are being processed.
- **Throughput** — while one thread waits for the database or a remote API, others use the CPU.
- **Using multiple cores** — CPU-heavy work (image processing, report generation) can be split across cores.
- **Background work** — sending emails, cleaning caches and polling queues without blocking users.

## Concurrency vs Parallelism

A favourite interview question.

| Concurrency | Parallelism |
| --- | --- |
| **Dealing with** many tasks at once | **Doing** many tasks at the same instant |
| Tasks make progress in overlapping time periods | Tasks literally run simultaneously |
| Possible on a single core (time slicing) | Needs multiple cores |
| About **structure** — managing independent tasks | About **execution** — speeding up work |

```flow Single core — concurrency by time slicing
Thread A runs
: context switch
Thread B runs
: context switch
Thread A continues
```

```flow Four cores — parallelism
Core 1
Thread A
---
Core 2
Thread B
---
Core 3
Thread C
---
Core 4
Thread D
```

A web server handling 200 requests on 8 cores is doing both: the requests are *concurrent*, and up to 8 of them execute *in parallel* at any instant.

## I/O-Bound vs CPU-Bound Work

How many threads help depends on what the threads do.

| I/O-bound | CPU-bound |
| --- | --- |
| Mostly **waiting** — database queries, HTTP calls, file reads | Mostly **computing** — hashing, compression, calculations |
| Many more threads than cores help, because waiting threads don't use the CPU | More threads than cores **don't** help — they just compete and context-switch |
| Typical of REST APIs and microservices | Typical of batch processing and analytics |
| Virtual threads (Java 21) shine here | Use roughly one thread per core (ForkJoinPool, parallel streams) |

## The Main Thread

Every Java program starts with one non-daemon thread called `main`:

```java
public class Main {
    public static void main(String[] args) {
        Thread current = Thread.currentThread();
        System.out.println(current.getName());   // main
        System.out.println(current.getId());     // usually 1
        System.out.println(Runtime.getRuntime().availableProcessors() + " cores");
    }
}
```

```output
main
1
8 cores
```

The JVM exits when **all non-daemon threads** have finished — not when `main` returns. (`getId()` is deprecated since Java 19 in favour of `threadId()`.)

## The Costs and Risks of Threads

Threads aren't free:

| Cost | Why |
| --- | --- |
| **Memory** | Each platform thread reserves a stack — typically 512 KB–1 MB (`-Xss`) |
| **Creation time** | Creating an OS thread is a system call |
| **Context switching** | The CPU saves and restores registers and loses cache warmth on every switch |
| **Scheduling limits** | Thousands of platform threads overwhelm the OS scheduler |

And they introduce whole new categories of bugs:

| Problem | What goes wrong | Covered in |
| --- | --- | --- |
| **Race condition** | Two threads update shared data and one update is lost | Race conditions & synchronized |
| **Visibility** | One thread's write is never seen by another | Java Memory Model & volatile |
| **Deadlock** | Threads wait for each other forever | Deadlock, livelock & starvation |
| **Starvation** | A thread never gets the CPU or lock it needs | Deadlock, livelock & starvation |
| **Thread leaks** | Pools that are never shut down; `ThreadLocal` values that are never cleaned | Executors; ThreadLocal |

> [!TIP]
> Concurrency bugs are **non-deterministic**: the same code can pass a thousand tests and fail in production under load. That's why the rest of this topic focuses on writing code that is correct **by design**, not by testing.

## How Java Supports Concurrency

```flow
Thread and Runnable — Java 1.0
synchronized, wait / notify — Java 1.0
java.util.concurrent: executors, locks, atomics, concurrent collections — Java 5
Fork/Join framework — Java 7
CompletableFuture, parallel streams — Java 8
Virtual threads — Java 21
```

Modern code rarely creates raw threads. It submits tasks to **executors**, coordinates with **`CompletableFuture`** and concurrency utilities, and — for high-concurrency I/O — uses **virtual threads**.

## Interview Questions

### Q1. What is the difference between a process and a thread?

A process is a running program with its own memory space; a thread is a unit of execution inside a process. Threads of the same process share the heap and static data but each has its own stack and program counter.

### Q2. What is the difference between concurrency and parallelism?

Concurrency is about managing multiple tasks whose execution overlaps in time — possible even on one core through time slicing. Parallelism is running tasks at literally the same instant on multiple cores.

### Q3. Which memory areas are shared between threads?

The heap (all objects), static fields and class metadata are shared. Each thread's stack — local variables and call frames — and its program counter are private.

### Q4. Are local variables thread-safe?

Yes — each thread gets its own copy on its own stack. But if a local variable **references** a shared object on the heap, the object itself is not protected.

### Q5. When does the JVM exit?

When all non-daemon threads have finished (or `System.exit()` is called). Daemon threads don't keep the JVM alive.

### Q6. Why not just create more threads to go faster?

For CPU-bound work, more threads than cores only add context switching. Each platform thread also costs memory and scheduling overhead. The right number depends on whether the work is CPU-bound or I/O-bound.

## Common Mistakes

- ❌ **Thinking multithreading always makes code faster** — for CPU-bound work beyond the core count, and for very small tasks, it makes things slower.
- ❌ **Assuming a single-threaded test proves thread safety** — concurrency bugs appear only under real interleavings.
- ❌ **Forgetting your code is already multithreaded** — a Spring singleton bean with a mutable field is shared by every request thread.
- ❌ **Confusing concurrency with parallelism** in interviews.

## Best Practices

- ✅ Prefer **immutable objects** and **local variables**; share as little mutable state as possible.
- ✅ Use **executors and thread pools** instead of creating threads manually.
- ✅ Choose thread counts based on whether work is **CPU-bound or I/O-bound**.
- ✅ Treat every Spring singleton (controllers, services, repositories) as **shared by many threads** — keep it stateless.
- ✅ Use high-level utilities from `java.util.concurrent` before low-level `wait`/`notify`.

## Key Takeaways

- ✅ A process has its own memory; threads inside it share the heap and static data but have their own stacks.
- ✅ Concurrency is about structure (overlapping tasks); parallelism is about simultaneous execution on multiple cores.
- ✅ I/O-bound work benefits from many threads; CPU-bound work from about one thread per core.
- ✅ The JVM exits when all non-daemon threads finish.
- ✅ Threads bring race conditions, visibility problems, deadlocks and starvation — the rest of this topic is about preventing them.
