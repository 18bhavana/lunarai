---
title: Pagination & Sorting
subtitle: Why never to load everything, Pageable and PageRequest, Page metadata, the SQL behind a page, Sort and multi-column sorting, pageable REST endpoints, Page vs Slice, deep-page performance and keyset pagination with Spring Data's scrolling API.
order: 4
---

## Introduction

> [!NOTE]
> **Interview importance:** high. Every enterprise application paginates — returning millions of rows is impractical — and Spring Data JPA has first-class support for it.

## Why Pagination?

With 5 million employees:

```java
List<Employee> employees = repository.findAll();   // ❌
```

loads every row into memory — high memory use, slow responses, heavy network traffic and a poor user experience. Return one **page** at a time instead:

| Page | Rows (size 10, 100 total) |
| --- | --- |
| 0 | 1–10 |
| 1 | 11–20 |
| … | … |
| 9 | 91–100 |

## Pageable and PageRequest

A `Pageable` describes **which page**, **how big**, and **how to sort**:

```java
Pageable first = PageRequest.of(0, 10);                       // page 0, 10 rows
Pageable fourth = PageRequest.of(3, 50);                      // 4th page, 50 rows
Pageable sorted = PageRequest.of(0, 10, Sort.by("salary").descending());
```

> [!IMPORTANT]
> Page numbers start at **0** — `PageRequest.of(0, 10)` is the first page.

`JpaRepository` already provides:

```java
Page<Employee> findAll(Pageable pageable);
```

## The Page Object

```java
Page<Employee> page = repository.findAll(PageRequest.of(0, 5));
```

| Method | Returns |
| --- | --- |
| `getContent()` | The rows on this page |
| `getTotalElements()` | Total matching rows |
| `getTotalPages()` | Number of pages |
| `getNumber()` | Current page number (0-based) |
| `getSize()` | Requested page size |
| `getNumberOfElements()` | Rows actually on this page |
| `hasNext()` / `hasPrevious()` | Is there another page? |
| `isFirst()` / `isLast()` | First / last page? |
| `map(fn)` | Convert the content — e.g. entities to DTOs — keeping the metadata |

## The SQL Behind a Page

```output Page 0, size 5 (MySQL)
select … from employee e1_0 limit ?, ?          -- offset 0, 5 rows
select count(e1_0.id) from employee e1_0        -- for total pages and elements
```

| Page request | SQL |
| --- | --- |
| `PageRequest.of(0, 5)` | `LIMIT 5 OFFSET 0` |
| `PageRequest.of(1, 5)` | `LIMIT 5 OFFSET 5` |
| `PageRequest.of(2, 5)` | `LIMIT 5 OFFSET 10` |

**Offset = page number × page size.**

A `Page` runs **two queries**: the content query, then a **count** query. Spring Data skips the count when it can work out the total itself — for example, the first page returned fewer rows than the page size.

## Pagination with Query Methods

```java
Page<Employee> findByDepartment(String department, Pageable pageable);

Page<Employee> page = repository.findByDepartment("IT", PageRequest.of(0, 10));
// WHERE department = ? LIMIT 10 OFFSET 0
```

Any derived or `@Query` method can take a `Pageable` as its last parameter.

## Sorting

```java
repository.findAll(Sort.by("salary"));                     // ORDER BY salary ASC
repository.findAll(Sort.by("salary").descending());        // ORDER BY salary DESC

Sort sort = Sort.by("department").and(Sort.by("salary").descending());
// ORDER BY department ASC, salary DESC

Sort typeSafe = Sort.sort(Employee.class).by(Employee::getSalary).descending();   // refactoring-safe
```

Sorting and paging together:

```java
Pageable pageable = PageRequest.of(0, 10, Sort.by("salary").descending());
// ORDER BY salary DESC LIMIT 10
```

## Paginated REST Endpoints

Accept a `Pageable` parameter and Spring MVC builds it from the query string:

```java
@GetMapping("/employees")
public Page<EmployeeDto> list(@PageableDefault(size = 20, sort = "id") Pageable pageable) {
    return repository.findAll(pageable).map(EmployeeDto::from);
}
```

```text
GET /employees?page=0&size=20
GET /employees?page=2&size=20&sort=salary,desc
GET /employees?sort=department&sort=salary,desc
```

> [!NOTE]
> The `sort` parameter is only understood when the controller takes a **`Pageable`** (or `Sort`) argument. Reading `@RequestParam int page, int size` yourself and calling `PageRequest.of(page, size)` ignores `sort` unless you parse it too. Spring caps the page size at 2,000 by default (`spring.data.web.pageable.max-page-size`) — lower it for your API.

> [!TIP]
> Avoid returning `Page<Entity>` straight from a controller: it exposes your entities and the JSON shape of `PageImpl` isn't a stable contract (Spring Data warns about it). Map to DTOs, and use `PagedModel` / `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` or your own response type with `content`, `page`, `size`, `totalElements`.

