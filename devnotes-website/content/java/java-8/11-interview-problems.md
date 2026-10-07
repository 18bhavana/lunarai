---
title: Real Stream Interview Problems
subtitle: From APIs to problem solving — duplicates, frequencies, first non-repeating element, Nth highest, longest string, per-department analytics and anagrams.
order: 11
---

## Introduction

From here on we stop learning APIs and start **problem solving** — exactly how 5–8 year Java interviews are conducted. The interviewer doesn't ask *"What is `map()`?"* Instead they ask:

- *"Given this employee list, find the second highest salary."*
- *"Group employees by department and return the highest-paid employee."*
- *"Find duplicate characters in a string."*

The goal of this chapter is to solve these problems while understanding **why** a particular Stream solution is the right choice.

## The Problem-Solving Framework

Before writing any code, ask yourself:

1. Do I need to **filter**?
2. Do I need to **transform**?
3. Do I need to **group**?
4. Do I need to **sort**?
5. Do I need a **single value**?
6. Do I need a **collection**?

If you answer these mentally first, the Stream pipeline almost writes itself.

## Number Problems

### Problem 1 — Find Duplicate Numbers

```java
List<Integer> list = Arrays.asList(2, 3, 5, 2, 6, 3, 8, 5);
```

**Solution (interview favourite):**

```java
Set<Integer> seen = new HashSet<>();

list.stream()
    .filter(n -> !seen.add(n))
    .forEach(System.out::println);
```

```output
2
3
5
```

**Why does this work?** Remember what `Set.add()` returns:

```java
seen.add(2);   // true  (first time)
seen.add(2);   // false (already exists)
```

Therefore `!seen.add(n)` means *"keep only duplicates."*

**Follow-up — why not use `distinct()`?** Because `distinct()` returns unique elements. We need the opposite.

> [!WARNING]
> This lambda mutates external state, so it is **not safe with parallel streams** (use a concurrent set or the frequency approach below). Also, a value that appears three times is printed twice — add `.distinct()` after the filter if you want each duplicate once.

### Problem 2 — Remove Duplicate Numbers

```java
list.stream()
    .distinct()
    .forEach(System.out::println);
```

Simple.

### Problem 3 — Frequency of Numbers

```java
Map<Integer, Long> frequency = list.stream()
        .collect(Collectors.groupingBy(
                Function.identity(),
                Collectors.counting()
        ));
```

```output
{2=2, 3=2, 5=2, 6=1, 8=1}
```

**Why `Function.identity()`?** Instead of `n -> n`, you can write `Function.identity()`.

### Problem 4 — First Non-Repeating Number

Input `2, 3, 2, 5, 6, 5, 7` → expected `3`.

```java
Integer result = list.stream()
        .collect(Collectors.groupingBy(
                Function.identity(),
                LinkedHashMap::new,
                Collectors.counting()
        ))
        .entrySet()
        .stream()
        .filter(e -> e.getValue() == 1)
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse(null);
```

**Why `LinkedHashMap`?** Very important. A normal `HashMap` does **not** preserve insertion order. We need `2, 3, 5, 6, 7` to stay in encounter order so that `findFirst()` really returns the *first* non-repeating number.

### Problem 8 — Second Highest Number

```java
int second = list.stream()
        .distinct()
        .sorted(Comparator.reverseOrder())
        .skip(1)
        .findFirst()
        .orElseThrow();
```

```flow-h
distinct()
sorted(desc)
skip(1)
findFirst()
```

> [!NOTE]
> No-argument `orElseThrow()` is Java 10+. On Java 8 use `.get()` or `orElseThrow(NoSuchElementException::new)`.

### Problem 9 — Nth Highest Number

Suppose the 4th highest:

```java
int n = 4;

int result = list.stream()
        .distinct()
        .sorted(Comparator.reverseOrder())
        .skip(n - 1)
        .findFirst()
        .orElseThrow();
```

Very elegant.

## String Problems

### Problem 5 — Character Frequency

```java
Map<Character, Long> result = "programming"
        .chars()
        .mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(
                Function.identity(),
                Collectors.counting()
        ));
```

```output
{p=1, r=2, o=1, g=2, a=1, m=2, i=1, n=1}
```

