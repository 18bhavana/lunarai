---
title: Password Encoding with PasswordEncoder
subtitle: Why passwords must be hashed, how PasswordEncoder's encode() and matches() work at registration and login, salting, how Spring Security authenticates a username and password, and choosing an encoder.
order: 1
---

## Introduction

`PasswordEncoder` is the Spring Security interface used to **hash passwords before storing them** in the database and to **verify passwords during login**. Hashing is one-way: unlike encryption, the original password can't be recovered from the stored value.

## Why Do We Need It?

**Bad practice — storing the plain password:**

```java
password = "admin123";
```

```output Database
admin123
```

If the database is ever leaked or breached, **every user's password is exposed** — and since people reuse passwords, their email and bank accounts are at risk too.

**Good practice — storing a hash:**

```java
passwordEncoder.encode("admin123");
```

```output Database
$2a$10$XJfL4P3fX8j...
```

The original password can't be recovered from the hash.

## Configure a PasswordEncoder Bean

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

`BCryptPasswordEncoder` is the most commonly used encoder in Spring Security.

> [!TIP]
> Spring Security also offers a **delegating** encoder that stores the algorithm id with every hash (`{bcrypt}$2a$10$...`), so you can migrate to a stronger algorithm later without breaking existing passwords. It uses BCrypt for new passwords by default.

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
}
```

## During Registration

The user enters `admin123`:

```java
String encodedPassword = passwordEncoder.encode("admin123");
user.setPassword(encodedPassword);
repository.save(user);
```

```output Stored in DB
$2a$10$8oQ0b1N8n7wq6v...
```

## During Login

The user enters `admin123`; the database contains `$2a$10$8oQ0b1N8n7wq6v...`. Spring Security calls:

```java
passwordEncoder.matches("admin123", storedHash);   // true
```

> [!WARNING]
> **Never compare hashes yourself** with `inputPassword.equals(storedHash)` — or by encoding the input again and comparing. BCrypt generates a different hash every time, so the comparison would always fail. Always use `matches()`.

## Why Is the Hash Different Every Time?

```java
System.out.println(passwordEncoder.encode("admin123"));
System.out.println(passwordEncoder.encode("admin123"));
```

```output Output (shortened)
$2a$10$abc...
$2a$10$xyz...
```

Both are different because of a **random salt**. Yet both of these return `true`:

```java
passwordEncoder.matches("admin123", hash1);   // true
passwordEncoder.matches("admin123", hash2);   // true
```

## How Login Works Internally

```flow
Username + password
AuthenticationManager
DaoAuthenticationProvider
UserDetailsService — load the user from the DB
PasswordEncoder.matches()
? Matches? | Yes: authentication succeeds | No: BadCredentialsException
```

If `matches()` returns `true`, authentication succeeds; otherwise a `BadCredentialsException` is thrown and the user gets a "bad credentials" response.

## Password Encoding with Salt

A **salt** is a random value added to a password before hashing.

### Without Salt

```text
Password: admin123
SHA-256(admin123) = 240be518...
```

Every user with the password `admin123` gets **the same hash**:

| User | Stored hash |
| --- | --- |
| User1 | 240be518... |
| User2 | 240be518... |
| User3 | 240be518... |

This makes **rainbow-table attacks** possible (huge precomputed tables of password → hash), and an attacker can see at a glance which users share a password.

### With Salt

```text
User 1:  salt = X7K9P2   Hash(admin123 + X7K9P2) = A1B2C3D4...
User 2:  salt = M5N8Q1   Hash(admin123 + M5N8Q1) = Z9Y8X7W6...
```

Same password, **different hashes** — precomputed tables become useless.

### How BCrypt Uses Salt

When you call `encoder.encode("admin123")`, BCrypt automatically:

1. generates a random salt;
2. combines the password and salt;
3. applies the BCrypt hashing function many times (the **work factor**);
4. stores the salt **inside** the final hash string.

```text
$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

| Part | Meaning |
| --- | --- |
| `$2a$` | BCrypt version |
| `10` | Cost factor |
| `N9qo8uLOickgx2ZMRZoMye` | Salt (22 characters) |
| Remaining 31 characters | Hashed password |

