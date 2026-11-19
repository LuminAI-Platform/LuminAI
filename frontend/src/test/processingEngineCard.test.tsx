import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    hash,
    children,
    className,
  }: {
    to: string;
    hash?: string;
    children?: React.ReactNode;
    className?: string;
  }) =>
    React.createElement(
      "a",
      { href: hash ? `${to}#${hash}` : to, className },
      children,
    ),
}));

import { EngineStatusPillView } from "../components/layout/EngineStatusPill";
import {
  deriveEngineStatus,
  formatLastChecked,
} from "../components/layout/engineStatusUtils";
import { SystemHealthSectionContent } from "../features/connections/components/SystemHealthSection";
import type { EngineMetricsResponse } from "../pages/dashboard/useDashboardData";

describe("EngineStatusPill (Footer Status Indicator)", () => {
  it("renders Online with green dot when engine health is ONLINE", () => {
    const html = renderToStaticMarkup(
      React.createElement(EngineStatusPillView, {
        engineMetrics: {
          engineHealth: {
            status: "ONLINE",
            appName: "LuminAI Data Engine",
            version: "0.1.0",
            latencyMs: 7,
            message: "Reachable",
          },
        },
        dataUpdatedAt: Date.now(),
      }),
    );

    expect(html).toContain("Engine:");
    expect(html).toContain("Online");
    expect(html).toContain("bg-success");
  });

  it("renders Degraded with amber dot when engine health is DEGRADED", () => {
    const html = renderToStaticMarkup(
      React.createElement(EngineStatusPillView, {
        engineMetrics: {
          engineHealth: {
            status: "DEGRADED",
            appName: "LuminAI Data Engine",
            version: "0.1.0",
            latencyMs: 420,
            message: "Slow response",
          },
        },
      }),
    );

    expect(html).toContain("Degraded");
    expect(html).toContain("bg-warning");
  });

  it("renders Offline with red dot when engine is unreachable or in STANDBY", () => {
    expect(deriveEngineStatus(undefined, true)).toBe("offline");
    const html = renderToStaticMarkup(
      React.createElement(EngineStatusPillView, {
        engineMetrics: {
          engineHealth: {
            status: "STANDBY",
            appName: "LuminAI Data Engine",
            version: "unknown",
            latencyMs: 3000,
            message: "Unreachable",
          },
        },
      }),
    );

    expect(html).toContain("Offline");
    expect(html).toContain("bg-error");
  });

  it("formats last checked relative time accurately", () => {
    const now = 1_700_000_000_000;
    expect(formatLastChecked(now - 10_000, now)).toEqual({
      label: "Just now",
      staleMinutes: 0,
    });
    expect(formatLastChecked(now - 12 * 60_000, now)).toEqual({
      label: "12 min ago",
      staleMinutes: 12,
    });
  });
});

describe("SystemHealthSection (Pipeline Monitor)", () => {
  it("renders N/A with muted styling when engine data is missing, never 0.0% or 'Figures may be out of sync'", () => {
    const html = renderToStaticMarkup(
      React.createElement(SystemHealthSectionContent, {
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

    expect(html).toContain("System Health &amp; Data Quality");
    expect(html).toContain("Completeness");
    expect(html).toContain("Uniqueness");
    expect(html).toContain("Consistency");
    expect(html).toContain("Timeliness");
    expect(html).toContain(">N/A<");
    expect(html).toContain("Unverified");
    expect(html).toContain("text-text-muted");
    expect(html).not.toContain("0.0%");
    expect(html).not.toContain("Figures may be out of sync");
  });

  it("renders real measured 0.0% and computed average when engine reports valid dimensions", () => {
    const activeMetrics: EngineMetricsResponse = {
      engineHealth: {
        status: "ONLINE",
        appName: "LuminAI Data Engine",
        version: "0.1.0",
        latencyMs: 8,
        message: "Reachable",
      },
      pipelineStats: {
        totalRuns: 15,
        successRate: 100,
        avgDuration: 3.45,
        recordsProcessed: 12000,
      },
      dataQuality: {
        completeness: 95.0,
        uniqueness: 0, // real measured 0%
        consistency: 91.0,
        timeliness: 86.0,
        recordsEvaluated: 12000,
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(SystemHealthSectionContent, {
        engineMetrics: activeMetrics,
      }),
    );

    expect(html).toContain("95.0%");
    expect(html).toContain("0.0%");
    expect(html).toContain("91.0%");
    expect(html).toContain("86.0%");
    expect(html).toContain("68.0%"); // (95 + 0 + 91 + 86) / 4
    expect(html).not.toContain(">N/A<");
  });

  it("shows specific staleness notice with Refresh action when data is stale", () => {
    const now = 1_700_000_000_000;
    const html = renderToStaticMarkup(
      React.createElement(SystemHealthSectionContent, {
        engineMetrics: {
          engineHealth: {
            status: "ONLINE",
            appName: "LuminAI Data Engine",
            version: "0.1.0",
            latencyMs: 7,
            message: "Reachable",
          },
        },
        dataUpdatedAt: now - 12 * 60_000,
        nowMs: now,
        onRefresh: () => { },
      }),
    );

    expect(html).toContain("Engine data last updated 12 min ago");
    expect(html).toContain("Refresh");
  });
});
