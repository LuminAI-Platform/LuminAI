import { describe, it, expect } from "vitest";
import {
  computeGraphBadge,
  deriveGraphViewState,
  filterGraphElements,
  mergeGraphElements,
  extractGraphErrorInfo,
} from "../pages/graph/useGraphData";
import { mapExplorerItemsToSuggestions } from "../pages/graph/graphDataUtils";

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
        activeEntityId: null,
        catalogTotal: 57,
        nodeCount: 5,
        edgeCount: 4,
      }),
    ).toBe("loaded");

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

  it("incrementally merges 1-hop expansion elements without losing existing context or creating duplicates", () => {
    const current = {
      nodes: [
        { data: { id: "gr-1", label: "Alice", entityType: "Person" } },
        { data: { id: "gr-2", label: "Acme", entityType: "Organization" } },
      ],
      edges: [
        {
          data: {
            id: "e-1",
            source: "gr-1",
            target: "gr-2",
            relationshipType: "WORKS_AT",
          },
        },
      ],
    };

    const incoming = {
      nodes: [
        {
          data: {
            id: "gr-2",
            label: "Acme Corp",
            entityType: "Organization",
            properties: { industry: "Tech" },
          },
        },
        { data: { id: "gr-3", label: "Bob", entityType: "Person" } },
      ],
      edges: [
        {
          data: {
            id: "alt-dup-id",
            source: "gr-1",
            target: "gr-2",
            relationshipType: "WORKS_AT",
          },
        },
        {
          data: {
            id: "e-2",
            source: "gr-2",
            target: "gr-3",
            relationshipType: "EMPLOYS",
          },
        },
      ],
    };

    const merged = mergeGraphElements(current, incoming);
    expect(merged.nodes.map((n) => n.data.id)).toEqual([
      "gr-1",
      "gr-2",
      "gr-3",
    ]);
    expect(merged.nodes[1].data.label).toBe("Acme Corp");
    expect(merged.nodes[1].data.properties).toEqual({ industry: "Tech" });
    expect(merged.edges).toHaveLength(2);
    expect(merged.edges.map((e) => e.data.relationshipType)).toEqual([
      "WORKS_AT",
      "EMPLOYS",
    ]);
  });

  it("maps explorer items into suggestions using entityLabel property resolution", () => {
    const result = mapExplorerItemsToSuggestions({
      items: [
        {
          id: "gr-a",
          canonicalName: "Entity gr-a",
          entityType: "Person",
          properties: { full_name: "Dr. Elena Vance" },
        },
        {
          id: "gr-b",
          canonicalName: "24",
          entityType: "Invoice",
          properties: { invoice_number: "INV-9001" },
        },
      ],
      total: 42,
      facets: { entityType: { Person: 20, Invoice: 22 } },
    });

    expect(result.total).toBe(42);
    expect(result.facetTypes).toEqual(["Person", "Invoice"]);
    expect(result.items).toEqual([
      {
        id: "gr-a",
        canonicalName: "Dr. Elena Vance",
        entityType: "Person",
      },
      {
        id: "gr-b",
        canonicalName: "Invoice number: INV-9001",
        entityType: "Invoice",
      },
    ]);
  });
});
