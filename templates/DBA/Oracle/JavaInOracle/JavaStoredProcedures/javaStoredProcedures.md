---
name: dba-java-stored-procedures
description: Writing Java classes that run inside Oracle, loading them with loadjava, publishing their static methods as PL/SQL call specs with LANGUAGE JAVA NAME, calling them from SQL*Plus and PL/SQL, debugging with DBMS_JAVA.SET_OUTPUT, and deciding between Java and PL/SQL for performance, based on Chapter 44 (Java Stored Procedures) of Oracle Database 11g: The Complete Reference. Use when the user runs loadjava, writes CREATE PROCEDURE/FUNCTION ... AS LANGUAGE JAVA, uses jdbc:default:connection, sees ORA-29524 or unresolved Java classes, asks why the first call of a Java procedure is slow, or wants to move logic between Java and PL/SQL.
---

# Java Stored Procedures

Java classes can run inside the database and be called as procedures, functions, triggers or type methods. The steps are: write a class with static methods that use the caller's session, load it with `loadjava`, publish each method with a PL/SQL call spec, then call the wrapper. Keep set-based data work in SQL and PL/SQL and use Java where computation dominates.

## Write the class

```java
import java.sql.*;

public class OrderOps {
  public static void cancelOrder(String orderId) throws SQLException {
    Connection conn = DriverManager.getConnection("jdbc:default:connection:");
    PreparedStatement ps = conn.prepareStatement(
        "update orders set status = 'CANCELLED' where order_id = ?");
    try {
      ps.setString(1, orderId);
      ps.executeUpdate();
    } finally {
      ps.close();
    }
  }
}
```

- The 11g in-database JVM is Java 5/6 level, so avoid newer syntax such as try-with-resources.

- `jdbc:default:connection:` reuses the calling session; the class never opens its own connection or handles credentials.
- Use `?` placeholders with `setString`, `setInt` and so on; match parameter types to the SQL columns.
- The book's example catches `SQLException` and only prints it. Let it propagate instead, so the caller sees ORA errors and can roll back.
- Transaction control stays with the caller unless the method commits explicitly.
- `javac` checks Java syntax only; SQL errors appear when the procedure runs.

## Load with loadjava

```sh
loadjava -user app_owner@orders_db -resolve -verbose OrderOps.java
```

Let loadjava prompt for the password rather than typing it on the command line. Options that matter most:

| Option | Effect |
|---|---|
| `-resolve` | Compile if needed and resolve references after loading; without it, classes are loaded but not resolved |
| `-verbose` | Detailed progress, including files skipped because they match the digest table |
| `-force` | Reload even if unchanged |
| `-schema` | Load into another schema (needs CREATE ANY PROCEDURE and related privileges) |
| `-grant` / `-cleargrants` | Add EXECUTE grants; clear existing grants first |
| `-definer` | Run with the definer's privileges instead of the invoker's (the default) |
| `-synonym` | Create PUBLIC synonyms (needs CREATE PUBLIC SYNONYM) |
| `-stoponerror` | Stop at the first error and report errors from USER_ERRORS |
| `-thin` / `-oci` | Driver used by loadjava (OCI is the default) |
| `-encoding` | Source file encoding |

- Use a full connect string (`host:port:sid`) if no service name is defined.
- The class name must not collide with existing objects in the schema.
- `-grant`, `-definer`, `-synonym` and `-schema` change security and visibility: confirm the target database and get approval before using them. `dropjava` removes loaded classes if you need to back out.
- `create java source | class | resource` can also load Java from a BFILE or LOB.

## Publish a call spec

```sql
create or replace procedure cancel_order_java (p_order_id varchar2)
as language java
name 'OrderOps.cancelOrder(java.lang.String)';
/
```

- One PL/SQL wrapper per Java method; the `name` string must match class, method and fully qualified parameter types exactly, including case.
- For functions, use `create function ... return <type> as language java name '...return <java type>'`.

## Call and debug

```sql
call cancel_order_java(:order_id);
begin cancel_order_java(:order_id); end;
/
set serveroutput on
call dbms_java.set_output(10000);  -- route System.out/err to DBMS_OUTPUT
```

- Verify the result with a query, then commit or roll back.
- Check load status in `USER_OBJECTS` (`object_type like 'JAVA%'`, `status`) and errors in `USER_ERRORS`. ORA-29524 usually means another class it depends on failed to resolve; fix that one first.
- Client code can also invoke static Java stored procedures directly through Oracle's `oracle.jpub.reflect` API; arguments there cannot be OUT or IN OUT, and calls run with invoker's rights.

## Performance: Java or PL/SQL

- The first call after database startup pays the highest cost (classes load); the first call in each new session pays a smaller one; later calls are fast.
- Reduce the penalty: warm up each Java procedure after startup, use connection pooling instead of short-lived sessions.
- Much of the overhead is the PL/SQL wrapper. Do data selection and manipulation in SQL and PL/SQL; Java can win for loop-heavy computation on data already fetched.
- Natively compiled PL/SQL in 11g is a strong alternative to Java for speed.

## Workflow

1. Confirm Java is the right tool (computation-heavy) rather than SQL or PL/SQL.
2. Write static methods using `jdbc:default:connection:` and bind variables; let SQLExceptions propagate.
3. Compile locally with `javac` to catch Java errors.
4. Load into the confirmed target schema with `loadjava -resolve -verbose`.
5. Create a call spec per method; test with `call` and `DBMS_JAVA.SET_OUTPUT`.
6. Check `USER_OBJECTS` status and `USER_ERRORS`; measure first-call and steady-state timings.

## Red flags

- Swallowing SQLException in the Java method so failures look like success.
- Opening a separate JDBC connection with credentials from inside a stored procedure.
- Loading without `-resolve` and discovering invalid classes at call time.
- Passwords typed on the loadjava command line or committed in scripts.
- Granting, publishing synonyms or using `-definer` without approval.
- Short-lived sessions that pay the Java warm-up cost on every request.
- Porting simple DML wrappers to Java for "speed".

## Related

- `../JdbcProgramming/jdbcProgramming.md` — JDBC statements and result sets used inside the class.
- `../IntroductionToJava/introductionToJava.md` — Java language basics.
- `../../PlSql/ProceduresFunctionsPackages/proceduresFunctionsPackages.md` — procedures and functions the call specs become.
- `../../PlSql/PlSqlTuning/plSqlTuning.md` — tuning the PL/SQL alternative.
- `../../SqlAndSqlPlus/BasicSecurity/basicSecurity.md` — EXECUTE grants and definer versus invoker rights.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — propagating errors instead of printing them.
