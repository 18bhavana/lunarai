---
title: "@GetMapping, @PostMapping, @PutMapping, @DeleteMapping and @PatchMapping"
subtitle: HTTP methods like a backend architect — safe methods, idempotency, PUT vs PATCH, CRUD mapping, status codes (200, 201, 204, 400, 404, 409) and REST naming.
order: 8
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

One of the most misunderstood topics in REST API development. Many developers know `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping` and `@PatchMapping`. But interviewers ask:

- Why is GET different from POST?
- What is idempotency?
- Why shouldn't GET modify data?
- What is the difference between PUT and PATCH?
- When should you return 200 vs 201 vs 204?

After this chapter you'll understand HTTP methods like a backend architect.

## What are HTTP Methods?

Every request carries an **HTTP method**:

```text
GET /users/10 HTTP/1.1
```

The first word, `GET`, tells the server *what operation you want it to perform*.

### REST API Example

| HTTP method | URL | Meaning |
| --- | --- | --- |
| GET | `/users` | Fetch users |
| GET | `/users/10` | Fetch one user |
| POST | `/users` | Create a user |
| PUT | `/users/10` | Replace a user |
| PATCH | `/users/10` | Partially update a user |
| DELETE | `/users/10` | Delete a user |

### Spring Mapping Annotations

| Annotation | HTTP method |
| --- | --- |
| `@GetMapping` | GET |
| `@PostMapping` | POST |
| `@PutMapping` | PUT |
| `@DeleteMapping` | DELETE |
| `@PatchMapping` | PATCH |

`@GetMapping("/users")` is equivalent to `@RequestMapping(value = "/users", method = RequestMethod.GET)`.

## 1. @GetMapping — Retrieve Data

**Purpose:** retrieve data. **Never** modify data.

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return service.getUser(id);
    }
}
```

`GET /users/10` returns:

```json
{
  "id": 10,
  "name": "Rahul"
}
```

```flow-h
GET /users/10
Controller
Service
Repository
Database
JSON response
```

### GET is a Safe Method

**Safe** means *no modification on the server*. Allowed: read, search, filter. Not allowed: insert, update, delete.

❌ Wrong:

```java
@GetMapping("/delete/{id}")
public void delete(@PathVariable Long id) {
    repository.deleteById(id);
}
```

Never delete data using GET — crawlers, link prefetching and caches may call GET URLs freely. Use DELETE.

## 2. @PostMapping — Create Resources

```java
@PostMapping
public User save(@RequestBody User user) {
    return service.save(user);
}
```

`POST /users` with body:

```json
{
  "name": "Rahul"
}
```

```flow-h
JSON
: Jackson
User object
Controller → Service → Repository
Database (ID generated)
JSON response
```

POST **creates** data:

| Before | After `POST /users` |
| --- | --- |
| 1 John | 1 John, **2 Rahul** |

## 3. @PutMapping — Replace a Resource

**Purpose:** replace an existing resource **completely**.

Database: `Rahul, 25`. PUT request:

```json
{
  "name": "Rohit",
  "age": 30
}
```

Database becomes `Rohit, 30` — the **entire resource is replaced**.

```java
@PutMapping("/{id}")
public User update(@PathVariable Long id, @RequestBody User user) {
    return service.update(id, user);
}
```

## 4. @PatchMapping — Partial Update

**Purpose:** update **only the required fields**.

Database: `Rahul, 25`. PATCH request:

```json
{
  "age": 26
}
```

Database becomes `Rahul, 26` — the name is unchanged.

```java
@PatchMapping("/{id}")
public User updateAge(@PathVariable Long id, @RequestBody User user) {
}
```

> [!TIP]
> With a plain `User` body, missing JSON fields arrive as `null`, so a PATCH handler must copy only the fields that were actually sent (a dedicated `UserPatchDto` or a `Map` makes this explicit).

## 5. @DeleteMapping — Delete a Resource

```java
@DeleteMapping("/{id}")
public void delete(@PathVariable Long id) {
    service.delete(id);
}
```

`DELETE /users/10` removes row 10.

## CRUD Mapping

| CRUD | HTTP | Spring |
| --- | --- | --- |
| Create | POST | `@PostMapping` |
| Read | GET | `@GetMapping` |
| Update | PUT / PATCH | `@PutMapping` / `@PatchMapping` |
| Delete | DELETE | `@DeleteMapping` |

Remember this table.

## Safe vs Unsafe Methods

**Safe** means no modification.

| Method | Safe |
| --- | --- |
| GET | ✓ |
| POST | ✗ |
| PUT | ✗ |
| DELETE | ✗ |
| PATCH | ✗ |

(HEAD and OPTIONS are also safe.)

## Idempotency

A favourite interview question.

> [!IMPORTANT]
> **Idempotent:** calling the same request multiple times produces the **same final state** on the server.

- **GET** — `GET /users/10` 100 times: no change in the database. ✓ Idempotent.
- **PUT** — `PUT {"name": "John"}` once → John; 100 times → still John. ✓ Idempotent.
- **DELETE** — delete once → user removed; delete again → still deleted. ✓ Idempotent. (The second call may return `404` — the *response* can differ, but the *state* doesn't.)
- **POST** — `POST /users` twice creates **two different rows** (`1 Rahul`, `2 Rahul`). ✗ Not idempotent.
- **PATCH** — usually not idempotent. E.g. `{"salary": "+1000"}` called twice changes the salary twice. Some PATCH operations (setting a field to a fixed value) are idempotent, but the HTTP specification doesn't guarantee it.

| Method | Idempotent |
| --- | --- |
| GET | ✓ |
| PUT | ✓ |
| DELETE | ✓ |
| POST | ✗ |
| PATCH | Usually ✗ |

## HTTP Status Codes

| Situation | Status |
| --- | --- |
| GET success | `200 OK` |
| POST success | `201 Created` |
| DELETE success (no body) | `204 No Content` |
| Resource not found | `404 Not Found` |
| Invalid JSON, validation failure, missing fields | `400 Bad Request` |
| Duplicate email/username, optimistic-locking failure | `409 Conflict` |

For POST, prefer:

```java
return ResponseEntity
        .status(HttpStatus.CREATED)
        .body(savedUser);
