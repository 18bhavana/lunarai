---
title: Stored Procedures & Functions
subtitle: Creating and calling procedures, IN / OUT / INOUT parameters, variables, IF and CASE, WHILE / REPEAT / LOOP, handlers and RESIGNAL, transactional procedures, stored functions and calling them from Spring Boot.
order: 29
---

## Introduction

Stored procedures and stored functions are widely used in banking, ERP, payroll, insurance, e-commerce and enterprise reporting systems.

This chapter covers what stored procedures are and why they're used, creating and calling them, `IN` / `OUT` / `INOUT` parameters, variables, `IF` and `CASE`, `WHILE` / `REPEAT` / `LOOP`, error handling, user-defined (stored) functions, enterprise use cases and interview questions.

## What Is a Stored Procedure?

A stored procedure is a **collection of SQL statements stored inside the database** that can be executed whenever required — think of it as a method in Java.

```java
public void calculateSalary() { ... }
```

```sql
CREATE PROCEDURE calculate_salary()
BEGIN
    ...
END;
```

## Why Use Stored Procedures?

Without a procedure, every application sends its own SQL — the same statements may be sent from many applications. With one:

```flow-h
Application
: CALL procedure()
Database executes the logic
```

Benefits:

- reusable database logic;
- fewer network round trips;
- centralized data operations;
- better security through controlled access (grant `EXECUTE` without granting table access);
- easier reuse across applications.

## A Basic Procedure

```sql
DELIMITER $$

CREATE PROCEDURE get_employees()
BEGIN
    SELECT * FROM employee;
END$$

DELIMITER ;

CALL get_employees();
```

> [!NOTE]
> `DELIMITER` is a **mysql client** command, not SQL. The procedure body contains `;`, so the client is told to treat `$$` as the end of the `CREATE` statement instead. GUI tools and JDBC/Flyway scripts handle this differently (Flyway, for example, supports `DELIMITER` in MySQL migrations).

## Parameters

### IN Parameter

`IN` is the default parameter type:

```sql
DELIMITER $$

CREATE PROCEDURE get_employee_by_id(IN emp_id INT)
BEGIN
    SELECT * FROM employee WHERE employee_id = emp_id;
END$$

DELIMITER ;

CALL get_employee_by_id(101);
```

### Multiple Parameters

```sql
DELIMITER $$

CREATE PROCEDURE get_employees_by_department(
    IN dept       VARCHAR(50),
    IN min_salary DECIMAL(10, 2)
)
BEGIN
    SELECT *
    FROM employee
    WHERE department = dept
      AND salary >= min_salary;
END$$

DELIMITER ;

CALL get_employees_by_department('IT', 70000);
```

> [!TIP]
> Don't give parameters the same names as columns. Inside the procedure, a parameter called `salary` would shadow the `salary` column, and `WHERE salary = salary` would compare the parameter with itself.

### OUT Parameter

An `OUT` parameter **returns a value to the caller**:

```sql
DELIMITER $$

CREATE PROCEDURE get_employee_count(OUT total INT)
BEGIN
    SELECT COUNT(*) INTO total FROM employee;
END$$

DELIMITER ;

CALL get_employee_count(@count);
SELECT @count;
```

### INOUT Parameter

An `INOUT` parameter is **both input and output**:

```sql
DELIMITER $$

CREATE PROCEDURE increase_value(INOUT number INT)
BEGIN
    SET number = number + 10;
END$$

DELIMITER ;

SET @num = 20;
CALL increase_value(@num);
SELECT @num;
```

```output Output
30
```

### IN vs OUT vs INOUT

| Parameter | Input | Output | Purpose |
| --- | --- | --- | --- |
| `IN` | ✅ | ❌ | Pass a value into the procedure |
| `OUT` | ❌ | ✅ | Return a value from the procedure (starts as `NULL`) |
| `INOUT` | ✅ | ✅ | Pass a value in and return the modified value |

## Local Variables

Variables inside stored programs are declared with `DECLARE`:

```sql
DELIMITER $$

CREATE PROCEDURE demo_variable()
BEGIN
    DECLARE total_salary DECIMAL(12, 2);

    SELECT SUM(salary) INTO total_salary FROM employee;

    SELECT total_salary;
END$$

DELIMITER ;
```

> [!IMPORTANT]
> `DECLARE` statements must appear at the **beginning** of a `BEGIN ... END` block, before executable statements — and in this order: variables and conditions, then cursors, then handlers.

Local variables (`total_salary`) exist only inside the block. **User variables** (`@count`) belong to the session and need no declaration.

## IF Statement

