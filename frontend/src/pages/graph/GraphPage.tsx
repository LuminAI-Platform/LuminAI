import React, { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { Core } from "cytoscape";
import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/Button";
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

// Fallback seed graph for demo visualization before database has entities
const DEFAULT_SEED_GRAPH: GraphElements = {
  nodes: [
    {
      data: {
        id: "ent-luminai",
        label: "LuminAI Core",
        entityType: "Organization",
        properties: { domain: "AI Data Platform", tier: "Enterprise" },
      },
    },
    {
      data: {
        id: "ent-snowflake",
        label: "Snowflake DW",
        entityType: "Dataset",
        properties: { cloud: "AWS", region: "us-east-1" },
      },
    },
    {
      data: {
        id: "ent-kafka",
        label: "Kafka Event Stream",
        entityType: "Dataset",
        properties: { partitions: 16, retention: "7d" },
      },
    },
    {
      data: {
        id: "ent-alice",
        label: "Alice Henderson",
        entityType: "Person",
        properties: { role: "Chief Data Architect", department: "Data Ops" },
      },
    },
    {
      data: {
        id: "ent-orders",
        label: "Enterprise Orders",
        entityType: "Transaction",
        properties: { volume: "1.2M records/day" },
      },
    },
  ],
  edges: [
    {
      data: {
        id: "rel-1",
        source: "ent-snowflake",
        target: "ent-luminai",
        relationshipType: "INGESTED_BY",
      },
    },
    {
      data: {
        id: "rel-2",
        source: "ent-kafka",
        target: "ent-luminai",
        relationshipType: "STREAMED_TO",
      },
    },
    {
      data: {
        id: "rel-3",
        source: "ent-alice",
        target: "ent-luminai",
        relationshipType: "MANAGES",
      },
    },
    {
      data: {
        id: "rel-4",
        source: "ent-orders",
        target: "ent-snowflake",
        relationshipType: "STORED_IN",
      },
    },
  ],
};

/**
 * Interactive Knowledge Graph Explorer Page powered by Cytoscape.js
 */
export const GraphPage: React.FC = () => {
  const [selectedEntityId, setSelectedEntityId] =
    useState<string>("ent-luminai");
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
      selectedEntityId,
      depth,
      selectedRelFilter,
    ],
    queryFn: async () => {
      let url = `/api/v1/graph/neighbourhood?entityId=${encodeURIComponent(selectedEntityId)}&depth=${depth}`;
      if (selectedRelFilter) {
        url += `&relationshipType=${encodeURIComponent(selectedRelFilter)}`;
      }
      const res = await apiFetch(url);
      return res.json();
    },
    retry: 1,
  });

  // Use API response or fallback to seed demo graph if API returns empty
  const graphData: GraphElements =
    apiGraph && apiGraph.nodes && apiGraph.nodes.length > 0
      ? apiGraph
      : DEFAULT_SEED_GRAPH;

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
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              Knowledge Graph Explorer
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Neo4j Mesh
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Explore 2D semantic entity neighbourhoods, shortest paths, and
            topological degree centrality
          </p>
        </div>

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
      </div>

      {/* Backend connection notice if fallback in use */}
      {error && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Connected to fallback graph topology. Live Neo4j connection will
              sync when services are live.
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
