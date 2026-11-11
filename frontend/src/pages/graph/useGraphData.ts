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

  const activeEntityId = selectedEntityId || initialEntityId || null;

  const {
    data: apiGraph,
    isLoading,
    error,
    refetch,
  } = useQuery<GraphResponse>({
    queryKey: [
      "graph",
      "neighbourhood",
      activeEntityId,
      depth,
      selectedRelFilter,
    ],
    queryFn: async () => {
      if (!activeEntityId) return { nodes: [], edges: [] };
      let url = `/api/v1/graph/neighbourhood?entityId=${encodeURIComponent(activeEntityId)}&depth=${depth}`;
      if (selectedRelFilter) {
        url += `&relationshipType=${encodeURIComponent(selectedRelFilter)}`;
      }
      const res = await apiFetch(url, {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    enabled: !!activeEntityId,
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

  return {
    selectedEntityId,
    setSelectedEntityId,
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
