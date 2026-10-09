---
title: MySQL String Functions and Text Analytics
subtitle: CONCAT vs CONCAT_WS, LENGTH vs CHAR_LENGTH, case and trimming, SUBSTRING/LEFT/RIGHT, REPLACE, LOCATE vs INSTR, SUBSTRING_INDEX, LIKE wildcards, NULL behaviour, collations and search performance.
order: 18
---

## Introduction

String functions are used for text processing, searching, formatting, data cleansing, validation, reporting, generating identifiers and extracting information from text — in almost every application that handles names, emails, addresses, phone numbers, product descriptions, customer data, search features or imported data.

Business requirements you'll be able to handle: combine first and last names, remove unwanted spaces, extract the username from an email, search by partial name, replace text, normalize imported data, mask sensitive information — and understand how `LIKE` affects index performance.

## Why String Functions Matter

| Employee ID | First name | Last name | Email | Department |
| --- | --- | --- | --- | --- |
| 101 | John | Smith | john.smith@gmail.com | IT |
| 102 | David | Brown | david.brown@gmail.com | HR |
| 103 | Lisa | Taylor | lisa.taylor@gmail.com | Finance |
| 104 | Alex | Wilson | alex.wilson@gmail.com | IT |

Real-world data has problems such as `" John "`, `"JOHN.SMITH@GMAIL.COM"`, `" john.smith@gmail.com "`, codes built as `"EMP" + id`, and names split across columns. String functions let us **clean, normalize, combine, extract, search and transform** text directly in SQL.

## CONCAT()

`CONCAT(string1, string2, ...)` joins strings:

```sql
SELECT CONCAT(first_name, ' ', last_name) AS full_name
FROM employees;          -- John Smith, David Brown, Lisa Taylor, Alex Wilson

SELECT CONCAT('EMP-', employee_id) AS employee_code
FROM employees;          -- EMP-101, EMP-102, EMP-103
```

### CONCAT() and NULL

With `first_name = John`, `middle_name = NULL`, `last_name = Smith`:

```sql
SELECT CONCAT(first_name, ' ', middle_name, ' ', last_name);   -- NULL
```

`CONCAT()` returns **`NULL` if any argument is `NULL`**. A safer approach:

```sql
SELECT CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name) AS full_name
FROM employees;
```

…but that can introduce extra spaces (`John  Smith`). This is where `CONCAT_WS()` is cleaner.

## CONCAT_WS()

**CONCAT With Separator** — `CONCAT_WS(separator, value1, value2, ...)`:

```sql
SELECT CONCAT_WS(' - ', first_name, department) AS employee_info
FROM employees;          -- John - IT, David - HR, Lisa - Finance

SELECT CONCAT_WS(' ', first_name, middle_name, last_name) AS full_name
FROM employees;          -- John Smith (the NULL middle name is skipped)
```

> [!IMPORTANT]
> `CONCAT_WS()` **skips `NULL` values** after the separator argument — extremely useful for optional name or address components.

| CONCAT() | CONCAT_WS() |
| --- | --- |
| Joins strings directly | Joins strings using a separator |
| Separator added manually | Separator specified once |
| A `NULL` argument makes the result `NULL` | Skips `NULL` values |
| Useful for custom formatting | Excellent for names and addresses |

## LENGTH() vs CHAR_LENGTH()

```sql
SELECT first_name, LENGTH(first_name)      AS byte_length      FROM employees;
SELECT first_name, CHAR_LENGTH(first_name) AS character_length FROM employees;
```

For simple ASCII text like `John`, both return **4**. But in Unicode text one character may need several bytes:

| Function | Counts |
| --- | --- |
| `LENGTH()` | **Bytes** |
| `CHAR_LENGTH()` | **Characters** |

For user-visible character counts, prefer `CHAR_LENGTH()` — especially in multilingual applications.

## UPPER() and LOWER()

