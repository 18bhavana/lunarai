---
title: Error Handling, Retries & Dead-Letter Topics
subtitle: Transient vs permanent failures, poison pills, Spring Kafka's DefaultErrorHandler and back-off, non-retryable exceptions, dead-letter topics with DeadLetterPublishingRecoverer, non-blocking retries with @RetryableTopic, deserialization errors, and producer-side failures.
order: 11
---

## Introduction

Sooner or later a consumer meets a record it can't process: the database is down, a downstream API times out, or the message itself is broken. How you handle that decides whether one bad record **stops the whole partition**, gets **silently lost**, or is **parked safely** for investigation.

## Transient vs Permanent Failures

| Transient (retry may succeed) | Permanent (retrying won't help) |
| --- | --- |
| Database temporarily unavailable | Malformed JSON / schema mismatch |
| Downstream service timeout or 503 | Validation failure (missing required field) |
| Deadlock, optimistic-lock conflict | Unknown customer / product |
| Rate limited (429) | Bug in your code for this specific data |

**Retry** transient failures with back-off; **don't retry** permanent ones — send them to a **dead-letter topic (DLT)**.

## The Poison-Pill Problem

Kafka delivers a partition's records **in order**. If one record always fails and the consumer keeps retrying it, nothing behind it in that partition is ever processed — the partition is blocked and lag grows forever.

```flow
Record at offset 57 always throws
Consumer retries it endlessly
Records 58, 59, 60… on this partition never get processed
Lag grows; alerts fire
```

The solution is always the same: **bounded retries, then move the record aside** (DLT) and continue.

## Spring Kafka's DefaultErrorHandler

When a `@KafkaListener` throws, the container's `DefaultErrorHandler`:

1. **re-seeks** the partition so the failed record is redelivered;
2. retries according to a **back-off**;
3. when retries are exhausted, calls a **recoverer** (by default it just logs) and moves on.

> [!NOTE]
> The default back-off is **10 attempts with no delay** (`FixedBackOff(0, 9)`), after which the record is logged and **skipped**. That's rarely what you want in production — configure it.

### Configuring Back-Off and a Dead-Letter Topic

```java
@Configuration
public class KafkaErrorConfig {

    @Bean
    public DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
        // After retries are exhausted, publish the record to <topic>-dlt, same partition
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                (record, ex) -> new TopicPartition(record.topic() + "-dlt", record.partition()));

        // 1s, 2s, 4s, 8s … up to 5 attempts
        ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(4);
        backOff.setInitialInterval(1_000);
        backOff.setMultiplier(2.0);
        backOff.setMaxInterval(10_000);

        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff);

        // Permanent failures go straight to the DLT — no pointless retries
        handler.addNotRetryableExceptions(ValidationException.class, JsonProcessingException.class);
        return handler;
    }
}
```

Spring Boot automatically applies a single `CommonErrorHandler` bean to its auto-configured listener containers.

> [!IMPORTANT]
> Create the DLT with **at least as many partitions** as the source topic when the recoverer keeps the same partition number (as above) — otherwise publishing to the DLT fails.

### What Lands in the DLT

The `DeadLetterPublishingRecoverer` copies the original key and value and adds headers describing the failure:

| Header | Content |
| --- | --- |
| `kafka_dlt-exception-fqcn` | Exception class |
| `kafka_dlt-exception-message` | Exception message |
| `kafka_dlt-exception-stacktrace` | Stack trace |
| `kafka_dlt-original-topic` / `-partition` / `-offset` | Where the record came from |
| `kafka_dlt-original-timestamp` | Original timestamp |

## Blocking vs Non-Blocking Retries

The `DefaultErrorHandler` retries **in place**: while it waits and retries one record, the rest of that partition waits too. Fine for short delays (seconds) — but a 5-minute back-off would stall the partition and can exceed `max.poll.interval.ms`.

**Non-blocking retries** move the failed record to a separate **retry topic** with a delay, so the main partition keeps flowing:

```flow
orders — fails
orders-retry-0 — retried after 1 s
orders-retry-1 — retried after 10 s
orders-retry-2 — retried after 60 s
orders-dlt — parked for investigation
```

### @RetryableTopic

```java
@Component
public class PaymentListener {

    @RetryableTopic(
            attempts = "4",                                            // 1 try + 3 retries
            backoff = @Backoff(delay = 1000, multiplier = 10.0, maxDelay = 60000),
            exclude = { ValidationException.class },                   // straight to DLT
            topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
    @KafkaListener(topics = "payments", groupId = "ledger-service")
    public void onPayment(PaymentEvent event) {
        ledgerService.record(event);
    }

    @DltHandler
    public void onDeadLetter(PaymentEvent event, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
        log.error("Payment {} reached the dead-letter topic {}", event.paymentId(), topic);
        alerting.notifyOnCall(event);
    }
}
```

Spring Kafka creates the retry and DLT topics, consumers for them, and the delay logic automatically.

| Blocking (`DefaultErrorHandler`) | Non-blocking (`@RetryableTopic`) |
| --- | --- |
| Retries in place | Retries via separate topics |
| **Preserves ordering** within the partition | **Breaks ordering** — later records overtake the failing one |
| The partition stalls during retries | The main flow continues |
| Best for short, quick retries | Best for long delays (minutes) |

> [!WARNING]
> Choose based on ordering. If events for the same key must be processed in order (e.g. `AccountDebited` then `AccountCredited`), non-blocking retries can apply them out of order.

## Deserialization Errors

If the value can't be deserialized, the exception happens **inside `poll()`** — before your listener runs — and a plain setup fails on the same record forever. Wrap the real deserializer in `ErrorHandlingDeserializer`:

```yaml
spring:
  kafka:
    consumer:
      key-deserializer: org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
      properties:
        spring.deserializer.key.delegate.class: org.apache.kafka.common.serialization.StringDeserializer
        spring.deserializer.value.delegate.class: org.springframework.kafka.support.serializer.JsonDeserializer
        spring.json.trusted.packages: "com.shop.events"
```

The failure is turned into a `DeserializationException` that the error handler treats as **not retryable** and sends straight to the DLT.

## Handling the Dead-Letter Topic

A DLT is only useful if someone acts on it:

- **Alert** when records arrive in a DLT.
- **Inspect** the error headers to find the cause.
- **Fix** the bug or the data, then **replay** — a small tool or admin endpoint that reads the DLT and republishes records to the original topic.
- Give DLTs a **long retention** so nothing expires before it's investigated.

## Producer-Side Failures

| Failure | Handling |
| --- | --- |
| Transient (leader change, timeout) | Retried automatically until `delivery.timeout.ms` |
| Retries exhausted | `send()` future completes exceptionally — log, alert, and store for retry (e.g. leave it in the outbox) |
| `RecordTooLargeException`, serialization errors | Not retried — fix the data or the size limits |
| Authorization errors | Configuration problem — fail fast |

## Interview Questions

### What is a poison pill?

A record that consistently fails processing. Because partitions are consumed in order, endlessly retrying it blocks every later record in that partition.

### How do you handle a message that fails processing?

Retry transient failures with bounded exponential back-off; send permanent failures — and records that exhaust their retries — to a dead-letter topic with error details, alert on it, and replay after fixing the cause.

### What is a dead-letter topic?

A separate topic where records that couldn't be processed are published, with metadata about the failure, so the main consumer can continue.

### What's the difference between blocking and non-blocking retries in Spring Kafka?

Blocking retries (`DefaultErrorHandler` with a back-off) redeliver the same record in place, preserving order but stalling the partition. Non-blocking retries (`@RetryableTopic`) move the record through delayed retry topics, keeping the main flow moving but losing ordering.

### What does DefaultErrorHandler do by default?

Retries a failed record 9 more times with no delay (10 attempts), then logs it and skips to the next record.

### How do you handle deserialization failures?

Use `ErrorHandlingDeserializer` delegating to the real deserializer, so the failure reaches the error handler and the record goes to the DLT instead of failing in `poll()` forever.

## Common Mistakes

- ❌ **Infinite retries** on poison pills — blocked partitions.
- ❌ **Relying on the default handler**, which silently skips records after 10 quick attempts.
- ❌ **Retrying validation errors.**
- ❌ **Long blocking back-offs** that exceed `max.poll.interval.ms`.
- ❌ **Non-blocking retries where ordering matters.**
- ❌ **A DLT that nobody monitors**, or with short retention.
- ❌ **Swallowing exceptions in the listener** — the record is "processed" and lost.

## Key Takeaways

- ✅ Separate transient failures (retry with back-off) from permanent ones (straight to the DLT).
- ✅ Bounded retries + a dead-letter topic prevent poison pills from blocking partitions.
- ✅ `DefaultErrorHandler` + `DeadLetterPublishingRecoverer` = blocking retries that keep ordering.
- ✅ `@RetryableTopic` = non-blocking delayed retries, at the cost of ordering.
- ✅ Wrap deserializers in `ErrorHandlingDeserializer`.
- ✅ Monitor, investigate and replay dead-lettered records.
