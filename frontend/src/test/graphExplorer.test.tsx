import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

import {
  GraphOverlays,
  GraphNodeListPanel,
} from "../pages/graph/components/GraphOverlays";
import { GraphControls } from "../pages/graph/components/GraphControls";
import { GraphSearchBar } from "../pages/graph/components/GraphSearchBar";
import { GraphPathBar } from "../pages/graph/components/GraphPathBar";
import { NodeDetailPanel } from "../pages/graph/components/NodeDetailPanel";
import { PageHeader } from "../components/layout/PageHeader";
import { TooltipProvider } from "../components/ui/Tooltip";

describe("Knowledge Graph Explorer — Canvas State Overlays", () => {
  const baseProps = {
    activeEntityId: null as string | null,
    activeEntityLabel: null as string | null,
    suggestedEntities: [
      { id: "1", canonicalName: "John Doe", entityType: "Person" },
      { id: "2", canonicalName: "Jane Smith", entityType: "Person" },
      { id: "3", canonicalName: "Acme Corp", entityType: "Organization" },
      { id: "4", canonicalName: "Cardiology", entityType: "Department" },
      { id: "5", canonicalName: "Aetna Health", entityType: "Insurer" },
    ],
    errorInfo: null,
    onSelectEntity: () => {},
    onClearEntity: () => {},
    onRetry: () => {},
  };

  it("renders Loading state with 'Loading graph...'", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphOverlays, {
        ...baseProps,
        viewState: "loading",
      }),
    );
    expect(html).toContain("Loading graph...");
  });

  it("renders Idle state with 'Choose an entity to explore' and 5 clickable suggestions", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphOverlays, { ...baseProps, viewState: "idle" }),
    );
    expect(html).toContain("Choose an entity to explore");
    expect(html).toContain("John Doe");
    expect(html).toContain("Jane Smith");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Cardiology");
    expect(html).toContain("Aetna Health");
  });

  it("renders Empty Catalog state with 'The graph is empty' and 'Connect a data source'", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphOverlays, {
        ...baseProps,
        suggestedEntities: [],
        viewState: "empty_catalog",
      }),
    );
    expect(html).toContain("The graph is empty");
    expect(html).toContain("Connect a data source");
    expect(html).toContain("/connections");
  });

  it("renders Isolated Entity notice with Data Connections link", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphOverlays, {
        ...baseProps,
        activeEntityId: "1",
        viewState: "loaded_isolated",
      }),
    );
    expect(html).toContain(
      "This entity has no relationships yet. Map relationships during ingestion.",
    );
    expect(html).toContain("Data Connections");
    expect(html).toContain("/connections");
  });

  it("renders Error state with collapsed status details and Retry button", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphOverlays, {
        ...baseProps,
        viewState: "error",
        errorInfo: { statusCode: 503, message: "Service Unavailable" },
      }),
    );
    expect(html).toContain("Couldn&#x27;t load the graph");
    expect(html).toContain("<details");
    expect(html).toContain("503");
    expect(html).toContain("Retry");
  });

  it("renders keyboard-accessible node list buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphNodeListPanel, {
        nodes: [
          { data: { id: "n1", label: "John Doe", entityType: "Person" } },
          {
            data: { id: "n2", label: "Acme Corp", entityType: "Organization" },
          },
        ],
        selectedNodeId: "n1",
        onSelectNode: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain("Graph Nodes (2)");
    expect(html).toContain("John Doe");
    expect(html).toContain("Acme Corp");
    expect(html).toContain('aria-current="true"');
  });
});

describe("Knowledge Graph Explorer — Search & Toolbar Accessibility", () => {
  it("renders full placeholder with non-shrinking width and disables Load when input is empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphSearchBar, {
        onSearch: () => {},
        isLoading: false,
      }),
    );
    expect(html).toContain('placeholder="Search entity name or ID"');
    expect(html).toContain("w-80");
    expect(html).toContain("min-w-[288px]");
    expect(html).toContain("shrink-0");
    expect(html).toContain('type="submit"');
    expect(html).toContain("disabled");
    expect(html).toContain("Load");
  });

  it("renders PageHeader with single-line title and badge, 2-line description, and 1400px container query stacking", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageHeader, {
        breadcrumbs: [
          { label: "Explore & Overview", to: "/" },
          { label: "Knowledge Graph" },
        ],
        title: "Knowledge Graph Explorer",
        description:
          "Explore entity relationships, connected graph clusters, and relationship pathways.",
        badge: { label: "Graph unavailable", variant: "error" },
        stackActionsBelowWide: true,
        actions: React.createElement("div", null, "Controls"),
      }),
    );
    expect(html).toContain("@container");
    expect(html).toContain("@[1400px]:flex-row");
    expect(html).toContain("justify-start");
    expect(html).toContain("flex-nowrap");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("truncate");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("Knowledge Graph Explorer");
    expect(html).toContain("Graph unavailable");
  });

  it("disables zoom, fit, reset, and layout controls when nothing is loaded and includes aria-labels", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(GraphControls, {
          layoutType: "cose",
          onChangeLayout: () => {},
          onZoomIn: () => {},
          onZoomOut: () => {},
          onFit: () => {},
          onReset: () => {},
          disabled: true,
        }),
      ),
    );
    expect(html).toContain('aria-label="Zoom in"');
    expect(html).toContain('aria-label="Zoom out"');
    expect(html).toContain('aria-label="Fit graph to view"');
    expect(html).toContain('aria-label="Reset layout"');
    expect(html).toContain("Force");
    expect(html).toContain("Circle");
    expect(html).toContain("Concentric");
    expect(html).toContain("Tree");
    expect(html).toContain("disabled");
  });

  it("renders Shortest Path bar with path summary and error banner when open", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphPathBar, {
        isOpen: true,
        canvasNodes: [
          { data: { id: "n1", label: "Alice", entityType: "Person" } },
          { data: { id: "n2", label: "Acme", entityType: "Organization" } },
        ],
        isFinding: false,
        pathResult: {
          sourceId: "n1",
          targetId: "n2",
          nodeCount: 3,
          edgeCount: 2,
        },
        pathError: null,
        onFindPath: async () => {},
        onClearPath: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain("Shortest Path");
    expect(html).toContain("Find Path");
    expect(html).toContain("3 nodes");
    expect(html).toContain("2 hops");
    expect(html).toContain("Exit Path");
  });

  it("renders NodeDetailPanel with properties, 1-hop expand action, and path starter", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(NodeDetailPanel, {
          node: {
            id: "gr-123",
            label: "Alice Smith",
            entityType: "Person",
            properties: { role: "Engineer" },
          },
          onClose: () => {},
          onExpand: () => {},
          onFindPathFrom: () => {},
        }),
      ),
    );
    expect(html).toContain("Alice Smith");
    expect(html).toContain("Expand Node (1 Hop)");
    expect(html).toContain("Find Shortest Path From Here");
    expect(html).toContain("Engineer");
  });
});
