---
title: Kafka with Spring Boot (Spring Kafka)
subtitle: Spring Boot auto-configuration, application.yml settings, creating topics with NewTopic beans, sending with KafkaTemplate and handling the result, @KafkaListener, JSON events, concurrency, manual acknowledgement, batch listeners, headers, and testing with embedded Kafka and Testcontainers.
order: 10
---

## Introduction

**Spring for Apache Kafka** (Spring Kafka) wraps the Kafka clients in familiar Spring abstractions: `KafkaTemplate` for producing and `@KafkaListener` for consuming, with Spring Boot configuring everything from `application.yml`. The examples here use Spring Boot 3.x.

```xml
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
```

## Configuration

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      acks: all
      properties:
        enable.idempotence: true
        linger.ms: 10
        compression.type: lz4
    consumer:
      group-id: notification-service
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "com.shop.events"
    listener:
      ack-mode: record          # commit after each record is processed
      concurrency: 3            # 3 consumer threads per listener
```

Anything not covered by a dedicated property goes under `properties:` and is passed straight to the Kafka client.

## Creating Topics

Spring Boot's `KafkaAdmin` creates topics declared as beans when the application starts (and leaves existing ones alone):

```java
@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic ordersTopic() {
        return TopicBuilder.name("orders")
                .partitions(6)
                .replicas(3)
                .config(TopicConfig.MIN_IN_SYNC_REPLICAS_CONFIG, "2")
                .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(Duration.ofDays(7).toMillis()))
                .build();
    }
}
```

## The Event

```java
public record OrderPlacedEvent(String eventId, String orderId, String customerId,
                               BigDecimal amount, Instant occurredAt) { }
```

## Producing with KafkaTemplate

```java
@Service
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);
    private final KafkaTemplate<String, OrderPlacedEvent> kafkaTemplate;

    public OrderEventPublisher(KafkaTemplate<String, OrderPlacedEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(OrderPlacedEvent event) {
        kafkaTemplate.send("orders", event.orderId(), event)          // key = orderId → per-order ordering
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        RecordMetadata m = result.getRecordMetadata();
                        log.info("Published {} to {}-{}@{}", event.eventId(), m.topic(), m.partition(), m.offset());
                    } else {
                        log.error("Failed to publish {}", event.eventId(), ex);
                    }
                });
    }
}
```

`send()` returns a `CompletableFuture<SendResult<K, V>>` (Spring Kafka 3.0+). Attach a callback rather than calling `.get()` on the request thread — unless the caller must know the send succeeded before responding.

> [!WARNING]
> Calling `kafkaTemplate.send()` right after a database save is a **dual write** — if the send fails after the transaction commits, the event is lost. For events that must not be lost, use the **transactional outbox** (see *Delivery Semantics & Exactly-Once*).

### Sending with Headers

```java
Message<OrderPlacedEvent> message = MessageBuilder.withPayload(event)
        .setHeader(KafkaHeaders.TOPIC, "orders")
        .setHeader(KafkaHeaders.KEY, event.orderId())
        .setHeader("eventType", "OrderPlaced")
        .build();
kafkaTemplate.send(message);
```

## Consuming with @KafkaListener

```java
@Component
public class OrderEventListener {

    private static final Logger log = LoggerFactory.getLogger(OrderEventListener.class);
    private final NotificationService notificationService;

    public OrderEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @KafkaListener(topics = "orders", groupId = "notification-service")
    public void onOrderPlaced(OrderPlacedEvent event,
                              @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                              @Header(KafkaHeaders.OFFSET) long offset) {
        log.info("Received {} from partition {} offset {}", event.orderId(), partition, offset);
        notificationService.sendOrderConfirmation(event);
    }
}
```

Behind the annotation, a **listener container** runs the poll loop, deserializes records, calls your method, handles errors and commits offsets. If the method returns normally, the record is considered processed; if it throws, the container's **error handler** decides what happens (next chapter).

### Receiving the Whole Record

```java
@KafkaListener(topics = "orders")
public void listen(ConsumerRecord<String, OrderPlacedEvent> record) {
    log.info("key={} partition={} offset={} headers={}",
            record.key(), record.partition(), record.offset(), record.headers());
}
```

## Concurrency

`concurrency: 3` (or `@KafkaListener(concurrency = "3")`) starts three consumers — each on its own thread — in one application instance. With three instances of the service, the group has nine consumers.

> [!TIP]
> Total consumers in a group = instances × concurrency. Keep it **≤ the number of partitions**; anything above that is idle.

## Acknowledgement Modes

Spring Kafka disables the Kafka client's auto-commit and commits through the container instead (`spring.kafka.listener.ack-mode`):

| Ack mode | Commits |
| --- | --- |
| `BATCH` (default) | After all records returned by one `poll()` are processed |
| `RECORD` | After each record is processed |
| `TIME` / `COUNT` / `COUNT_TIME` | After a time interval or number of records |
| `MANUAL` | When you call `acknowledgment.acknowledge()` — committed with the next batch |
| `MANUAL_IMMEDIATE` | Immediately when you call `acknowledge()` |

```java
@KafkaListener(topics = "payments", groupId = "ledger-service")
public void onPayment(PaymentEvent event, Acknowledgment ack) {
    ledgerService.record(event);   // if this throws, we never acknowledge
    ack.acknowledge();
}
```

(Requires `ack-mode: manual` or `manual_immediate`.)

## Batch Listeners

Process a whole poll at once — useful for bulk database inserts:

```yaml
spring:
  kafka:
    listener:
      type: batch
