---
title: "@RequestHeader, @CookieValue and @RequestAttribute"
subtitle: Reading headers, cookies and server-side request attributes — JWT tokens, API versioning, sessions, filter-to-controller data passing and the argument resolvers behind them.
order: 15
---

## Introduction

> [!NOTE]
> **Interview importance: 9.5/10.**

These three annotations are widely used in enterprise Spring Boot applications — especially for JWT authentication, API versioning, microservices, correlation IDs, logging, API gateways, security filters and request tracking.

Interviewers commonly ask: How do you read HTTP headers? How do JWT tokens reach the controller? What's the difference between a header, a cookie and a request attribute? How do filters pass data to controllers? Which Spring classes resolve these annotations?

## HTTP Request Structure

```tree Each Spring annotation reads a different part
HTTP request
  URL path
  Query parameters
  Headers
  Cookies
  Body
```

```text
GET /users/101?page=1 HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Accept: application/json
X-Request-Id: 7e4b3a
Cookie: SESSION=ABC123
```

| Annotation | Reads from |
| --- | --- |
| `@PathVariable` | URL path |
| `@RequestParam` | Query string |
| `@RequestHeader` | HTTP headers |
| `@CookieValue` | Cookies |
| `@RequestBody` | Request body |
| `@RequestAttribute` | Server-side request attributes |

## Part 1 — @RequestHeader

`@RequestHeader` binds an HTTP request header to a controller parameter.

```java
// Authorization: Bearer abc.xyz.123
@GetMapping("/profile")
public User profile(@RequestHeader("Authorization") String token) {
    return service.getProfile(token);
}
```

Spring injects the `Authorization` header into `String token`.

```flow-h
Client — Authorization header
DispatcherServlet
RequestHeaderMethodArgumentResolver
Controller
```

### Reading Standard Headers

```java
@GetMapping
public String language(@RequestHeader("Accept-Language") String language) {
    return language;   // Accept-Language: en-US → "en-US"
}

@GetMapping("/device")
public String device(@RequestHeader("User-Agent") String agent) {
    return agent;      // browser detection, mobile detection, analytics
}

@GetMapping
public String host(@RequestHeader("Host") String host) {
    // Host: localhost:8080
}
```

> [!TIP]
> HTTP header names are **case-insensitive**, so `@RequestHeader("authorization")` also matches `Authorization`.

### Required, Optional and Default Values

`@RequestHeader String version` means **`required = true`** — a missing header gives **`400 Bad Request`**.

```java
@RequestHeader(required = false) String version       // null when absent
@RequestHeader(defaultValue = "1.0") String version   // "1.0" when absent
```

### Reading All Headers

```java
@GetMapping
public void headers(@RequestHeader Map<String, String> headers) {
}
```

```text
Authorization=Bearer xxx
Host=localhost
Accept=application/json
```

(Use `HttpHeaders` or `MultiValueMap<String, String>` if a header can appear more than once.)

### JWT Authentication Example

```java
// Authorization: Bearer eyJhbGc...
@GetMapping("/profile")
public User profile(@RequestHeader("Authorization") String token) {
}
```

Usually the controller **doesn't** validate the token directly. Instead:

```flow-h Covered again in the Spring Security chapter
Request
JWT filter
Validate token
Store user
Controller
```

### API Versioning

```java
// X-API-Version: 2
@GetMapping
public User users(@RequestHeader("X-API-Version") Integer version) {
}
```

> [!QUESTION] Which internal class resolves @RequestHeader?
> **`RequestHeaderMethodArgumentResolver`**.

## Part 2 — @CookieValue

Cookies are small pieces of data stored by the browser.

```java
// Cookie: SESSION=ABC123
@GetMapping("/dashboard")
public String dashboard(@CookieValue("SESSION") String session) {
}
```

Spring extracts `SESSION` → `ABC123`.

```flow-h
Browser — cookie
DispatcherServlet
Servlet API
ServletCookieValueMethodArgumentResolver
Controller
```

### Multiple Cookies

```java
// Cookie: SESSION=ABC123; theme=dark; language=en
@GetMapping
public void cookies(@CookieValue("theme") String theme,
                    @CookieValue("language") String language) {
}
```

### Optional and Default Cookies

```java
@CookieValue(required = false) String theme         // null when absent
@CookieValue(defaultValue = "light") String theme   // "light" when absent
```

### Cookie vs Header

| Header | Cookie |
| --- | --- |
| Sent with the request | Sent with the request (automatically by the browser) |
| General metadata | Client state |
| e.g. Authorization, API version, Content-Type | e.g. session ID, user theme, remember-me |

Cookies are often used by browsers for **stateful sessions**; headers are commonly used for **authentication and API metadata**.

### Session Example

```flow
Login
Server sends Set-Cookie: SESSION=ABC123
Browser stores it
Next request sends Cookie: SESSION=ABC123
Spring reads it with @CookieValue("SESSION")
```

Spring resolves `@CookieValue` with **`ServletCookieValueMethodArgumentResolver`**.

## Part 3 — @RequestAttribute

Less common, but extremely important in enterprise projects — an interview favourite.

