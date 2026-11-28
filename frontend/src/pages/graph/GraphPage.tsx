import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Icons,
  RefreshCw,
  GitFork,
  Database,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/layout/PageHeader";
import { showToastNotification } from "../../components/ui/ToastProvider";
import { useThemeStore } from "../../stores/themeStore";
import { getEntityColor } from "../../lib/entityColors";
import { GraphCanvas, type GraphNodeData } from "./components/GraphCanvas";
import { GraphControls } from "./components/GraphControls";
import { NodeDetailPanel } from "./components/NodeDetailPanel";
import { GraphSearchBar } from "./components/GraphSearchBar";
import { GraphPathBar } from "./components/GraphPathBar";
import { GraphOverlays, GraphNodeListPanel } from "./components/GraphOverlays";
import { extractGraphErrorInfo, useGraphData } from "./useGraphData";

export const GraphPage: React.FC = () => {
  const {
    selectedEntityLabel,
    selectEntity,
    expandNode,
    isExpanding,
    findShortestPath,
    clearShortestPath,
    pathResult,
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
    errorInfo,
    viewState,
    badge,
    hasLoadedGraph,
    suggestedEntities,
    refetch,
    filteredElements,
    availableEntityTypes,
    availableRelTypes,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleReset,
    handleFocusNode,
  } = useGraphData();

  const isDark = useThemeStore((s) => s.isDark);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isNodeListOpen, setIsNodeListOpen] = useState(false);
  const [isPathBarOpen, setIsPathBarOpen] = useState(false);
  const [pathPrefillSource, setPathPrefillSource] = useState<{
    id: string;
    label?: string;
    nonce: number;
  } | null>(null);

  // Focus the search field automatically when in the idle "Choose an entity to explore" state
  useEffect(() => {
    if (viewState === "idle" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [viewState]);

  // Close node list if graph is cleared
  useEffect(() => {
    if (!hasLoadedGraph) {
      setIsNodeListOpen(false);
    }
  }, [hasLoadedGraph]);

  const handleExpandNode = useCallback(
    async (nodeId: string) => {
      try {
        const { addedNodes, addedEdges } = await expandNode(nodeId);
        if (addedNodes === 0 && addedEdges === 0) {
          showToastNotification(
            "info",
            "No additional links",
            "All 1-hop neighbours for this node are already on the canvas.",
          );
        } else {
          showToastNotification(
            "success",
            "Expanded Neighbourhood",
            `Added ${addedNodes} node${addedNodes === 1 ? "" : "s"} and ${addedEdges} edge${addedEdges === 1 ? "" : "s"}.`,
          );
        }
      } catch (err) {
        const info = extractGraphErrorInfo(err);
        showToastNotification("error", "Expand Failed", info.message);
      }
    },
    [expandNode],
  );

  const handleSyncGraph = useCallback(async () => {
    try {
      const result = await syncAllToGraph();
      const syncedNodes = result.nodesSynced ?? result.nodesCreated ?? 0;
      const syncedEdges =
        result.edgesSynced ?? result.relationshipsCreated ?? 0;
      showToastNotification(
        "success",
        "Knowledge Graph Synced",
        `Synced ${syncedNodes} entities and ${syncedEdges} relationships.`,
      );
    } catch (err) {
      const info = extractGraphErrorInfo(err);
      showToastNotification("error", "Graph Sync Failed", info.message);
    }
  }, [syncAllToGraph]);

  const handleFindPathFromNode = useCallback((node: GraphNodeData) => {
    setPathPrefillSource({
      id: node.id,
      label: node.label || node.id,
      nonce: Date.now(),
    });
    setIsPathBarOpen(true);
  }, []);

  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Explore & Overview", to: "/" },
          { label: "Knowledge Graph" },
        ]}
        title="Knowledge Graph Explorer"
        description="Explore entity relationships, connected graph clusters, and relationship pathways."
        icon={
          <Icons.KnowledgeGraph
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        badge={badge}
        stackActionsBelowWide
        actions={
          <div className="flex flex-wrap items-center justify-start gap-2.5">
            <GraphSearchBar
              inputRef={searchInputRef}
              onSearch={(id, label) => {
                selectEntity(id, label);
              }}
              isLoading={isLoading}
            />

            {/* Traversal Depth Selector */}
            <div
              className="flex items-center shrink-0 bg-surface border border-border rounded-lg p-1 text-xs gap-1"
              role="group"
              aria-label="Graph traversal depth"
              title={
                activeEntityId
                  ? "Set neighbourhood hop depth"
                  : "Select a specific entity to adjust hop depth"
              }
            >
              <span className="text-text-secondary text-[11px] px-1.5 font-medium select-none">
                Depth
              </span>
              {[1, 2, 3, 4].map((d) => {
                const depthDisabled =
                  !activeEntityId || !hasLoadedGraph || Boolean(pathResult);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={depthDisabled}
                    aria-label={`Traversal depth ${d}`}
                    aria-pressed={depth === d}
                    onClick={() => setDepth(d)}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      depth === d && !depthDisabled
                        ? "bg-primary text-primary-text"
                        : "text-text-secondary hover:text-text hover:bg-surface-hover disabled:hover:bg-transparent disabled:hover:text-text-secondary"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            <Button
              variant={isPathBarOpen || pathResult ? "primary" : "secondary"}
              size="sm"
              className="shrink-0"
              onClick={() => setIsPathBarOpen((prev) => !prev)}
              leftIcon={<GitFork className="w-3.5 h-3.5" />}
            >
              Shortest Path
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={isBackfilling || isLoading}
              onClick={handleSyncGraph}
              leftIcon={<Database className="w-3.5 h-3.5" />}
            >
              {isBackfilling ? "Syncing..." : "Sync Graph"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={isLoading}
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Reload
            </Button>
          </div>
        }
      />

      {/* Shortest Path Finder Ribbon */}
      <GraphPathBar
        isOpen={isPathBarOpen}
        prefillSource={pathPrefillSource}
        canvasNodes={filteredElements.nodes}
        isFinding={isFindingPath}
        pathResult={pathResult}
        pathError={pathError}
        onFindPath={findShortestPath}
        onClearPath={clearShortestPath}
        onClose={() => setIsPathBarOpen(false)}
      />

      {/* Graph Visualizer Main Area — explicit viewport-relative height so canvas never collapses to 0px */}
      <div className="relative w-full h-[calc(100vh-15.5rem)] min-h-[520px]">
        {/* Controls Overlay */}
        <GraphControls
          layoutType={layoutType}
          onChangeLayout={setLayoutType}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFit={handleFit}
          onReset={handleReset}
          disabled={!hasLoadedGraph}
          entityTypes={availableEntityTypes}
          selectedEntityType={selectedTypeFilter}
          onSelectEntityType={setSelectedTypeFilter}
          relationshipTypes={availableRelTypes}
          selectedRelType={selectedRelFilter}
          onSelectRelType={setSelectedRelFilter}
          nodeCount={filteredElements.nodes.length}
          isNodeListOpen={isNodeListOpen}
          onToggleNodeList={() => setIsNodeListOpen((prev) => !prev)}
        />

        {/* Keyboard-Accessible Node List */}
        {isNodeListOpen && hasLoadedGraph && (
          <GraphNodeListPanel
            nodes={filteredElements.nodes}
            selectedNodeId={selectedNode?.id ?? null}
            onSelectNode={handleFocusNode}
            onClose={() => setIsNodeListOpen(false)}
          />
        )}

        {/* Explicit Canvas States (Loading, Error, Empty, Idle, Not Found, Isolated Notice) */}
        <GraphOverlays
          viewState={viewState}
          activeEntityId={activeEntityId}
          activeEntityLabel={selectedEntityLabel}
          suggestedEntities={suggestedEntities}
          errorInfo={errorInfo}
          onSelectEntity={(id, label) => selectEntity(id, label)}
          onClearEntity={() => selectEntity(null)}
          onRetry={() => refetch()}
          onFocusSearch={handleFocusSearch}
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
          isExpanding={isExpanding}
          onFindPathFrom={handleFindPathFromNode}
        />

        {/* Dynamic Bottom Legend Bar */}
        {hasLoadedGraph && (
          <div
            className="absolute bottom-4 left-4 z-20 bg-surface/95 backdrop-blur-md border border-border rounded-lg px-3 py-1.5 shadow-xs flex flex-wrap items-center gap-3 text-[11px] text-text-secondary max-w-[calc(100%-2rem)]"
            aria-label="Graph legend"
          >
            <span className="font-semibold text-text">
              {filteredElements.nodes.length} Nodes &middot;{" "}
              {filteredElements.edges.length} Edges
            </span>
            {availableEntityTypes.length > 0 && (
              <>
                <div className="h-3 w-px bg-border" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-3">
                  {availableEntityTypes.map((type) => {
                    const color = getEntityColor(type, isDark);
                    return (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1.5 text-text"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <span>{type}</span>
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
