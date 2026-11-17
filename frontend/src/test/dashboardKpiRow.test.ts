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
    expect(html.includes("text-success")).toBe(true);
  });
});
