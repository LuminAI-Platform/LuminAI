import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataEngineTelemetryCard } from "../features/dashboard/components/DataEngineTelemetryCard";
import type {
  DashboardSummary,
  EngineMetricsResponse,
} from "../pages/dashboard/useDashboardData";

describe("DataEngineTelemetryCard (Processing Engine)", () => {
  const baseSummary: DashboardSummary = {
    totalEntities: 57,
    totalConnections: 2,
    totalPipelines: 15,
    entityBreakdown: {},
    recentActivity: [],
    dataQualityScore: 100.0,
    pipelineHealth: { running: 0, completed: 15, failed: 0 },
    lastSyncAt: "2026-11-18T10:00:00Z",
  };

  const zeroRunsEngineMetrics: EngineMetricsResponse = {
    engineHealth: {
      status: "ONLINE",
      appName: "LuminAI Data Engine",
      version: "1.0.0",
      latencyMs: 14,
      message: "Data Engine reachable",
    },
    pipelineStats: {
      totalRuns: 0,
      successRate: 0,
      avgDuration: 0,
      recordsProcessed: 0,
    },
    dataQuality: {
      overallScore: null,
      completeness: null,
      uniqueness: null,
      consistency: null,
      timeliness: null,
    },
  };

  it("renders new title 'Processing Engine' and subtitle", () => {
    const html = renderToStaticMarkup(
      React.createElement(DataEngineTelemetryCard, {
        summary: baseSummary,
        engineMetrics: zeroRunsEngineMetrics,
      }),
    );

    expect(html.includes("Processing Engine")).toBe(true);
    expect(
      html.includes("Cleans, deduplicates and matches your records."),
    ).toBe(true);
    // Technology name is moved out of title into tooltip
    expect(html.includes("Python Data Engine &amp; Polars")).toBe(true);
  });

  it("never shows 'No runs yet' when platform history has completed runs; shows 'No live data from engine'", () => {
    const html = renderToStaticMarkup(
      React.createElement(DataEngineTelemetryCard, {
        summary: baseSummary,
        engineMetrics: zeroRunsEngineMetrics,
      }),
    );

    // Platform has 15 completed runs, engine reports 0: must NOT say "No runs yet"
    expect(html.includes("No runs yet")).toBe(false);
    expect(html.includes("No live data from engine")).toBe(true);
    expect(
      html.includes(
        "Run history is available, but the engine has not reported live metrics.",
      ),
    ).toBe(true);
  });

  it("shows 'Figures may be out of sync' warning when platform runs and engine runs mismatch", () => {
    const html = renderToStaticMarkup(
      React.createElement(DataEngineTelemetryCard, {
        summary: baseSummary, // 15 pipelines
        engineMetrics: zeroRunsEngineMetrics, // 0 runs
      }),
    );

    expect(html.includes("Figures may be out of sync")).toBe(true);
    expect(
      html.includes(
        "Platform history reports 15 runs, while engine live telemetry reports 0 runs.",
      ),
    ).toBe(true);
  });

  it("uses sentence case for all quality dimensions and labels", () => {
    const activeEngineMetrics: EngineMetricsResponse = {
      engineHealth: {
        status: "ONLINE",
        appName: "LuminAI Data Engine",
        version: "1.2.0",
        latencyMs: 8,
        message: "Data Engine reachable",
      },
      pipelineStats: {
        totalRuns: 15,
        successRate: 100,
        avgDuration: 3.45,
        p95Duration: 4.8,
        recordsProcessed: 12000,
      },
      dataQuality: {
        overallScore: 92.5,
        completeness: 95.0,
        uniqueness: 98.2,
        consistency: 91.0,
        timeliness: 86.4,
        recordsEvaluated: 12000,
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(DataEngineTelemetryCard, {
        summary: baseSummary,
        engineMetrics: activeEngineMetrics,
      }),
    );

    expect(html.includes("Data quality")).toBe(true);
    expect(html.includes("Avg run time")).toBe(true);
    expect(html.includes("Response")).toBe(true);
    expect(html.includes("Round-trip time to the engine")).toBe(true);
    expect(html.includes("Completeness")).toBe(true);
    expect(html.includes("Uniqueness")).toBe(true);
    expect(html.includes("Consistency")).toBe(true);
    expect(html.includes("Timeliness")).toBe(true);
    expect(html.includes("12,000 records evaluated")).toBe(true);
  });
});
