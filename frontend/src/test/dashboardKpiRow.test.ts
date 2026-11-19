import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardKpiRow } from "../pages/dashboard/components/DashboardKpiRow";
import {
  computeDataQuality,
  formatQualityMetric,
} from "../hooks/useDataQuality";
import type {
  DashboardSummary,
  EngineMetricsResponse,
} from "../pages/dashboard/useDashboardData";

const makeEngineMetrics = (
  completeness: number | null | undefined,
  uniqueness: number | null | undefined,
  consistency: number | null | undefined,
  timeliness: number | null | undefined,
  extra?: Partial<EngineMetricsResponse>,
): EngineMetricsResponse => ({
  engineHealth: {
    status: "ONLINE",
    appName: "LuminAI Data Engine",
    version: "0.1.0",
    latencyMs: 7,
    message: "Data Engine reachable",
  },
  pipelineStats: {
    totalRuns: 10,
    successRate: 100,
    avgDuration: 2.1,
    recordsProcessed: 1000,
  },
  dataQuality: {
    completeness,
    uniqueness,
    consistency,
    timeliness,
    recordsEvaluated: 1000,
  },
  ...extra,
});

describe("useDataQuality / computeDataQuality", () => {
  it("computes the average of all four finite dimensions", () => {
    const res = computeDataQuality(makeEngineMetrics(100, 90, 80, 70));
    expect(res.score).toBe(85);
    expect(res.isComplete).toBe(true);
    expect(formatQualityMetric(res.score)).toBe("85.0%");
  });

  it("returns null score when any dimension is null, undefined, or NaN", () => {
    expect(
      computeDataQuality(makeEngineMetrics(90, null, 80, 70)).score,
    ).toBeNull();
    expect(
      computeDataQuality(makeEngineMetrics(90, 80, undefined, 70)).score,
    ).toBeNull();
    expect(
      computeDataQuality(makeEngineMetrics(90, 80, 70, Number.NaN)).score,
    ).toBeNull();
  });

  it("treats missing engine response or available: false fallback zeros as unavailable (N/A)", () => {
    expect(computeDataQuality(undefined).score).toBeNull();
    expect(
      computeDataQuality({
        engineHealth: {
          status: "STANDBY",
          appName: "LuminAI Data Engine",
          version: "unknown",
          latencyMs: 3000,
          message: "Unreachable",
        },
        dataQuality: {
          overallScore: 0,
          completeness: 0,
          uniqueness: 0,
          consistency: 0,
          timeliness: 0,
          available: false,
          status: "UNAVAILABLE",
        },
      }).score,
    ).toBeNull();
    expect(formatQualityMetric(null)).toBe("N/A");
  });

  it("preserves a real measured 0 and formats it as 0.0%", () => {
    const res = computeDataQuality(makeEngineMetrics(0, 0, 0, 0));
    expect(res.score).toBe(0);
    expect(res.isComplete).toBe(true);
    expect(formatQualityMetric(res.score)).toBe("0.0%");
  });
});

