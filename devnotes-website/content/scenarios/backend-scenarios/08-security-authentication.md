---
title: Security & Authentication Scenarios
subtitle: "Scenario questions 67–72: a valid JWT that still gets 401 or 403, renewing expired tokens securely, role-based access control with many roles, preventing access to other customers' orders, protecting payment APIs from replays, and managing secrets across environments."
order: 8
---

## Introduction

Security scenarios test whether you understand the difference between **authentication** (who you are: 401 when it's missing or invalid) and **authorization** (what you may do: 403 when it's denied), and whether you think about attackers as well as happy paths. For the mechanics, see [JWT Authentication in Spring Boot](/spring/spring-security/jwt-authentication-spring-boot/) and [JWT Security Interview Scenarios](/spring/spring-security/jwt-security-interview-scenarios/).

## Scenario Questions

### Q67. A JWT is valid, but the API still returns HTTP 401 or 403. How would you troubleshoot it?

First, **which status?** 401 means Spring didn't authenticate the request. 403 means it did, but authorization failed.

Turn on `logging.level.org.springframework.security=TRACE` to see exactly which filter rejected the request and why.

**For 401, check the token's journey:**

- **The header:** `Authorization: Bearer <token>`, with exactly one space. Proxies, gateways or CORS configuration may strip the `Authorization` header.
- **The filter:** is your JWT filter registered, in the right place (before `UsernamePasswordAuthenticationFilter`), and does it set the `SecurityContext`? With Spring's resource server, check `issuer-uri` / `jwk-set-uri`.
- **Validation details:** "valid" on jwt.io isn't the same as valid for your server. Check the signature key (a rotated key, or the wrong `kid`), the `iss` and `aud` claims, the expiry, and **clock skew** between servers.
- **CORS preflight:** browser `OPTIONS` requests carry no token. Configure CORS in Spring Security so preflights are allowed.
- **Stateless config:** `SessionCreationPolicy.STATELESS`. Make sure nothing redirects to a login page (a 302 that looks like a failure).

**For 403, check authorities:**

- **The role prefix:** `hasRole("ADMIN")` checks for the authority `ROLE_ADMIN`. If the token's `roles` claim contains `ADMIN`, map it with the prefix, or use `hasAuthority("ADMIN")`.
- **Claim mapping:** with the resource server, scopes become `SCOPE_xxx` by default. Use a `JwtAuthenticationConverter` to map a custom `roles` claim.
- **Rule order:** in `authorizeHttpRequests`, the first matching rule wins. A broad rule above a specific one changes the outcome.
- **Method security:** `@PreAuthorize` expressions, and ownership checks (Q70).
- **CSRF:** with CSRF protection enabled and cookie-based auth, POSTs fail with 403. For pure bearer-token APIs, CSRF is normally disabled.
- **`/error` dispatch:** an exception in the controller is forwarded to `/error`. If that path isn't permitted, the client sees 401/403 instead of the real error.

```java
@Bean
JwtAuthenticationConverter jwtAuthConverter() {
    var authorities = new JwtGrantedAuthoritiesConverter();
    authorities.setAuthoritiesClaimName("roles");
    authorities.setAuthorityPrefix("ROLE_");
    var converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(authorities);
    return converter;
}
```

### Q68. A user's JWT expires while they are using the application. How would you manage token renewal securely?

Use **short-lived access tokens with refresh tokens**:

| Token | Lifetime | Stored | Used for |
| --- | --- | --- | --- |
| Access token (JWT) | 5–15 minutes | In memory in the SPA (not `localStorage`) | Calling APIs |
| Refresh token | Days to weeks | **HttpOnly, Secure, SameSite** cookie scoped to the refresh path | Getting new access tokens |

```flow
API call returns 401 (access token expired)
Client calls POST /auth/refresh — the cookie is sent automatically
Server validates the refresh token: not revoked, not expired, belongs to the user
Server issues a NEW access token and a NEW refresh token (rotation), invalidating the old one
Client retries the original request
```

