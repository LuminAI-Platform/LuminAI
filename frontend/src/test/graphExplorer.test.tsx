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

import {
  computeGraphBadge,
  deriveGraphViewState,
  filterGraphElements,
  extractGraphErrorInfo,
} from "../pages/graph/useGraphData";
import {
  GraphOverlays,
  GraphNodeListPanel,
} from "../pages/graph/components/GraphOverlays";
import { GraphControls } from "../pages/graph/components/GraphControls";
import { GraphSearchBar } from "../pages/graph/components/GraphSearchBar";
import { TooltipProvider } from "../components/ui/Tooltip";

describe("Knowledge Graph Explorer — Badge & State Logic", () => {
  it("computes honest badge labels for Ready, Loaded, and Unavailable states", () => {
    expect(
      computeGraphBadge({
        hasError: false,
        hasActiveEntity: false,
        isLoading: false,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toEqual({ label: "Ready", variant: "zinc" });

    expect(
      computeGraphBadge({
        hasError: false,
        hasActiveEntity: true,
        isLoading: false,
        nodeCount: 4,
        edgeCount: 3,
      }),
    ).toEqual({ label: "Graph loaded - 4 nodes, 3 edges", variant: "emerald" });

    expect(
      computeGraphBadge({
        hasError: false,
        hasActiveEntity: true,
        isLoading: false,
        nodeCount: 1,
        edgeCount: 0,
      }),
    ).toEqual({ label: "Graph loaded - 1 nodes, 0 edges", variant: "emerald" });

    expect(
      computeGraphBadge({
        hasError: true,
        hasActiveEntity: true,
        isLoading: false,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toEqual({ label: "Graph unavailable", variant: "error" });
  });

  it("derives explicit view states and never leaves an unexplained blank canvas", () => {
    expect(
      deriveGraphViewState({
        isLoading: true,
        hasError: false,
        activeEntityId: "e-1",
        catalogTotal: 10,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("loading");

    expect(
      deriveGraphViewState({
        isLoading: false,
        hasError: true,
        activeEntityId: "e-1",
        catalogTotal: 10,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("error");

    expect(
      deriveGraphViewState({
        isLoading: false,
        hasError: false,
        activeEntityId: null,
        catalogTotal: 0,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("empty_catalog");

    expect(
      deriveGraphViewState({
        isLoading: false,
        hasError: false,
        activeEntityId: null,
        catalogTotal: 57,
        nodeCount: 0,
        edgeCount: 0,
      }),
    ).toBe("idle");

    expect(
      deriveGraphViewState({
        isLoading: false,
        hasError: false,
        activeEntityId: "e-1",
        catalogTotal: 57,
        nodeCount: 1,
        edgeCount: 0,
      }),
    ).toBe("loaded_isolated");

    expect(
      deriveGraphViewState({
        isLoading: false,
        hasError: false,
        activeEntityId: "e-1",
        catalogTotal: 57,
        nodeCount: 3,
        edgeCount: 2,
      }),
    ).toBe("loaded");
  });

  it("preserves isolated nodes and drops dangling edges when filtering by entity type", () => {
    const graph = {
      nodes: [
        { data: { id: "n1", label: "Alice", entityType: "Person" } },
        { data: { id: "n2", label: "Dr. Adams", entityType: "Physician" } },
        { data: { id: "n3", label: "Solo Bob", entityType: "Person" } },
      ],
      edges: [
        {
          data: {
            id: "e1",
            source: "n1",
            target: "n2",
            relationshipType: "TREATED_BY",
          },
        },
      ],
    };

    // Unfiltered: isolated node n3 is preserved
    const unfiltered = filterGraphElements(graph, null, null);
    expect(unfiltered.nodes.map((n) => n.data.id)).toEqual(["n1", "n2", "n3"]);
    expect(unfiltered.edges).toHaveLength(1);

    // Filtered to Person: n1 and n3 stay, dangling edge n1->n2 is removed safely
    const personOnly = filterGraphElements(graph, "Person", null);
    expect(personOnly.nodes.map((n) => n.data.id)).toEqual(["n1", "n3"]);
    expect(personOnly.edges).toHaveLength(0);
  });

  it("extracts status code and message from errors", () => {
    const info = extractGraphErrorInfo(new Error("Connection refused"));
    expect(info.statusCode).toBeNull();
    expect(info.message).toBe("Connection refused");
  });
});

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
  it("renders full placeholder and disables Load when input is empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphSearchBar, {
        onSearch: () => {},
        isLoading: false,
      }),
    );
    expect(html).toContain('placeholder="Search entity name or ID"');
    expect(html).toContain('type="submit"');
    expect(html).toContain("disabled");
    expect(html).toContain("Load");
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
});
