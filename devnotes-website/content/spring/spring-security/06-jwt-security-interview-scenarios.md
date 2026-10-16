---
title: JWT Security & Interview Scenarios
subtitle: The pros and cons of JWT, logout and revocation, refresh-token rotation, XSS vs CSRF and where to store tokens, the alg-none and algorithm-confusion attacks, best practices, and the senior-level questions interviewers ask.
order: 6
---

## Introduction

To do well in a JWT interview for a backend role you need to go beyond *"what is a JWT?"*. Senior interviewers test **security trade-offs, state management, Spring Security integration and real-world vulnerabilities**. This chapter covers those topics and the exact questions to prepare for.

## Pros and Cons

| Feature | Benefit / drawback |
| --- | --- |
| **Statelessness** | ✅ No server-side session storage; any instance can verify a token — ideal for microservices |
| **Size** | ❌ Tokens grow with every claim and are sent on every request |
| **Integrity** | ✅ Digitally signed, so tampering is detected |
| **Revocation** | ❌ Hard to log a user out instantly — a token stays valid until it expires |
| **Confidentiality** | ❌ The payload is readable by anyone (Base64URL, not encryption) |
| **Cross-domain** | ✅ Works across domains and for mobile / server-to-server clients |

## Core Concept Pitfalls

### Is a JWT encrypted? Can I store a user's password inside it?

**No.** Standard JWTs (JWS) are **signed**, not encrypted — the payload is only Base64URL-encoded and anyone can decode it with tools like jwt.io. Storing passwords, OTPs, Aadhaar/SSN numbers or other sensitive data in a JWT is a serious security violation. If the contents must be secret, use **JWE** (encrypted JWT).

### Symmetric (HS256) vs asymmetric (RS256) signing?

- **HS256** — one secret key signs and verifies. Good for a monolith where the same backend issues and reads tokens.
- **RS256** — a private key signs (held only by the auth server) and a public key verifies (shared with every service). Essential for microservices, because downstream services never get a key that can create tokens.

## Scenario A — "How do you handle logout with JWT?"

**The problem:** the server keeps no state, so a token is valid until its `exp`. After logout, a copied token can still call the API.

**Solutions interviewers accept:**

1. **Short lifetimes** — access tokens of 5–15 minutes, accepting a small risk window; logout just deletes the token on the client and revokes its refresh token.
2. **A denylist in Redis** — store the logged-out token's unique ID (`jti`) in Redis with a TTL equal to its remaining lifetime, and check it on every request. This makes the system slightly stateful, but the list stays small because entries expire.
3. **A token version per user** — store a `tokenVersion` in the user record and in each token; bumping it (on logout-everywhere or a password change) invalidates all older tokens.

```flow
User logs out
Server stores the token's jti in Redis with TTL = remaining lifetime
Every request checks whether its jti is on the denylist
? jti on the denylist? | Yes: 401 | No: continue
```

## Scenario B — "How do refresh tokens and refresh-token rotation work?"

| Token | Lifetime | Purpose |
| --- | --- | --- |
| **Access token** | Short, e.g. 15 minutes | Calls APIs via `Authorization: Bearer` |
| **Refresh token** | Long, e.g. 7 days | Stored securely; used **only** to request a new access token |

**Refresh-token rotation:** every time the client uses a refresh token, the server issues a **new** refresh token along with the new access token, and **invalidates the old one**. If an attacker steals a refresh token and tries to use it after the real client already has, the server sees a **reused** token, concludes a breach happened, and invalidates the whole token family — forcing a fresh login.

```flow
Client sends refresh token R1
Server returns new access token + new refresh token R2 and invalidates R1
? R1 used again later? | Yes: theft detected — revoke R2 and the whole family | No: normal operation
```

Refresh tokens are usually stored server-side (hashed) so they can be revoked, and sent from browsers only in an HttpOnly cookie scoped to the refresh endpoint.

## Frontend Storage — XSS vs CSRF

| Local storage | HttpOnly cookie |
| --- | --- |
| Vulnerable to **XSS** — malicious JavaScript can read `localStorage.getItem("token")` | Not readable by JavaScript → mitigates token theft via XSS |
| Not sent automatically → not vulnerable to CSRF | Sent automatically by the browser → vulnerable to **CSRF** |
| You add the `Authorization` header yourself | Block CSRF with `SameSite=Strict`/`Lax` and/or anti-CSRF tokens |

- **Local / session storage** — easy, but if an attacker injects a script (XSS), they can read and exfiltrate the token.
- **HttpOnly cookies** — JavaScript can't touch them, which stops XSS from stealing the token. But because the browser attaches cookies automatically, you must defend against **Cross-Site Request Forgery** with `SameSite` cookies or anti-CSRF tokens — and keep Spring Security's CSRF protection **enabled**.

> [!TIP]
> Neither option is perfect. A common, well-balanced approach for SPAs: keep the short-lived access token **in memory**, and the refresh token in an **HttpOnly, Secure, SameSite** cookie used only by the refresh endpoint.

## Spring Security Integration Mechanics

### Where does JWT validation happen?

