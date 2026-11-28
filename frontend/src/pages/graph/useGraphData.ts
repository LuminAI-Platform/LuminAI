import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Core } from "cytoscape";
import { apiFetch } from "../../lib/api";
import {
  fetchGraphNeighbourhood,
  fetchShortestPath,
  backfillKnowledgeGraph,
  type DecomposedSyncResult,
} from "../../features/graph/graphApi";
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
  mergeGraphElements,
  computeGraphBadge,
  deriveGraphViewState,
  getSearchParamEntityId,
  syncSearchParamEntityId,
  mapExplorerItemsToSuggestions,
  normalizeGraphResponse,
} from "./graphDataUtils";
import { useGraphViewport } from "./useGraphViewport";

export {
  type GraphResponse,
  type SuggestedEntity,
  type CatalogSummary,
  type GraphErrorInfo,
  type GraphViewState,
  type GraphBadgeInfo,
  type DecomposedSyncResult,
  extractGraphErrorInfo,
  filterGraphElements,
  mergeGraphElements,
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
  const [expandedGraph, setExpandedGraph] = useState<{
    key: string;
    elements: GraphElements;
  } | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [pathGraph, setPathGraph] = useState<{
    sourceId: string;
    targetId: string;
    graph: GraphResponse;
  } | null>(null);
  const [isFindingPath, setIsFindingPath] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

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
      const { items, total, facetTypes } = mapExplorerItemsToSuggestions(
        data,
        5,
      );
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
      return normalizeGraphResponse(payload);
    },
    enabled: true,
    retry: false,
  });

  const currentQueryKey = `${activeEntityId ?? "__overview__"}::${depth}::${selectedRelFilter ?? ""}`;

  const baseGraphData: GraphElements = useMemo(
    () =>
      apiGraph && Array.isArray(apiGraph.nodes)
        ? { nodes: apiGraph.nodes, edges: apiGraph.edges ?? [] }
        : { nodes: [], edges: [] },
    [apiGraph],
  );

  const graphData: GraphElements = useMemo(() => {
    if (pathGraph) {
      return {
        nodes: pathGraph.graph.nodes ?? [],
        edges: pathGraph.graph.edges ?? [],
      };
    }
    if (expandedGraph && expandedGraph.key === currentQueryKey) {
      return expandedGraph.elements;
    }
    return baseGraphData;
  }, [pathGraph, expandedGraph, currentQueryKey, baseGraphData]);

  const latestGraphRef = useRef<GraphElements>(graphData);
  useEffect(() => {
    latestGraphRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      setSelectedEntityId(getSearchParamEntityId());
      setSelectedEntityLabel(null);
      setSelectedNode(null);
      setSelectedTypeFilter(null);
      setSelectedRelFilter(null);
      setExpandedGraph(null);
      setPathGraph(null);
      setPathError(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
    if (selectedRelFilter) rels.add(selectedRelFilter);
    return Array.from(rels);
  }, [graphData.edges, selectedRelFilter]);

  const resolvedEntityLabel = useMemo(() => {
    if (selectedEntityLabel) return selectedEntityLabel;
    if (!activeEntityId) return null;
    const stripPrefix = (id: string) =>
      id.startsWith("gr-") ? id.slice(3) : id;
    const targetBare = stripPrefix(activeEntityId);
    const match = graphData.nodes.find(
      (n) =>
        n.data.id === activeEntityId || stripPrefix(n.data.id) === targetBare,
    );
    return match?.data.label ?? null;
  }, [selectedEntityLabel, activeEntityId, graphData.nodes]);

  const activeError = activeEntityId ? graphError : graphError || catalogError;
  const errorInfo = useMemo(
    () => (activeError ? extractGraphErrorInfo(activeError) : null),
    [activeError],
  );

  const isLoading = activeEntityId
    ? isGraphLoading || isGraphFetching
    : isCatalogLoading || (isGraphLoading && graphData.nodes.length === 0);

  const viewState = deriveGraphViewState({
    isLoading,
    hasError: Boolean(activeError),
    activeEntityId: pathGraph ? pathGraph.sourceId : activeEntityId,
    catalogTotal: catalogSummary ? catalogSummary.total : null,
    nodeCount: graphData.nodes.length,
    edgeCount: graphData.edges.length,
  });

  const badge = computeGraphBadge({
    hasError: Boolean(activeError),
    hasActiveEntity: Boolean(activeEntityId || pathGraph),
    isLoading,
    nodeCount: graphData.nodes.length,
    edgeCount: graphData.edges.length,
  });

  const hasLoadedGraph =
    !isLoading && !activeError && graphData.nodes.length > 0;

  const selectEntity = useCallback(
    (id: string | null, label?: string | null) => {
      const normalizedId = id?.trim() || null;
      setSelectedEntityId(normalizedId);
      setSelectedEntityLabel(label ?? null);
      setSelectedNode(null);
      setSelectedTypeFilter(null);
      setSelectedRelFilter(null);
      setExpandedGraph(null);
      setPathGraph(null);
      setPathError(null);
      syncSearchParamEntityId(normalizedId);
    },
    [],
  );

  const refetch = useCallback(() => {
    setExpandedGraph(null);
    setPathGraph(null);
    setPathError(null);
    if (activeEntityId) {
      return refetchGraph();
    }
    return Promise.all([refetchGraph(), refetchCatalog()]);
  }, [activeEntityId, refetchGraph, refetchCatalog]);

  const expandNode = useCallback(
    async (
      nodeId: string,
    ): Promise<{ addedNodes: number; addedEdges: number }> => {
      const trimmedId = nodeId.trim();
      if (!trimmedId) return { addedNodes: 0, addedEdges: 0 };
      setIsExpanding(true);
      try {
        const res = await fetchGraphNeighbourhood({
          entityId: trimmedId,
          depth: 1,
          relationshipType: selectedRelFilter ?? undefined,
        });
        const normalized = normalizeGraphResponse(res);
        const incoming: GraphElements = {
          nodes: normalized.nodes,
          edges: normalized.edges,
        };
        const current = latestGraphRef.current;
        const merged = mergeGraphElements(current, incoming);
        const addedNodes = Math.max(
          0,
          merged.nodes.length - current.nodes.length,
        );
        const addedEdges = Math.max(
          0,
          merged.edges.length - current.edges.length,
        );
        setPathGraph(null);
        setPathError(null);
        setExpandedGraph({
          key: currentQueryKey,
          elements: merged,
        });
        return { addedNodes, addedEdges };
      } finally {
        setIsExpanding(false);
      }
    },
    [selectedRelFilter, currentQueryKey],
  );

  const findShortestPath = useCallback(
    async (
      sourceId: string,
      targetId: string,
    ): Promise<{ found: boolean; nodeCount: number; edgeCount: number }> => {
      const src = sourceId.trim();
      const dst = targetId.trim();
      if (!src || !dst) {
        setPathError("Select or enter both a source and target entity.");
        return { found: false, nodeCount: 0, edgeCount: 0 };
      }
      if (src === dst) {
        setPathError("Source and target entities must be different.");
        return { found: false, nodeCount: 0, edgeCount: 0 };
      }
      setIsFindingPath(true);
      setPathError(null);
      try {
        const res = await fetchShortestPath(src, dst, { suppressToast: true });
        const normalized = normalizeGraphResponse(res);
        if (normalized.nodes.length === 0) {
          setPathError("No connecting path found between those entities.");
          return { found: false, nodeCount: 0, edgeCount: 0 };
        }
        setPathGraph({
          sourceId: src,
          targetId: dst,
          graph: normalized,
        });
        setSelectedNode(null);
        setSelectedTypeFilter(null);
        setSelectedRelFilter(null);
        return {
          found: true,
          nodeCount: normalized.nodes.length,
          edgeCount: normalized.edges.length,
        };
      } catch (err) {
        const info = extractGraphErrorInfo(err);
        setPathError(info.message || "Failed to find shortest path.");
        return { found: false, nodeCount: 0, edgeCount: 0 };
      } finally {
        setIsFindingPath(false);
      }
    },
    [],
  );

  const clearShortestPath = useCallback(() => {
    setPathGraph(null);
    setPathError(null);
  }, []);

  const syncAllToGraph =
    useCallback(async (): Promise<DecomposedSyncResult> => {
      setIsBackfilling(true);
      try {
        const result = await backfillKnowledgeGraph();
        setExpandedGraph(null);
        setPathGraph(null);
        setPathError(null);
        await Promise.all([refetchGraph(), refetchCatalog()]);
        return result;
      } finally {
        setIsBackfilling(false);
      }
    }, [refetchGraph, refetchCatalog]);

  const viewportHandlers = useGraphViewport(cyRef, layoutType, setSelectedNode);

  return {
    selectedEntityId,
    selectedEntityLabel: resolvedEntityLabel,
    setSelectedEntityId: (id: string | null) => selectEntity(id),
    selectEntity,
    expandNode,
    isExpanding,
    findShortestPath,
    clearShortestPath,
    pathResult: pathGraph
      ? {
          sourceId: pathGraph.sourceId,
          targetId: pathGraph.targetId,
          nodeCount: pathGraph.graph.nodes.length,
          edgeCount: pathGraph.graph.edges.length,
        }
      : null,
    isFindingPath,
    pathError,
    syncAllToGraph,
    isBackfilling,
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
    ...viewportHandlers,
  };
}
