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
  }),
}));

import { AppShellNotFound } from "../components/layout/AppShellNotFound";
import { PipelinePage } from "../pages/connections/PipelinePage";
import { PipelineMonitor } from "../features/connections/components/PipelineMonitor";

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
});
