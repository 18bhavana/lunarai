---
title: Schemas, Serialization & Schema Registry
subtitle: Why event contracts matter, JSON vs Avro vs Protobuf, how a Schema Registry works, backward, forward and full compatibility, safe schema evolution rules, event design and versioning, and configuring Avro in Spring Boot.
order: 12
---

## Introduction

A Kafka topic is a **contract** between teams. Producers and consumers are deployed independently, often by different teams, so the shape of each event must be agreed — and must be able to **evolve** without breaking anyone. Serialization formats and a **Schema Registry** make that safe.

## The Problem

```flow
Order team renames customerId to clientId and deploys
Old events still have customerId; new events have clientId
Billing service, not yet updated, reads null customer IDs
Invoices fail in production
```

Kafka itself doesn't care what's in the bytes — it will happily accept an event that breaks every consumer. **Schema enforcement has to come from you.**

## Serialization Formats

| | JSON | Avro | Protobuf |
| --- | --- | --- | --- |
| Encoding | Text | Compact binary | Compact binary |
| Schema | Optional (JSON Schema) | Required (`.avsc`, JSON-defined) | Required (`.proto`) |
| Size | Largest (field names in every message) | Small | Small |
| Human-readable on the topic | ✅ | ❌ | ❌ |
| Code generation | Optional | Yes (Java classes from `.avsc`) | Yes (`protoc`) |
| Schema evolution | Manual discipline | Excellent, with defaults | Excellent, with field numbers |
| Typical use | Simple systems, low volume, prototypes | The Kafka ecosystem standard (Confluent, Kafka Connect) | gRPC shops, polyglot systems |

## Schema Registry

A **Schema Registry** (Confluent Schema Registry, Apicurio, AWS Glue Schema Registry, Karapace…) stores versioned schemas and checks compatibility when new versions are registered.

```flow
Producer serializer registers or looks up the schema and gets a schema ID
Message = magic byte + 4-byte schema ID + binary payload
Message sent to Kafka — no full schema in each message
Consumer deserializer reads the ID and fetches the schema (cached)
Consumer decodes the payload with the writer's schema
```

Benefits:

- Messages are tiny — just an ID instead of the whole schema.
- **Incompatible schema changes are rejected** at registration time, before they reach production.
- Schemas are discoverable and versioned — a living catalogue of your events.

Schemas are grouped into **subjects**, by default `<topic>-value` and `<topic>-key`.

## An Avro Schema

```json
{
  "type": "record",
  "name": "OrderPlaced",
  "namespace": "com.shop.events",
  "fields": [
    { "name": "eventId",    "type": "string" },
    { "name": "orderId",    "type": "string" },
    { "name": "customerId", "type": "string" },
    { "name": "amount",     "type": { "type": "bytes", "logicalType": "decimal", "precision": 12, "scale": 2 } },
    { "name": "occurredAt", "type": { "type": "long", "logicalType": "timestamp-millis" } },
    { "name": "couponCode", "type": ["null", "string"], "default": null }
  ]
}
```

The optional `couponCode` uses a **union with null** and a **default** — what makes adding fields safe.

## Compatibility Modes

| Mode | New schema can read… | Safe changes | Upgrade order |
| --- | --- | --- | --- |
| **BACKWARD** (default) | Data written with the **previous** schema | Delete fields; add **optional** fields (with defaults) | **Consumers first**, then producers |
| **FORWARD** | Old schema can read data written with the **new** one | Add fields; delete **optional** fields | **Producers first**, then consumers |
| **FULL** | Both directions | Add or delete **optional** fields only | Any order |
| `*_TRANSITIVE` | …all previous versions, not just the last | Same, checked against every version | — |
| **NONE** | No checks | Anything — dangerous | — |

> [!TIP]
> **BACKWARD_TRANSITIVE** or **FULL_TRANSITIVE** are good defaults for long-lived topics where consumers may replay old data from the beginning.

## Safe Evolution Rules

