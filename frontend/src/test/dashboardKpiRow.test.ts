import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardKpiRow } from "../pages/dashboard/components/DashboardKpiRow";
import type { DashboardSummary } from "../pages/dashboard/useDashboardData";

describe("DashboardKpiRow Zero-State & Non-Zero Logic", () => {
  it("renders 'None yet' in neutral badges when all metrics are 0", () => {
    const zeroSummary: DashboardSummary = {
      totalEntities: 0,
      totalConnections: 0,
      totalPipelines: 0,
      entityBreakdown: {},
      recentActivity: [],
      dataQualityScore: 0,
      pipelineHealth: { running: 0, completed: 0, failed: 0 },
      lastSyncAt: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: zeroSummary,
        isLoading: false,
      }),
    );

    // "None yet" should be displayed for all 4 cards
    const noneYetMatches = html.match(/None yet/g);
    expect(noneYetMatches).not.toBeNull();
    expect(noneYetMatches!.length).toBe(4);

    // Green/success text ("text-success") must NOT be rendered when values are zero
    expect(html.includes("text-success")).toBe(false);

    // Data Quality Score value must show '–' instead of '0.0%' or hardcoded score
    expect(html.includes(">–<")).toBe(true);

    // "No runs yet" should be rendered
    expect(html.includes("No runs yet")).toBe(true);
  });

  it("renders 'Active', 'Online', and 'Healthy' badges in success colors when metrics are > 0", () => {
    const activeSummary: DashboardSummary = {
      totalEntities: 1250,
      totalConnections: 4,
      totalPipelines: 12,
      entityBreakdown: { Customer: 1250 },
      recentActivity: [],
      dataQualityScore: 99.2,
      pipelineHealth: { running: 1, completed: 11, failed: 0 },
      lastSyncAt: "2026-11-17T12:00:00Z",
    };

    const html = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: activeSummary,
        isLoading: false,
      }),
    );

    expect(html.includes("Active")).toBe(true);
    expect(html.includes("Online")).toBe(true);
    expect(html.includes("Healthy")).toBe(true);
    expect(html.includes("99.2%")).toBe(true);
    expect(html.includes("Good")).toBe(true);
    expect(html.includes("text-success")).toBe(true);
  });

  it("shows 'Unverified' badge when score is 100 without evaluated-records count", () => {
    const unverifiedSummary: DashboardSummary = {
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
        summary: unverifiedSummary,
        isLoading: false,
      }),
    );

    expect(html.includes("Unverified")).toBe(true);
    expect(
      html.includes(
        "Score has no evaluated-records count, so it cannot be verified.",
      ),
    ).toBe(true);
    // Must NOT show "Good" badge for unverified 100%
    expect(html.includes("100% Good")).toBe(false);
  });

  it("shows 'Fair' for score 70-89 and 'Poor' for score < 70", () => {
    const fairSummary: DashboardSummary = {
      totalEntities: 100,
      totalConnections: 2,
      totalPipelines: 5,
      entityBreakdown: {},
      recentActivity: [],
      dataQualityScore: 78.5,
      pipelineHealth: { running: 0, completed: 5, failed: 0 },
      lastSyncAt: null,
    };

    const fairHtml = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: fairSummary,
        isLoading: false,
      }),
    );
    expect(fairHtml.includes("Fair")).toBe(true);

    const poorSummary: DashboardSummary = {
      ...fairSummary,
      dataQualityScore: 54.2,
    };
    const poorHtml = renderToStaticMarkup(
      React.createElement(DashboardKpiRow, {
        summary: poorSummary,
        isLoading: false,
      }),
    );
    expect(poorHtml.includes("Poor")).toBe(true);
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
        engineMetrics: {
          pipelineStats: {
            totalRuns: 10,
            successRate: 90,
            avgDuration: 2.5,
            recordsProcessed: 1000,
            rejectedCount: 15,
            quarantinedCount: 5,
          },
        },
      }),
    );

    expect(html.includes("Completed with issues")).toBe(true);
    expect(html.includes("Good")).toBe(false);
  });
});
