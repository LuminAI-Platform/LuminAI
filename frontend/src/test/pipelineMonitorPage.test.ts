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

// Mock apiFetch for tests
vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("../features/connections/hooks/usePipelineStream", () => ({
  usePipelineStream: () => ({
    isConnected: false,
    isPolling: false,
    errors: [],
    clearErrors: () => {},
    reconnect: () => {},
  }),
}));

import { AppShellNotFound } from "../components/layout/AppShellNotFound";
import { PipelinePage } from "../pages/connections/PipelinePage";
import { PipelineMonitor } from "../features/connections/components/PipelineMonitor";
import { ConnectionDot } from "../features/connections/components/pipeline-monitor/pipelineMonitorTypes";
import { ThroughputGauge } from "../features/connections/components/pipeline-monitor/ThroughputGauge";
import { PipelineKpis } from "../features/connections/components/pipeline-monitor/PipelineKpis";
import { AnalysisSummaryCards } from "../features/connections/components/pipeline-analysis/AnalysisSummaryCards";
import { DataQualityPanel } from "../features/connections/components/pipeline-analysis/DataQualityPanel";
import { StageBreakdownPanel } from "../features/connections/components/pipeline-analysis/StageBreakdownPanel";
import { TopIssuesPanel } from "../features/connections/components/pipeline-analysis/TopIssuesPanel";

describe("AppShellNotFound Component", () => {
  it("renders heading, one-line explanation, and Back to Dashboard button", () => {
    const html = renderToStaticMarkup(React.createElement(AppShellNotFound));

    expect(html).toContain("Page Not Found");
    expect(
      html.includes(
        "The page you are looking for does not exist or may have been moved.",
      ),
    ).toBe(true);
    expect(html).toContain("Back to Dashboard");
    expect(html).toContain('href="/"');
  });
});

describe("PipelinePage & PipelineMonitor Empty State", () => {
  it("renders page title, 'No pipelines yet' message, and 'Create a connection' button linking to /connections", () => {
    const html = renderToStaticMarkup(React.createElement(PipelinePage));

    // Page title
    expect(html).toContain("Pipeline Monitor");
    // Empty state message
    expect(html).toContain("No pipelines yet");
    // Primary button
    expect(html).toContain("Create a connection");
    expect(html).toContain('href="/connections"');
    // Two tabs
    expect(html).toContain("Live Telemetry");
    expect(html).toContain("Analysis");
    // Disconnected warning badge when stream is disconnected
    expect(html).toContain("Live feed disconnected");
  });

  it("renders populated telemetry view when jobs exist", () => {
    const sampleJobs = [
      {
        id: "job-1",
        connectorName: "Postgres Ingestion",
        connectorType: "POSTGRESQL",
        status: "RUNNING" as const,
        progress: 45,
        throughput: 1250,
        recordsInput: 10000,
        recordsOutput: 4500,
        recordsFailed: 0,
        startedAt: "2026-11-17T12:00:00Z",
        completedAt: null,
        durationSeconds: 120,
        errors: [],
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(PipelineMonitor, {
        initialJobs: sampleJobs,
        initialLoading: false,
      }),
    );

    expect(html).toContain("Live Pipeline Telemetry");
    expect(html).toContain("Postgres Ingestion");
    expect(html).not.toContain("No pipelines yet");
  });

  it("ConnectionDot renders 'Live feed disconnected' with Reconnect button and fallback polling note when disconnected", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConnectionDot, {
        connected: false,
        polling: false,
        onReconnect: () => {},
        fallbackNote: "polling every 30s",
      }),
    );

    expect(html).toContain("Live feed disconnected");
    expect(html).toContain("Reconnect");
    expect(html).toContain("polling every 30s");
  });

  it("ThroughputGauge renders scale labels for 0 and max rec/s", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThroughputGauge, {
        value: 12500,
        max: 50000,
      }),
    );

    expect(html).toContain(">0<");
    expect(html).toContain("50.0K/s");
  });

  it("PipelineKpis shows 'No records processed yet' when empty, never misleading 'All records clean'", () => {
    const html = renderToStaticMarkup(
      React.createElement(PipelineKpis, {
        jobs: [],
        counts: { RUNNING: 0, ALL: 0 },
      }),
    );

    expect(html).toContain("No records processed yet");
    expect(html).not.toContain("All records clean");
    expect(html).not.toContain(">–<");
  });

  it("AnalysisSummaryCards shows 'No runs yet' when empty, never bare 0% or 'All clean'", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnalysisSummaryCards, {
        pipelineStats: {
          totalRuns: 0,
          successRate: 0,
          avgDuration: 0,
          recordsProcessed: 0,
        },
      }),
    );

    expect(html).toContain("No runs yet");
    expect(html).not.toContain(">0%<");
  });

  it("DataQualityPanel shows '–' and 'No records evaluated' when nothing was evaluated", () => {
    const html = renderToStaticMarkup(
      React.createElement(DataQualityPanel, {
        dataQuality: {
          overallScore: 0,
          completeness: 0,
          uniqueness: 0,
          consistency: 0,
          timeliness: 0,
        },
        recordsEvaluated: 0,
      }),
    );

    expect(html).toContain("No records evaluated");
    expect(html).toContain(">–<");
  });

  it("StageBreakdownPanel renders cleaning stages and highlights slowest and highest drop", () => {
    const sampleStages = [
      {
        stage: "ingest" as const,
        label: "Data Ingest",
        recordsIn: 10000,
        recordsOut: 10000,
        dropped: 0,
        durationSeconds: 15,
      },
      {
        stage: "clean" as const,
        label: "Data Cleaning",
        recordsIn: 10000,
        recordsOut: 9000,
        dropped: 1000,
        durationSeconds: 45,
        isSlowest: true,
        isHighestDrop: true,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(StageBreakdownPanel, {
        stages: sampleStages,
      }),
    );

    expect(html).toContain("Data Ingest");
    expect(html).toContain("Data Cleaning");
    expect(html).toContain("Slowest Stage");
    expect(html).toContain("Highest Drop");
  });

  it("TopIssuesPanel renders clean state when no issues, and issues list when errors present", () => {
    const cleanHtml = renderToStaticMarkup(
      React.createElement(TopIssuesPanel, {
        topReasons: [],
        failingPipelines: [],
      }),
    );
    expect(cleanHtml).toContain("No rejection issues or failed runs");

    const issuesHtml = renderToStaticMarkup(
      React.createElement(TopIssuesPanel, {
        topReasons: [{ reason: "Schema mismatch on email", count: 42 }],
        failingPipelines: [
          { pipelineId: "p1", pipelineName: "CRM Sync", failureCount: 3 },
        ],
      }),
    );
    expect(issuesHtml).toContain("Schema mismatch on email");
    expect(issuesHtml).toContain("CRM Sync");
    expect(issuesHtml).toContain("42 dropped");
    expect(issuesHtml).toContain("3 failed");
  });
});
