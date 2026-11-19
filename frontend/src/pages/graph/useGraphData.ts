import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Core } from "cytoscape";
import { apiFetch } from "../../lib/api";
import type {
  GraphElements,
  GraphNodeData,
  GraphLayoutType,
} from "./components/GraphCanvas";

export interface GraphResponse {
  nodes: Array<{
    data: {
      id: string;
      label: string;
      entityType?: string;
      properties?: Record<string, unknown>;
      color?: string;
    };
  }>;
  edges: Array<{
    data: {
      id: string;
      source: string;
      target: string;
      label?: string;
      relationshipType?: string;
      weight?: number;
    };
  }>;
  totalNodes?: number;
  totalEdges?: number;
}

export function useGraphData() {
  const getSearchParamEntityId = () => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("entityId");
    }
    return null;
  };

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    getSearchParamEntityId,
  );
  const [isResetToOverview, setIsResetToOverview] = useState(false);
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

  const { data: initialEntityId } = useQuery<string | null>({
    queryKey: ["graph", "initialEntity"],
    queryFn: async () => {
      try {
        const res = await apiFetch("/api/v1/explorer/search?size=1", {
          headers: { "X-Suppress-Toast": "true" },
        });
        const data = await res.json();
        const items = data?.items ?? data?.content ?? [];
        if (items.length > 0 && items[0]?.id) {
          return items[0].id as string;
        }
      } catch {
        // Could not fetch initial entity
      }
      return null;
    },
    staleTime: 60000,
  });

  const activeEntityId = isResetToOverview
    ? null
    : selectedEntityId || initialEntityId || null;

  const {
    data: apiGraph,
    isLoading,
    error,
    refetch,
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
      try {
        const res = await apiFetch(url, {
          headers: { "X-Suppress-Toast": "true" },
        });
        if (!res.ok) {
          return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };
        }
        return await res.json();
      } catch (err) {
        console.warn("Could not fetch graph data:", err);
        return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };
      }
    },
    retry: false,
  });

  const graphData: GraphElements =
    apiGraph && apiGraph.nodes ? apiGraph : { nodes: [], edges: [] };

  const filteredElements: GraphElements = {
    nodes: selectedTypeFilter
      ? graphData.nodes.filter((n) => n.data.entityType === selectedTypeFilter)
      : graphData.nodes,
    edges: selectedRelFilter
      ? graphData.edges.filter(
          (e) => e.data.relationshipType === selectedRelFilter,
        )
      : graphData.edges,
  };

  const availableEntityTypes = Array.from(
    new Set(
      graphData.nodes
        .map((n) => n.data.entityType)
        .filter((t): t is string => Boolean(t)),
    ),
  );

  const availableRelTypes = Array.from(
    new Set(
      graphData.edges
        .map((e) => e.data.relationshipType)
        .filter((r): r is string => Boolean(r)),
    ),
  );

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  }, []);

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 40);
  }, []);

  const handleReset = useCallback(() => {
    cyRef.current?.layout({ name: layoutType, animate: true }).run();
  }, [layoutType]);

  const handleResetSelection = useCallback(() => {
    setSelectedEntityId(null);
    setIsResetToOverview(true);
    setSelectedNode(null);
  }, []);

  const handleSelectEntity = useCallback((id: string | null) => {
    setSelectedEntityId(id);
    setIsResetToOverview(id === null);
    setSelectedNode(null);
  }, []);

  return {
    selectedEntityId,
    setSelectedEntityId: handleSelectEntity,
    handleResetSelection,
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
    error,
    refetch,
    filteredElements,
    availableEntityTypes,
    availableRelTypes,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleReset,
  };
}
