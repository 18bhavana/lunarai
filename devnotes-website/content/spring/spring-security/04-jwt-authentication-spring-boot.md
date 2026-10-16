---
title: JWT Authentication in Spring Boot
subtitle: Sessions vs JWT, the login and request flow end to end, a custom OncePerRequestFilter, wiring it into a Spring Security 6 SecurityFilterChain, role-based access with @PreAuthorize, refresh tokens, and how to explain it in an interview.
order: 4
---

## Introduction

A typical resume line for a backend developer reads:

> *"Engineered secure REST APIs with JWT-based authentication and custom filters for token-based request validation and access control."*

It means you designed and built APIs where only **authenticated** and **authorized** users can reach protected resources. This chapter breaks that sentence down and shows the complete implementation.

| Phrase | What it means |
| --- | --- |
| **Engineered secure REST APIs** | Built RESTful services with Spring Boot and protected their endpoints from unauthorized access |
| **JWT-based authentication** | After a successful login, the server issues a JWT containing the username, roles and expiry; the client sends it on every request |
| **Custom filters for token-based request validation** | A filter (usually extending `OncePerRequestFilter`) intercepts every request, validates the token and sets the authenticated user |
| **Access control** | Endpoints restricted by role, e.g. `@PreAuthorize("hasRole('ADMIN')")` |

## Why JWT Instead of Sessions?

### Traditional Session Authentication

```flow
User logs in
Server creates a session and stores it
Session ID sent to the browser in a cookie
Every request carries the session ID
Server looks the session up in its session store
```

Problems at scale: session storage is needed on the server, it's harder to scale across many servers (sticky sessions or a shared store like Redis), and there are extra lookups on each request.

### JWT Authentication

```flow
User logs in
Server creates a signed JWT
Client stores the JWT
Every request sends the JWT
Server verifies the signature — no session lookup
```

| Session-based | JWT-based |
| --- | --- |
| **Stateful** — the server stores sessions | **Stateless** — everything needed is in the token |
| Scaling needs sticky sessions or a shared store | Any instance can verify any token |
| Easy logout — delete the session | Logout is harder — the token stays valid until it expires |
| Session ID is tiny | The token is larger and sent on every request |
| Natural for server-rendered web apps | Natural for REST APIs, mobile apps and microservices |

> [!NOTE]
> JWT isn't automatically "better" — it trades easy revocation for statelessness. See *JWT Security & Interview Scenarios* for logout and refresh-token strategies.

## The Architecture

```flow
Client sends a login request
Authentication API validates credentials and generates a JWT
Client stores the token
Client calls APIs with Authorization: Bearer token
JWT filter validates the signature and expiry and extracts the user and roles
Spring Security context holds the authenticated user
Protected REST API runs, subject to role checks
```

## Step 1 — Login and Token Creation

```http
POST /login
Content-Type: application/json

{ "username": "john", "password": "1234" }
```

**Validate the credentials** with the `AuthenticationManager` (which uses `UserDetailsService` and `PasswordEncoder`, as in *Password Encoding*):

```java
Authentication authentication = authenticationManager.authenticate(
        new UsernamePasswordAuthenticationToken(request.username(), request.password()));
```

If the username doesn't exist or the password doesn't match, this throws an `AuthenticationException` (e.g. `BadCredentialsException`) → **401**.

**Generate the token** with the user's roles as a claim:

```java
String token = Jwts.builder()
        .subject(username)
        .claim("roles", List.of("ROLE_ADMIN"))
        .issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + 15 * 60 * 1000))   // 15 minutes
        .signWith(key)
        .compact();
```

**Return it:**

```json
{ "token": "eyJhbGciOiJIUzI1NiJ9..." }
```

### A Login Controller

```java
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public TokenResponse login(@RequestBody LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        UserDetails user = (UserDetails) auth.getPrincipal();
        return new TokenResponse(jwtService.generateToken(user));
    }
}

record LoginRequest(String username, String password) { }
record TokenResponse(String token) { }
```

## Step 2 — Where the Client Stores the Token

| Option | Trade-off |
| --- | --- |
| `localStorage` / `sessionStorage` | Easy, but readable by any JavaScript on the page → vulnerable to **XSS** |
| **HttpOnly cookie** | JavaScript can't read it → protects against XSS; but the browser sends it automatically → needs **CSRF** protection (`SameSite`, CSRF tokens) |
| Memory only (a JS variable) + refresh cookie | Common in SPAs: short-lived access token in memory, refresh token in an HttpOnly cookie |

