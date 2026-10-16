---
title: "Design: Notification System"
subtitle: A complete worked design of a system that sends push, SMS, email and in-app notifications at scale — requirements, estimates, API, architecture with queues per channel, templates and preferences, retries and provider failover, deduplication, rate limits, scheduling, tracking and trade-offs.
order: 13
---

## Introduction

Almost every product needs to notify users: order confirmations, OTPs, payment alerts, delivery updates, marketing campaigns. A **notification system** is a common interview question because it combines asynchronous processing, third-party integrations, reliability, rate limiting and user preferences.

## Step 1 — Requirements

### Functional

- Send notifications over **push** (iOS APNs / Android FCM), **SMS**, **email** and **in-app**.
- Triggered by other services (events or API calls) — e.g. *"order shipped"*.
- **Templates** with personalisation and **multiple languages**.
- Respect **user preferences** — opt-outs per channel and category, quiet hours.
- **Scheduled** notifications and **bulk campaigns**.
- Track **delivery status** (sent, delivered, opened, failed).

### Non-Functional

- **High throughput** — millions of notifications per day, bursts during campaigns.
- **Reliability** — critical notifications (OTP, payment alerts) must not be lost.
- **Low latency for critical types** — an OTP within seconds; marketing can wait.
- **No duplicates** — users shouldn't receive the same message twice.
- **Extensible** — adding a channel (WhatsApp) shouldn't require a redesign.

## Step 2 — Estimates

| Assumption | Value |
| --- | --- |
| Users | 100 million |
| Notifications per day | 50 million push, 10 million email, 5 million SMS, 50 million in-app |
| Campaign peak | 10 million notifications within 10 minutes |

| Estimate | Result |
| --- | --- |
| Average rate | ~115 million/day ÷ 10⁵ ≈ **1,150/s** |
| Campaign peak | 10 M ÷ 600 s ≈ **17,000/s** |
| Notification log storage | 115 M/day × ~1 KB ≈ **115 GB/day** — time-series or wide-column store with TTL |

The key insight: traffic is **bursty**, third-party providers have their own **rate limits**, and some types are **urgent** — so queues and priorities are essential.

## Step 3 — API

```text
POST /api/v1/notifications
{
  "idempotencyKey": "order-1001-shipped",
  "userId": "U-42",
  "type": "ORDER_SHIPPED",              // maps to a template and a category
  "channels": ["PUSH", "EMAIL"],         // optional — otherwise from preferences
  "priority": "HIGH",                    // HIGH (OTP, alerts) | NORMAL | LOW (marketing)
  "data": { "orderId": "1001", "eta": "Oct 18" },
  "sendAt": null                         // or a future time
}
→ 202 Accepted { "notificationId": "N-9f1c" }

GET /api/v1/notifications/{id}           → status per channel
PUT /api/v1/users/{id}/preferences       → opt-outs, quiet hours, language
```

Services can also simply publish domain events (`OrderShipped`) to Kafka, which the notification system consumes.

## Step 4 — Data Model

```text
templates(id, type, channel, language, subject, body, version)
user_preferences(user_id, channel, category, enabled, quiet_hours, language)
device_tokens(user_id, platform, token, last_seen)
notifications(id, user_id, type, priority, status, created_at)
delivery_log(notification_id, channel, provider, status, attempts, updated_at)   -- high volume, TTL
```

## Step 5 — High-Level Design

```flow
Order, payment and auth services — API calls or Kafka events
Notification service — validate, dedupe, check preferences, render templates
Priority queues per channel — push, SMS, email, in-app
Channel workers — rate-limited, with retries
Providers — FCM / APNs, SMS gateways, email (SES, SendGrid), in-app via WebSocket
Delivery-status callbacks update the log
```

