import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    hash,
    children,
    className,
    tabIndex,
    ...rest
  }: {
    to: string;
    hash?: string;
    children?: React.ReactNode;
    className?: string;
    tabIndex?: number;
  }) => {
    const fullHref = hash ? `${to}#${hash}` : to;
    return React.createElement(
      "a",
      { href: fullHref, className, tabIndex, ...rest },
      children,
    );
  },
}));

import {
  ActivityFeed,
  type ActivityItem,
} from "../pages/dashboard/components/ActivityFeed";
import {
  getActivityTargetRoute,
  formatRelativeTime,
  formatActivitySubtitle,
  getActivityTitleInfo,
  resolveActivityStatus,
} from "../pages/dashboard/components/activityFeedUtils";
import { DashboardQuickActions } from "../pages/dashboard/components/DashboardQuickActions";
import type { DashboardSummary } from "../pages/dashboard/dashboardTypes";

describe("Dashboard ActivityFeed Component", () => {
  it("renders empty state with 'No activity yet' and 'Connect a data source' button when empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityFeed, { activities: [], isLoading: false }),
    );

    // Empty state heading check
    expect(html).toContain("No activity yet");

    // "Connect a data source" button check
    expect(html).toContain("Connect a data source");
    expect(html).toContain('href="/connections"');

    // Friendly description check
    expect(html).toContain("Connect a data source to begin running pipelines");
  });

  it("renders loading skeletons when isLoading is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityFeed, { activities: [], isLoading: true }),
    );

    expect(html).toContain('data-testid="activity-feed-loading"');
    expect(html).not.toContain("No activity yet");
  });

  it("renders rows as keyboard focusable links with focus rings", () => {
    const mockActivities: ActivityItem[] = [
      {
        id: "run-abc12345",
        type: "PIPELINE_RUN",
        title: "Customer Ingest Run",
        description: "Processed 12,000 records successfully.",
        timestamp: new Date().toISOString(),
        status: "RUNNING",
      },
      {
        id: "conn-def67890",
        type: "CONNECTION_CREATE",
        title: "Connector Registered: PostgreSQL",
        description: "Source connector configured.",
        timestamp: new Date().toISOString(),
        status: "SUCCESS",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(ActivityFeed, {
        activities: mockActivities,
        isLoading: false,
      }),
    );

    // Both rows must be links with hrefs
    expect(html).toContain(
      'href="/connections/pipelines#pipeline-job-abc12345"',
    );
    expect(html).toContain('href="/connections"');

    // Must be keyboard focusable (tabIndex="0") and have focus ring classes
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("focus-visible:ring-primary");

    // Status badges & secondary tag
    expect(html).toContain("Running");
    expect(html).toContain("Completed");
    expect(html).toContain("File ingestion");

    // Never says "successfully" when quarantined/rejected are not both 0
    expect(html).not.toContain("successfully");
    expect(html).toContain("12,000 records processed");
  });

  it("shows dataset name, Untitled dataset fallback with run ID, counts subtitle, and all 5 status badges", () => {
    const items: ActivityItem[] = [
      {
        id: "run-1111aaaa",
        type: "PIPELINE_RUN",
        title: "Data Run",
        datasetName: "orders_2026.csv",
        description: "Processed 500 records successfully.",
        recordsLoaded: 480,
        recordsQuarantined: 12,
        recordsRejected: 8,
        timestamp: "2026-11-24T10:00:00Z",
        status: "SUCCESS",
      },
      {
        id: "run-2222bbbb",
        type: "PIPELINE_RUN",
        title: "Data Run",
        description: "Pipeline execution initiated.",
        timestamp: "2026-11-24T09:00:00Z",
        status: "QUEUED",
      },
      {
        id: "run-3333cccc",
        type: "PIPELINE_RUN",
        title: "invoices.csv",
        description: "Schema mismatch",
        timestamp: "2026-11-24T08:00:00Z",
        status: "FAILED",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(ActivityFeed, {
        activities: items,
        isLoading: false,
      }),
    );

    expect(html).toContain("orders_2026.csv");
    expect(html).toContain("Loaded 480 - Quarantined 12 - Rejected 8");
    expect(html).toContain("Completed with issues");
    expect(html).not.toContain("successfully");

    expect(html).toContain("Untitled dataset");
    expect(html).toContain("#2222bbbb");
    expect(html).toContain("Queued");
    expect(html).toContain("Failed");
    expect(html).toContain("<time");

    expect(resolveActivityStatus(items[0])).toBe("COMPLETED_WITH_ISSUES");
    expect(resolveActivityStatus(items[1])).toBe("QUEUED");
    expect(getActivityTitleInfo(items[1]).title).toBe("Untitled dataset");
    expect(formatActivitySubtitle(items[0])).toBe(
      "Loaded 480 - Quarantined 12 - Rejected 8",
    );
  });

  it("limits display to 6 items and provides 'View all runs' link to Pipeline Monitor", () => {
    const eightActivities: ActivityItem[] = Array.from(
      { length: 8 },
      (_, i) => ({
        id: `run-${i + 1}`,
        type: "PIPELINE_RUN",
        title: `Pipeline Run #${i + 1}`,
        description: `Description ${i + 1}`,
        timestamp: new Date().toISOString(),
        status: "SUCCESS",
      }),
    );

    const html = renderToStaticMarkup(
      React.createElement(ActivityFeed, {
        activities: eightActivities,
        isLoading: false,
        limit: 6,
      }),
    );

    // Only 6 rows should be rendered
    expect(html).toContain("Pipeline Run #1");
    expect(html).toContain("Pipeline Run #6");
    expect(html).not.toContain("Pipeline Run #7");
    expect(html).not.toContain("Pipeline Run #8");

    // Showing 6 of 8 runs counter
    expect(html).toContain("Showing 6 of 8 runs");

    // "View all runs" link to Pipeline Monitor
    expect(html).toContain("View all runs");
    expect(html).toContain('href="/connections/pipelines"');

    // Must NOT have inner scroll container or overscroll containment that traps page scroll
    expect(html).not.toContain("[overscroll-behavior:contain]");
    expect(html).not.toContain("overflow-y-auto");
    expect(html).not.toContain("max-h-[360px]");
  });

  it("resolves correct target routes for various activity types", () => {
    const base = {
      title: "Run",
      description: "",
      timestamp: "",
      status: "SUCCESS",
    };
    expect(
      getActivityTargetRoute({
        ...base,
        id: "run-98765432",
        type: "PIPELINE_RUN",
      }),
    ).toEqual({
      to: "/connections/pipelines",
      hash: "pipeline-job-98765432",
    });
    expect(
      getActivityTargetRoute({
        ...base,
        id: "conn-111",
        type: "CONNECTION_CREATE",
      }),
    ).toEqual({
      to: "/connections",
    });
    expect(
      getActivityTargetRoute({ ...base, id: "sync-222", type: "ENTITY_SYNC" }),
    ).toEqual({
      to: "/explorer",
    });
    expect(
      getActivityTargetRoute({
        ...base,
        id: "onto-333",
        type: "ONTOLOGY_UPDATE",
      }),
    ).toEqual({
      to: "/ontology",
    });
  });

  it("formats relative time correctly", () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe("just now");

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    expect(formatRelativeTime(tenMinutesAgo.toISOString())).toBe("10m ago");

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe("2h ago");
  });
});