```sql
DELIMITER $$

CREATE PROCEDURE calculate_bonus(
    IN  emp_salary DECIMAL(10, 2),
    OUT bonus      DECIMAL(10, 2)
)
BEGIN
    IF emp_salary > 50000 THEN
        SET bonus = 5000;
    ELSE
        SET bonus = 2000;
    END IF;
END$$

DELIMITER ;
```

`ELSEIF` adds further branches.

## CASE Statement

Useful when several conditions need evaluating:

```sql
CASE department
    WHEN 'IT' THEN SELECT 'Technology';
    WHEN 'HR' THEN SELECT 'Human Resources';
    ELSE SELECT 'Other';
END CASE;
```

> [!WARNING]
> Unlike the `CASE` **expression** (which returns `NULL` when nothing matches), the `CASE` **statement** inside a stored program raises error 1339 *Case not found for CASE statement* if no `WHEN` matches and there's no `ELSE`. Always include an `ELSE`, even an empty `BEGIN END`.

## Loops

### WHILE

Checks the condition **before** executing:

```sql
DELIMITER $$

CREATE PROCEDURE print_numbers()
BEGIN
    DECLARE i INT DEFAULT 1;

    WHILE i <= 5 DO
        SELECT i;
        SET i = i + 1;
    END WHILE;
END$$

DELIMITER ;
```

Each `SELECT i` inside a loop produces a **separate result set** — fine for a demo, but real loops usually build a value or insert rows.

### REPEAT

Executes **at least once**, because the condition is checked after execution:

```sql
DELIMITER $$

CREATE PROCEDURE repeat_example()
BEGIN
    DECLARE i INT DEFAULT 1;

    REPEAT
        SELECT i;
        SET i = i + 1;
    UNTIL i > 5
    END REPEAT;
END$$

DELIMITER ;
```

### LOOP

`LOOP` is an **unconditional** loop, usually combined with a label and `LEAVE` (and `ITERATE` to skip to the next iteration):

```sql
DELIMITER $$

CREATE PROCEDURE loop_example()
BEGIN
    DECLARE i INT DEFAULT 1;

    number_loop: LOOP
        IF i > 5 THEN
            LEAVE number_loop;
        END IF;

        SELECT i;
        SET i = i + 1;
    END LOOP number_loop;
END$$

DELIMITER ;
```

| Loop | Condition checked | Runs at least once? |
| --- | --- | --- |
| `WHILE` | Before each iteration | No |
| `REPEAT ... UNTIL` | After each iteration | Yes |
| `LOOP` | Never — exit with `LEAVE` | Yes |

## Exception Handling

Stored programs use **handlers** to manage SQL errors:

```sql
DECLARE EXIT HANDLER FOR SQLEXCEPTION
BEGIN
    ROLLBACK;
END;
```

Common handler conditions are `SQLEXCEPTION`, `SQLWARNING`, `NOT FOUND` (used with cursors and `SELECT ... INTO` that finds no row) and specific error codes or `SQLSTATE` values.

| Handler type | After handling the condition |
| --- | --- |
| `EXIT` | Leaves the current `BEGIN ... END` block |
| `CONTINUE` | Continues with the next statement |

You can raise your own errors with `SIGNAL`:

```sql
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance';
```

## Transactions Inside Procedures

Transactions are essential when multiple operations must **succeed or fail together** — a bank transfer:

```sql
START TRANSACTION;

UPDATE account SET balance = balance - 1000 WHERE account_id = 1;
UPDATE account SET balance = balance + 1000 WHERE account_id = 2;

COMMIT;
-- on error: ROLLBACK;
```

### Bank Transfer Procedure

```sql
DELIMITER $$

CREATE PROCEDURE transfer_money(
    IN from_account    INT,
    IN to_account      INT,
    IN transfer_amount DECIMAL(12, 2)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    UPDATE account
    SET balance = balance - transfer_amount
    WHERE account_id = from_account;

    UPDATE account
    SET balance = balance + transfer_amount
    WHERE account_id = to_account;

    COMMIT;
END$$

DELIMITER ;

CALL transfer_money(1, 2, 1000);
```

A real banking system needs more validation: sufficient balance, valid accounts, concurrent transactions, isolation and audit logging. A more defensive version locks the source row, checks the balance and verifies both updates hit a row:

```sql
DELIMITER $$

CREATE PROCEDURE transfer_money_safe(
    IN from_account    INT,
    IN to_account      INT,
    IN transfer_amount DECIMAL(12, 2)
)
BEGIN
    DECLARE current_balance DECIMAL(12, 2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF transfer_amount <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Amount must be positive';
    END IF;

    START TRANSACTION;

    -- Lock the source row so concurrent transfers can't overdraw it
    SELECT balance INTO current_balance
    FROM account
    WHERE account_id = from_account
    FOR UPDATE;

    IF current_balance IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Source account not found';
    END IF;

    IF current_balance < transfer_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient balance';
    END IF;

    UPDATE account SET balance = balance - transfer_amount WHERE account_id = from_account;
    UPDATE account SET balance = balance + transfer_amount WHERE account_id = to_account;

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Destination account not found';
    END IF;

    COMMIT;
END$$

DELIMITER ;
```