**Security measures:**

- **Refresh token rotation with reuse detection:** each refresh token works **once**. If an old one is presented again, it was probably stolen, so revoke the whole token family and force a new login.
- **Store refresh tokens server-side** (hashed) so they can be revoked on logout, password change or suspicious activity.
- **Absolute session limits:** require a full login again after, say, 30 days, even with activity.
- **Refresh proactively** a little before expiry, and make concurrent refresh calls share one in-flight request, so parallel requests don't trigger multiple rotations.
- **Never put sensitive data in JWT claims.** They're only encoded, not encrypted.
- With an identity provider (Keycloak, Auth0, Okta, Cognito), use **OAuth2/OIDC**. Authorization Code + PKCE for SPAs and mobile apps, or a **backend-for-frontend** that keeps tokens out of the browser entirely.

### Q69. How would you implement role-based access control when an application has 15 or more roles?

Hard-coding `hasAnyRole("ADMIN", "MANAGER", "SUPERVISOR", …)` everywhere becomes unmanageable. Separate **roles** from **permissions**:

- **Authorise on permissions**, not roles: `order:read`, `order:approve`, `refund:create`. Code checks permissions, and roles are just named bundles of permissions.

```java
@PreAuthorize("hasAuthority('order:approve')")
public void approve(Long orderId) { … }
```

- **Store the role → permission mapping in the database** (or the identity provider), so you can change it without redeploying:

```text
roles(id, name) — role_permissions(role_id, permission_id) — permissions(id, code)
user_roles(user_id, role_id)
```

- **Resolve permissions at login,** and put the permissions (or the roles, to keep tokens small) in the token, or load them per request with caching.
- **Role hierarchies** for inheritance (`ROLE_ADMIN > ROLE_MANAGER > ROLE_USER`) with a `RoleHierarchy` bean.
- **Centralise rules:** keep URL-level rules in the `SecurityFilterChain` configuration, and fine-grained rules in method security (`@PreAuthorize`), with custom beans for complex logic: `@PreAuthorize("@orderSecurity.canApprove(authentication, #orderId)")`.
- **Attribute-based rules** (ABAC) when access depends on data (region, department, amount limits): "managers can approve refunds up to ₹50,000 in their own region".
- **Test the access matrix:** parameterised tests per role and endpoint (`@WithMockUser(authorities = "order:approve")`).

### Q70. How would you prevent unauthorized users from accessing another customer's order?

This is **IDOR / Broken Object Level Authorization**, number one in the OWASP API Security Top 10. Being logged in isn't enough: **every request must check that the resource belongs to the caller**.

```java
// ❌ any logged-in user can read any order by changing the ID
@GetMapping("/orders/{id}")
public OrderDto get(@PathVariable Long id) {
    return orderService.findById(id);
}

// ✅ scope the query to the authenticated user
@GetMapping("/orders/{id}")
public OrderDto get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
    Long customerId = Long.valueOf(jwt.getSubject());
    return orderRepository.findByIdAndCustomerId(id, customerId)
            .map(OrderDto::from)
            .orElseThrow(() -> new OrderNotFoundException(id));   // 404, so it doesn't reveal the order exists
}
```

**Other ways to enforce ownership:**

- Method security with a custom check: `@PreAuthorize("@orderAccess.isOwner(#id, authentication)")`, or `@PostAuthorize("returnObject.customerId == authentication.name")`.
- **Always take the user's identity from the token,** never from a request parameter like `?customerId=`.
- Make the ownership filter part of the **repository query**, so it can't be forgotten in one code path. Hibernate filters or multi-tenancy (`@TenantId`) can apply it automatically.
- Don't rely on **unguessable IDs** (UUIDs) as the protection. They make guessing harder but aren't authorization.
- Include **admin and support roles** explicitly, and audit their access.
- **Test it:** an automated test where user A requests user B's order and expects 404/403.

### Q71. How would you protect a payment API from replay attacks and duplicate submissions?

