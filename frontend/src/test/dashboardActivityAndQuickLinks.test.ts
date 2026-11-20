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
} from "../pages/dashboard/components/activityFeedUtils";
import { DashboardQuickActions } from "../pages/dashboard/components/DashboardQuickActions";

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

    // Status badges
    expect(html).toContain("Running");
    expect(html).toContain("Completed");
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
    expect(
      getActivityTargetRoute({
        id: "run-98765432",
        type: "PIPELINE_RUN",
        title: "Run",
        description: "",
        timestamp: "",
        status: "SUCCESS",
      }),
    ).toEqual({
      to: "/connections/pipelines",
      hash: "pipeline-job-98765432",
    });

    expect(
      getActivityTargetRoute({
        id: "conn-111",
        type: "CONNECTION_CREATE",
        title: "Conn",
        description: "",
        timestamp: "",
        status: "SUCCESS",
      }),
    ).toEqual({ to: "/connections" });

    expect(
      getActivityTargetRoute({
        id: "sync-222",
        type: "ENTITY_SYNC",
        title: "Sync",
        description: "",
        timestamp: "",
        status: "SUCCESS",
      }),
    ).toEqual({ to: "/explorer" });

    expect(
      getActivityTargetRoute({
        id: "onto-333",
        type: "ONTOLOGY_UPDATE",
        title: "Onto",
        description: "",
        timestamp: "",
        status: "SUCCESS",
      }),
    ).toEqual({ to: "/ontology" });
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
  it("renders 4 quick-link cards with keyboard accessible focus rings", () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardQuickActions),
    );

    // Cards titles
    expect(html).toContain("Data Connections");
    expect(html).toContain("Pipeline Monitor");
    expect(html).toContain("Knowledge Graph");
    expect(html).toContain("Data Model &amp; Ontology");

    // Routes
    expect(html).toContain('href="/connections"');
    expect(html).toContain('href="/connections/pipelines"');
    expect(html).toContain('href="/graph"');
    expect(html).toContain('href="/ontology"');

    // Accessibility focus rings
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("focus-visible:ring-primary");

    // Category pills
    expect(html).toContain("Ingestion");
    expect(html).toContain("Telemetry");
    expect(html).toContain("Relationships");
    expect(html).toContain("Schema");
  });
});