`SIGNAL` raises an `SQLEXCEPTION`, so the handler rolls back and `RESIGNAL`s the message to the caller. (In production, lock both accounts in a consistent order — e.g. lowest ID first — to avoid deadlocks between opposite transfers.)

## Stored Functions (User-Defined Functions)

A **stored function** is a reusable database function that returns **exactly one value**. Unlike procedures, functions can be used **inside SQL expressions**; procedures are invoked with `CALL`.

```sql
DELIMITER $$

CREATE FUNCTION annual_salary(monthly_salary DECIMAL(10, 2))
RETURNS DECIMAL(12, 2)
DETERMINISTIC
BEGIN
    RETURN monthly_salary * 12;
END$$

DELIMITER ;

SELECT employee_name, annual_salary(salary)
FROM employee;
```

> [!NOTE]
> In MySQL's own terminology, "UDF" (now *loadable function*) means a function written in C/C++ and loaded with `CREATE FUNCTION ... SONAME`. Functions written in SQL like the one above are **stored functions**, although many teams loosely call both "UDFs".

### DETERMINISTIC vs NOT DETERMINISTIC

- **DETERMINISTIC** — the same input always gives the same output: `annual_salary(50000)` is 600000 every time.
- **NOT DETERMINISTIC** (the default) — the same input may give different results: functions using the current date/time, random values or changing table data.

> [!WARNING]
> With binary logging enabled (the default in MySQL 8), creating a function fails with error 1418 unless it's declared `DETERMINISTIC`, `NO SQL` or `READS SQL DATA` (or `log_bin_trust_function_creators` is on). Declare characteristics **truthfully** — marking a non-deterministic function `DETERMINISTIC` can cause wrong results and replication inconsistencies.

### Procedure vs Function

| Stored procedure | Stored function |
| --- | --- |
| Called with `CALL` | Used in SQL expressions |
| Can return multiple result sets | Returns one value |
| Supports `IN`, `OUT`, `INOUT` | Parameters are input only |
| Can manage transactions (`COMMIT`, `ROLLBACK`) | Can't commit or roll back |
| Suits workflows and complex database operations | Suits reusable calculations |

## Real-World Examples

```sql
-- 1. Employee search
CALL get_employee_by_id(101);

-- 2. Payroll calculation
SELECT employee_name, annual_salary(salary) FROM employee;

-- 3. Bank fund transfer: START TRANSACTION → debit A → credit B → COMMIT (ROLLBACK on failure)
CALL transfer_money(1, 2, 1000);

-- 4. Monthly report generation
CALL generate_monthly_report();

-- 5. Inventory update
CALL update_inventory(101, 5);
```

## Performance and Design Considerations

Stored procedures can:

- reduce network round trips;
- execute data-centric logic close to the data;
- improve code reuse;
- simplify repeated multi-step database operations.

However:

- complex business logic is often easier to maintain in the application layer;
- database code is harder to unit test;
- versioning and deployment need proper migration processes;
- heavy use creates **database vendor lock-in**.

A common enterprise split: **data-centric operations → stored procedures; complex business workflows → Java / the application layer.**

## Stored Procedures in Spring Boot

With plain JDBC, use a `CallableStatement`:

```java
try (CallableStatement statement = connection.prepareCall("{call get_employee_by_id(?)}")) {
    statement.setInt(1, 101);
    try (ResultSet rs = statement.executeQuery()) {
        while (rs.next()) {
            System.out.println(rs.getString("employee_name"));
        }
    }
}
```

With Spring Data JPA, `@Procedure` maps naturally to procedures with **OUT parameters**:

```java
public interface EmployeeRepository extends JpaRepository<Employee, Integer> {

    @Procedure(procedureName = "get_employee_count")
    Integer getEmployeeCount();          // returns the OUT parameter

    @Query(value = "CALL get_employee_by_id(:id)", nativeQuery = true)
    List<Employee> findByIdViaProcedure(@Param("id") Integer id);   // result set
}
```

For procedures that return a **result set**, a native `@Query` with `CALL` (or `@NamedStoredProcedureQuery` with `resultClasses`) is the reliable option on MySQL. Spring's `SimpleJdbcCall` is another clean choice.

