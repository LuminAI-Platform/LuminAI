import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseRawConnections,
  buildUnifiedSources,
  resolveNonEmptyTab,
  normalizeSourceStatus,
} from "../pages/connections/connections/connectionsHelpers";
import { formatRelativeTime } from "../pages/connections/connections/connectionsTypes";
import {
  DatabaseEmptyState,
  FilesEmptyState,
} from "../pages/connections/connections/ConnectionsEmptyStates";

describe("Connections page helpers and empty states", () => {
  it("never opens on an empty tab when another tab has items", () => {
    expect(resolveNonEmptyTab("connectors", { connectors: 0, files: 2 })).toBe(
      "all",
    );
    expect(resolveNonEmptyTab("files", { connectors: 3, files: 0 })).toBe(
      "all",
    );
    expect(resolveNonEmptyTab("connectors", { connectors: 1, files: 2 })).toBe(
      "connectors",
    );
    expect(resolveNonEmptyTab("all", { connectors: 0, files: 0 })).toBe("all");
  });

  it("formats relative time in sentence case ('just now')", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
    expect(formatRelativeTime(null)).toBe("never");
  });

  it("normalizes backend Connection.Status values accurately", () => {
    expect(normalizeSourceStatus("ACTIVE")).toBe("Connected");
    expect(normalizeSourceStatus("INACTIVE")).toBe("Paused");
    expect(normalizeSourceStatus("ERROR")).toBe("Failed");
    expect(normalizeSourceStatus("SYNCING")).toBe("Syncing");
  });

  it("parses raw API connections into unified sources without fabricating missing fields", () => {
    const { fileItems, dbItems } = parseRawConnections([
      {
        id: "db-1",
        name: "Prod Postgres",
        type: "POSTGRESQL",
        status: "ACTIVE",
        config: JSON.stringify({ database: "orders", tables: ["a", "b"] }),
        lastSyncAt: "2026-11-20T12:00:00Z",
      },
      {
        id: "file-1",
        name: "patients.csv",
        type: "FILE",
        status: "INACTIVE",
        config: JSON.stringify({ fileSize: 2097152, rowsCount: 450 }),
        createdAt: "2026-11-20T11:00:00Z",
      },
    ]);

    const unified = buildUnifiedSources(dbItems, fileItems);
    expect(unified).toHaveLength(2);

    const dbSource = unified.find((s) => s.id === "db-1")!;
    expect(dbSource.typeLabel).toBe("PostgreSQL");
    expect(dbSource.status).toBe("Connected");
    expect(dbSource.rowsSynced).toBeUndefined();
    expect(dbSource.schemaDriftWarning).toBeUndefined();

    const fileSource = unified.find((s) => s.id === "file-1")!;
    expect(fileSource.typeLabel).toBe("Flat file");
    expect(fileSource.status).toBe("Paused");
    expect(fileSource.rowsSynced).toBe(450);
  });

  it("renders DatabaseEmptyState with connector tiles and next-step guidance without duplicate button", () => {
    const html = renderToStaticMarkup(
      React.createElement(DatabaseEmptyState, {
        onSelectConnector: () => {},
      }),
    );

    expect(html).toContain("PostgreSQL");
    expect(html).toContain("MySQL");
    expect(html).toContain("SQL Server");
    expect(html).toContain("Snowflake");
    expect(html).toContain("Databases");
    expect(html).toContain("Warehouses");
    expect(html).toContain(
      "Connect a source, map it in Schema Studio, then run a pipeline.",
    );
    expect(html).not.toContain("Add Database Connection");
  });

  it("renders FilesEmptyState with drag-and-drop prompt and next-step guidance", () => {
    const html = renderToStaticMarkup(
      React.createElement(FilesEmptyState, {
        onSelectFile: () => {},
      }),
    );

    expect(html).toContain("Upload CSV or JSON (up to 500 MB)");
    expect(html).toContain(
      "Connect a source, map it in Schema Studio, then run a pipeline.",
    );
  });
});
