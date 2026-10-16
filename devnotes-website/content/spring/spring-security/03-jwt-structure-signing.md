---
title: JWT Structure & Signing Algorithms
subtitle: Header, payload and signature, Base64URL and standard claims, how HS256 / HMAC signing and verification work, HS256 vs RS256 vs ES256, and why a JWT is signed but not encrypted.
order: 3
---

## Introduction

A **JSON Web Token (JWT)** is a compact, URL-safe string that carries **claims** — statements about a user, such as their username, roles and when the token expires. JWTs are the "passports" of modern web APIs: the server issues one at login, and the client presents it on every request.

JWT signatures use cryptographic algorithms to prove the token **hasn't been tampered with** and **was issued by someone holding the key**.

## JWT Structure

A JWT has three parts separated by dots:

```text
Header.Payload.Signature
```

```text
eyJhbGciOiJIUzI1NiJ9
.
eyJzdWIiOiJyYWoiLCJyb2xlIjoiVVNFUiJ9
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

```flow-h
Header — algorithm and type
Payload — claims about the user
Signature — proves integrity and authenticity
```

### 1. Header

Token metadata:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

`alg` is the signing algorithm and `typ` the token type.

### 2. Payload

The **claims**:

```json
{
  "sub": "thimmaraju",
  "role": "ADMIN",
  "iat": 1716000000,
  "exp": 1716003600
}
```

| Claim | Meaning |
| --- | --- |
| `sub` | Subject — username or user ID |
| `iat` | Issued at (seconds since the epoch) |
| `exp` | Expiration time |
| `nbf` | Not valid before |
| `iss` | Issuer — who created the token |
| `aud` | Audience — who the token is meant for |
| `jti` | Unique token ID (useful for revocation) |
| `role` / `roles` | A custom claim — the user's roles |

`sub`, `iat`, `exp`, `nbf`, `iss`, `aud` and `jti` are **registered** claims defined by the JWT standard (RFC 7519); anything else, like `role` or `email`, is a **custom** claim.

### 3. Signature

The most important part:

```text
HMACSHA256(
    Base64Url(Header) + "." + Base64Url(Payload),
    secretKey
)
```

Its purpose is to **prevent tampering** and **verify authenticity**.

## Base64URL Is Encoding, Not Encryption

The header and payload are only **Base64URL-encoded** — a reversible, URL-safe text encoding. Anyone can decode them (for example on jwt.io):

```json
{
  "username": "raj",
  "role": "ADMIN"
}
```

| What a signed JWT gives you | |
| --- | --- |
| ✅ **Integrity** | The data wasn't modified |
| ✅ **Authenticity** | It was signed by someone holding the key |
| ❌ **Confidentiality** | The payload is **not** hidden |

> [!IMPORTANT]
> **Never put passwords, OTPs, card numbers or other secrets in a JWT payload.** Standard JWTs (JWS — JSON Web *Signature*) are signed, not encrypted. If you really need an encrypted token, that's a separate format, **JWE** (JSON Web *Encryption*).

## How Token Generation Works (HS256)

Suppose the secret key is a 256-bit key, the header is `{"alg":"HS256","typ":"JWT"}` and the payload is `{"username":"raj"}`.

**Step 1 — Base64URL-encode** both parts:

```text
Header:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
Payload: eyJ1c2VybmFtZSI6InJhaiJ9
```

**Step 2 — join them** with a dot:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InJhaiJ9
```

**Step 3 — apply HMAC-SHA256** with the secret key → `signature`.

**Final JWT:** `header.payload.signature`.

### What Is HMAC?

Plain `SHA256("hello")` produces a hash that **anyone** can compute, so it can't prove who created a token. **HMAC** mixes a **secret key** into the hash:

```text
HMACSHA256(message, secretKey)
```

Without the secret key, nobody can produce a valid signature.

**HS256 = HMAC + SHA-256**: HMAC (Hash-based Message Authentication Code) using SHA-256, a hash with a 256-bit output.

## How Verification Works

```flow
Client sends Authorization: Bearer token
Split into header.payload.signature
Recompute the signature from header.payload with the server's key
? Recomputed signature equals the token's signature? | Yes: token valid — then check exp | No: invalid signature — 401
```

### Why Can't Someone Change the Payload?

Original payload `{"role":"USER"}` — an attacker changes it to `{"role":"ADMIN"}`. They *can* edit it, because Base64 isn't encryption. But `header.payload` has changed, so the original signature no longer matches, and the attacker can't compute a new one without the key. Verification fails with a `SignatureException` and the token is rejected.

> [!WARNING]
> The server must verify with **the algorithm and key it expects**, not whatever the token's header says. Old libraries that trusted the header allowed the infamous `"alg": "none"` attack and RS256 → HS256 "algorithm confusion" attacks (see *JWT Security & Interview Scenarios*). Modern libraries such as JJWT 0.12 reject unsigned tokens and tie verification to the key you configure.

## Signing Algorithms

### HMAC — Symmetric (HS256, HS384, HS512)

**One shared secret** both signs and verifies:

```flow-h
Header + payload
HMAC-SHA256 with the server's secret key
Signature
```

| Algorithm | Notes |
| --- | --- |
| **HS256** | HMAC-SHA256 — the most common choice for a single Spring Boot application |
| **HS384** | HMAC-SHA384 — larger signature, slightly slower |
| **HS512** | HMAC-SHA512 — largest signature |

