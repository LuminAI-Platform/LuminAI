import React, { useCallback } from "react";
import { AlertCircle, RefreshCw, Network } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/layout/PageHeader";
import { GraphCanvas } from "./components/GraphCanvas";
import { GraphControls } from "./components/GraphControls";
import { NodeDetailPanel } from "./components/NodeDetailPanel";
import { GraphSearchBar } from "./components/GraphSearchBar";
import { useGraphData } from "./useGraphData";

export const GraphPage: React.FC = () => {
  const {
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
  } = useGraphData();

  const handleExpandNode = useCallback(
    (nodeId: string) => {
      setSelectedEntityId(nodeId);
      setDepth((prev) => Math.min(4, prev + 1));
    },
    [setSelectedEntityId, setDepth],
  );

  return (
    <div className="flex flex-col h-full gap-4 pb-4">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Explore & Overview", to: "/" },
          { label: "Knowledge Graph" },
        ]}
        title="Knowledge Graph Explorer"
        description="Explore entity relationships, connected graph clusters, and relationship pathways."
        icon={<Network className="w-5 h-5 text-purple-400" />}
        badge={{
          label: "Graph Connected",
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
              Failed to load graph neighbourhood for entity &quot;
              {activeEntityId}&quot;. Please verify backend graph services.
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
            <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
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
