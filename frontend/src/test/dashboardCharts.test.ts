import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children?: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href: to, className }, children),
}));

import { PipelineTimelineChart } from "../pages/dashboard/components/PipelineTimelineChart";
import { formatDateLabel } from "../pages/dashboard/components/dashboardChartUtils";
import { EntityBreakdownChart } from "../pages/dashboard/components/EntityBreakdownChart";

describe("Dashboard Charts - formatDateLabel", () => {
  it("formats ISO date strings (YYYY-MM-DD) as short month and day", () => {
    const formatted = formatDateLabel("2026-11-11");
    expect(formatted).toBe("Nov 11");
  });

  it("formats MM-DD date strings as short month and day", () => {
    const formatted = formatDateLabel("11-11");
    expect(formatted).toBe("Nov 11");
  });

  it("handles ISO timestamps with timezone", () => {
    const formatted = formatDateLabel("2026-05-20T00:00:00Z");
    expect(formatted).toBe("May 20");
  });
});

describe("PipelineTimelineChart Empty & Populated States", () => {
  it("renders empty state overlay with text and secondary button when data is all zeroes", () => {
    const zeroData = [
      { date: "2026-11-09", entityCount: 0, pipelineRuns: 0 },
      { date: "2026-11-10", entityCount: 0, pipelineRuns: 0 },
      { date: "2026-11-11", entityCount: 0, pipelineRuns: 0 },
    ];

    const html = renderToStaticMarkup(
      React.createElement(PipelineTimelineChart, {
        data: zeroData,
        isLoading: false,
        timeRange: "7d",
      }),
    );

    // Empty state message
    expect(html).toContain("No pipeline runs in the last 7 days");
    // Working button linking to /connections
    expect(html).toContain("Connect a data source");
    expect(html).toContain('href="/connections"');
    // Accessible aria-label
    expect(html).toContain("No pipeline runs or resolved entities");
  });

  it("reflects selected time range in empty state message", () => {
    const html30 = renderToStaticMarkup(
      React.createElement(PipelineTimelineChart, {
        data: [],
        isLoading: false,
        timeRange: "30d",
      }),
    );
    expect(html30).toContain("No pipeline runs in the last 30 days");

    const html14 = renderToStaticMarkup(
      React.createElement(PipelineTimelineChart, {
        data: [],
        isLoading: false,
        timeRange: "14d",
      }),
    );
    expect(html14).toContain("No pipeline runs in the last 14 days");
  });

  it("renders populated aria-label and suppresses empty state overlay when data is present", () => {
    const sampleData = [
      { date: "2026-11-09", entityCount: 10, pipelineRuns: 2 },
      { date: "2026-11-10", entityCount: 20, pipelineRuns: 3 },
      { date: "2026-11-11", entityCount: 30, pipelineRuns: 5 },
    ];

    const html = renderToStaticMarkup(
      React.createElement(PipelineTimelineChart, {
        data: sampleData,
        isLoading: false,
        timeRange: "7d",
      }),
    );

    expect(html).not.toContain("No pipeline runs in the last");
    expect(html).not.toContain("Connect a data source");
    expect(html).toContain(
      'aria-label="Pipeline throughput and entity growth over the last 7 days: 60 resolved entities and 10 pipeline runs."',
    );
  });
});

describe("EntityBreakdownChart Empty & Populated States", () => {
  it("renders center count '0', 'entities indexed', and 'No data yet' in legend area when empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(EntityBreakdownChart, {
        data: {},
        isLoading: false,
      }),
    );

    // Center count 0
    expect(html).toContain(">0<");
    // Center label "entities indexed"
    expect(html).toContain("entities indexed");
    // Legend area shows "No data yet"
    expect(html).toContain("No data yet");
    // Old ambiguous text should NOT exist
    expect(html).not.toContain("No entity records indexed yet");
    // Accessible aria-label
    expect(html).toContain('aria-label="Entity type distribution: no data."');
  });

  it("renders total formatted count and suppresses 'No data yet' when populated", () => {
    const html = renderToStaticMarkup(
      React.createElement(EntityBreakdownChart, {
        data: {
          Customer: 1200,
          Organization: 50,
        },
        isLoading: false,
      }),
    );

    // Center total is 1,250
    expect(html).toContain("1,250");
    expect(html).toContain("entities indexed");
    // "No data yet" is NOT rendered
    expect(html).not.toContain("No data yet");
    // Accessible aria-label
    expect(html).toContain(
      'aria-label="Entity type distribution: 1,250 entities indexed across 2 types."',
    );
  });
});