In a custom filter, typically extending `OncePerRequestFilter`, registered before `UsernamePasswordAuthenticationFilter`.

### How is it wired?

1. The filter reads the `Authorization` header.
2. It parses and verifies the token with a library such as JJWT.
3. If valid, it builds a `UsernamePasswordAuthenticationToken` with the user's authorities and stores it:

```java
SecurityContextHolder.getContext().setAuthentication(authentication);
```

4. Crucially, the application is configured as **stateless**, so Spring never creates an HTTP session:

```java
http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
```

(The older form `http.sessionManagement().sessionCreationPolicy(...)` is deprecated in Spring Security 6.)

## Infamous JWT Vulnerabilities

Mentioning these signals that you're a security-conscious engineer.

### The `alg: none` Exploit

Early JWT libraries trusted the header. Attackers changed it to `{"alg": "none"}`, removed the signature, and edited the payload. Badly configured servers read `none`, **skipped signature verification**, and trusted the forged claims. Modern libraries reject unsigned tokens when a key is configured — JJWT 0.12 does so by default.

### Algorithm Confusion (RS256 → HS256)

A server expects RS256 tokens and verifies them with its RSA **public** key. The attacker creates a token with `"alg": "HS256"` and signs it using that public key **as the HMAC secret** — the public key is, after all, public. A vulnerable library that picks the algorithm from the header then "verifies" the HMAC with the same public key and accepts the forgery.

**Defence:** pin the expected algorithm and key type on the server; never let the token's header choose them.

### Other Common Weaknesses

| Weakness | Defence |
| --- | --- |
| Weak or leaked HMAC secrets (brute-forced offline) | Random ≥ 256-bit keys from a secret manager; rotate them |
| Long-lived tokens | Short access tokens + refresh rotation |
| Missing `exp` / `aud` / `iss` checks | Validate expiry, audience and issuer |
| Sensitive data in the payload | Keep claims minimal; use JWE if needed |
| Tokens in URLs (`?token=`) | URLs end up in logs, history and Referer headers — use headers or cookies |
| Logging full tokens | Log a token ID (`jti`), never the token |

## Security Best Practices

- ✅ **Never put sensitive information in the payload** — anyone can decode it.
- ✅ **Use HTTPS everywhere** — the token is sent on every request.
- ✅ **Keep the key secret** — anyone with the HMAC key can forge tokens and become any user.
- ✅ **Short expiration times**, with refresh tokens for longer sessions.
- ✅ **Validate signature, `exp`, `iss` and `aud`** on every request.
- ✅ **Use RS256/ES256** when several services verify tokens.
- ✅ **Plan for revocation** — refresh-token rotation, a `jti` denylist or token versions.

## Interview Questions

### 1. What are the three parts of a JWT?

Header, payload and signature, separated by dots.

### 2. How is JWT different from session authentication?

Sessions store state on the server and send only a session ID; JWT puts the claims in a signed token the client sends, so the server keeps no session state.

### 3. Why is a signature required in a JWT?

To detect tampering and prove the token was issued by someone holding the signing key.

### 4. How do you log a user out when using JWT?

Short-lived access tokens plus refresh-token revocation, a Redis denylist of `jti` values with a TTL, or a per-user token version.

### 5. What is refresh-token rotation?

Each refresh returns a new refresh token and invalidates the old one; reuse of an old token indicates theft and revokes the whole token family.

### 6. Where should a JWT be stored in the browser?

Preferably in memory or an HttpOnly, Secure, SameSite cookie with CSRF protection — not in `localStorage`, which XSS can read.

### 7. Why is JWT considered stateless?

All the information needed to authenticate a request is in the signed token, so the server doesn't need to look up a session.

### 8. What is the alg-none attack?

Setting the header's algorithm to `none` and stripping the signature so a careless server accepts unsigned, forged tokens.

### 9. What is algorithm confusion?

Tricking a server that expects RS256 into verifying an HS256 token using its RSA public key as the HMAC secret. Prevent it by pinning the algorithm.

### 10. How does Spring Security authenticate a JWT request?

A `OncePerRequestFilter` extracts and verifies the token, loads the user, creates an `Authentication` and stores it in the `SecurityContextHolder`; authorization rules and `@PreAuthorize` then use that context.

### 11. What happens if the signing key leaks?

Attackers can mint valid tokens for any user. Rotate the key immediately (which invalidates all existing tokens), and use key IDs (`kid`) to support graceful rotation in future.

### 12. Can you change a user's roles while they hold a valid token?

Not if roles are read only from the token — the old roles last until it expires. Either load authorities from the database per request, keep tokens short-lived, or invalidate tokens with a token version.

## Key Takeaways

- ✅ JWT trades easy revocation for statelessness — design for logout and refresh up front.
- ✅ Refresh-token rotation detects stolen refresh tokens.
- ✅ `localStorage` risks XSS; cookies risk CSRF — choose deliberately and defend accordingly.
- ✅ Pin algorithms and keys to defeat `alg: none` and algorithm-confusion attacks.
- ✅ Keep tokens short-lived, payloads minimal, keys strong and secret, and always validate signature, expiry, issuer and audience.
