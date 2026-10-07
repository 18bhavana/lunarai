---
title: Date and Time API (java.time)
subtitle: LocalDate, LocalTime, LocalDateTime, ZonedDateTime, Instant, Period, Duration and DateTimeFormatter — the immutable, thread-safe replacement for Date and Calendar.
order: 21
---

## Introduction

Java 8 introduced the **`java.time`** package to replace the old `Date` and `Calendar` APIs. The new API is **immutable**, **thread-safe**, and much easier to use.

## Important Classes

| Class | Purpose |
| --- | --- |
| `LocalDate` | Date only |
| `LocalTime` | Time only |
| `LocalDateTime` | Date + time |
| `ZonedDateTime` | Date + time + time zone |
| `Instant` | UTC timestamp |
| `Period` | Difference in years, months, days |
| `Duration` | Difference in hours, minutes, seconds |
| `DateTimeFormatter` | Formatting and parsing dates |

```tree
java.time
  Human date/time
    LocalDate | date only
    LocalTime | time only
    LocalDateTime | date + time
    ZonedDateTime | + time zone
  Machine time
    Instant | UTC timestamp
  Amounts
    Period | years, months, days
    Duration | hours, minutes, seconds
```

## LocalDate

Represents **only a date** (year-month-day).

```java
import java.time.LocalDate;

LocalDate today = LocalDate.now();
System.out.println(today);
```

```output
2026-06-15
```

### Common Methods

```java
today.getYear();         // 2026
today.getMonth();        // JUNE (a Month enum)
today.getDayOfMonth();   // 15
today.getDayOfWeek();    // MONDAY (a DayOfWeek enum)
```

## LocalTime

Represents **only time**.

```java
import java.time.LocalTime;

LocalTime now = LocalTime.now();
System.out.println(now);
```

```output
10:30:45.123
```

### Common Methods

```java
now.getHour();
now.getMinute();
now.getSecond();
```

## LocalDateTime

Represents **both date and time without a time zone**.

```java
import java.time.LocalDateTime;

LocalDateTime current = LocalDateTime.now();
System.out.println(current);
```

```output
2026-06-15T10:30:45
```

## Create a Custom Date

```java
LocalDate date = LocalDate.of(2026, 6, 15);
System.out.println(date);
```

```output
2026-06-15
```

## Add and Subtract Dates

```java
LocalDate today = LocalDate.now();

today.plusDays(5);
today.plusMonths(2);
today.plusYears(1);
today.minusDays(10);
```

Since `LocalDate` is **immutable**, these methods return a **new** object.

> [!WARNING]
> Calling `today.plusDays(5);` on its own does nothing useful — `today` is unchanged. Keep the result: `LocalDate nextWeek = today.plusDays(7);`

## Compare Dates

```java
LocalDate d1 = LocalDate.of(2026, 1, 1);
LocalDate d2 = LocalDate.of(2026, 12, 31);

System.out.println(d1.isBefore(d2));
System.out.println(d1.isAfter(d2));
System.out.println(d1.equals(d2));
```

```output
true
false
false
```

## Date Formatting

```java
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

LocalDate date = LocalDate.now();

DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy");

String formatted = date.format(formatter);
System.out.println(formatted);
```

```output
15-06-2026
```

### Common Formatting Patterns

| Pattern | Example |
| --- | --- |
| `dd/MM/yyyy` | `15/06/2026` |
| `dd-MM-yyyy` | `15-06-2026` |
| `yyyy-MM-dd` | `2026-06-15` |
| `dd MMM yyyy` | `15 Jun 2026` |
| `dd MMMM yyyy` | `15 June 2026` |
| `HH:mm:ss` | `14:30:45` (24-hour) |
| `hh:mm a` | `02:30 PM` (12-hour) |

> [!TIP]
> Case matters: `MM` is month but `mm` is minutes; `HH` is 24-hour and `hh` is 12-hour.

