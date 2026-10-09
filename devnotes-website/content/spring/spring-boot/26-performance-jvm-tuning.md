---
title: Performance and JVM Tuning
subtitle: Measure first — JVM memory (heap, stack, Metaspace), OutOfMemoryError vs StackOverflowError, garbage collectors and G1, JVM flags, HikariCP, thread pools and @Async, caching, N+1 queries and profiling tools.
order: 26
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

Performance tuning separates a good Java developer from a senior one. Most production issues aren't caused by bugs — they're caused by slow SQL, memory leaks, thread starvation, connection-pool exhaustion, poor garbage collection, excessive object creation, blocking I/O, cache misses and inefficient algorithms.

Interviewers frequently ask: Why is your Spring Boot application slow? How do you identify bottlenecks? Heap vs stack? Explain G1GC. What causes `OutOfMemoryError` and `StackOverflowError`? What is HikariCP? How do you tune thread pools? What is the N+1 query problem? What tools do you use?

## Performance Layers

Performance problems can exist at any layer:

```flow Never assume the JVM is the bottleneck
Client
Network
Load balancer
Spring Boot
JVM
Database
Disk
Operating system
```

## Performance Tuning Strategy

Senior engineers follow this order:

```flow-h Never optimize based on assumptions
Measure
Identify the bottleneck
Optimize
Measure again
```

## JVM Memory Model

One of the most important interview topics.

```tree
JVM memory
  Heap
  Stack (one per thread)
  Metaspace
  Code cache
  Other native memory
```

### Heap

Stores **objects** — arrays, collections, Spring beans, Hibernate entities. In `User user = new User();`, the `User` object lives on the heap.

### Stack

Each thread has its own stack of **method frames**, holding **local variables** — primitive values and **references** to heap objects (not the objects themselves).

```java
public void calculate() {
    int x = 10;   // x lives on the stack
}
```

### Heap vs Stack

**Interview favourite.**

| Heap | Stack |
| --- | --- |
| Stores objects | Stores method frames (locals, references) |
| Shared by all threads | Thread-specific |
| Garbage collected | Freed automatically when a method returns |
| Larger | Smaller |
| Slower allocation/access | Faster |

### Metaspace

Since **Java 8**, class metadata (classes, methods, bytecode information) lives in **Metaspace**, in native memory. Before Java 8 it was the **PermGen** space inside the heap.

### Memory Allocation

```flow-h
new User()
Heap allocation
Reference stored in a stack variable
Garbage collector reclaims it when unreachable
```

## OutOfMemoryError

Common reasons: memory leaks, very large collections, unbounded caches, loading huge files into memory, and a heap that's simply too small.

```java
List<byte[]> list = new ArrayList<>();

while (true) {
    list.add(new byte[1024]);
}
```

Eventually: `java.lang.OutOfMemoryError: Java heap space`.

## StackOverflowError

Usually caused by **infinite (or very deep) recursion**:

```java
public void test() {
    test();
}
```

Each call adds another stack frame until the thread's stack is exhausted.

## Garbage Collection

GC removes **unreachable** objects from the heap:

```flow-h
Create objects
Use objects
No more references
Garbage collector
Memory reclaimed
```

### Heap Generations

Modern collectors organize memory differently internally, but the traditional generational model is useful for understanding GC:

| Region | Contents | GC |
| --- | --- | --- |
| Young generation | New objects | Frequent (minor GC) |
| Old generation | Long-lived objects | Less frequent (major/mixed GC) |

```flow-h GC cycle
Object created
Young generation
Minor GC (survivors promoted)
Old generation
Major / mixed GC
Collected
```

### G1 Garbage Collector

The **default collector since JDK 9** (on server-class machines). It splits the heap into **many regions**, collects in parallel and targets **low, predictable pause times**. Benefits: predictable pauses, large-heap support and good overall throughput.

### Other Garbage Collectors

**Interview favourite.**

| Collector | Best for |
| --- | --- |
| Serial GC | Small applications |
| Parallel GC | Maximum throughput |
| G1 GC | General purpose (default) |
| ZGC | Very low pause times |
| Shenandoah | Low latency |

