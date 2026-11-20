import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_DB_PORTS,
  validateDbField,
  isDbFormValid,
  parseConnectionString,
  classifyConnectionError,
} from "../features/connections/components/db-connector/dbConnectorUtils";
import { TableSelector } from "../features/connections/components/TableSelector";

describe("DatabaseConnectorForm utilities and TableSelector", () => {
  it("maps default ports per supported database type", () => {
    expect(DEFAULT_DB_PORTS.postgresql).toBe(5432);
    expect(DEFAULT_DB_PORTS.mysql).toBe(3306);
    expect(DEFAULT_DB_PORTS.snowflake).toBe(443);
    expect(DEFAULT_DB_PORTS.sqlserver).toBe(1433);
  });

  it("validates required fields, port range 1-65535, and host format", () => {
    expect(validateDbField("name", "")).toBeDefined();
    expect(validateDbField("host", "https://db.internal")).toBeDefined();
    expect(validateDbField("host", "db.replica.internal")).toBeUndefined();
    expect(validateDbField("port", "0")).toBeDefined();
    expect(validateDbField("port", "70000")).toBeDefined();
    expect(validateDbField("port", "5432")).toBeUndefined();

    expect(
      isDbFormValid({
        name: "Prod DB",
        dbType: "postgresql",
        host: "db.internal",
        port: "5432",
        databaseName: "sales",
        username: "readonly",
        password: "secret",
      }),
    ).toBe(true);

    expect(
      isDbFormValid({
        name: "Prod DB",
        dbType: "postgresql",
        host: "db.internal",
        port: "5432",
        databaseName: "sales",
        username: "readonly",
        password: "",
      }),
    ).toBe(false);
  });

  it("parses PostgreSQL, JDBC, and MySQL connection strings client-side", () => {
    const pg = parseConnectionString(
      "postgresql://readonly_user:p%40ss@db.prod.internal:5433/analytics",
    );
    expect(pg).toEqual({
      dbType: "postgresql",
      host: "db.prod.internal",
      port: 5433,
      databaseName: "analytics",
      username: "readonly_user",
      password: "p@ss",
    });

    const jdbc = parseConnectionString(
      "jdbc:mysql://myuser:pw@10.0.0.5/orders",
    );
    expect(jdbc).toEqual({
      dbType: "mysql",
      host: "10.0.0.5",
      port: 3306,
      databaseName: "orders",
      username: "myuser",
      password: "pw",
    });

    expect(parseConnectionString("not a uri")).toBeNull();
  });

  it("classifies specific database connection errors with actionable suggestions", () => {
    const authErr = classifyConnectionError(
      'Database connection rejected: FATAL: password authentication failed for user "sync"',
    );
    expect(authErr.title).toBe("Authentication failed");
    expect(authErr.suggestion).toContain("password");

    const hostErr = classifyConnectionError(
      "java.net.UnknownHostException: bad.host.internal",
    );
    expect(hostErr.title).toBe("Host unreachable");

    const timeoutErr = classifyConnectionError(
      "Connection attempt timed out after 10000ms",
    );
    expect(timeoutErr.title).toBe("Connection timed out");

    const dbErr = classifyConnectionError(
      'FATAL: database "missing_db" does not exist',
    );
    expect(dbErr.title).toBe("Database not found");
  });

  it("renders empty discovery guidance when no tables are returned", () => {
    const html = renderToStaticMarkup(
      React.createElement(TableSelector, {
        discovered: [],
        selectedTables: [],
        onChange: () => {},
      }),
    );

    expect(html).toContain(
      "No tables found. Check the schema name and the user&#x27;s permissions.",
    );
  });

  it("renders Select all and selected table count when schemas are discovered", () => {
    const html = renderToStaticMarkup(
      React.createElement(TableSelector, {
        discovered: [
          { schema: "public", tables: ["users", "orders"] },
          { schema: "analytics", tables: ["events"] },
        ],
        selectedTables: ["public.users"],
        onChange: () => {},
      }),
    );

    expect(html).toContain("1 of 3 tables selected");
    expect(html).toContain("Select all");
    expect(html).toContain("public");
    expect(html).toContain("analytics");
  });
});