The salt is embedded in the hash itself — no separate database column is needed.

### The Verification Process

```flow-h
Stored hash
Extract salt
Hash the entered password with that salt
Compare hashes
```

1. Extract the salt (and cost) from the stored hash.
2. Hash the entered password using the same salt and cost.
3. Compare the generated hash with the stored hash.
4. Return `true` or `false`.

## Common Password Encoders

| Encoder | Notes |
| --- | --- |
| **BCrypt** — `new BCryptPasswordEncoder()` | Recommended default; adaptive cost factor |
| **PBKDF2** — `Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8()` | Approved by NIST; used where FIPS compliance is required |
| **SCrypt** — `SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8()` | Memory-hard; resists GPU attacks |
| **Argon2** — `Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8()` | Winner of the Password Hashing Competition; considered one of the strongest modern algorithms |

> [!NOTE]
> The no-argument constructors of `Pbkdf2PasswordEncoder`, `SCryptPasswordEncoder` and `Argon2PasswordEncoder` are deprecated in recent Spring Security versions — use the `defaultsForSpringSecurity_v5_8()` factory methods. SCrypt and Argon2 also need the Bouncy Castle library on the classpath.

Never use `NoOpPasswordEncoder` (plain text), or fast general-purpose hashes like MD5, SHA-1 or a single SHA-256 for passwords.

## Example

```java
@Autowired
private PasswordEncoder passwordEncoder;

String hash = passwordEncoder.encode("admin123");
boolean valid = passwordEncoder.matches("admin123", hash);
System.out.println(valid);   // true
```

This is exactly what Spring Security does behind the scenes when the `AuthenticationManager` authenticates a username and password.

## Interview Questions

### What is PasswordEncoder?

An interface in Spring Security used to hash passwords and verify them during authentication.

### Why use BCryptPasswordEncoder?

- One-way hashing.
- Automatic salting.
- Resistant to rainbow-table attacks.
- An adjustable cost factor that slows brute-force attempts.
- A widely accepted industry standard.

### What is the difference between encode() and matches()?

`encode(password)` creates a hash. `matches(rawPassword, encodedPassword)` verifies whether the raw password corresponds to the stored hash.

### Why not store passwords in plain text?

If the database is leaked, attackers immediately see every user's password — and many users reuse passwords on other sites.

### Why can't we compare BCrypt hashes using equals()?

Because BCrypt generates a new random salt every time, the same password produces different hashes. Use `matches()`, which re-hashes the input with the stored salt.

### What is a salt?

A randomly generated value added to a password before hashing, so that identical passwords produce different hashes.

### Why is salt important?

It prevents rainbow-table attacks, hides which users share the same password, and makes precomputed hash attacks ineffective.

### Do we store the salt separately with BCrypt?

No. BCrypt embeds the salt in the generated hash string, and it's extracted automatically during verification.

### Does Spring Security generate the salt automatically?

Yes. `BCryptPasswordEncoder` generates a random salt for every password and uses it during hashing and verification.

## Common Mistakes

- ❌ **Storing plain-text passwords** or using `NoOpPasswordEncoder` outside tests.
- ❌ **Comparing hashes with `equals()`** instead of `matches()`.
- ❌ **Hashing passwords with MD5, SHA-1 or plain SHA-256** — they're far too fast.
- ❌ **Logging passwords** (even at DEBUG) or returning the hash in API responses.
- ❌ **Using different encoders** for registration and login.

## Best Practices

- ✅ Expose one `PasswordEncoder` bean and use it everywhere.
- ✅ Prefer BCrypt (or Argon2), or the delegating encoder for future migration.
- ✅ Hash on the server side, always over HTTPS.
- ✅ Never log, return or email passwords.

## Key Takeaways

- ✅ `PasswordEncoder` hashes passwords on registration and verifies them on login.
- ✅ Hashing is one-way — the original password can't be recovered.
- ✅ A random salt makes identical passwords produce different hashes; BCrypt stores it inside the hash.
- ✅ Always verify with `matches()`, never `equals()`.
- ✅ Login flows through `AuthenticationManager` → `DaoAuthenticationProvider` → `UserDetailsService` → `PasswordEncoder.matches()`.