**Pros:** fast and simple. **Cons:** every service that verifies tokens must also hold the secret — and anyone who can verify can also **forge** tokens.

> [!IMPORTANT]
> The HMAC key must be at least as long as the hash: **≥ 256 bits (32 bytes) for HS256**, 384 for HS384, 512 for HS512. JJWT rejects shorter keys with a `WeakKeyException` — a secret like `"my-secret-key"` (13 bytes) won't work. Generate a random key and store it Base64-encoded.

### RSA — Asymmetric (RS256, RS384, RS512)

A **private key signs**; a **public key verifies**:

```flow
Auth server signs the JWT with its private key
Token sent to the client
Resource servers verify it with the public key
```

**Advantages:** the public key can be shared safely (often published as a **JWKS** endpoint), the private key never leaves the auth server, and verifying services can't forge tokens. Used by **OAuth2**, **OpenID Connect** and identity providers such as Keycloak, Okta, Auth0 and Azure AD.

### ECDSA — Asymmetric (ES256, ES384, ES512)

Uses **elliptic-curve** cryptography: much smaller keys and signatures than RSA for the same security, and fast verification. Common in mobile apps and modern identity systems.

### Which Algorithm Should You Use?

| Situation | Use | Why |
| --- | --- | --- |
| A single Spring Boot application that both issues and checks tokens | **HS256** | Simple and fast |
| Enterprise / microservices — one auth service, many verifying services | **RS256** (or ES256) | One service signs; many verify with a public key that can be distributed freely |

## HS256 vs RS256

| HS256 | RS256 |
| --- | --- |
| Symmetric | Asymmetric |
| One shared secret key | Public/private key pair |
| Sign and verify with the same key | Sign with the private key, verify with the public key |
| Every verifier can also forge tokens | Verifiers can't forge tokens |
| Simpler, faster | Better for microservices and third-party verification |

## Example with JJWT

JJWT 0.12+ (the current API):

```java
SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretBase64));   // ≥ 256-bit key

String token = Jwts.builder()
        .subject("raj")
        .claim("role", "ADMIN")
        .issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + 3_600_000))   // 1 hour
        .signWith(key)                     // algorithm chosen from the key: HS256 for a 256-bit key
        .compact();

Claims claims = Jwts.parser()
        .verifyWith(key)                   // signature verified with this key
        .build()
        .parseSignedClaims(token)          // throws if tampered with or expired
        .getPayload();
```

> [!NOTE]
> Many tutorials use the older JJWT API — `setSubject()`, `setExpiration()`, `signWith(key, SignatureAlgorithm.HS256)`, `Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token)`. Those methods are **deprecated in JJWT 0.12**. They behave the same way, but use the new names in new code. The full utility class is in *Implementing JWT with JJWT*.

### What Does `.signWith(key)` Do?

It creates a digital signature for the JWT from the encoded header and payload using the key — HMAC-SHA256 for a 256-bit secret key — guaranteeing the token's **integrity** and **authenticity**. Without the key, nobody can create a valid token or modify an existing one.

## Interview Questions

### What are the three parts of a JWT?

Header (algorithm and type), payload (claims) and signature, each Base64URL-encoded and separated by dots.

### Which algorithm is commonly used for JWT?

HS256 (HMAC-SHA256) for single applications; RS256 for microservices and identity providers.

### What is the difference between HS256 and RS256?

HS256 is symmetric — one shared secret signs and verifies. RS256 is asymmetric — a private key signs and a public key verifies, so verifying services never hold a key that could create tokens.

### Why is RS256 preferred in microservices?

Only the authentication service needs the private key; every other service verifies with the public key. A compromised downstream service can't forge tokens.

### What happens if someone modifies the payload?

The recomputed signature won't match the token's signature, so validation fails and access is denied.

### Is a JWT encrypted?

No. A standard JWT is signed, not encrypted — the payload is Base64URL-encoded and readable by anyone. Use JWE if the contents must be confidential.

### Explain HS256 in two minutes.

HS256 stands for HMAC-SHA256, a symmetric signing algorithm where the same secret key signs and verifies the token. To create a token, the server joins the Base64URL-encoded header and payload and computes an HMAC-SHA256 signature with the secret key. To validate, the server recomputes the signature with the same key and compares it with the one in the token; if they match the token is genuine and unmodified. HS256 provides integrity and authenticity but doesn't encrypt the payload.

## Common Mistakes

- ❌ **Putting sensitive data in the payload.**
- ❌ **Weak or short HMAC secrets**, or secrets committed to Git.
- ❌ **Trusting the header's `alg`** instead of enforcing the expected algorithm and key.
- ❌ **Sharing an HS256 secret with many services** — any of them can forge tokens.
- ❌ **Decoding the payload without verifying the signature.**

## Key Takeaways

- ✅ A JWT is `header.payload.signature`; header and payload are Base64URL-encoded JSON.
- ✅ The signature guarantees integrity and authenticity, not confidentiality.
- ✅ HS256 uses one shared secret (≥ 256 bits); RS256/ES256 sign with a private key and verify with a public key.
- ✅ Prefer RS256 when many services verify tokens.
- ✅ Use the JJWT 0.12 API: `subject()`, `signWith(key)`, `parser().verifyWith(key)`, `parseSignedClaims()`.