```sql
SELECT UPPER(first_name) AS employee_name FROM employees;   -- JOHN, DAVID, LISA, ALEX
SELECT LOWER(email) AS normalized_email FROM employees;     -- JOHN.SMITH@GMAIL.COM → john.smith@gmail.com
```

### Normalize Email

```sql
SELECT LOWER(TRIM(email)) AS normalized_email
FROM employees;
```

Remove outer spaces, then lowercase — common in login systems, user registration, customer imports and data cleansing.

## TRIM(), LTRIM() and RTRIM()

```sql
SELECT TRIM(email)  FROM employees;   -- "  john@gmail.com  " → "john@gmail.com"
SELECT LTRIM(email) FROM employees;   -- left side only
SELECT RTRIM(email) FROM employees;   -- right side only
```

`TRIM()` does **not** remove spaces from the middle of a string — `"John Smith"` stays as it is. (`TRIM(BOTH 'x' FROM str)` can trim other characters.)

## SUBSTRING(), LEFT() and RIGHT()

`SUBSTRING(string, start_position, length)` extracts part of a string. **Positions start at 1.**

```sql
SELECT SUBSTRING(first_name, 1, 3)
FROM employees;                                -- Joh, Dav, Lis, Ale

SELECT SUBSTRING('john.smith@gmail.com', 12);  -- everything from position 12: gmail.com
```

```sql
SELECT LEFT(first_name, 2)  FROM employees;    -- Jo, Da, Li, Al
SELECT RIGHT(first_name, 2) FROM employees;    -- hn, id, sa, ex
```

### Last Four Digits

```sql
SELECT RIGHT(account_number, 4) AS last_four_digits
FROM accounts;
```

Useful for masked `XXXXXX1234`-style displays.

## REPLACE()

`REPLACE(string, old_text, new_text)` replaces **all** occurrences:

```sql
SELECT REPLACE(email, '@gmail.com', '@company.com') AS company_email
FROM employees;          -- john.smith@gmail.com → john.smith@company.com

SELECT REPLACE(phone_number, '-', '') AS normalized_phone
FROM customers;          -- 987-654-3210 → 9876543210
```

## LOCATE() and INSTR()

```sql
SELECT LOCATE('@', email) AS at_position
FROM employees;          -- john.smith@gmail.com → 11 (0 if not found)

SELECT INSTR(email, '@')
FROM employees;          -- same result
```

> [!TIP]
> Notice the **argument order**: `LOCATE(substring, string)` but `INSTR(string, substring)`. A common interview detail.

## REVERSE()

```sql
SELECT REVERSE(first_name)
FROM employees;          -- John → nhoJ, David → divaD
```

A common interview use is checking **palindromes**:

```sql
SELECT *
FROM words
WHERE word = REVERSE(word);
```

## LIKE and Wildcards

| Wildcard | Meaning |
| --- | --- |
| `%` | Zero or more characters |
| `_` | Exactly one character |

```sql
SELECT * FROM employees WHERE first_name LIKE 'J%';     -- starts with J: John, James, Jennifer
SELECT * FROM employees WHERE first_name LIKE '%n';     -- ends with n
SELECT * FROM employees WHERE first_name LIKE '%it%';   -- contains "it"
SELECT * FROM employees WHERE first_name LIKE '_o%';    -- any one char, then "o", then anything: John
```

| Pattern | Meaning |
| --- | --- |
| `'John%'` | Starts with John |
| `'%John'` | Ends with John |
| `'%John%'` | Contains John |
| `'_ohn'` | Exactly one character before "ohn" |

## Combining String Functions

```sql
SELECT UPPER(CONCAT(first_name, ' ', last_name)) AS employee_name
FROM employees;          -- John + space + Smith → John Smith → JOHN SMITH

SELECT CONCAT('EMP-', employee_id, ' - ', UPPER(first_name)) AS employee_label
FROM employees;          -- EMP-101 - JOHN
```

## Extracting the Email Username and Domain