Mobile and server-to-server clients simply keep the token in secure storage and send it in a header.

## Step 3 — Sending the Token

```http
GET /accounts
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

## Step 4 — The JWT Filter

Every request goes through a custom filter **before** it reaches the controller:

```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);    // no token — let Spring Security decide (401 for protected URLs)
            return;
        }

        String token = authHeader.substring(7);
        try {
            String username = jwtService.extractUsername(token);           // verifies signature + expiry

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        } catch (JwtException e) {
            // invalid, tampered or expired token — leave the context empty; protected URLs return 401
        }

        filterChain.doFilter(request, response);
    }
}
```

### What Happens During Validation

```flow
1 — extract the token after "Bearer "
2 — verify the signature with the server key
3 — check the expiration (exp)
4 — read the username (sub)
5 — load the user's roles and authorities
6 — create an Authentication object
7 — store it in the SecurityContext
Controller runs with the authenticated user
```

| Step | Code / result |
| --- | --- |
| Extract | `token = header.substring(7)` |
| Verify signature | Recompute `HMACSHA256(header.payload, key)` and compare — mismatch → `SignatureException` |
| Check expiry | Expired → `ExpiredJwtException` (JJWT checks `exp` automatically) |
| Extract username | `claims.getSubject()` → `john` |
| Load user | `userDetailsService.loadUserByUsername("john")` → roles and authorities |
| Create authentication | `new UsernamePasswordAuthenticationToken(userDetails, null, authorities)` |
| Set context | `SecurityContextHolder.getContext().setAuthentication(auth)` |

Now Spring Security knows: *user = john, role = ADMIN*.

> [!TIP]
> Loading the user from the database on every request (step 5) lets you block disabled accounts immediately, at the cost of one query per request. The fully stateless alternative builds the authorities straight from the token's `roles` claim — faster, but role changes only take effect when the token expires.

## Step 5 — Wire the Filter into Spring Security

Without this, the filter never runs in the right place. Spring Security 6 configuration:

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity                       // enables @PreAuthorize
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                          // OK for header-based tokens; NOT if the JWT is in a cookie
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

| Line | Why |
| --- | --- |
| `sessionCreationPolicy(STATELESS)` | Spring Security never creates or uses an HTTP session |
| `addFilterBefore(..., UsernamePasswordAuthenticationFilter.class)` | The JWT filter runs early in the security filter chain |
| `csrf.disable()` | Safe only when the token travels in the `Authorization` header — browsers don't add that header automatically |
| `@EnableMethodSecurity` | Required for `@PreAuthorize`; replaces the deprecated `@EnableGlobalMethodSecurity` |

> [!NOTE]
> Older tutorials extend `WebSecurityConfigurerAdapter` and write `http.sessionManagement().sessionCreationPolicy(...)`. The adapter was removed in Spring Security 6, and the chained style is deprecated — use the lambda DSL shown above.

> [!WARNING]
> If your filter is a `@Component`, Spring Boot also registers it as a normal servlet filter, so it can run twice. Either don't annotate it and create it as a `@Bean` only for the security chain, or add a `FilterRegistrationBean` with `setEnabled(false)`.

## Step 6 — Access Control

```java
@PreAuthorize("hasRole('ADMIN')")
@GetMapping("/users")
public List<User> getUsers() {
    return userService.getUsers();
}
```

```flow
Request reaches /users
? Role is ADMIN? | Yes: allowed — 200 | No: 403 Forbidden
```

> [!IMPORTANT]
> `hasRole('ADMIN')` checks for the authority **`ROLE_ADMIN`** — Spring adds the `ROLE_` prefix. If your token or database stores plain `ADMIN`, use `hasAuthority('ADMIN')` instead, or store roles with the prefix.

### Authentication vs Authorization

| Authentication | Authorization |
| --- | --- |
| **Who are you?** | **What can you access?** |
| Username + password, JWT validation | ADMIN → delete users; USER → view users |
| Failure → **401 Unauthorized** | Failure → **403 Forbidden** |

## Token Expiration and Refresh Tokens

```java
.expiration(new Date(System.currentTimeMillis() + 3_600_000))   // valid for 1 hour
```

After the expiry, requests return **401 Unauthorized**. Short-lived access tokens are safer, so pair them with a **refresh token**:

| Token | Lifetime | Used for |
| --- | --- | --- |
| Access token | ~15 minutes | Calling APIs (`Authorization: Bearer`) |
| Refresh token | ~7 days | Only to obtain a new access token |

```flow
Access token expires
Client sends the refresh token to /auth/refresh
Server validates it and issues a new access token
User stays logged in without re-entering the password
```

## JWT Security Best Practices

1. **Use HTTPS** — never send tokens over plain HTTP.
2. **Keep access tokens short-lived** — 15–30 minutes.
3. **Store secrets securely** — environment variables, Vault or a cloud secret manager, never in source code:

```properties
jwt.secret=${JWT_SECRET}
```

4. **Always verify the signature** — never trust a payload you've only decoded.
5. **Use refresh tokens** instead of long-lived access tokens.
6. **Prefer HttpOnly cookies in browsers** to protect against XSS — and add CSRF protection when you do.

## The Interview Answer (3–4 minutes)

> JWT is a stateless authentication mechanism commonly used in Spring Boot REST APIs. When a user logs in, Spring Security's `AuthenticationManager` validates the username and password. If authentication succeeds, the server generates a JWT containing claims such as the username, roles, issued-at time and expiration. The token has a header, payload and signature, and the signature — created with a secret key — makes the token tamper-proof. The client stores the token and sends it as a Bearer token in the Authorization header on every request. A custom filter extending `OncePerRequestFilter`, registered before `UsernamePasswordAuthenticationFilter`, extracts the token, validates its signature and expiry, loads the user and sets an Authentication object in the `SecurityContext`. Spring Security then enforces role-based authorization with rules like `hasRole` and annotations such as `@PreAuthorize`. The session policy is stateless, so no session is stored on the server, which makes the design scalable and well suited to microservices.

## Interview Questions

### Why JWT instead of session authentication?

It's stateless and needs no server-side session storage, so any instance can verify any request — convenient for REST APIs, mobile clients and microservices. The trade-off is harder revocation.

### What information is stored in a JWT?

The subject (username or user ID), roles or authorities, issued-at and expiration times, and any custom claims — never secrets.

### What is the structure of a JWT?

`Header.Payload.Signature`.

### Why use a custom filter?

To validate the JWT before the request reaches controllers, and to establish the authenticated user for each request.

### What is OncePerRequestFilter?

A Spring base filter class that guarantees the filter logic runs exactly once per request, even when a request is forwarded or dispatched internally.

### What happens if the token is expired?

Parsing throws `ExpiredJwtException`, no authentication is set, and the request to a protected endpoint returns **401 Unauthorized**.

### What is the difference between 401 and 403?

401 means the user isn't authenticated (no token, invalid or expired token). 403 means they are authenticated but don't have permission.

### What is SecurityContextHolder?

It holds the `SecurityContext` — and therefore the current `Authentication` — for the current thread. Spring Security reads it to make authorization decisions; the JWT filter populates it.

### Why must the filter be added before UsernamePasswordAuthenticationFilter?

So the request is authenticated from the token early in the security filter chain, before Spring Security's authorization checks run.

### What is the difference between an access token and a refresh token?

The access token is short-lived and sent with every API call; the refresh token is long-lived, kept more securely, and used only to obtain new access tokens.

### Where should a JWT be stored in the browser?

Ideally in an HttpOnly, Secure, SameSite cookie (with CSRF protection) or in memory with a refresh cookie — not in `localStorage`, which XSS can read.

## Common Mistakes

- ❌ **Forgetting `addFilterBefore`** — the filter never authenticates anything.
- ❌ **Not making the session policy `STATELESS`** — Spring still creates sessions.
- ❌ **`hasRole('ADMIN')` with authorities stored as `ADMIN`** — always 403.
- ❌ **Missing `@EnableMethodSecurity`** — `@PreAuthorize` is silently ignored.
- ❌ **Disabling CSRF while storing the JWT in a cookie.**
- ❌ **Long-lived access tokens** without refresh tokens or revocation.
- ❌ **Catching token errors and continuing as if authenticated.**

## Key Takeaways

- ✅ Login validates credentials with `AuthenticationManager` and returns a signed JWT.
- ✅ The client sends `Authorization: Bearer <token>` on every request.
- ✅ A `OncePerRequestFilter` verifies the token and puts an `Authentication` into the `SecurityContext`.
- ✅ Register the filter with `addFilterBefore(..., UsernamePasswordAuthenticationFilter.class)` and a `STATELESS` session policy.
- ✅ `@PreAuthorize("hasRole('ADMIN')")` needs `@EnableMethodSecurity` and `ROLE_`-prefixed authorities.
- ✅ 401 = not authenticated, 403 = not allowed; short access tokens + refresh tokens keep users logged in safely.