Stored procedures are useful when legacy systems already use them, when complex database operations must run atomically, when several applications share the same database logic, or when database-side processing gives a measurable benefit.

## Interview Questions

### Q1. Difference between a procedure and a function?

| Procedure | Function |
| --- | --- |
| Invoked with `CALL` | Used inside SQL |
| Can return multiple outputs or result sets | Returns a single value |
| Supports `OUT` parameters | No `OUT` parameters |
| Used for workflows | Used for calculations |

### Q2. What are IN, OUT and INOUT?

- **IN** — input only.
- **OUT** — output only.
- **INOUT** — input and output.

### Q3. Why use stored procedures?

Reusability, security, fewer network round trips, centralized database operations, and complex transactional workflows.

### Q4. Can a function modify data?

In MySQL a stored function **can** run `INSERT`, `UPDATE` and `DELETE` — but it can't commit or roll back (explicitly or implicitly), can't return a result set, and can't modify a table that the calling statement is reading or writing. In practice, functions should be kept **side-effect free** and used for reusable calculations; use procedures for data changes.

### Q5. Can a procedure return multiple result sets?

Yes — each `SELECT` the procedure executes produces its own result set.

### Q6. What is an exception handler?

A handler defines what happens when a particular database condition occurs — for example `DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; END;`.

### Q7. EXIT vs CONTINUE handlers?

An **EXIT** handler terminates the current block after handling the condition; a **CONTINUE** handler resumes execution with the next statement.

## Common Mistakes

- ❌ **Forgetting `DELIMITER`** — in the mysql client, change the delimiter temporarily when creating procedures or functions.
- ❌ **Using procedures for everything** — simple CRUD is often clearer in the application layer.
- ❌ **Mixing business logic and data logic excessively** — keep complex business workflows in Java unless database-side execution clearly helps.
- ❌ **Missing transaction handling** — for multiple related updates, use a transaction, handle exceptions and roll back on failure.
- ❌ **Swallowing exceptions** — a handler that only rolls back hides the original error from the caller.

```sql
-- Hides the error
DECLARE EXIT HANDLER FOR SQLEXCEPTION
BEGIN
    ROLLBACK;
END;

-- Prefer: RESIGNAL propagates the original error to the caller
DECLARE EXIT HANDLER FOR SQLEXCEPTION
BEGIN
    ROLLBACK;
    RESIGNAL;
END;
```

## Mini Project

Using an `employee` table (employee_id, name, department, salary):

1. Create a procedure to retrieve an employee by ID.
2. Create a procedure to count employees in a department.
3. Create a procedure that increases salary by a given percentage.
4. Create a function to calculate annual salary.
5. Create a procedure to transfer money between two bank accounts using a transaction.

## Practice Problems

**Easy**

1. Create a basic procedure.
2. Create a procedure with an `IN` parameter.
3. Create a procedure with an `OUT` parameter.
4. Create a simple function.
5. Call a stored procedure.

**Medium**

1. Use `IF` inside a procedure.
2. Use `CASE` inside a procedure.
3. Create a `WHILE` loop.
4. Create a procedure using transactions.
5. Build an inventory update procedure.

**Interview level**

1. Explain procedure vs function.
2. Explain `IN`, `OUT` and `INOUT`.
3. Explain exception handling in stored procedures.
4. Design a bank transfer procedure using transactions.
5. Discuss when business logic should stay in Java vs move into stored procedures.

## Best Practices

- ✅ Keep each procedure focused on one business task, with meaningful names for procedures and parameters.
- ✅ Wrap multi-step updates in transactions.
- ✅ Use handlers with `RESIGNAL`, and `SIGNAL` for business-rule errors.
- ✅ Use functions for reusable calculations that return a single value.
- ✅ Avoid unnecessary database-side business logic.
- ✅ Version stored procedures with database migration tools (Flyway, Liquibase).
- ✅ Document stored procedures just as you would Java APIs.

Stored procedures are common in banking fund transfers, payroll processing, insurance claims, ERP, inventory management, financial reporting, ETL jobs, legacy enterprise systems and Spring Boot + MySQL enterprise applications.

## Key Takeaways

- ✅ Stored procedures encapsulate reusable SQL logic inside the database.
- ✅ `IN`, `OUT` and `INOUT` parameters control how data flows in and out.
- ✅ Local variables are declared with `DECLARE`.
- ✅ `IF`, `CASE`, `WHILE`, `REPEAT` and `LOOP` provide procedural control flow.
- ✅ Handlers manage SQL errors; transactions make multi-step operations succeed or fail together.
- ✅ Functions return a single value and can be used directly in SQL statements.
- ✅ Use stored procedures where database-side execution adds value, but don't push all application logic into the database.
