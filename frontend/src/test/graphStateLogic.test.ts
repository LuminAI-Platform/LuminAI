import { describe, it, expect } from "vitest";
import {
  computeGraphBadge,
  deriveGraphViewState,
  filterGraphElements,
  extractGraphErrorInfo,
} from "../pages/graph/useGraphData";

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

    const unfiltered = filterGraphElements(graph, null, null);
    expect(unfiltered.nodes.map((n) => n.data.id)).toEqual(["n1", "n2", "n3"]);
    expect(unfiltered.edges).toHaveLength(1);

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
