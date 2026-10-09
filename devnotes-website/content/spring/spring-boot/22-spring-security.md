---
title: Spring Security
subtitle: Authentication vs authorization, the security filter chain, AuthenticationManager, AuthenticationProvider, UserDetailsService, BCrypt, SecurityContextHolder, JWT with OncePerRequestFilter, roles, 401 vs 403 and CSRF.
order: 22
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

Spring Security is one of the most frequently asked topics for 3–10 years Java developers — almost every enterprise application uses it (banking, healthcare, e-commerce, government portals, insurance, ticket booking, ERP, payments).

Interviewers frequently ask: What is Spring Security? Authentication vs authorization? What is the security filter chain? What are `UserDetailsService`, `AuthenticationManager`, `AuthenticationProvider` and `SecurityContextHolder`? How does JWT authentication work? How does `OncePerRequestFilter` work? What happens internally after login?

## What is Spring Security?

A framework that protects your application against unauthorized access. It provides authentication, authorization, password encoding, CSRF protection, session management, JWT authentication, OAuth2, LDAP, remember-me and security headers.

## Why Do We Need Security?

```flow
Without security
Anyone
REST API
Database
---
With Spring Security
Client
Authentication
Authorization
Controller → Service → Database
```

Without security, anyone can access your data. With Spring Security, only **authenticated and authorized** users can access resources.

## Authentication vs Authorization

One of the most common interview questions.

- **Authentication** answers *"Who are you?"* — e.g. username + password → verify identity.
- **Authorization** answers *"What are you allowed to do?"* — e.g. an admin can create, update and delete users; a regular user can only view and update their own profile.

| Authentication | Authorization |
| --- | --- |
| Identity verification | Permission check |
| Login | Access control |
| Username + password | Roles and authorities |
| Happens first | Happens after authentication |

## Spring Security Architecture

```flow This architecture is frequently asked in interviews
HTTP request
Security filter chain
Authentication filter
AuthenticationManager
AuthenticationProvider
UserDetailsService
Database
SecurityContext
Controller
Response
```

## The Security Filter Chain

**Every request first enters the security filter chain.** If a request fails security checks, it **never reaches the controller**.

> [!NOTE]
> Spring Security plugs into the servlet container as a single filter (`DelegatingFilterProxy` → `FilterChainProxy`), which then runs the chain of security filters. These run **before** the `DispatcherServlet`.

### SecurityFilterChain

Modern Spring Security uses a `SecurityFilterChain` bean instead of the old `WebSecurityConfigurerAdapter` (which has been **removed** in Spring Security 6):

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

    http.authorizeHttpRequests(auth -> auth
            .requestMatchers("/login").permitAll()
            .anyRequest().authenticated());

    return http.build();
}
```

```flow-h
HTTP request
FilterChainProxy
SecurityFilterChain
Authentication
Authorization
Controller
```

## Username & Password Login

```flow-h
Client — username + password
Spring Security
Database
Password match
Success
```

### AuthenticationManager

**Interview favourite.** `AuthenticationManager` is responsible for authentication:

```flow-h
Username + password
AuthenticationManager
Success / failure
```

It **delegates** authentication to one or more `AuthenticationProvider` implementations.

### AuthenticationProvider

`AuthenticationProvider` performs the **actual** authentication:

```flow-h
AuthenticationManager
AuthenticationProvider
UserDetailsService
Database
```

Example providers: `DaoAuthenticationProvider`, LDAP provider, OAuth provider.

### UserDetailsService

```java
public interface UserDetailsService {
    UserDetails loadUserByUsername(String username);
}
```

It loads the user from a database, LDAP, an external system or an API:

```java
@Service
public class MyUserService implements UserDetailsService {

    @Override
    public UserDetails loadUserByUsername(String username) {
        // fetch the user; throw UsernameNotFoundException if missing
    }
}
```

### UserDetails

Represents a user to Spring Security. Important methods:

```java
getUsername();
getPassword();
getAuthorities();
isAccountNonExpired();
isAccountNonLocked();
isEnabled();
```

## PasswordEncoder

**Never store plain-text passwords** — not `password123`, but a hash like `$2a$10$P7w...`.

```java
PasswordEncoder encoder = new BCryptPasswordEncoder();
```

### BCryptPasswordEncoder

**Interview favourite.**

```flow
Registration
Password
BCrypt
Hash stored in database
---
Login
Password
BCrypt (with the stored salt)
Compare hashes
Success
```

The raw password is **not decrypted** — hashing is one-way. BCrypt hashes the supplied password (using the salt embedded in the stored hash) and compares the result.

## The Authentication Object

After login, Spring creates an **`Authentication`** containing the principal (user), credentials, authorities and authenticated status.

### SecurityContextHolder

One of the most important interview topics. After authentication, Spring stores the authenticated user in **`SecurityContextHolder`**:

```flow-h
Authentication
SecurityContext
SecurityContextHolder
Controller
```

Access the current user:

```java
Authentication auth = SecurityContextHolder.getContext().getAuthentication();

