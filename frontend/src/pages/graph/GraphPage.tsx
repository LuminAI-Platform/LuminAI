import React, { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Network } from "lucide-react";
import type { Core } from "cytoscape";
import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { FoundryPageHeader } from "../../components/layout/FoundryPageHeader";
import {
  GraphCanvas,
  type GraphElements,
  type GraphNodeData,
  type GraphLayoutType,
} from "./components/GraphCanvas";
import { GraphControls } from "./components/GraphControls";
import { NodeDetailPanel } from "./components/NodeDetailPanel";
import { GraphSearchBar } from "./components/GraphSearchBar";

interface GraphResponse {
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

/**
 * Interactive Knowledge Graph Explorer Page powered by Cytoscape.js
 */
export const GraphPage: React.FC = () => {
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

  // Discover initial entity from tenant catalog if none selected yet
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
        // Fallback gracefully
      }
      return null;
    },
    staleTime: 60000,
  });

  const activeEntityId = selectedEntityId || initialEntityId || null;

  // 1. Fetch neighbourhood from real REST API
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

  // Use real API response or empty graph
  const graphData: GraphElements =
    apiGraph && apiGraph.nodes ? apiGraph : { nodes: [], edges: [] };

  // Filter elements according to user selection
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

  // Derive unique entity and relationship types for filters
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

  // Cytoscape Viewport Helpers
  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  }, []);

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 50);
  }, []);

  const handleReset = useCallback(() => {
    cyRef.current?.reset();
    cyRef.current?.fit(undefined, 50);
  }, []);

  const handleExpandNode = useCallback((nodeId: string) => {
    setSelectedEntityId(nodeId);
    setDepth((prev) => Math.min(4, prev + 1));
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 pb-4">
      {/* Foundry Page Header */}
      <FoundryPageHeader
        breadcrumbs={[
          { label: "Operational Mesh", to: "/" },
          { label: "Knowledge Graph" },
        ]}
        title="Knowledge Graph Explorer"
        description="Explore 2D semantic entity neighbourhoods, shortest paths, and topological degree centrality."
        icon={<Network className="w-5 h-5 text-purple-400" />}
        badge={{
          label: "Neo4j Mesh Synced",
          variant: "purple",
        }}
        actions={
          <div className="flex items-center gap-3">
            <GraphSearchBar
              onSearch={(id) => {
                setSelectedEntityId(id);
                setSelectedNode(null);
              }}
              isLoading={isLoading}
            />

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs gap-1.5">
              <span className="text-zinc-500 text-[11px] px-1 font-medium">
                Depth
              </span>
              {[1, 2, 3, 4].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    depth === d
                      ? "bg-blue-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Reload
            </Button>
          </div>
        }
      />

      {/* Backend connection error banner */}
      {error && (
        <div className="bg-red-950/20 border border-red-500/30 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              Failed to load graph neighbourhood for entity "{activeEntityId}".
              Please verify backend graph services.
            </span>
          </div>
          <Button size="xs" variant="ghost" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Graph Visualizer Main Area */}
      <div className="relative flex-1 min-h-[500px] w-full">
        {/* Controls Overlay */}
        <GraphControls
          layoutType={layoutType}
          onChangeLayout={setLayoutType}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFit={handleFit}
          onReset={handleReset}
          entityTypes={availableEntityTypes}
          selectedEntityType={selectedTypeFilter}
          onSelectEntityType={setSelectedTypeFilter}
          relationshipTypes={availableRelTypes}
          selectedRelType={selectedRelFilter}
          onSelectRelType={setSelectedRelFilter}
        />

        {/* Empty State Overlay */}
        {!isLoading && filteredElements.nodes.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-xs text-center p-6 select-none">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
              <Network className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">
              No Graph Relationships Found
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
              {activeEntityId
                ? `Entity "${activeEntityId}" currently has no connected edges or relationships in the graph catalog.`
                : "No active entity selected to explore in the knowledge graph."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedEntityId(null)}
            >
              Reset Selected Entity
            </Button>
          </div>
        )}

        {/* Cytoscape Canvas */}
        <GraphCanvas
          elements={filteredElements}
          layoutType={layoutType}
          selectedNodeId={selectedNode?.id}
          onSelectNode={setSelectedNode}
          onExpandNode={handleExpandNode}
          onInitCy={(cy) => {
            cyRef.current = cy;
          }}
        />

        {/* Selected Node Details Side Inspector */}
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onExpand={handleExpandNode}
        />

        {/* Graph Bottom Legend Bar */}
        <div className="absolute bottom-4 left-4 z-10 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg px-3 py-1.5 shadow-xl flex items-center gap-4 text-[11px] text-zinc-400">
          <span className="font-semibold text-zinc-300">
            {filteredElements.nodes.length} Nodes ·{" "}
            {filteredElements.edges.length} Edges
          </span>
          <div className="h-3 w-px bg-zinc-800" />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Person
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
              Organization
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Dataset
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500" /> Transaction
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
