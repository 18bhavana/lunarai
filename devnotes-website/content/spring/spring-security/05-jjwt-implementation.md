---
title: Implementing JWT with JJWT
subtitle: The JJWT 0.12 dependencies, a complete thread-safe token provider for generating and validating tokens, what happens under the hood during creation and parsing, the exceptions to handle, and the old API you will still see in tutorials.
order: 5
---

## Introduction

The industry-standard Java library for JWTs is **JJWT** (Java JWT), originally from Stormpath/Okta. This chapter builds a complete token provider using the modern **0.12.x** API.

> [!IMPORTANT]
> Use JJWT **0.12 or newer**. The older builder and parser methods (`setSubject()`, `setClaims()`, `signWith(key, SignatureAlgorithm.HS256)`, `parserBuilder()`, `parseClaimsJws()`) are **deprecated** in favour of a cleaner, type-safe API.

## Project Setup

JJWT is split into an API module and two **runtime** modules — all three are needed:

```xml
<dependencies>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>0.12.6</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>0.12.6</version>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>0.12.6</version>
        <scope>runtime</scope>
    </dependency>
</dependencies>
```

> [!WARNING]
> Adding only `jjwt-api` compiles fine but fails at runtime with an error that no JJWT implementation was found. `jjwt-impl` provides the implementation and `jjwt-jackson` the JSON serializer.

## Generating a Secret Key

An HS256 key must be **at least 256 bits (32 bytes)** of random data. Generate one once, store it Base64-encoded outside your code, and load it at startup:

```java
SecretKey key = Jwts.SIG.HS256.key().build();                         // random 256-bit key
String base64 = Encoders.BASE64.encode(key.getEncoded());              // store this value securely
```

```properties
# application.properties — the real value comes from an environment variable or secret manager
jwt.secret=${JWT_SECRET}
jwt.expiration-ms=3600000
```

> [!WARNING]
> Never hard-code a secret like `"1234567890..."` or commit it to Git. Anyone who has the HMAC key can **forge tokens for any user**. A predictable key is as bad as no key.

## A Complete Token Provider

A production-ready, thread-safe class that handles both **generation** and **validation**:

```java
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtTokenProvider {

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtTokenProvider(@Value("${jwt.secret}") String secretBase64,
                            @Value("${jwt.expiration-ms}") long expirationMs) {
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretBase64));   // throws WeakKeyException if < 256 bits
        this.expirationMs = expirationMs;
    }

    // ==========================================
    // PHASE 1: TOKEN CREATION
    // ==========================================
    public String generateToken(String username, String role) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .claims(Map.of("role", role))           // custom claims (payload)
                .subject(username)                       // sub
                .issuedAt(new Date(now))                 // iat
                .expiration(new Date(now + expirationMs))// exp
                .signWith(signingKey)                    // HS256, chosen from the 256-bit key
                .compact();                              // header.payload.signature
    }

    // ==========================================
    // PHASE 2: VALIDATION & PARSING
    // ==========================================

    /** Verifies the signature and expiry, then returns the claims. Throws JwtException if invalid. */
    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)        // key used to verify the signature
                .build()
                .parseSignedClaims(token)      // signature + exp/nbf checks happen here
                .getPayload();
    }

    public <T> T extractClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(extractAllClaims(token));
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /** True only if the token is genuine, unexpired and belongs to the expected user. */
    public boolean validateToken(String token, String expectedUsername) {
        try {
            return expectedUsername.equals(extractUsername(token));
        } catch (JwtException | IllegalArgumentException e) {
            return false;   // tampered, expired, malformed or empty
        }
    }
}
```

> [!NOTE]
> Many tutorials add an `isTokenExpired()` helper that compares `exp` with the current time. With JJWT it's redundant: `parseSignedClaims()` already throws `ExpiredJwtException` for expired tokens, before you can read any claim.

The class is **thread-safe**: the key and expiry are immutable fields, and each parse builds its own parser, so one instance can serve every request thread.

## Under the Hood

### How Creation Works

When you call `Jwts.builder()...compact()`, the library:

1. **Builds the header** — `{"alg":"HS256"}` (chosen from the key) — and Base64URL-encodes it.
2. **Builds the payload** — `sub`, `iat`, `exp` and custom claims like `role` — and Base64URL-encodes it.
3. **Signs** — joins `header.payload`, computes HMAC-SHA256 with the secret key, and appends the encoded signature as the third part.

### How Validation Works

When you call `.parseSignedClaims(token)`:

```flow
Split the token on the dots into header, payload and signature
Recompute the signature from header.payload using the configured key
? Signatures equal? | Yes: decode the payload | No: SignatureException
? exp still in the future? | Yes: return the claims | No: ExpiredJwtException
```