describe("DashboardKpiRow Zero-State, Data Quality & Non-Zero Logic", () => {
  it("renders 'None yet' for count cards and 'N/A' + 'Unverified' for Data Quality when no engine data exists", () => {
    const zeroSummary: DashboardSummary = {
      totalEntities: 0,
      totalConnections: 0,
      totalPipelines: 0,
      entityBreakdown: {},
      recentActivity: [],
      dataQualityScore: 100.0, // Backend baseline 100 must NEVER be trusted
      pipelineHealth: { running: 0, completed: 0, failed: 0 },
      lastSyncAt: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: zeroSummary,
        isLoading: false,
      }),
    );

    const noneYetMatches = html.match(/None yet/g);
    expect(noneYetMatches).not.toBeNull();
    expect(noneYetMatches!.length).toBe(3);

    expect(html.includes("text-success")).toBe(false);
    expect(html.includes(">N/A<")).toBe(true);
    expect(html.includes("Unverified")).toBe(true);
    expect(html.includes("100.0%")).toBe(false);
    expect(html.includes("0.0%")).toBe(false);
    expect(html.includes("No runs yet")).toBe(true);
  });

  it("renders 'Active', 'Online', 'Healthy', and computed average quality score when engine metrics are present", () => {
    const activeSummary: DashboardSummary = {
      totalEntities: 1250,
      totalConnections: 4,
      totalPipelines: 12,
      entityBreakdown: { Customer: 1250 },
      recentActivity: [],
      dataQualityScore: 100.0,
      pipelineHealth: { running: 1, completed: 11, failed: 0 },
      lastSyncAt: "2026-11-17T12:00:00Z",
    };

    const html = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: activeSummary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(96, 98, 92, 94), // avg = 95.0%
      }),
    );

    expect(html.includes("Active")).toBe(true);
    expect(html.includes("Online")).toBe(true);
    expect(html.includes("Healthy")).toBe(true);
    expect(html.includes("95.0%")).toBe(true);
    expect(html.includes("Good")).toBe(true);
    expect(html.includes("text-success")).toBe(true);
  });

  it("never shows 100.0% when engine metrics are missing or zero-stubbed; shows N/A + Unverified", () => {
    const summaryWithBaseline100: DashboardSummary = {
      totalEntities: 57,
      totalConnections: 2,
      totalPipelines: 15,
      entityBreakdown: {},
      recentActivity: [],
      dataQualityScore: 100.0,
      pipelineHealth: { running: 0, completed: 15, failed: 0 },
      lastSyncAt: "2026-11-18T10:00:00Z",
    };

    const html = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: summaryWithBaseline100,
        isLoading: false,
        engineMetrics: {
          engineHealth: {
            status: "ONLINE",
            appName: "LuminAI Data Engine",
            version: "0.1.0",
            latencyMs: 7,
            message: "Reachable",
          },
          pipelineStats: {
            totalRuns: 0,
            successRate: 0,
            avgDuration: 0,
            recordsProcessed: 0,
          },
          dataQuality: {
            overallScore: 0,
            completeness: 0,
            uniqueness: 0,
            consistency: 0,
            timeliness: 0,
          },
        },
      }),
    );

    expect(html.includes(">N/A<")).toBe(true);
    expect(html.includes("Unverified")).toBe(true);
    expect(html.includes("100.0%")).toBe(false);
    expect(html.includes("0.0%")).toBe(false);
  });

  it("shows 'Fair' for score 70-89, 'Poor' for score < 70, and '0.0%' for real measured 0", () => {
    const baseSummary: DashboardSummary = {
      totalEntities: 100,
      totalConnections: 2,
      totalPipelines: 5,
      entityBreakdown: {},
      recentActivity: [],
      dataQualityScore: 100.0,
      pipelineHealth: { running: 0, completed: 5, failed: 0 },
      lastSyncAt: null,
    };

    const fairHtml = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: baseSummary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(80, 76, 82, 76), // avg = 78.5%
      }),
    );
    expect(fairHtml.includes("78.5%")).toBe(true);
    expect(fairHtml.includes("Fair")).toBe(true);

    const poorHtml = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: baseSummary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(50, 60, 52, 54), // avg = 54.0%
      }),
    );
    expect(poorHtml.includes("54.0%")).toBe(true);
    expect(poorHtml.includes("Poor")).toBe(true);

    const realZeroHtml = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: baseSummary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(0, 0, 0, 0), // real measured 0%
      }),
    );
    expect(realZeroHtml.includes("0.0%")).toBe(true);
    expect(realZeroHtml.includes("Poor")).toBe(true);
  });

  it("shows 'Completed with issues' in amber when quarantined or rejected records > 0", () => {
    const issuesSummary: DashboardSummary = {
      totalEntities: 500,
      totalConnections: 3,
      totalPipelines: 10,
      entityBreakdown: {},
      recentActivity: [],
      dataQualityScore: 95.0,
      pipelineHealth: { running: 0, completed: 9, failed: 1 },
      lastSyncAt: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: issuesSummary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(95, 95, 95, 95, {
          pipelineStats: {
            totalRuns: 10,
            successRate: 90,
            avgDuration: 2.5,
            recordsProcessed: 1000,
            rejectedCount: 15,
            quarantinedCount: 5,
          },
        }),
      }),
    );

    expect(html.includes("Completed with issues")).toBe(true);
    expect(html.includes("Good")).toBe(false);
  });
});
