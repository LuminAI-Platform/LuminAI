import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutionLogs } from "../features/connections/components/ExecutionLogs";
import {
  resolveStreamStatus,
  formatRowCountsFragment,
  type LogEntry,
} from "../features/connections/components/execution-logs/executionLogTypes";

describe("Pipeline Execution Stream", () => {
  it("resolves stream status accurately: Live only when connected and active", () => {
    expect(
      resolveStreamStatus({
        isConnected: true,
        hasActiveRun: true,
        paused: false,
      }),
    ).toBe("live");
    expect(
      resolveStreamStatus({
        isConnected: true,
        hasActiveRun: false,
        paused: false,
      }),
    ).toBe("idle");
    expect(
      resolveStreamStatus({
        isConnected: true,
        hasActiveRun: true,
        paused: true,
      }),
    ).toBe("paused");
    expect(
      resolveStreamStatus({
        isConnected: false,
        hasActiveRun: true,
        paused: false,
      }),
    ).toBe("disconnected");
  });

  it("renders ExecutionLogs with ordered timestamps, date separators, level counts, clickable run IDs, and row counts", () => {
    const entries: LogEntry[] = [
      {
        id: "log-2",
        ts: new Date(2026, 10, 20, 15, 48, 0),
        level: "WARN",
        source: "patients.csv",
        runId: "abcdef12-3456-7890",
        message: "Run completed with issues in 15s",
        rowsIn: 870,
        rowsOut: 840,
        rowsQuarantined: 25,
        rowsRejected: 5,
      },
      {
        id: "log-1",
        ts: new Date(2026, 10, 19, 11, 20, 0),
        level: "INFO",
        source: "orders_db",
        runId: "99887766-1122-3344",
        message: "Run started (Database)",
      },
    ];

    const htmlIdle = renderToStaticMarkup(
      React.createElement(ExecutionLogs, {
        entries,
        streamConnected: true,
        hasActiveRun: false,
      }),
    );

    // Idle chip when connected but nothing running (not Live)
    expect(htmlIdle).toContain("Idle");
    expect(htmlIdle).not.toContain(">Live<");
    // Level tab counts
    expect(htmlIdle).toContain("All");
    expect(htmlIdle).toContain("(2)");
    expect(htmlIdle).toContain("Info");
    expect(htmlIdle).toContain("Warn");
    // Chronological order: Nov 19 entry appears before Nov 20 entry
    expect(htmlIdle.indexOf("orders_db")).toBeLessThan(
      htmlIdle.indexOf("patients.csv"),
    );
    // Date separators & row counts & clickable run IDs
    expect(htmlIdle).toContain("Nov 19, 2026");
    expect(htmlIdle).toContain("#abcdef12");
    expect(htmlIdle).toContain("#99887766");
    expect(htmlIdle).toContain(
      "In 870 · Out 840 · Quarantined 25 · Rejected 5",
    );
    expect(htmlIdle).toContain("Copy visible lines");

    // Disconnected shows Reconnect button
    const htmlDisconnected = renderToStaticMarkup(
      React.createElement(ExecutionLogs, {
        entries,
        streamConnected: false,
        hasActiveRun: false,
      }),
    );
    expect(htmlDisconnected).toContain("Disconnected");
    expect(htmlDisconnected).toContain("Reconnect");

    // Row counts helper
    expect(
      formatRowCountsFragment({ rowsIn: 100, rowsOut: 95, rowsRejected: 5 }),
    ).toBe("In 100 · Out 95 · Rejected 5");
  });
});