**Duplicates** come from honest retries. **Replays** come from an attacker re-sending a captured valid request. Use layered defences:

- **TLS everywhere** (HTTPS, with HSTS), so requests can't easily be captured in transit.
- **An idempotency key** per payment attempt. The server processes each key once and returns the stored result for repeats (Q45). This blocks accidental duplicates.
- **Signed requests with a timestamp and nonce,** for server-to-server and webhook calls:

```text
X-Timestamp: 2026-10-16T09:12:44Z
X-Nonce: 7f3c9a1e-…
X-Signature: HMAC-SHA256(secret, method + path + timestamp + nonce + sha256(body))
```

The server **rejects requests older than ~5 minutes**, rejects **nonces it has already seen** (stored in Redis with a TTL matching the window), and verifies the signature with a **constant-time comparison** (`MessageDigest.isEqual`).

- **Short-lived, sender-bound tokens:** short access-token lifetimes, and DPoP or mTLS-bound tokens for high-value APIs, so a stolen token is useless elsewhere.
- **Business rules:** payment state machines (a `PAID` order can't be paid again), amount and currency validated against the server-side order, not the client's request.
- **Step-up authentication** for sensitive actions (OTP, 3-D Secure).
- **Rate limiting and anomaly detection** per user, card and IP.
- **Verify webhooks:** check provider signatures (for example Stripe's `Stripe-Signature`), and deduplicate by event ID.

### Q72. How would you manage secrets, database credentials, and API keys across development, testing, and production environments?

**Principles:**

- **Never commit secrets** to Git, including `application.yml`, Dockerfiles and CI scripts. Add secret scanning (gitleaks, GitHub secret scanning) and pre-commit hooks. If a secret leaks, **rotate it immediately**: deleting the commit isn't enough.
- **Different secrets for each environment,** with least privilege: the dev database user can't touch production, and the app's database user can't drop tables.
- **Inject secrets at runtime** from a **secrets manager**:

| Tool | Notes |
| --- | --- |
| HashiCorp Vault | Spring Cloud Vault; **dynamic database credentials** with short leases |
| AWS Secrets Manager / Parameter Store | `spring.config.import=aws-secretsmanager:…` (Spring Cloud AWS) |
| Azure Key Vault / GCP Secret Manager | Spring Cloud Azure / GCP integrations |
| Kubernetes Secrets | Mounted as files or environment variables. Enable encryption at rest, restrict them with RBAC, or sync from a vault (External Secrets Operator) |

```yaml
spring:
  config:
    import: "vault://"
  cloud:
    vault:
      uri: https://vault.internal:8200
      authentication: KUBERNETES   # the pod's service account, so there's no secret needed to fetch secrets
```

- **Local development:** use `.env` files or local profiles that are **git-ignored**, with dummy or developer-specific credentials, and Testcontainers for local databases. Never copy production secrets to laptops.
- **Rotation:** automate rotation (Vault dynamic secrets, AWS rotation Lambdas). Applications should handle new credentials without redeploying (Hikari `max-lifetime`, Spring Cloud refresh).
- **Prefer identity over secrets** where possible: IAM roles for service accounts (IRSA, workload identity) instead of static access keys.
- **Don't leak secrets at runtime:** mask them in logs and in Actuator `/env` (masked by default), and never return them in error messages.
- **Audit access** to the secrets store.

## Key Takeaways

- ✅ 401 = authentication failed (header, filter, signature, claims, clock); 403 = authorities, role prefix, CSRF, rule order.
- ✅ Use short access tokens plus rotating, revocable refresh tokens in HttpOnly cookies.
- ✅ Authorise on permissions, with the role mapping in data and ABAC for data-dependent rules.
- ✅ Check object ownership on every request (IDOR), using the identity from the token.
- ✅ Idempotency keys plus signed, timestamped, nonce-checked requests stop duplicates and replays.
- ✅ Keep secrets out of Git, in a secrets manager, per environment, rotated, and least-privileged.