(The order of a `HashMap` isn't guaranteed — use `LinkedHashMap::new` as the map factory if you need encounter order.)

**Why `chars()`?** A `String` is not a collection. `chars()` converts it into an `IntStream`, then `mapToObj(c -> (char) c)` creates a `Stream<Character>`.

### Problem 6 — Duplicate Characters

```java
"programming"
        .chars()
        .mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
        .entrySet()
        .stream()
        .filter(e -> e.getValue() > 1)
        .forEach(System.out::println);
```

```output
r=2
g=2
m=2
```

### Problem 7 — First Non-Repeating Character

**The most asked Stream interview question.** Input `programming` → expected `p`.

```java
Character ch = "programming"
        .chars()
        .mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(
                Function.identity(),
                LinkedHashMap::new,
                Collectors.counting()
        ))
        .entrySet()
        .stream()
        .filter(e -> e.getValue() == 1)
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse(null);
```

```flow
"programming"
: chars() → mapToObj
Stream<Character>
: groupingBy(identity, LinkedHashMap, counting)
{p=1, r=2, o=1, g=2, a=1, m=2, i=1, n=1}
: filter(count == 1) → findFirst()
p
```

### Problem 10 — Longest String

```java
List<String> names = Arrays.asList("John", "Alexander", "Bob");

String longest = names.stream()
        .max(Comparator.comparingInt(String::length))
        .orElse("");
```

Notice: **no sorting**. Much faster.

> [!TIP]
> **Interview optimization.** Many candidates write `sorted()` + `findFirst()` to get a maximum. If you need only the maximum, use `max()` — **O(n)** instead of sorting's **O(n log n)**. This impresses interviewers.

### Problem 15 — Group Anagrams

Input `eat, tea, tan, ate, nat, bat`:

```java
Map<String, List<String>> result = words.stream()
        .collect(Collectors.groupingBy(word -> {
            char[] chars = word.toCharArray();
            Arrays.sort(chars);
            return new String(chars);
        }));
```

```buckets Key = the word's sorted letters
aet: eat, tea, ate
ant: tan, nat
abt: bat
```

## Employee Problems

### Problem 11 — Highest Salary Employee

```java
Employee highest = employees.stream()
        .max(Comparator.comparing(Employee::getSalary))
        .orElseThrow();
```

### Problem 12 — Highest Salary in Each Department

```java
Map<String, Optional<Employee>> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.maxBy(Comparator.comparing(Employee::getSalary))
        ));
```

Classic interview problem.

### Problem 13 — Count Employees Per Department

```java
Map<String, Long> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.counting()
        ));
```

### Problem 14 — Average Salary Per Department

```java
Map<String, Double> result = employees.stream()
        .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.averagingDouble(Employee::getSalary)
        ));
```

## Quick-Fire Interview Round

### Q1. Difference between max() and sorted().findFirst()?

`max()` is **O(n)**; `sorted()` is **O(n log n)**. Prefer `max()`.

### Q2. Why use LinkedHashMap for the first non-repeating character?

Because it preserves insertion order.

### Q3. Why Function.identity()?

It's equivalent to `x -> x`.

### Q4. How do you find duplicates?

`filter(n -> !set.add(n))`, or group with `counting()` and keep entries with count > 1.

### Q5. How do you find the second highest salary?

`distinct()` → `sorted(desc)` → `skip(1)` → `findFirst()`.

## Homework — Top 20 Interview Problems

Using Streams, solve:

1. First repeating character.
2. Last repeating character.
3. Last non-repeating character.
4. Most frequent character.
5. Least frequent character.
6. Reverse each word in a sentence.
7. Sort words by length.
8. Top 3 longest words.
9. Count vowels.
10. Count consonants.
11. Employees older than 30 grouped by department.
12. Department with the highest average salary.
13. Youngest employee in each department.
14. Employee names in uppercase grouped by department.
15. Remove duplicate words from a sentence.
16. Most expensive product.
17. Top 5 salaries.
18. Second youngest employee.
19. Third highest unique salary.
20. Employees whose names contain only unique characters.

## Pattern Recognition

Knowing Stream methods is one thing. Being able to look at a problem and immediately think *"this is a `groupingBy` + `mapping` + `maxBy` problem"* is what distinguishes senior Java developers from developers who have memorized the API. That intuition is the skill that consistently helps in interviews.

## Chapter Summary

- ✅ The six-question problem-solving framework
- ✅ Duplicates with `!seen.add(n)` (and its parallel-safety caveat)
- ✅ Frequency maps with `groupingBy(identity(), counting())`
- ✅ First non-repeating element with `LinkedHashMap`
- ✅ Nth highest with `distinct → sorted(desc) → skip(n-1)`
- ✅ `max()` over `sorted().findFirst()`
- ✅ Group anagrams by sorted key
