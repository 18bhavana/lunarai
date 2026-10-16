---
title: BCrypt Password Hashing in Java
subtitle: Encoding and verifying passwords with BCryptPasswordEncoder, why the same password gives different hashes, the structure of a BCrypt hash, the cost factor, and why BCrypt beats SHA-256 for passwords.
order: 2
---

## Introduction

**BCrypt** is a password-hashing algorithm designed specifically for storing passwords. It automatically generates a **random salt** for every password and is resistant to brute-force attacks because it's **intentionally slow** — and you can make it slower as hardware gets faster.

## Maven Dependency (Spring Boot)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

(Outside Spring Boot, the `spring-security-crypto` module alone provides `BCryptPasswordEncoder`.)

## Encode a Password

```java
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class Main {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        String password = "admin123";
        String hashedPassword = encoder.encode(password);

        System.out.println("Original Password : " + password);
        System.out.println("BCrypt Hash       : " + hashedPassword);
    }
}
```

```output Example output (your hash will differ)
Original Password : admin123
BCrypt Hash       : $2a$10$7uXf1fO0e2Qx9QJ5kJzJ3uN4wGm7hX6v1xJ5wPzD4YvX0M2nY8c7e
```

## Verify a Password

```java
BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

String rawPassword = "admin123";
String storedHash = encoder.encode(rawPassword);   // normally loaded from the database

boolean matches = encoder.matches(rawPassword, storedHash);
System.out.println(matches);
```

```output
true
```

`matches()` hashes the entered password using the salt embedded in the stored hash, then compares the results.

> [!NOTE]
> The hash strings in these notes are illustrative. To test `matches()` against a fixed string, paste a hash that your own encoder actually produced — an invented hash won't verify.

## Why Does the Same Password Produce Different Hashes?

```java
BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
System.out.println(encoder.encode("admin123"));
System.out.println(encoder.encode("admin123"));
```

```output Example output (shortened)
$2a$10$abc..............
$2a$10$xyz..............
```

The password is identical, but each hash is different because BCrypt creates a **new random salt** on every call. Verification still succeeds for both:

```java
encoder.matches("admin123", hash1);   // true
encoder.matches("admin123", hash2);   // true
```

## Structure of a BCrypt Hash

```text
$2a$10$7uXf1fO0e2Qx9QJ5kJzJ3uN4wGm7hX6v1xJ5wPzD4YvX0M2nY8c7e
```

| Part | Meaning |
| --- | --- |
| `$2a$` | BCrypt algorithm version (`$2a$`, `$2b$` or `$2y$`) |
| `10` | Cost factor (work factor) |
| Next 22 characters | Random salt |
| Remaining 31 characters | Password hash |

A BCrypt hash is always **60 characters** long — size your database column accordingly (`VARCHAR(60)` or larger, e.g. `VARCHAR(100)` if you use the delegating encoder's `{bcrypt}` prefix).

## Spring Security Configuration

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

```java
@Autowired
private PasswordEncoder passwordEncoder;

String hash = passwordEncoder.encode("password");
boolean valid = passwordEncoder.matches("password", hash);
```

## The Cost Factor

```java
new BCryptPasswordEncoder();      // default cost = 10
new BCryptPasswordEncoder(12);    // custom cost
```

The cost is a **logarithm**: BCrypt performs **2^cost** rounds of its key-setup function. Each +1 **doubles** the work — cost 12 is 4× slower than cost 10.

A higher cost means:

- more security;
- slower hashing;
- much harder brute-force attacks.

> [!TIP]
> Pick the highest cost that keeps a single hash at roughly **0.25–1 second** on your production hardware. Login is rare per user, so the delay is fine for users but crippling for an attacker testing billions of guesses.

> [!WARNING]
> BCrypt only uses the first **72 bytes** of a password — anything longer is silently ignored. That's rarely an issue for normal passwords, but enforce a sensible maximum length (and remember multi-byte characters count as several bytes).

## Why BCrypt Instead of SHA-256?

| SHA-256 | BCrypt |
| --- | --- |
| Very fast (billions per second on a GPU) | Intentionally slow |
| No built-in salt | Generates a salt automatically |
| Vulnerable to brute-force attacks | Resistant to brute-force attacks |
| Same input → same hash | Same input → different hash (random salt) |
| General-purpose hashing (checksums, signatures) | Designed specifically for password hashing |

## The Authentication Flow

```flow
Registration — user enters a password
Application hashes it with BCrypt
BCrypt hash stored in the database
Login — user enters the password again
matches() extracts the salt from the stored hash
Entered password hashed with that salt
? Hashes equal? | Yes: authentication succeeds | No: login rejected
```

## Interview Questions

### 1. Why should we use BCrypt instead of SHA-256?

SHA-256 is a fast hash, so attackers can try billions of guesses per second. BCrypt is intentionally slow, automatically adds a random salt, and has a tunable cost factor, making it far more secure for passwords.

### 2. Do we need to store the salt separately?

No. BCrypt embeds the salt directly in the generated hash, so no separate database column is needed.

### 3. What is the cost factor?

The logarithm of the number of hashing rounds — BCrypt performs 2^cost rounds. Higher cost means better security but more CPU time per hash; each +1 doubles the work.

### 4. Can BCrypt hashes be decrypted?

No. BCrypt is a one-way hashing algorithm, not encryption. The original password can't be recovered; attackers can only guess and check.

### 5. Why does the same password generate different hashes?

Because BCrypt generates a new random salt every time `encode()` is called.

### 6. How does matches() work?

It extracts the version, cost and salt from the stored hash, hashes the user-entered password with that same salt and cost, and compares the result with the stored hash.

### 7. What happens to passwords longer than 72 bytes?

BCrypt ignores everything after the first 72 bytes, so two long passwords with the same first 72 bytes would match.

## Common Mistakes

- ❌ **Comparing hashes with `equals()`.**
- ❌ **A database column that's too short** — BCrypt hashes are 60 characters.
- ❌ **A cost factor that's too low** (e.g. 4) — or so high that logins time out.
- ❌ **Re-hashing the stored hash** instead of the raw password.

## Key Takeaways

- ✅ BCrypt is a slow, salted, one-way hash built for passwords.
- ✅ The salt and cost are stored inside the 60-character hash.
- ✅ The cost factor is logarithmic — each +1 doubles the work.
- ✅ Same password → different hashes, but `matches()` still verifies them.
- ✅ Prefer BCrypt (or Argon2) over fast hashes like SHA-256 for passwords.