```

## Complete REST Controller

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping
    public List<User> getAll() {
        return service.getAll();
    }

    @GetMapping("/{id}")
    public User get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public User save(@RequestBody User user) {
        return service.save(user);
    }

    @PutMapping("/{id}")
    public User update(@PathVariable Long id, @RequestBody User user) {
        return service.update(id, user);
    }

    @PatchMapping("/{id}")
    public User patch(@PathVariable Long id, @RequestBody UserPatchDto dto) {
        return service.patch(id, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

### Complete Request Lifecycle (POST /users)

```flow
Client — HTTP POST
DispatcherServlet
HandlerMapping
@PostMapping method
Jackson → Java object
Service
Repository
Database
Saved entity
Jackson → JSON
HTTP response
```

## REST API Naming Best Practices

| ✅ Good | ❌ Bad |
| --- | --- |
| `GET /users` | `/getUsers` |
| `GET /users/10` | |
| `POST /users` | `/createUser` |
| `PUT /users/10` | `/updateUser` |
| `DELETE /users/10` | `/deleteUser` |

REST URLs should represent **resources (nouns)**, not actions (verbs). The HTTP method already describes the action.

## Common Mistakes

- ❌ **Using GET to delete** (`@GetMapping("/delete/{id}")`) — always use `@DeleteMapping`.
- ❌ **Using POST for updates** — prefer PUT or PATCH.
- ❌ **Returning 200 after creation** — prefer `201 Created`.
- ❌ **Returning entities directly** — in enterprise projects map Entity → DTO → JSON to protect internal models and control the API contract.

## Enterprise Example

```flow
Angular / React
GET /employees
EmployeeController
EmployeeService
EmployeeRepository
Hibernate
MySQL
Employee list → JSON
Frontend
```

## Interview Questions

### Q1. What is the difference between GET and POST?

- GET retrieves data and should not modify server state.
- POST creates a new resource or performs an operation that changes server state.

### Q2. What is idempotency?

An operation is idempotent if making the same request multiple times results in the same final state on the server.

### Q3. Which HTTP methods are idempotent?

GET ✓, PUT ✓, DELETE ✓; POST ✗. PATCH depends on the operation but is not guaranteed to be idempotent.

### Q4. What is the difference between PUT and PATCH?

- PUT replaces the entire resource representation.
- PATCH updates only the specified fields.

### Q5. Why should REST URLs use nouns instead of verbs?

Because the HTTP method already expresses the action; the URL should identify the resource. `GET /users` is preferable to `/getUsers`.

### Q6. Which status code should a successful POST return?

Typically `201 Created`, often with the created resource in the body and ideally a `Location` header pointing to the new resource.

### Q7. What status code should DELETE return?

- `204 No Content` when no response body is returned.
- `200 OK` when returning additional information in the body.

## Key Takeaways

- ✅ `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping` and `@PatchMapping` are specialized forms of `@RequestMapping`.
- ✅ GET reads, POST creates, PUT replaces, PATCH partially updates, DELETE deletes.
- ✅ Know safe methods, idempotency and status codes — frequent interview topics.
- ✅ Design REST APIs around resources (nouns) and let HTTP methods express the action.
- ✅ Return appropriate status codes: `200`, `201`, `204`, `400`, `404`, `409`.