String username = auth.getName();
```

## JWT Authentication

Modern REST APIs mostly use **JWT**.

```flow
Login
Username + password
AuthenticationManager → AuthenticationProvider → database
Generate JWT
Return to client
---
Subsequent request
Authorization: Bearer eyJhbGci...
JWT filter validates token
SecurityContextHolder
Controller
```

No database lookup is required for every request **unless your application chooses to do one** (for example, to load current user details or verify account status).

### JWT Filter

Usually implemented with `OncePerRequestFilter`:

```java
public class JwtFilter extends OncePerRequestFilter {
}
```

```flow-h
HTTP request
JWT filter
Read Authorization header
Validate token
Create Authentication
SecurityContextHolder
Next filter
```

Register it in the chain, typically before the username/password filter:

```java
http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
```

### Why OncePerRequestFilter?

It guarantees the filter executes **once per HTTP request** (even on internal forwards). Useful for JWT validation, logging, auditing and correlation IDs.

## SecurityContext Lifecycle

```flow-h
HTTP request
Authentication
SecurityContextHolder
Controller
Response
Context cleared
```

Spring **clears the security context at the end of the request** to avoid leaking authentication information between requests (it's stored per thread).

## Authorization

```java
http.authorizeHttpRequests(auth -> auth
        .requestMatchers("/admin/**").hasRole("ADMIN")
        .anyRequest().authenticated());
```

Meaning: `/admin/**` → only `ADMIN`.

### Roles vs Authorities

**Interview favourite.** A **role** like `ADMIN` is stored internally as the authority **`ROLE_ADMIN`** — `hasRole("ADMIN")` checks for `ROLE_ADMIN`. **Authorities** are finer-grained permissions such as `READ_USER` and `WRITE_USER` (checked with `hasAuthority(...)`).

### Method Security

```java
@PreAuthorize("hasRole('ADMIN')")
public void deleteUser() {
}
```

Only admins can invoke this method. Method security must be enabled — with **`@EnableMethodSecurity`** in modern Spring Security.

## 401 vs 403

**Interview favourite.**

| Status | Meaning |
| --- | --- |
| `401 Unauthorized` | Not authenticated — authentication required or failed |
| `403 Forbidden` | Authenticated, but not authorized |

## CSRF

CSRF protection defends **browser-based** applications against forged requests. For many stateless REST APIs using JWT (sent in a header, not a cookie):

```java
http.csrf(csrf -> csrf.disable());
```

is common. For browser applications using **sessions/cookies**, CSRF protection should usually remain **enabled**.

## Session vs JWT

| Session | JWT |
| --- | --- |
| Server stores the session | Client stores the token |
| Stateful | Stateless |
| Client sends a session ID | Client sends the JWT |
| Uses server memory (or a session store) | No server-side session required |

## Internal Flows

```flow Internal login flow
Login request
UsernamePasswordAuthenticationFilter
AuthenticationManager
AuthenticationProvider
UserDetailsService
Database
PasswordEncoder
Authentication
SecurityContextHolder
Success response
```

```flow Internal JWT flow
HTTP request
OncePerRequestFilter
Read JWT
Validate JWT
Create Authentication
SecurityContextHolder
Controller
Response
```

Key components: `FilterChainProxy`, `SecurityFilterChain`, authentication filters, `AuthenticationManager`, `AuthenticationProvider`, `UserDetailsService`, `PasswordEncoder` and `SecurityContextHolder`.

## Common Mistakes

- ❌ **Storing plain passwords** — store a BCrypt hash.
- ❌ **Parsing the JWT in every controller** with `@RequestHeader("Authorization")` — use a JWT filter to populate `SecurityContextHolder` once per request.
- ❌ **Using `SecurityContextHolder` before authentication** — always check that an authentication exists.
- ❌ **Disabling security completely** with `permitAll()` everywhere — expose endpoints intentionally.
- ❌ **Mixing up 401 and 403** — 401 = not authenticated; 403 = authenticated but not authorized.

## Enterprise Architecture

```flow
Client
SecurityFilterChain
JWT filter
AuthenticationManager → AuthenticationProvider → UserDetailsService → database
SecurityContextHolder
Controller
Service
Repository
Database
JSON response
```

## Interview Questions

### Q1. What is Spring Security?

A security framework that provides authentication, authorization, password encoding, session management, CSRF protection, OAuth2 support and more.

### Q2. Authentication vs authorization?

| Authentication | Authorization |
| --- | --- |
| Who are you? | What can you access? |

### Q3. Which filter handles username/password login?

`UsernamePasswordAuthenticationFilter` (for the standard form-login flow).

### Q4. Which interface loads users?

`UserDetailsService`.

### Q5. Which interface performs authentication?

`AuthenticationManager`, which delegates to one or more `AuthenticationProvider` implementations.

### Q6. Which class stores the authenticated user?

`SecurityContextHolder`.

### Q7. Why use BCrypt?

It's a strong password-hashing algorithm that automatically incorporates a salt and is intentionally computationally expensive, making cracking more difficult.

### Q8. Why use OncePerRequestFilter?

To ensure custom logic (such as JWT validation) executes once per HTTP request.

### Q9. Difference between 401 and 403?

401 — authentication required or failed. 403 — authenticated but not authorized.

### Q10. How does JWT authentication work?

```flow-h
Login and authenticate
Generate JWT
Client stores JWT
Next request: Authorization: Bearer token
JWT filter validates
SecurityContextHolder
Controller
```

## Key Takeaways

- ✅ Spring Security protects applications through authentication and authorization.
- ✅ Every request passes through the security filter chain before reaching controllers.
- ✅ `AuthenticationManager` coordinates authentication; `AuthenticationProvider` does the verification.
- ✅ `UserDetailsService` loads users; `BCryptPasswordEncoder` hashes passwords.
- ✅ `SecurityContextHolder` holds the authenticated user for the current request.
- ✅ Stateless JWT authentication is typically a custom `OncePerRequestFilter`.