| Component | Responsibility |
| --- | --- |
| **Notification service** | Accepts requests, validates, deduplicates (idempotency key), looks up preferences, chooses channels, renders templates, enqueues messages |
| **Queues per channel and priority** | Decouple intake from sending; absorb bursts; isolate channels (an SMS-provider outage doesn't block email) |
| **Channel workers** | Pull messages, call providers, handle retries, rate limits and failover |
| **Template service** | Versioned, localised templates with placeholders |
| **Preference and device stores** | Opt-outs, quiet hours, language, device tokens (cached in Redis) |
| **Scheduler** | Holds scheduled notifications and releases them at `sendAt` |
| **Tracking** | Records sent / delivered / opened / failed from provider callbacks |

## Step 6 — Deep Dives

### Priorities

```tree
Queues
  push-high | OTPs, security alerts — dedicated, over-provisioned workers
  push-normal | transactional updates
  push-low | marketing campaigns — throttled
  sms-high, sms-normal …
```

Separate queues (or topics) per priority make sure a 10-million-user campaign never delays someone's OTP.

### Reliability and Retries

```flow
Worker sends to a provider
? Provider accepted it? | Yes: mark SENT and wait for the delivery callback | No: retry with exponential back-off
? Retries exhausted, or a permanent error such as an invalid number? | Yes: try a fallback provider or channel, otherwise mark FAILED and dead-letter | No: keep retrying
```

- **At-least-once** processing from the queue — so sends must be **idempotent**: keep a record per `(notificationId, channel)` and skip if already sent.
- **Provider failover** — integrate two SMS or email providers; switch on errors or circuit-breaker trips.
- **Channel fallback** — if push fails because the token is invalid, fall back to SMS for critical messages.
- Remove **invalid device tokens** reported by FCM/APNs.

### Deduplication

Duplicates arise from retried API calls, event redelivery and worker retries:

- **Idempotency key** on intake (`order-1001-shipped`), stored with a TTL — repeats return the original notification.
- **Per-channel send record** checked before calling the provider.
- Content-based dedupe windows for noisy event sources ("don't send the same type to the same user within 5 minutes").

### Rate Limiting

| Limit | Why |
| --- | --- |
| **Provider limits** | Providers enforce messages-per-second — use token buckets per provider |
| **Per-user limits** | Don't spam: e.g. max 3 marketing pushes per day |
| **Global campaign throttling** | Spread a campaign over time to protect providers and downstream traffic (users opening the app at once) |

### User Preferences and Compliance

- Check preferences **before** enqueueing (and again before sending scheduled messages).
- Honour **unsubscribe links** in email and **opt-out keywords** (STOP) for SMS.
- **Quiet hours** in the user's time zone — delay non-urgent notifications.
- Follow regulations, such as India's TRAI rules for commercial SMS (registered templates and sender IDs, DND preferences), plus anti-spam and data-protection laws.

### Templates and Localisation

```text
template ORDER_SHIPPED / PUSH / en:
  title: "Your order is on its way!"
  body:  "Order #{{orderId}} will arrive by {{eta}}."
```

Templates are versioned, rendered with the user's language, and validated (length limits for SMS, payload size limits for push).

### Scheduling and Campaigns

- Scheduled notifications are stored with `sendAt`; a scheduler polls due items (indexed by time, sharded) or uses delayed queues.
- Campaigns are broken into batches by a **fan-out** job that pages through the target audience and enqueues messages at a controlled rate.

### Tracking and Analytics

- Providers report delivery via **webhooks**; opens and clicks come from tracking pixels / links or app events.
- Status updates flow through a queue into the delivery log (wide-column or time-series store with TTL) and an analytics pipeline.

## Step 7 — Bottlenecks and Trade-offs

| Concern | Decision |
| --- | --- |
| Bursty campaigns | Queues + throttled low-priority workers |
| Urgent messages | Separate high-priority queues and workers |
| Provider outages | Multiple providers, circuit breakers, fallback channels |
| Duplicates | Idempotency keys and per-channel send records |
| Preference lookups at scale | Cache preferences and device tokens in Redis |
| Data volume | TTL on delivery logs; aggregate analytics separately |
| In-app delivery to online users | WebSocket gateway with Redis/Kafka pub/sub to reach the user's connected server; store for later if offline |

## Interview Questions

### How do you make sure an OTP isn't delayed by a marketing campaign?

Separate queues (or topics) and workers per priority, with the high-priority path over-provisioned and campaigns throttled.

### How do you avoid sending duplicate notifications?

Idempotency keys on intake, a per-notification-per-channel send record checked before calling the provider, and idempotent workers — because queues deliver at least once.

### What happens if the SMS provider is down?

Workers retry with back-off; a circuit breaker switches to a secondary provider; critical messages can fall back to another channel; failures are dead-lettered and alerted on.

### How do you handle user preferences and quiet hours?

Store preferences per user, channel and category (cached in Redis); check them before enqueueing; delay non-urgent messages during quiet hours in the user's time zone.

### Why use queues instead of calling providers directly?

To absorb bursts, isolate channels from each other's failures, respect provider rate limits, retry safely, and keep the API fast (202 Accepted).

## Key Takeaways

- ✅ Accept requests quickly (202) and process asynchronously through queues per channel and priority.
- ✅ Keep urgent and bulk traffic separate.
- ✅ Retries + idempotency + provider failover give reliability without duplicates.
- ✅ Rate-limit per provider, per user and per campaign.
- ✅ Respect preferences, quiet hours and regulations; track delivery status from provider callbacks.
