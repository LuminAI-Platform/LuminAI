import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Core } from "cytoscape";
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
import { fetchCatalogSummary, fetchGraphNeighbourhood } from "./graphApi";
import { useGraphViewportControls } from "./useGraphViewportControls";

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
    queryFn: fetchCatalogSummary,
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
    queryFn: () =>
      fetchGraphNeighbourhood(activeEntityId, depth, selectedRelFilter),
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

  const viewportControls = useGraphViewportControls(
    cyRef,
    layoutType,
    setSelectedNode,
  );

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
    ...viewportControls,
  };
}
