---
title: API Design & Communication Protocols
subtitle: REST resource design, HTTP methods and status codes, idempotency and idempotency keys, pagination, filtering and versioning, error formats, REST vs GraphQL vs gRPC, WebSockets, server-sent events, polling and webhooks.
order: 11
---

## Introduction

An API is a **contract** between a system and its clients, and once published it's hard to change. Good API design makes systems easy to use, safe to retry and possible to evolve.

## REST Resource Design

Model **resources** (nouns) and use HTTP **methods** as verbs:

| Method | Path | Meaning |
| --- | --- | --- |
| `GET` | `/orders` | List orders |
| `GET` | `/orders/{id}` | Get one order |
| `POST` | `/orders` | Create an order |
| `PUT` | `/orders/{id}` | Replace an order |
| `PATCH` | `/orders/{id}` | Partially update an order |
| `DELETE` | `/orders/{id}` | Delete an order |
| `GET` | `/customers/{id}/orders` | A customer's orders (sub-resource) |
| `POST` | `/orders/{id}/cancellation` | An action modelled as a resource |

Guidelines: plural nouns, lowercase with hyphens (`/order-items`), no verbs in paths (`/getOrders` ❌), and consistent naming across the whole API.

## Methods: Safe and Idempotent

| Method | Safe (no side effects) | Idempotent (repeating has the same effect) |
| --- | --- | --- |
| `GET`, `HEAD`, `OPTIONS` | ✅ | ✅ |
| `PUT` | ❌ | ✅ |
| `DELETE` | ❌ | ✅ |
| `POST` | ❌ | ❌ |
| `PATCH` | ❌ | ❌ (can be made idempotent) |

Idempotency matters because **networks fail**: a client that times out doesn't know whether its request succeeded, and will retry.

### Idempotency Keys

Make `POST` safe to retry by having the client send a unique key:

```http
POST /payments
Idempotency-Key: 3f9a1c7e-58b2-4f2a-9d1e-1b2c3d4e5f6a
Content-Type: application/json

{ "orderId": "ORD-1001", "amount": 2499.00 }
```

```flow
Request arrives with an idempotency key
? Key seen before? | Yes: return the stored response — no second charge | No: process, store key + response with a TTL, return it
```

Payment APIs such as Stripe and Razorpay work this way.

## Status Codes

| Code | Meaning | Use |
| --- | --- | --- |
| **200 OK** | Success | GET, PUT, PATCH |
| **201 Created** | Resource created | POST — include a `Location` header |
| **202 Accepted** | Accepted for asynchronous processing | Long-running jobs |
| **204 No Content** | Success with no body | DELETE |
| **400 Bad Request** | Invalid input | Validation errors |
| **401 Unauthorized** | Not authenticated | Missing or invalid token |
| **403 Forbidden** | Authenticated but not allowed | Insufficient permissions |
| **404 Not Found** | Resource doesn't exist | |
| **409 Conflict** | Conflicts with current state | Duplicate, version conflict |
| **422 Unprocessable Content** | Well-formed but semantically invalid | Business-rule violations |
| **429 Too Many Requests** | Rate limited | With `Retry-After` |
| **500 Internal Server Error** | Unexpected server failure | Bugs — never leak stack traces |
| **502 / 503 / 504** | Bad gateway / unavailable / gateway timeout | Upstream or overload problems |

## Consistent Error Responses

Use one error format everywhere — the **Problem Details** standard (RFC 9457), supported by Spring 6 (`ProblemDetail`):

