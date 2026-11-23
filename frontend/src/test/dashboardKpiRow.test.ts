import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardKpiRow } from "../pages/dashboard/components/DashboardKpiRow";
import type {
  DashboardSummary,
  EngineMetricsResponse,
} from "../pages/dashboard/dashboardTypes";

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

describe("<DashboardKpiRow /> rendering with live engine metrics", () => {
  const summary: DashboardSummary = {
    totalEntities: 57,
    totalConnections: 2,
    totalPipelines: 15,
    entityBreakdown: {},
    recentActivity: [],
    dataQualityScore: 95.0,
    pipelineHealth: { running: 0, completed: 15, failed: 0 },
    lastSyncAt: "2026-11-18T10:00:00Z",
  };

  it("renders genuine measured data quality from Data Engine instead of hardcoded 100%", () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(95, 95, 95, 95),
      }),
    );

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
        engineMetrics: makeEngineMetrics(80, 76, 82, 76),
      }),
    );
    expect(fairHtml.includes("78.5%")).toBe(true);
    expect(fairHtml.includes("Fair")).toBe(true);

    const poorHtml = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: baseSummary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(50, 60, 52, 54),
      }),
    );
    expect(poorHtml.includes("54.0%")).toBe(true);
    expect(poorHtml.includes("Poor")).toBe(true);

    const realZeroHtml = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: baseSummary,
        isLoading: false,
        engineMetrics: makeEngineMetrics(0, 0, 0, 0),
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