## Parse a String into a Date

```java
String dateStr = "15-06-2026";

DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy");

LocalDate date = LocalDate.parse(dateStr, formatter);

System.out.println(date);
```

```output
2026-06-15
```

## Period (Difference Between Dates)

Used to calculate the difference between two **dates**.

```java
import java.time.LocalDate;
import java.time.Period;

LocalDate start = LocalDate.of(2020, 1, 1);
LocalDate end = LocalDate.now();

Period period = Period.between(start, end);

System.out.println(period.getYears());
System.out.println(period.getMonths());
System.out.println(period.getDays());
```

## Duration (Difference Between Times)

Used to calculate the difference between two **times**.

```java
import java.time.Duration;
import java.time.LocalTime;

LocalTime start = LocalTime.of(10, 0);
LocalTime end = LocalTime.of(12, 30);

Duration duration = Duration.between(start, end);

System.out.println(duration.toHours());
System.out.println(duration.toMinutes());
```

```output
2
150
```

## Working with Time Zones

```java
import java.time.ZoneId;
import java.time.ZonedDateTime;

ZonedDateTime india = ZonedDateTime.now(ZoneId.of("Asia/Kolkata"));

System.out.println(india);
```

```output
2026-06-15T10:30:45.123+05:30[Asia/Kolkata]
```

### Other Common Time Zones

```java
ZoneId.of("America/New_York");
ZoneId.of("Europe/London");
ZoneId.of("Asia/Tokyo");
```

## Instant (UTC Timestamp)

`Instant` represents a **point on the UTC timeline**.

```java
import java.time.Instant;

Instant instant = Instant.now();
System.out.println(instant);
```

```output
2026-06-15T05:00:00Z
```

`Instant` is commonly used for storing timestamps in databases, distributed systems and logging.

## Interview Questions

### Q1. Why was java.time introduced?

- `Date` and `Calendar` were **mutable**.
- They were **not thread-safe** (e.g. `SimpleDateFormat`).
- Their API was difficult to understand (months start at 0 in `Calendar`, etc.).
- `java.time` is immutable, thread-safe, and provides a cleaner API.

### Q2. Difference between Period and Duration?

| Period | Duration |
| --- | --- |
| Date-based | Time-based |
| Years, months, days | Hours, minutes, seconds (and nanos) |
| `Period.between(LocalDate, LocalDate)` | `Duration.between(LocalTime / LocalDateTime / Instant, …)` |

### Q3. Difference between LocalDateTime and ZonedDateTime?

| LocalDateTime | ZonedDateTime |
| --- | --- |
| No time-zone information | Includes the time zone |
| Suitable for local applications | Suitable for global / distributed applications |

### Q4. Difference between Date and Instant?

| Date | Instant |
| --- | --- |
| Legacy Java API | Modern Java 8 API |
| Mutable | Immutable |
| Limited API | Rich API |
| Time-zone handling is cumbersome | UTC-based timestamp |

## Common Spring Boot Usage

Modern JPA/Hibernate directly supports Java 8 date and time types.

```java
import jakarta.persistence.Entity;

@Entity
public class Employee {
    private LocalDate joiningDate;
    private LocalDateTime createdAt;
}
```

These types are preferred over `java.util.Date` because they are immutable, thread-safe, and integrate seamlessly with modern Java and Spring Boot applications.

> [!NOTE]
> `jakarta.persistence` is used from Spring Boot 3 onward; older Spring Boot 2 projects use `javax.persistence`.

## Chapter Summary

- ✅ `LocalDate`, `LocalTime`, `LocalDateTime` — no time zone
- ✅ `ZonedDateTime` and `ZoneId`
- ✅ `Instant` — a UTC timestamp
- ✅ Immutable `plus…()` / `minus…()` methods return new objects
- ✅ `DateTimeFormatter` for formatting and parsing
- ✅ `Period` (dates) vs `Duration` (times)