### What is a Request Attribute?

A **request attribute** is data stored inside the current HTTP request **on the server**. Unlike headers and cookies, **the client never sees it**.

```flow-h
Filter
request.setAttribute()
Controller
@RequestAttribute
```

### Why Do We Need It?

Suppose a JWT filter validates the token. Instead of validating again in the controller:

```flow-h This avoids duplicate work
JWT filter
Extract user
Store user
Controller uses user
```

### Example

```java
// Filter
request.setAttribute("userId", 101L);

// Controller
@GetMapping("/profile")
public User profile(@RequestAttribute Long userId) {
}
```

```flow
Client — JWT token
Filter
Validate
request.setAttribute()
DispatcherServlet
Controller — @RequestAttribute
```

### Authentication Example

```java
// JWT filter
request.setAttribute("loggedInUser", user);

// Controller
@GetMapping("/me")
public User me(@RequestAttribute User loggedInUser) {
}
```

No need to decode the JWT again.

### Header vs Request Attribute

| Header | Request attribute |
| --- | --- |
| Client → server | Server → server |
| Travels over the network | Exists only during request processing |

Spring resolves `@RequestAttribute` with **`RequestAttributeMethodArgumentResolver`**.

## Comparison Table

| Feature | @RequestHeader | @CookieValue | @RequestAttribute |
| --- | --- | --- | --- |
| Source | HTTP header | Cookie | Request object |
| Client sends | Yes | Yes | No |
| Visible to browser | Yes | Yes | No |
| Typical usage | JWT, API version | Session | Filter data |
| Lifetime | Request | Cookie lifetime | Current request only |

## Enterprise Architecture

```flow
React — Authorization header
JWT filter
Validate token
request.setAttribute(user)
Controller
Service
Repository
Database
JSON
```

## Common Mistakes

### Reading the JWT in Every Controller

`@RequestHeader("Authorization") String token` inside every endpoint is wrong. Better: JWT filter → validate → `@RequestAttribute User` (or Spring Security's `SecurityContext`). Controllers receive the authenticated user directly.

### Storing Sensitive Data in Cookies

Avoid storing passwords, credit-card details or secrets. Cookies can be protected with the `HttpOnly`, `Secure` and `SameSite` flags, but sensitive data generally shouldn't be stored in them.

### Using Request Attributes for Cross-Request Storage

Wrong — request attributes exist **only for the current request**. Use sessions, databases, caches or tokens for longer-lived state.

## Internal Spring Flow

```tree Every controller parameter is resolved by a dedicated argument resolver
HandlerMethodArgumentResolver
  PathVariableMethodArgumentResolver
  RequestParamMethodArgumentResolver
  RequestHeaderMethodArgumentResolver
  ServletCookieValueMethodArgumentResolver
  RequestAttributeMethodArgumentResolver
  RequestResponseBodyMethodProcessor
```

## Interview Questions

### Q1. What is @RequestHeader?

It binds an HTTP request header to a controller method parameter.

### Q2. Which Spring class resolves @RequestHeader?

`RequestHeaderMethodArgumentResolver`.

### Q3. What is @CookieValue?

It reads the value of a cookie from the incoming HTTP request.

### Q4. Which class resolves @CookieValue?

`ServletCookieValueMethodArgumentResolver`.

### Q5. What is @RequestAttribute?

It binds a server-side request attribute (typically added by a filter, interceptor or another component during request processing) to a controller method parameter.

### Q6. Which class resolves @RequestAttribute?

`RequestAttributeMethodArgumentResolver`.

### Q7. When should we use @RequestAttribute?

When one server-side component (such as a filter or interceptor) computes data that another component (such as a controller) needs during the same request.

### Q8. What is the difference between a header, a cookie and a request attribute?

| Header | Cookie | Request attribute |
| --- | --- | --- |
| Sent by the client | Sent by the client | Created on the server |
| Metadata | Client state | Request-scoped server data |
| Travels over the network | Travels over the network | Never leaves the server |

### Q9. How does JWT authentication typically work?

```flow-h
Client — Authorization header
JWT filter
Validate token
Store authentication / user context
Controller
```

In Spring Security, the authenticated user is typically stored in the **`SecurityContext`** rather than passed as a request attribute, although request attributes are a common pattern in custom filter implementations.

## Summary

| Part of the request | Annotation |
| --- | --- |
| URL path | `@PathVariable` |
| Query parameters | `@RequestParam` |
| Headers | `@RequestHeader` |
| Cookies | `@CookieValue` |
| Body | `@RequestBody` |
| Request attributes (server-side) | `@RequestAttribute` |

## Key Takeaways

- ✅ `@RequestHeader` reads HTTP headers such as `Authorization`, `Accept-Language` and custom headers.
- ✅ `@CookieValue` reads cookies sent by the client — session IDs and user preferences.
- ✅ `@RequestAttribute` reads server-side attributes created while processing the current request.
- ✅ Each is resolved by a dedicated `HandlerMethodArgumentResolver`.
- ✅ Authentication usually happens in filters or Spring Security; controllers receive the already-authenticated user.
- ✅ Choose the annotation based on where the data originates.