```

```java
@KafkaListener(topics = "clickstream", groupId = "analytics")
public void onClicks(List<ClickEvent> events) {
    clickRepository.saveAll(events);   // one round trip for the whole batch
}
```

## JSON Serialization Notes

- `JsonSerializer` adds **type headers** (`__TypeId__`) by default; the `JsonDeserializer` uses them to choose the class.
- The deserializer only creates classes from **trusted packages** (`spring.json.trusted.packages`) — a security measure.
- When producer and consumer use different class names, set `spring.json.use.type.headers: false` and `spring.json.value.default.type: com.shop.events.OrderPlacedEvent` on the consumer, or map types.
- A record that **can't be deserialized** would make a plain consumer fail forever — wrap it in `ErrorHandlingDeserializer` (next chapter).

## Testing

### Embedded Kafka

```java
@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = "orders")
class OrderEventPublisherTest {

    @Autowired OrderEventPublisher publisher;
    @Autowired EmbeddedKafkaBroker broker;

    @Test
    void publishesOrderPlacedEvent() {
        publisher.publish(new OrderPlacedEvent("e1", "ORD-1", "C-1", BigDecimal.TEN, Instant.now()));
        // consume from "orders" with KafkaTestUtils and assert on the record
    }
}
```

### Testcontainers (a real broker)

```java
@SpringBootTest
@Testcontainers
class OrderFlowIT {

    @Container
    @ServiceConnection
    static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("apache/kafka-native:latest"));

    // tests run against a real Kafka in Docker; @ServiceConnection sets spring.kafka.bootstrap-servers
}
```

Use **Awaitility** to wait for asynchronous listener effects instead of `Thread.sleep()`.

## Interview Questions

### How do you produce and consume messages in Spring Boot?

Inject `KafkaTemplate` and call `send(topic, key, value)`; annotate a method with `@KafkaListener(topics = ..., groupId = ...)` to consume. Spring Boot configures both from `spring.kafka.*` properties.

### What does KafkaTemplate.send() return?

A `CompletableFuture<SendResult>` (Spring Kafka 3+) — attach `whenComplete` to log success with the partition and offset, or handle failures.

### How does Spring Kafka commit offsets?

The listener container commits them according to the ack mode — by default after each poll batch is processed (`BATCH`) — with Kafka's own auto-commit disabled. `MANUAL` modes let you call `Acknowledgment.acknowledge()`.

### What is the concurrency setting?

The number of consumer threads (each a separate `KafkaConsumer`) the listener container runs in one application instance.

### Why use ErrorHandlingDeserializer?

So a record that can't be deserialized is passed to the error handler (and, for example, sent to a dead-letter topic) instead of making the consumer fail on it forever.

### How do you test Kafka code in Spring Boot?

With `@EmbeddedKafka` for fast tests, or Testcontainers with a real broker for integration tests, using Awaitility to assert asynchronous results.

## Common Mistakes

- ❌ **Blocking on `send().get()`** in every request.
- ❌ **Dual writes** to the database and Kafka for critical events.
- ❌ **Concurrency × instances greater than partitions.**
- ❌ **Untrusted-package errors** from the `JsonDeserializer` — configure `trusted.packages`.
- ❌ **Slow listeners** exceeding `max.poll.interval.ms`, causing rebalances.
- ❌ **`Thread.sleep()` in tests** instead of Awaitility.

## Key Takeaways

- ✅ Spring Boot configures producers and consumers from `spring.kafka.*`.
- ✅ Declare topics as `NewTopic` beans with partitions, replicas and configs.
- ✅ `KafkaTemplate.send()` is asynchronous and returns a `CompletableFuture`.
- ✅ `@KafkaListener` runs on a listener container that polls, deserializes, handles errors and commits offsets.
- ✅ Choose the ack mode deliberately; keep instances × concurrency ≤ partitions.
- ✅ Test with embedded Kafka or Testcontainers.