1. **Splits the string** into header, payload and signature.
2. **Recomputes the signature** over the incoming header and payload with the key from `.verifyWith()`.
3. **Compares the signatures.** If even one bit of the payload was altered, they won't match → `SignatureException`.
4. **Checks the time claims.** If the current time is past `exp` (or before `nbf`), it throws `ExpiredJwtException` (or `PrematureJwtException`).

## Exceptions to Handle

| Exception | Cause | Typical response |
| --- | --- | --- |
| `ExpiredJwtException` | `exp` is in the past | 401 — client should refresh the token |
| `SignatureException` | Signature doesn't match — tampered or signed with another key | 401 |
| `MalformedJwtException` | Not a valid JWT structure | 401 |
| `UnsupportedJwtException` | Unexpected token type, e.g. unsigned when a signature is required | 401 |
| `IllegalArgumentException` | Null or empty token string | 401 |

All the JJWT exceptions extend `JwtException`, so one `catch (JwtException e)` covers them. Clock differences between servers can be tolerated with `.clockSkewSeconds(30)` on the parser.

## Testing the Lifecycle

```java
public static void main(String[] args) {
    String secret = Encoders.BASE64.encode(Jwts.SIG.HS256.key().build().getEncoded());
    JwtTokenProvider provider = new JwtTokenProvider(secret, 3_600_000);

    // 1. Create a token
    String token = provider.generateToken("john_doe", "ROLE_ADMIN");
    System.out.println("Generated JWT Token:\n" + token + "\n");

    // 2. Validate and extract data
    System.out.println("Is Token Valid? " + provider.validateToken(token, "john_doe"));
    System.out.println("Extracted Username: " + provider.extractUsername(token));
    System.out.println("Extracted Role Claim: " + provider.extractAllClaims(token).get("role"));

    // 3. Tamper with the payload — validation fails
    String[] parts = token.split("\\.");
    String forged = parts[0] + "." + parts[1].replace('a', 'b') + "." + parts[2];
    System.out.println("Forged token valid? " + provider.validateToken(forged, "john_doe"));
}
```

```output Output (token shortened)
Generated JWT Token:
eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiUk9MRV9BRE1JTiIsInN1YiI6ImpvaG5fZG9lIi...

Is Token Valid? true
Extracted Username: john_doe
Extracted Role Claim: ROLE_ADMIN
Forged token valid? false
```

## Old API vs New API

| Old (≤ 0.11, deprecated) | New (0.12+) |
| --- | --- |
| `Jwts.builder().setSubject(u)` | `Jwts.builder().subject(u)` |
| `.setIssuedAt(d)` / `.setExpiration(d)` | `.issuedAt(d)` / `.expiration(d)` |
| `.setClaims(map)` | `.claims(map)` |
| `.signWith(key, SignatureAlgorithm.HS256)` | `.signWith(key)` or `.signWith(key, Jwts.SIG.HS256)` |
| `Keys.secretKeyFor(SignatureAlgorithm.HS256)` | `Jwts.SIG.HS256.key().build()` |
| `Jwts.parserBuilder().setSigningKey(key)` | `Jwts.parser().verifyWith(key)` |
| `.parseClaimsJws(token).getBody()` | `.parseSignedClaims(token).getPayload()` |

The concepts are identical; only the method names changed.

## Interview Questions

### Which library do you use for JWT in Java?

JJWT (`io.jsonwebtoken`), version 0.12+, with the `jjwt-api`, `jjwt-impl` and `jjwt-jackson` modules. Alternatives include Nimbus JOSE + JWT, which Spring Security's OAuth2 resource server uses.

### How does JJWT validate a token?

It recomputes the signature over the header and payload with the configured key, compares it with the token's signature, then checks `exp` and `nbf`, throwing a `JwtException` subtype if any check fails.

### Why must the key be at least 256 bits for HS256?

The HMAC key should be at least as long as the hash output to provide the algorithm's full strength; JJWT enforces this and throws `WeakKeyException` for shorter keys.

### Is your JWT utility thread-safe?

Yes — it holds only immutable state (the key and expiry) and creates a parser per call, so a single Spring bean can be shared by all request threads.

## Common Mistakes

- ❌ **Only adding `jjwt-api`** — runtime failure.
- ❌ **Short, guessable or hard-coded secrets.**
- ❌ **Mixing old and new API styles** from different tutorials.
- ❌ **Swallowing exceptions and returning claims anyway.**
- ❌ **Reading claims from a token without verifying it** (e.g. Base64-decoding the payload yourself).

## Key Takeaways

- ✅ Use JJWT 0.12+ with `jjwt-api`, `jjwt-impl` and `jjwt-jackson`.
- ✅ Load a random ≥ 256-bit Base64 key from configuration; never hard-code it.
- ✅ Generate with `builder().subject().claims().issuedAt().expiration().signWith(key).compact()`.
- ✅ Validate with `parser().verifyWith(key).build().parseSignedClaims(token)` — it checks the signature and expiry.
- ✅ Catch `JwtException` to reject tampered, expired or malformed tokens.
