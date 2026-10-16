---
title: Security in Microservices
subtitle: Edge vs service-level security, OAuth2 and OpenID Connect roles, an authorization server such as Keycloak, services as JWT resource servers, token relay, service-to-service authentication with client credentials and mTLS, scopes and roles, and zero trust.
order: 9
---

## Introduction

In a monolith, a user logs in once and a session covers every feature. With dozens of services, each one must know **who is calling** and **what they're allowed to do** — without every service handling passwords. The standard answer is **OAuth2 + OpenID Connect with JWT access tokens**.

> [!TIP]
> If JWTs are new to you, read [JWT Authentication in Spring Boot](/spring/spring-security/jwt-authentication-spring-boot/) first — this chapter builds on it for the multi-service case.

## Where Security Is Enforced

| Layer | Responsibility |
| --- | --- |
| **API gateway** | Reject requests without a valid token; rate limiting; CORS; TLS termination |
| **Each service** | Validate the token **again** and authorize every operation (roles, scopes, ownership) |
| **Network** | TLS (ideally mTLS) between services; network policies limiting who can talk to whom |

> [!IMPORTANT]
> **Zero trust:** never assume a request is safe because it's "internal". Attackers who get inside the network, or a misconfigured route that bypasses the gateway, must still face authentication and authorization in every service.

## OAuth2 and OpenID Connect

| Role | Example |
| --- | --- |
| **Resource owner** | The user |
| **Client** | The web app, mobile app or another service |
| **Authorization server** | Keycloak, Okta, Auth0, Azure AD / Entra ID, Spring Authorization Server |
| **Resource server** | Your microservices, which accept access tokens |

- **OAuth2** is about **authorization** — getting an access token to call APIs.
- **OpenID Connect (OIDC)** adds **authentication** on top — an ID token describing the user, and a standard user-info endpoint.

### The Login Flow (Authorization Code + PKCE)

```flow
User clicks "Log in" in the web or mobile app
App redirects to the authorization server's login page
User authenticates — password, MFA, social login
Authorization server redirects back with a one-time code
App exchanges the code (plus a PKCE verifier) for tokens
App calls APIs with Authorization: Bearer access-token
```

Your services **never see the user's password** — only signed tokens. Login, MFA, password resets and social login are handled once, by the authorization server.

## Tokens

| Token | Purpose | Lifetime |
| --- | --- | --- |
| **Access token** (usually a JWT) | Sent to APIs; carries subject, scopes / roles, audience, expiry | Short — minutes |
| **ID token** (JWT, OIDC) | Tells the client who logged in | Short |
| **Refresh token** | Gets new access tokens without logging in again | Longer — hours or days |

A typical access token payload:

```json
{
  "iss": "https://auth.example.com/realms/shop",
  "sub": "8f14e45f-ceea-467a-9575-0b5b1c1e3f9a",
  "aud": "order-service",
  "scope": "orders:read orders:write",
  "realm_access": { "roles": ["CUSTOMER"] },
  "exp": 1760522430
}
```

Because the authorization server signs tokens with **RS256** (private key) and publishes its public keys at a **JWKS** endpoint, every service can verify tokens **locally**, without calling the auth server on each request.