```json
{
  "type": "https://api.example.com/errors/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Only 2 units of SKU-1 are available.",
  "instance": "/orders",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

## Pagination

Never return unbounded lists.

| Offset pagination | Cursor (keyset) pagination |
| --- | --- |
| `GET /orders?page=3&size=20` | `GET /orders?limit=20&after=eyJpZCI6MTAwfQ` |
| Easy; supports jumping to page N | Stable and fast at any depth |
| Slow for deep pages (`OFFSET 100000`) | No random page access |
| Items shift when data changes — duplicates or gaps | Consistent while data changes |

For large or frequently changing datasets (feeds, logs), **cursor pagination** is the scalable choice — it maps to keyset queries like `WHERE id < ? ORDER BY id DESC LIMIT 20` (see the SQL chapters).

```json
{
  "items": [ … ],
  "nextCursor": "eyJpZCI6ODB9",
  "hasMore": true
}
```

## Filtering, Sorting and Field Selection

```text
GET /orders?status=PAID&createdAfter=2026-10-01&sort=-createdAt&fields=id,total,status
```

Validate and whitelist parameters, index the columns you allow filtering on, and cap page sizes.

## Versioning

| Strategy | Example |
| --- | --- |
| URI path | `/v1/orders`, `/v2/orders` — the most common and visible |
| Header | `Accept: application/vnd.example.v2+json` |
| Query parameter | `/orders?version=2` |

Prefer **additive, backward-compatible changes** (new optional fields) so new versions are rarely needed; when they are, run both for a deprecation period and announce removal dates (`Deprecation` / `Sunset` headers).

## Other API Concerns

- **Authentication** with OAuth2 bearer tokens; HTTPS only.
- **Rate limiting** with 429 responses.
- **Caching** of GET responses with `Cache-Control` and `ETag` (conditional requests return `304 Not Modified`).
- **Optimistic concurrency** with `ETag` / `If-Match` to prevent lost updates (`412 Precondition Failed`).
- **Documentation** with OpenAPI (springdoc-openapi generates it from Spring controllers).

## REST vs GraphQL vs gRPC

| | REST | GraphQL | gRPC |
| --- | --- | --- | --- |
| Style | Resources + HTTP methods | One endpoint, client-specified queries | Remote procedure calls |
| Format | JSON (usually) | JSON | Protocol Buffers (binary) |
| Transport | HTTP/1.1 or 2 | HTTP | HTTP/2 |
| Strengths | Simple, cacheable, universal | Clients fetch exactly the fields they need in one request; good for varied UIs | Fast, compact, strongly typed, streaming |
| Weaknesses | Over- and under-fetching; many round trips | Caching and rate limiting are harder; complex queries can be expensive | Not browser-friendly; binary debugging |
| Best for | Public APIs, CRUD | Mobile/web apps aggregating many entities | Internal service-to-service calls |

## Real-Time Communication

| Technique | How it works | Use |
| --- | --- | --- |
| **Short polling** | Client asks every few seconds | Simple, wasteful; rarely ideal |
| **Long polling** | Server holds the request until there's news or a timeout | Fallback for older clients |
| **Server-Sent Events (SSE)** | One long-lived HTTP connection; server pushes text events | One-way updates: notifications, live scores, progress |
| **WebSockets** | Full-duplex connection over a single TCP socket | Chat, collaborative editing, games, trading |
| **Webhooks** | Your server calls the client's URL when something happens | Server-to-server events (payment succeeded) |

> [!TIP]
> WebSocket connections are **stateful** — each user is attached to one server. At scale, use a pub/sub layer (Redis, Kafka) so a message published on one server reaches users connected to others, and plan load balancing for long-lived connections.

### Webhooks Done Right

- Sign payloads (HMAC) so receivers can verify them.
- Retry with back-off; receivers must be **idempotent** (deduplicate by event ID).
- Respond quickly (2xx) and process asynchronously.

## Interview Questions

### What makes an API RESTful?

Resources identified by URIs, standard HTTP methods with their semantics, stateless requests, representations such as JSON, meaningful status codes, and cacheable responses where appropriate.

### Which HTTP methods are idempotent?

GET, HEAD, OPTIONS, PUT and DELETE. POST and PATCH aren't by default; idempotency keys make POST safe to retry.

### Offset vs cursor pagination?

Offset uses page numbers — simple, but slow for deep pages and unstable when data changes. Cursor pagination continues from the last item seen — fast and consistent at any depth, without random page access.

### REST vs GraphQL vs gRPC — when would you use each?

REST for public and CRUD APIs; GraphQL when varied clients need flexible data fetching in one request; gRPC for high-performance internal service-to-service communication.

### WebSockets vs SSE?

WebSockets are full-duplex for interactive two-way communication; SSE is simpler one-way server push over HTTP with automatic reconnection.

### 401 vs 403?

401 means not authenticated (missing or invalid credentials); 403 means authenticated but not permitted.

## Key Takeaways

- ✅ Design around resources and standard HTTP methods; be consistent.
- ✅ Know safe and idempotent methods; use idempotency keys for retried POSTs.
- ✅ Return precise status codes and one consistent error format (Problem Details).
- ✅ Paginate everything — cursors for large, changing datasets.
- ✅ Evolve additively; version only for breaking changes.
- ✅ REST for public APIs, gRPC internally, GraphQL for flexible clients; SSE/WebSockets/webhooks for real-time.