describe("DashboardQuickActions Component", () => {
  it("renders 4 quick-link cards matching sidebar names, sentence case, and optional API counts", () => {
    const mockSummary: DashboardSummary = {
      totalEntities: 1420,
      totalConnections: 4,
      totalPipelines: 18,
      entityBreakdown: {},
      recentActivity: [],
      dataQualityScore: 98,
      pipelineHealth: { running: 0, completed: 18, failed: 0 },
      lastSyncAt: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(DashboardQuickActions, { summary: mockSummary }),
    );

    // Sentence case heading, no "Direct Shortcuts"
    expect(html).toContain("Quick navigation");
    expect(html).not.toContain("Direct Shortcuts");

    // Card titles matching sidebarConfig.tsx
    expect(html).toContain("Data Connections");
    expect(html).toContain("Pipeline Monitor");
    expect(html).toContain("Knowledge Graph");
    expect(html).toContain("Ontology Manager");
    expect(html).not.toContain("Data Model &amp; Ontology");

    // Routes
    expect(html).toContain('href="/connections"');
    expect(html).toContain('href="/connections/pipelines"');
    expect(html).toContain('href="/graph"');
    expect(html).toContain('href="/ontology"');

    // Muted counts from API summary
    expect(html).toContain("4 sources");
    expect(html).toContain("18 runs");
    expect(html).toContain("1,420 entities");

    // Accessibility focus rings
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("focus-visible:ring-primary");

    // Category pills in sentence case
    expect(html).toContain("Ingestion");
    expect(html).toContain("Telemetry");
    expect(html).toContain("Relationships");
    expect(html).toContain("Schema");
  });
});
