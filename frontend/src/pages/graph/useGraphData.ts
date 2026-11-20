import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Core } from "cytoscape";
import { apiFetch } from "../../lib/api";
import type {
  GraphElements,
  GraphNodeData,
  GraphLayoutType,
} from "./components/GraphCanvas";
import {
  type GraphResponse,
  type SuggestedEntity,
  type CatalogSummary,
  type GraphErrorInfo,
  type GraphViewState,
  type GraphBadgeInfo,
  extractGraphErrorInfo,
  filterGraphElements,
  computeGraphBadge,
  deriveGraphViewState,
  getSearchParamEntityId,
} from "./graphDataUtils";

export {
  type GraphResponse,
  type SuggestedEntity,
  type CatalogSummary,
  type GraphErrorInfo,
  type GraphViewState,
  type GraphBadgeInfo,
  extractGraphErrorInfo,
  filterGraphElements,
  computeGraphBadge,
  deriveGraphViewState,
};

export function useGraphData() {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    getSearchParamEntityId,
  );
  const [selectedEntityLabel, setSelectedEntityLabel] = useState<string | null>(
    null,
  );
  const [depth, setDepth] = useState<number>(2);
  const [layoutType, setLayoutType] = useState<GraphLayoutType>("cose");
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [selectedRelFilter, setSelectedRelFilter] = useState<string | null>(
    null,
  );
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(
    null,
  );

  const cyRef = useRef<Core | null>(null);

  const {
    data: catalogSummary,
    isLoading: isCatalogLoading,
    error: catalogError,
    refetch: refetchCatalog,
  } = useQuery<CatalogSummary>({
    queryKey: ["graph", "catalogSuggestions"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/explorer/search?size=5", {
        headers: { "X-Suppress-Toast": "true" },
      });
      const data = await res.json();
      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.content)
          ? data.content
          : Array.isArray(data?.results)
            ? data.results
            : [];

      const items: SuggestedEntity[] = rawItems
        .slice(0, 5)
        .filter((item: Record<string, unknown>) => Boolean(item?.id))
        .map((item: Record<string, unknown>) => ({
          id: String(item.id),
          canonicalName: String(
            item.canonicalName || item.label || item.name || item.id,
          ),
          entityType: String(item.entityType || "Entity"),
        }));

      const total =
        typeof data?.total === "number"
          ? data.total
          : typeof data?.totalResults === "number"
            ? data.totalResults
            : items.length;

      const facetTypes =
        data?.facets?.entityType && typeof data.facets.entityType === "object"
          ? Object.keys(data.facets.entityType)
          : data?.facets && typeof data.facets === "object"
            ? Object.keys(data.facets).filter(
                (k) => typeof data.facets[k] === "number",
              )
            : [];

      return { items, total, entityTypes: facetTypes };
    },
    staleTime: 60000,
    retry: false,
  });

  const activeEntityId = selectedEntityId;

  const {
    data: apiGraph,
    isLoading: isGraphLoading,
    isFetching: isGraphFetching,
    error: graphError,
    refetch: refetchGraph,
  } = useQuery<GraphResponse>({
    queryKey: ["graph", "data", activeEntityId, depth, selectedRelFilter],
    queryFn: async () => {
      let url = activeEntityId
        ? `/api/v1/graph/neighbourhood?entityId=${encodeURIComponent(activeEntityId)}&depth=${depth}`
        : `/api/v1/graph/overview`;
      if (selectedRelFilter) {
        url +=
          (url.includes("?") ? "&" : "?") +
          `relationshipType=${encodeURIComponent(selectedRelFilter)}`;
      }
      const res = await apiFetch(url, {
        headers: { "X-Suppress-Toast": "true" },
      });
      const payload = await res.json();
      return {
        nodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
        edges: Array.isArray(payload?.edges) ? payload.edges : [],
        centerNodeId: payload?.centerNodeId,
        totalNodes:
          typeof payload?.totalNodes === "number"
            ? payload.totalNodes
            : Array.isArray(payload?.nodes)
              ? payload.nodes.length
              : 0,
        totalEdges:
          typeof payload?.totalEdges === "number"
            ? payload.totalEdges
            : Array.isArray(payload?.edges)
              ? payload.edges.length
              : 0,
      };
    },
    enabled: Boolean(activeEntityId),
    retry: false,
  });

  const graphData: GraphElements = useMemo(
    () =>
      apiGraph && Array.isArray(apiGraph.nodes)
        ? { nodes: apiGraph.nodes, edges: apiGraph.edges ?? [] }
        : { nodes: [], edges: [] },
    [apiGraph],
  );

  const filteredElements: GraphElements = useMemo(
    () => filterGraphElements(graphData, selectedTypeFilter, selectedRelFilter),
    [graphData, selectedTypeFilter, selectedRelFilter],
  );

  const availableEntityTypes = useMemo(() => {
    const types = new Set<string>();
    for (const n of graphData.nodes) {
      if (n.data.entityType) types.add(n.data.entityType);
    }
    return Array.from(types);
  }, [graphData.nodes]);

  const availableRelTypes = useMemo(() => {
    const rels = new Set<string>();
    for (const e of graphData.edges) {
      if (e.data.relationshipType) rels.add(e.data.relationshipType);
    }
    return Array.from(rels);
  }, [graphData.edges]);

  const activeError = activeEntityId ? graphError : catalogError;
  const errorInfo = useMemo(
    () => (activeError ? extractGraphErrorInfo(activeError) : null),
    [activeError],
  );

  const isLoading = activeEntityId
    ? isGraphLoading || isGraphFetching
    : isCatalogLoading;

  const viewState = deriveGraphViewState({
    isLoading,
    hasError: Boolean(activeError),
    activeEntityId,
    catalogTotal: catalogSummary ? catalogSummary.total : null,
    nodeCount: graphData.nodes.length,
    edgeCount: graphData.edges.length,
  });

  const badge = computeGraphBadge({
    hasError: Boolean(activeError),
    hasActiveEntity: Boolean(activeEntityId),
    isLoading,
    nodeCount: graphData.nodes.length,
    edgeCount: graphData.edges.length,
  });

  const hasLoadedGraph =
    Boolean(activeEntityId) &&
    !isLoading &&
    !activeError &&
    graphData.nodes.length > 0;

  const selectEntity = useCallback(
    (id: string | null, label?: string | null) => {
      setSelectedEntityId(id);
      setSelectedEntityLabel(label ?? null);
      setSelectedNode(null);
      setSelectedTypeFilter(null);
      setSelectedRelFilter(null);
    },
    [],
  );

  const refetch = useCallback(() => {
    if (activeEntityId) {
      return refetchGraph();
    }
    return refetchCatalog();
  }, [activeEntityId, refetchGraph, refetchCatalog]);

  const handleZoomIn = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.zoom({
      level: cyRef.current.zoom() * 1.25,
      renderedPosition: {
        x: cyRef.current.width() / 2,
        y: cyRef.current.height() / 2,
      },
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.zoom({
      level: cyRef.current.zoom() * 0.8,
      renderedPosition: {
        x: cyRef.current.width() / 2,
        y: cyRef.current.height() / 2,
      },
    });
  }, []);

  const handleFit = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;
    cy.fit(undefined, 48);
    if (cy.nodes().length <= 2 && cy.zoom() > 1.25) {
      cy.zoom(1.25);
      cy.center();
    }
  }, []);

  const handleReset = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;
    const layout = cy.layout({
      name: layoutType,
      animate: true,
      animationDuration: 400,
      padding: 48,
    } as cytoscape.LayoutOptions);
    layout.one("layoutstop", () => {
      cy.fit(undefined, 48);
      if (cy.nodes().length <= 2 && cy.zoom() > 1.25) {
        cy.zoom(1.25);
        cy.center();
      }
    });
    layout.run();
  }, [layoutType]);

  const handleFocusNode = useCallback((nodeData: GraphNodeData) => {
    setSelectedNode(nodeData);
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    const target = cy.$id(nodeData.id);
    if (target.length > 0) {
      target.select();
      cy.animate({
        center: { eles: target },
        duration: 250,
      });
    }
  }, []);

  return {
    selectedEntityId,
    selectedEntityLabel,
    setSelectedEntityId: (id: string | null) => selectEntity(id),
    selectEntity,
    depth,
    setDepth,
    layoutType,
    setLayoutType,
    selectedNode,
    setSelectedNode,
    selectedRelFilter,
    setSelectedRelFilter,
    selectedTypeFilter,
    setSelectedTypeFilter,
    cyRef,
    activeEntityId,
    isLoading,
    error: activeError,
    errorInfo,
    viewState,
    badge,
    hasLoadedGraph,
    suggestedEntities: catalogSummary?.items ?? [],
    catalogTotal: catalogSummary?.total ?? null,
    refetch,
    graphData,
    filteredElements,
    availableEntityTypes,
    availableRelTypes,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleReset,
    handleFocusNode,
  };
}
