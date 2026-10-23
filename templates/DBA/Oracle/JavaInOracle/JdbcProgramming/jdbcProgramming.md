---
name: dba-jdbc-programming
description: Connecting Java programs to Oracle with JDBC: choosing the Oracle JDBC jar for the JDK, creating connections with OracleDataSource, controlling autocommit, running queries and DML with Statement and PreparedStatement, iterating ResultSets as a cursor loop, and closing resources, based on Chapter 43 (JDBC Programming) of Oracle Database 11g: The Complete Reference. Use when the user writes or debugs Java code that connects to Oracle, sees connection failures from getConnection, picks between ojdbc jars, asks how to run select/insert/update/delete from Java, builds SQL strings in Java, or finds that JDBC changes were committed unexpectedly.
---

# JDBC Programming

JDBC lets Java execute SQL against Oracle. A JDBC program connects, creates a statement, executes it, walks the results and closes everything. SQL inside Java strings is checked only at run time, so a program that compiles can still carry broken SQL; test every statement against the database.

## Drivers and setup

- Standard interfaces live in `java.sql`; Oracle's extensions in `oracle.jdbc` and `oracle.sql`.
- Pick the jar for your JDK from `$ORACLE_HOME/jdbc/lib`: in 11g, `ojdbc5.jar` for JDK 5 and `ojdbc6.jar` for JDK 6; the `_g` variants carry debug and tracing code. NLS support for object and collection types is in `jlib/orai18n.jar`.
- Oracle JDBC 11g needs J2SE 5.0 or later.
- Javadoc and demos ship under `$ORACLE_HOME/jdbc`; read the README there for environment variables.

## Connecting

```java
OracleDataSource ods = new OracleDataSource();
ods.setURL("jdbc:oracle:thin:@//dbhost:1521/orders_svc");
ods.setUser(user);
ods.setPassword(password);          // read from config or a secret store
Connection conn = ods.getConnection();
conn.setAutoCommit(false);
```

- The book's sample uses the OCI driver (`jdbc:oracle:oci8:@tns_alias`), which needs Oracle Net client configuration; the thin URL needs only host, port and service.
- Failures at `getConnection` usually mean wrong credentials, mismatched driver jars, or Oracle Net not configured.
- Connections start with **autocommit on**: every statement commits immediately. Turn it off for multi-statement transactions and call `commit()` or `rollback()` explicitly.
- Never hard-code or echo passwords, and never put them in a URL that gets logged.

## Querying

```java
String sql = "select order_id, status from orders where customer_id = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
  ps.setLong(1, customerId);
  try (ResultSet rs = ps.executeQuery()) {
    while (rs.next()) {
      System.out.println(rs.getLong("ORDER_ID") + " " + rs.getString("STATUS"));
    }
  }
}
```

- `while (rs.next())` is the Java equivalent of a PL/SQL cursor FOR loop.
- Read columns with typed getters (`getInt`, `getLong`, `getString`) by position or by column name.
- Select explicit column names, not `*`.
- `try`-with-resources is newer Java syntax (Java 7+); on older JDKs close ResultSet, Statement and Connection in `finally`.

## DML

- `executeQuery` for selects, `executeUpdate` for insert/update/delete (returns the row count), `execute` for anything.
- Do not end the SQL string with a semicolon.
- The book builds an insert by concatenating values into the SQL text and creates a new Statement per row. Prefer one `PreparedStatement` with `?` bind variables, created once outside the loop: it avoids SQL injection and re-parsing.

```java
try (PreparedStatement ins = conn.prepareStatement(
       "insert into order_totals (order_id, total) values (?, ?)")) {
  for (Order o : orders) {
    ins.setLong(1, o.id());
    ins.setBigDecimal(2, o.total());
    ins.executeUpdate();
  }
  conn.commit();
}
```

- Better still for sets of rows: do the whole job in one SQL statement or a PL/SQL call instead of row-by-row JDBC traffic.

## Beyond the basics

JDBC also offers statement caching, connection caching and pooling, connection failover, distributed transactions and LOB support; see the Oracle JDBC Developer's Guide before building them yourself.

## Workflow

1. Match the driver jar to the JDK and put it on the classpath.
2. Run a connection check (`select 'ok' from dual`) before writing business code.
3. Decide transaction boundaries; disable autocommit when several statements must succeed together.
4. Write SQL with bind variables in PreparedStatements; test each statement in SQL*Plus first.
5. Iterate results with `while (rs.next())`; close ResultSet, Statement and Connection on every path.
6. Verify the effect with a query in SQL*Plus; on errors, roll back and log the SQL and `SQLException` message without credentials.

## Red flags

- Building SQL by concatenating user input.
- Creating a new Statement per loop iteration and never closing it.
- Relying on default autocommit for multi-step changes.
- Empty `catch (SQLException e) {}` blocks.
- Credentials in source code, URLs or console output.
- Running DML from a test program against an unconfirmed (possibly production) connection string.

## Related

- `../IntroductionToJava/introductionToJava.md` — Java syntax used here.
- `../JavaStoredProcedures/javaStoredProcedures.md` — the same JDBC API running inside the database.
- `../../PlSql/DynamicSql/dynamicSql.md` — dynamic SQL and binds on the PL/SQL side.
- `../../BeyondTheBasics/RemoteData/remoteData.md` — Oracle Net service names behind connection strings.
- `../../../../CleanCode/Boundaries/boundaries.md` — wrapping JDBC behind your own data-access interface.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` — translating SQLException into domain errors.