For `john.smith@gmail.com`, the username is `john.smith` and the domain is `gmail.com`.

```sql
-- Username: everything before @
SELECT LEFT(email, LOCATE('@', email) - 1) AS username
FROM employees;

-- Domain: everything after @
SELECT SUBSTRING(email, LOCATE('@', email) + 1) AS domain
FROM employees;
```

```flow-h Username
LOCATE('@', email)
Subtract 1
Take everything before @
```

### SUBSTRING_INDEX()

`SUBSTRING_INDEX(string, delimiter, count)` — a positive count returns everything **before** the Nth delimiter; a negative count returns everything **after** the Nth delimiter from the right:

```sql
SELECT SUBSTRING_INDEX(email, '@', 1)  AS username FROM employees;   -- john.smith
SELECT SUBSTRING_INDEX(email, '@', -1) AS domain   FROM employees;   -- gmail.com
```

Often cleaner than `LEFT()` + `LOCATE()` for delimiter-based extraction.

## NULL Behaviour in String Functions

| Function | With a `NULL` argument |
| --- | --- |
| `CONCAT()` | Can produce `NULL` |
| `CONCAT_WS()` | Skips `NULL` values after the separator |

```sql
SELECT CONCAT(first_name, COALESCE(middle_name, ''), last_name) FROM employees;
SELECT CONCAT_WS(' ', first_name, middle_name, last_name)       FROM employees;   -- preferred
```

## Case Sensitivity and Collations

Whether `WHERE first_name = 'john'` matches `John` depends on the column's **collation**. Many common MySQL collations are **case-insensitive** (`_ci`), so `John`, `john` and `JOHN` compare as equal — don't assume every database or collation behaves the same.

You may see explicit normalization:

```sql
SELECT *
FROM employees
WHERE LOWER(first_name) = LOWER('JOHN');
```

It makes the intent clear, but applying `LOWER()` to an indexed column can stop the optimizer from using a normal index. If case-insensitive searching is frequent, choose an appropriate collation and indexing strategy.

## String Search Performance

```flow
'Raj%' — known starting prefix
Index may help
---
'%Raj%' — unknown starting position
Often requires much more scanning
```

`WHERE customer_name LIKE 'Raj%'` can often use an index, because the search has a **known prefix**. `LIKE '%Raj%'` starts with a wildcard, so a normal B-tree index can't seek to a starting point. For large-scale text search, consider `FULLTEXT` indexes, dedicated search engines or purpose-built search indexes.

## Real-World Enterprise Examples

```sql
-- 1. Full name
SELECT CONCAT_WS(' ', first_name, middle_name, last_name) AS full_name FROM employees;

-- 2. Normalized emails
SELECT LOWER(TRIM(email)) AS normalized_email FROM employees;

-- 3. Customer search (flexible, but mind the leading wildcard)
SELECT * FROM customers WHERE customer_name LIKE '%Raj%';

-- 4. Employee code
SELECT CONCAT('EMP-', employee_id) AS employee_code FROM employees;

-- 5. Replace the email domain
SELECT REPLACE(email, '@gmail.com', '@company.com') AS company_email FROM employees;

-- 6. Extract the email domain
SELECT SUBSTRING_INDEX(email, '@', -1) AS email_domain FROM employees;

-- 7. Customers per email domain
SELECT SUBSTRING_INDEX(email, '@', -1) AS email_domain,
       COUNT(*) AS customer_count
FROM customers
GROUP BY SUBSTRING_INDEX(email, '@', -1)
ORDER BY customer_count DESC;

-- 8. Initials: John Smith → JS
SELECT CONCAT(LEFT(first_name, 1), LEFT(last_name, 1)) AS initials FROM employees;

-- 9. Normalize phone numbers
SELECT REPLACE(REPLACE(TRIM(phone_number), '-', ''), ' ', '') AS normalized_phone
FROM customers;

-- 10. Prefix search — more index-friendly than '%Raj%'
SELECT * FROM customers WHERE customer_name LIKE 'Raj%';
```