## Common JVM Options

```text
-Xms2G
-Xmx2G
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
```

| Option | Purpose |
| --- | --- |
| `-Xms` | Initial heap size |
| `-Xmx` | Maximum heap size |
| `-XX:+UseG1GC` | Enable the G1 collector |
| `-XX:MaxGCPauseMillis` | Pause-time target |

## Spring Boot Startup Performance

```flow-h
main()
SpringApplication.run()
Component scan
Bean creation
Auto-configuration
Embedded Tomcat
Ready
```

Slow startup usually comes from too many beans, heavy initialization, slow database connections, expensive `@PostConstruct` methods and a large classpath.

### Lazy Initialization

```text
spring.main.lazy-initialization=true
```

Beans are created only when first needed. ✅ Faster startup. ❌ The first request may be slower (and configuration errors surface later).

## HikariCP

**Interview favourite.** The **default Spring Boot connection pool**.

```flow-h
Application
Hikari pool
Database connections
MySQL
```

### Why a Connection Pool?

```flow
Without pooling
HTTP request
Open connection (expensive)
Execute SQL
Close connection
---
With pooling
Request
Reuse an existing connection
Database
```

Much faster.

### Common Hikari Settings

```text
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
```

(The default maximum pool size is 10. Bigger isn't automatically better — the database has limits too.)

## Thread Pools

**Never create unlimited threads.**

```java
new Thread(...).start();                                          // ❌

ExecutorService executor = Executors.newFixedThreadPool(10);      // ✅
```

Spring example:

```java
@EnableAsync
@Configuration
public class AsyncConfig {

    @Bean
    ThreadPoolTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(500);
        return executor;
    }
}
```

> [!TIP]
> On Java 21+ with Spring Boot 3.2+, `spring.threads.virtual.enabled=true` runs request handling and `@Async` tasks on **virtual threads**, which helps blocking I/O-heavy apps.

### @Async

```java
@Async
public void sendEmail() {
}
```

```flow-h
HTTP request
Business logic
Thread pool
Background task
```

Useful for emails, notifications, reports and image processing. (Like `@Transactional`, `@Async` works through a proxy — self-invocation won't run it asynchronously.)

## Caching

Instead of hitting the database on every request, check a **cache** first. Benefits: lower latency and reduced database load.

```java
@Cacheable("users")
public User getUser(Long id) {
}
```

```flow
Request
? In cache? | Yes: Return cached value | No: Query database → store in cache
```

(Enable it with `@EnableCaching`.)

### Cache Providers

| Provider | Best use |
| --- | --- |
| Caffeine | In-memory (local) cache |
| Redis | Distributed cache |
| Hazelcast | Distributed in-memory data grid |

## Database Performance

Most performance issues originate here. Always:

- Use indexes
- Avoid `SELECT *`
- Fetch only the required columns
- Use pagination
- Analyze execution plans

### N+1 Query Problem

**Interview favourite.**

```flow-h 101 SQL statements — very slow
Load orders (1 query)
100 orders
100 customer queries
```

**Solution:** use fetch joins or entity graphs where appropriate:

```java
@Query("""
        SELECT o
        FROM Order o
        JOIN FETCH o.customer
        """)
```

This retrieves the related data in a single query.

### Pagination

```text
SELECT * FROM USERS;            -- ❌ loads the whole table
SELECT * FROM USERS LIMIT 20;   -- ✅
```

Spring Data:

```java
Page<User> users = repository.findAll(pageable);
```

## Code-Level Tips

### Logging

```java
logger.info("User " + user.getName());     // ❌ string is built even if INFO is disabled
logger.info("User {}", user.getName());     // ✅ SLF4J formats only when needed
```

(The argument expression itself still runs; for expensive arguments, guard with `if (logger.isDebugEnabled())`.)

### Avoid Unnecessary Object Creation

```java
for (int i = 0; i < 100000; i++) {
    new Object();
}
```

Unnecessary allocations increase **GC pressure**.

### Immutable Objects

Immutable objects are generally thread-safe, easier to cache and less error-prone. Use immutable DTOs (e.g. records) where appropriate.

## Profiling and Diagnostics

**Interview favourite.** Common tools:

- Java Flight Recorder (JFR)
- Java Mission Control (JMC)
- VisualVM
- Eclipse Memory Analyzer (MAT)
- JConsole
- async-profiler

**Use profilers before making optimizations.**

### Thread Dump

Diagnoses deadlocks, blocked threads, high CPU and thread starvation: `jstack <PID>`, or the Actuator `threaddump` endpoint.

### Heap Dump

Diagnoses memory leaks, large collections and duplicate objects: `jmap -dump:live,format=b,file=heap.hprof <PID>`, or the Actuator `heapdump` endpoint. Analyze with Eclipse MAT.

### GC Logs

Enable with `-Xlog:gc*` and analyze pause times, allocation rate, heap usage and full-GC frequency.

### JVM Monitoring

GC, heap, threads and CPU are usually monitored through **Micrometer → Prometheus → Grafana**.

## Performance Analysis Workflow

```flow
Slow API
Metrics
Thread dump
Heap dump
GC logs
SQL analysis
Fix
Measure again
```

### Common Bottlenecks

Slow SQL, missing indexes, too many threads, an exhausted connection pool, GC pressure, large object creation and network delay.

```flow-h Request path
Client
Spring Boot
Thread pool
Connection pool
Hibernate
JDBC
Database
```

## Common Mistakes

- ❌ **A huge heap** — large heaps can increase GC pause times. Size the heap from measurements, not guesswork.
- ❌ **Unlimited thread creation** — leads to high CPU, memory exhaustion and context-switching overhead. Use managed thread pools.
- ❌ **No connection pool** — opening a database connection per request is expensive. Use HikariCP.
- ❌ **No cache** — cache frequently accessed data when appropriate.
- ❌ **Loading entire tables** — always paginate large result sets.
- ❌ **Ignoring SQL execution plans** — verify indexes with execution plans, not assumptions.
- ❌ **Optimizing without measuring** — always profile first.

## Enterprise Performance Architecture

```flow
Client
Load balancer
Spring Boot
Thread pool
Cache
HikariCP
Database
Metrics → Prometheus → Grafana → alerts
```

## Interview Questions

### Q1. What is the difference between heap and stack?

| Heap | Stack |
| --- | --- |
| Objects | Method frames |
| Shared | Thread-local |
| Garbage collected | Released automatically |

### Q2. What causes OutOfMemoryError?

Memory leaks, excessive object creation, very large collections and insufficient heap.

### Q3. What causes StackOverflowError?

Usually infinite or excessively deep recursion.

### Q4. Which GC is the default in modern Java?

The G1 garbage collector (since JDK 9).

### Q5. What is HikariCP?

The default high-performance JDBC connection pool used by Spring Boot.

### Q6. Why use connection pooling?

To reuse database connections instead of opening a new one for every request.

### Q7. What is the N+1 query problem?

Fetching a list of parents and then running one extra query per parent entity, resulting in many unnecessary database calls.

### Q8. Why use @Cacheable?

To reduce repeated database access for frequently requested data.

### Q9. What tools do you use for performance analysis?

JFR, JMC, VisualVM, Eclipse MAT, async-profiler, Micrometer, Prometheus and Grafana.

### Q10. What is the first step in performance tuning?

Measure the application and identify the bottleneck before optimizing.

## Key Takeaways

- ✅ Performance tuning must be measurement-driven.
- ✅ Know the JVM memory model: heap, stack and Metaspace.
- ✅ G1 is the default collector and balances throughput with pause times.
- ✅ HikariCP improves database performance through connection pooling.
- ✅ Thread pools and `@Async` manage concurrent work efficiently.
- ✅ Caching, good SQL and avoiding N+1 queries are among the highest-impact optimizations.
- ✅ Profile with JFR, JMC, VisualVM, MAT or async-profiler before changing code.
- ✅ Monitor continuously with Micrometer, Prometheus and Grafana.