## Page vs Slice

| Feature | `Page` | `Slice` |
| --- | --- | --- |
| Total elements / total pages | ✅ | ❌ |
| Extra `COUNT(*)` query | Yes | No |
| Knows whether there's a next page | ✅ | ✅ (fetches one extra row) |
| Cost on large tables | Higher — the count can be expensive | Lower |
| Best for | Numbered pages ("Page 3 of 120") | Infinite scroll / "Load more" |

```java
Slice<Employee> findByDepartment(String department, Pageable pageable);
```

Social feeds (Instagram, LinkedIn) don't show "page 3 of 1,200" — they only need "is there more?", so `Slice` fits.

## Deep Pages Are Slow — Keyset Pagination

```sql
SELECT … FROM employee ORDER BY id LIMIT 20 OFFSET 100000;
```

The database must read and **skip 100,000 rows** to return 20. **Keyset (seek) pagination** continues from the last row seen instead:

```sql
SELECT … FROM employee WHERE id > :lastSeenId ORDER BY id LIMIT 20;
```

```java
List<Employee> findTop20ByIdGreaterThanOrderByIdAsc(Integer lastSeenId);
```

### Spring Data's Scrolling API

Spring Data 3.1+ supports keyset pagination directly with `Window` and `ScrollPosition`:

```java
Window<Employee> findTop20ByDepartmentOrderByIdAsc(String department, ScrollPosition position);

Window<Employee> window = repository.findTop20ByDepartmentOrderByIdAsc("IT", ScrollPosition.keyset());
while (!window.isEmpty()) {
    window.forEach(this::process);
    if (!window.hasNext()) break;
    window = repository.findTop20ByDepartmentOrderByIdAsc("IT", window.positionAt(window.size() - 1));
}
```

| Offset pagination | Keyset pagination |
| --- | --- |
| Jump to any page number | Only next/previous |
| Slows down with deep pages | Constant speed (uses the index) |
| Rows shift when data changes | Stable while data changes |

Great for feeds, exports, batch jobs and very large tables.

## Performance Tips

- **Keep page sizes reasonable** — 10, 20, 25, 50 or 100; never `PageRequest.of(0, 100000)`.
- **Always sort**, with a **unique tie-breaker** — `Sort.by("createdDate").descending().and(Sort.by("id"))`. Without a deterministic order, rows can repeat or vanish between pages.
- **Index** columns used for filtering and sorting.
- **Use `Slice`** when you don't need totals.
- **Provide a cheaper `countQuery`** for complex `@Query` methods returning `Page`.
- **Map to DTOs** so pages carry only the fields the client needs.

## Common Mistakes

- ❌ **`findAll()` on large tables.**
- ❌ **Sorting by a field name that doesn't exist** — `Sort.by("salaryAmount")` when the field is `salary` → `PropertyReferenceException`.
- ❌ **Non-deterministic sorting** — sorting only by a column with many duplicates.
- ❌ **Starting page numbers at 1.**
- ❌ **Deep `OFFSET` pagination** on huge tables.
- ❌ **Paginating a query that fetch-joins a collection** — Hibernate paginates in memory (see *Fetching Strategies & the N+1 Problem*).

## A Real Example

```java
Page<Order> orders = orderRepository.findByStatus(
        OrderStatus.SHIPPED,
        PageRequest.of(0, 25, Sort.by("createdDate").descending().and(Sort.by("id"))));
```

Latest shipped orders, 25 per page, with total pages and records, using efficient `LIMIT/OFFSET` SQL.

## Interview Questions

### What's the difference between Page and List?

A `Page` contains the current page's content plus metadata (total elements, total pages, page number, `hasNext`); a `List` contains only data.

### What's the difference between Page and Slice?

`Page` runs an extra count query to know the totals; `Slice` fetches one extra row to know whether there's a next page — cheaper when totals aren't needed.

### Why does Page execute two queries?

One for the page's rows (with `LIMIT/OFFSET`) and a `COUNT(*)` for the totals — though Spring skips the count when it can deduce the total.

### What is keyset pagination?

Fetching the next rows after the last seen key (`WHERE id > ? ORDER BY id LIMIT n`) instead of using an offset. It stays fast on deep pages and is supported by Spring Data's `ScrollPosition`/`Window` API.

### Why should pagination always include sorting?

Without an explicit, deterministic order the database may return rows in any order, causing duplicates or missing rows across pages.

## Key Takeaways

- ✅ Use `Pageable`/`PageRequest` (0-based) instead of loading everything.
- ✅ `Page` = content + totals (two queries); `Slice` = content + "has next".
- ✅ Always sort deterministically; index sort and filter columns.
- ✅ Accept `Pageable` in controllers, return DTO pages, and cap the page size.
- ✅ Use keyset pagination (`ScrollPosition`) for deep or continuously growing data.