## Interview Questions

### Q1. Display employee full names.

```sql
SELECT CONCAT_WS(' ', first_name, last_name) AS full_name
FROM employees;
```

### Q2. Find employees whose names start with A.

```sql
SELECT * FROM employees WHERE first_name LIKE 'A%';
```

### Q3. Convert all emails to lowercase.

```sql
SELECT LOWER(email) AS email FROM employees;
```

### Q4. Remove extra outer spaces.

```sql
SELECT TRIM(email) AS email FROM employees;
```

### Q5. Extract the username from an email.

```sql
SELECT SUBSTRING_INDEX(email, '@', 1) AS username FROM employees;
```

### Q6. Extract the domain from an email.

```sql
SELECT SUBSTRING_INDEX(email, '@', -1) AS domain FROM employees;
```

### Q7. What is the difference between LENGTH() and CHAR_LENGTH()?

`LENGTH()` counts bytes; `CHAR_LENGTH()` counts characters.

### Q8. What is the difference between LOCATE() and INSTR()?

They return the same position but take arguments in opposite order: `LOCATE(substring, string)` vs `INSTR(string, substring)`.

### Q9. Find names ending with "son".

```sql
SELECT * FROM employees WHERE last_name LIKE '%son';
```

### Q10. Find palindromes.

```sql
SELECT * FROM words WHERE word = REVERSE(word);
```

### Q11. Why can LIKE '%text%' be slow?

A leading wildcard prevents a normal B-tree index from seeking to a known starting prefix, so many rows must be scanned.

### Q12. What happens when CONCAT() receives NULL?

The whole result becomes `NULL`. Use `COALESCE()` around nullable parts, or `CONCAT_WS()`.

## Common Mistakes