| Change | Safe? |
| --- | --- |
| Add an **optional** field with a default | ✅ |
| Remove an optional field | ✅ (backward) |
| Add a **required** field with no default | ❌ — old data can't be read |
| **Rename** a field | ❌ — use an alias, or add the new field and deprecate the old one |
| Change a field's **type** (`int` → `string`) | ❌ (except allowed promotions like `int` → `long`) |
| Reuse a removed Protobuf field number | ❌ — mark it `reserved` |

For breaking changes, publish a **new topic** or a **new event type** (`OrderPlacedV2`) and migrate consumers deliberately.

## Event Design Guidelines

- **Name events in the past tense** — `OrderPlaced`, `PaymentFailed`, `ShipmentDispatched`: they're facts.
- **Include a unique `eventId`** for deduplication and an **`occurredAt`** timestamp.
- **Use the entity ID as the key** to preserve per-entity ordering.
- **Event notification vs event-carried state:** a thin event (`{"orderId": "ORD-1"}`) forces consumers to call back for details; a fat event carries the data they need, reducing coupling and load.
- **Don't leak internal database models** — design events as a public API.
- **Use headers for metadata** — event type, schema version, trace ID, source service.
- **Use `decimal` logical types for money**, never floats.

## Avro in Spring Boot

```xml
<dependency>
    <groupId>io.confluent</groupId>
    <artifactId>kafka-avro-serializer</artifactId>
    <version><!-- matching Confluent platform version --></version>
</dependency>
<!-- plus the avro-maven-plugin to generate Java classes from .avsc files -->
```

```yaml
spring:
  kafka:
    producer:
      value-serializer: io.confluent.kafka.serializers.KafkaAvroSerializer
    consumer:
      value-deserializer: io.confluent.kafka.serializers.KafkaAvroDeserializer
    properties:
      schema.registry.url: http://localhost:8081
      specific.avro.reader: true              # deserialize into generated classes
      auto.register.schemas: false            # register schemas through CI, not at runtime
```

> [!NOTE]
> In production, register schemas from your **CI pipeline** (e.g. the Schema Registry Maven plugin) and set `auto.register.schemas=false`, so an accidental incompatible change fails the build instead of reaching a topic.

## Interview Questions

### Why use a Schema Registry?

To enforce event contracts between independently deployed producers and consumers: schemas are versioned, compatibility is checked when a new version is registered, and messages carry only a small schema ID.

### Avro vs JSON for Kafka?

Avro is compact binary with a required schema and well-defined evolution rules; JSON is human-readable but larger and has no built-in enforcement. Avro (or Protobuf) with a registry is preferred for important, high-volume topics.

### What is backward compatibility?

Consumers using the new schema can read data written with the old one. It allows deleting fields and adding optional fields with defaults, and requires upgrading consumers first.

### How do you add a field without breaking consumers?

Make it optional with a default value (in Avro, a union with `null` and `"default": null`).

### How do you handle a breaking change?

Publish to a new topic or a new versioned event type, run both during migration, and move consumers over before retiring the old one.

### What does the schema ID in a message do?

It tells the deserializer which schema version wrote the message; the deserializer fetches (and caches) that schema from the registry to decode the bytes.

## Common Mistakes

- ❌ **No schema discipline** — "it's just JSON".
- ❌ **Renaming or retyping fields** in place.
- ❌ **Adding required fields** without defaults.
- ❌ **Auto-registering schemas from production apps.**
- ❌ **Floats for money.**
- ❌ **Exposing internal database entities** as events.

## Key Takeaways

- ✅ Topics are contracts; Kafka doesn't enforce them — schemas do.
- ✅ Avro and Protobuf are compact, typed and evolvable; JSON is simple but unenforced.
- ✅ A Schema Registry versions schemas and rejects incompatible changes; messages carry a schema ID.
- ✅ BACKWARD (default), FORWARD and FULL define which changes are safe and the upgrade order.
- ✅ Add optional fields with defaults; never rename or retype in place.