## Services as Resource Servers

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
```

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com/realms/shop   # discovers the JWKS keys automatically
          audiences: order-service                          # reject tokens meant for other services
```

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/orders/**").hasAuthority("SCOPE_orders:read")
                .requestMatchers("/api/orders/**").hasAuthority("SCOPE_orders:write")
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.disable());
        return http.build();
    }
}
```

Spring Security validates the signature, expiry, issuer and audience, and maps the `scope` claim to `SCOPE_…` authorities. (Roles in custom claims, like Keycloak's `realm_access.roles`, need a small `JwtAuthenticationConverter`.)

### Authorization Inside the Service

Scopes say *what kind* of action the client may take; the service must still check **which data**:

```java
@PreAuthorize("hasAuthority('SCOPE_orders:read')")
@GetMapping("/api/orders/{id}")
public OrderView get(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
    Order order = orderService.find(id);
    if (!order.customerId().equals(jwt.getSubject()) && !isSupport(jwt)) {
        throw new AccessDeniedException("Not your order");    // object-level authorization
    }
    return OrderView.from(order);
}
```

> [!WARNING]
> **Broken object-level authorization** — letting any authenticated user fetch `/orders/{anyone's id}` — is the top API security risk (OWASP API Top 10). Always check ownership, not just the presence of a valid token.

## Propagating the User's Identity

When the order service calls the payment service **on behalf of the user**, forward the user's token:

```java
@Bean
RestClient paymentClient(RestClient.Builder builder) {
    return builder
            .baseUrl("http://payment-service")
            .requestInterceptor((request, body, execution) -> {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth instanceof JwtAuthenticationToken jwt) {
                    request.getHeaders().setBearerAuth(jwt.getToken().getTokenValue());
                }
                return execution.execute(request, body);
            })
            .build();
}
```

At the gateway, Spring Cloud Gateway's **`TokenRelay`** filter does this when the gateway itself handles the OAuth2 login.

## Service-to-Service Authentication

For calls **not** on behalf of a user — a scheduled job, an event consumer calling another service — use the **client credentials** grant: the service authenticates as itself and gets its own token.

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          inventory-client:
            provider: shop-auth
            client-id: order-service
            client-secret: ${ORDER_SERVICE_CLIENT_SECRET}
            authorization-grant-type: client_credentials
            scope: inventory:read
        provider:
          shop-auth:
            issuer-uri: https://auth.example.com/realms/shop
```

Spring Security's OAuth2 client support (for example `OAuth2ClientHttpRequestInterceptor` with `RestClient`) fetches, caches and refreshes the token automatically.

### mTLS and Service Meshes

**Mutual TLS** makes both sides present certificates, so services prove their identity at the connection level and all traffic is encrypted. Doing it by hand is painful; **service meshes** (Istio, Linkerd) issue and rotate certificates automatically and enforce which services may call which.

| Mechanism | Proves |
| --- | --- |
| User access token (forwarded) | Which user, which scopes |
| Client-credentials token | Which service is calling, with which scopes |
| mTLS | Which workload is on the other end of the connection |

## Other Essentials

- **TLS everywhere** — at the edge and between services.
- **Secrets** in Vault or a cloud secret manager — never in Git or images.
- **Least privilege** — narrow scopes per client; network policies per service.
- **Validate input** in every service — the gateway can't know each service's rules.
- **Audit logging** of security-relevant actions, without logging tokens.
- **Dependency and image scanning** in CI.

## Interview Questions

### How do you secure microservices?

Use an authorization server with OAuth2/OIDC; clients obtain access tokens (JWTs); the gateway validates them at the edge and every service validates them again as a resource server and enforces authorization, including object-level checks. Service-to-service calls use forwarded user tokens or client-credentials tokens, over TLS or mTLS.

### What's the difference between OAuth2 and OpenID Connect?

OAuth2 is an authorization framework for obtaining access tokens to call APIs; OIDC is an identity layer on top that authenticates the user and provides an ID token.

### Why validate tokens in each service if the gateway already does?

Zero trust: internal traffic may bypass the gateway, and only the service knows its own authorization rules.

### How do services verify JWTs without calling the auth server?

Tokens are signed with the auth server's private key (RS256); services download its public keys from the JWKS endpoint (found via the issuer URI) and verify signatures locally.

### How do you authenticate service-to-service calls?

Forward the user's token for calls made on their behalf; use the OAuth2 client-credentials grant for the service's own calls; and add mTLS (often via a service mesh) for transport-level identity.

### What is broken object-level authorization?

Failing to check that the authenticated user is allowed to access the specific object requested — for example, any user reading any order by changing the ID.

## Key Takeaways

- ✅ Centralise login in an authorization server (Keycloak, Okta, Entra ID); services never handle passwords.
- ✅ Services are OAuth2 resource servers that validate JWTs locally via JWKS.
- ✅ Validate at the gateway **and** in every service; check object-level permissions.
- ✅ Forward user tokens; use client credentials for service identity; add mTLS.
- ✅ TLS everywhere, least privilege, and secrets outside code.