- ❌ **Forgetting `TRIM()`** — imported `"john@gmail.com "` may not match `'john@gmail.com'` (MySQL 8's default `utf8mb4_0900` collations treat trailing spaces as significant). Normalize with `LOWER(TRIM(email))`.
- ❌ **Using `LIKE` incorrectly** — `'%John'` means *ends with* John; *starts with* is `'John%'`.
- ❌ **Confusing `LENGTH()` and `CHAR_LENGTH()`** — bytes vs characters; they differ for multilingual text.
- ❌ **Ignoring `NULL` in `CONCAT()`** — use `CONCAT_WS(' ', first_name, middle_name, last_name)`.
- ❌ **Functions on indexed columns without considering performance** — `WHERE LOWER(email) = 'john@gmail.com'` can bypass a normal index. For frequent normalized searches, consider an appropriate collation, storing normalized values, generated columns or functional indexes (MySQL 8.0.13+).
- ❌ **Leading wildcards everywhere** — `'%Raj%'` may be expensive on large tables; use `'Raj%'` when prefix search meets the requirement.
- ❌ **Assuming `LIKE` is always case-insensitive** — it depends on the collation.

## Mini Project

```sql
-- 1. Full names
SELECT CONCAT_WS(' ', first_name, last_name) AS full_name FROM employees;
-- 2. Emails in lowercase
SELECT LOWER(email) AS email FROM employees;
-- 3. Remove extra spaces from emails
SELECT TRIM(email) AS email FROM employees;
-- 4. Normalize emails completely
SELECT LOWER(TRIM(email)) AS normalized_email FROM employees;
-- 5. Email usernames
SELECT SUBSTRING_INDEX(email, '@', 1) AS username FROM employees;
-- 6. Email domains
SELECT SUBSTRING_INDEX(email, '@', -1) AS domain FROM employees;
-- 7. Names starting with A
SELECT * FROM employees WHERE first_name LIKE 'A%';
-- 8. Employee codes
SELECT CONCAT('EMP-', employee_id) AS employee_code FROM employees;
-- 9. Replace Gmail domains with the company domain
SELECT REPLACE(email, '@gmail.com', '@company.com') AS company_email FROM employees;
```

## Practice Problems

**Easy**

1. Convert names to uppercase.
2. Convert names to lowercase.
3. Find the length of employee names.
4. Extract the first three characters.
5. Remove leading and trailing spaces.
6. Display the last four characters of an account number.
7. Reverse employee names.

**Medium**

1. Search customers by partial name.
2. Generate usernames from email addresses.
3. Replace company domains.
4. Display employee initials.
5. Find names ending with *son*.
6. Extract email domains.
7. Normalize email addresses.
8. Generate formatted employee labels.

**Interview level**

1. Build full names while handling `NULL` middle names.
2. Mask email addresses for privacy.
3. Validate basic email structure.
4. Generate employee IDs with prefixes.
5. Build a searchable customer report.
6. Explain `LENGTH()` vs `CHAR_LENGTH()`.
7. Explain `CONCAT()` vs `CONCAT_WS()`.
8. Explain why `LIKE '%text%'` may be slow.
9. Explain how collation affects case-sensitive searching.
10. Find duplicate emails after applying normalization.

## Best Practices

- ✅ Use `TRIM()` to clean outer spaces and normalize emails consistently.
- ✅ Use `CONCAT_WS()` when joining optional values with separators.
- ✅ Use `CHAR_LENGTH()` for user-visible character counts.
- ✅ Understand `NULL` behaviour in string functions.
- ✅ Use `SUBSTRING_INDEX()` for delimiter-based extraction.
- ✅ Be careful with leading wildcards in `LIKE`.
- ✅ Understand your collation and case sensitivity.
- ✅ Avoid unnecessary functions on indexed columns in search predicates; store frequently searched data in a consistent format.
- ✅ Use proper search technology for large-scale full-text requirements, and validate/normalize data at the right application boundary.

## Real Backend Example

`GET /api/customers/search?name=Raj`:

```sql
-- Flexible substring search
SELECT customer_id, customer_name, email
FROM customers
WHERE customer_name LIKE CONCAT('%', :name, '%');
```

On a large table, `%Raj%` can get expensive. If the business accepts **prefix** search:

```sql
SELECT customer_id, customer_name, email
FROM customers
WHERE customer_name LIKE CONCAT(:name, '%');
```

…which is more index-friendly. For normalized email lookup:

```sql
SELECT customer_id, customer_name, email
FROM customers
WHERE normalized_email = :email;
```

…where the application or database maintains a consistently normalized value (lowercase + trimmed). Common in login systems, customer search, CRM platforms, user management, banking and e-commerce.

## Cheat Sheet

| Goal | SQL |
| --- | --- |
| Combine | `CONCAT(first_name, ' ', last_name)` |
| Combine with separator (skips `NULL`) | `CONCAT_WS(' ', first_name, middle_name, last_name)` |
| Length in bytes / characters | `LENGTH(name)` / `CHAR_LENGTH(name)` |
| Case | `UPPER(name)` / `LOWER(email)` |
| Remove outer spaces | `TRIM(email)` (`LTRIM`, `RTRIM`) |
| Extract | `SUBSTRING(name, 1, 3)`, `LEFT(name, 3)`, `RIGHT(name, 4)` |
| Replace | `REPLACE(email, '@gmail.com', '@company.com')` |
| Find position | `LOCATE('@', email)` / `INSTR(email, '@')` |
| Email username / domain | `SUBSTRING_INDEX(email, '@', 1)` / `SUBSTRING_INDEX(email, '@', -1)` |
| Starts / ends / contains | `LIKE 'Raj%'` / `LIKE '%son'` / `LIKE '%Raj%'` |
| Exactly one character | `LIKE '_ohn'` |

> [!IMPORTANT]
> A **leading wildcard** has a potential performance cost; avoid unnecessary functions and leading wildcards on large indexed search columns.
