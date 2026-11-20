import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Icons,
  AlertCircle,
  Loader2,
  RefreshCw,
  Database,
  Info,
  X,
} from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import type {
  GraphErrorInfo,
  GraphViewState,
  SuggestedEntity,
} from "../useGraphData";
import type { GraphNodeData } from "./GraphCanvas";

export interface GraphOverlaysProps {
  viewState: GraphViewState;
  activeEntityId: string | null;
  activeEntityLabel: string | null;
  suggestedEntities: SuggestedEntity[];
  errorInfo: GraphErrorInfo | null;
  onSelectEntity: (id: string, label?: string) => void;
  onClearEntity: () => void;
  onRetry: () => void;
  onFocusSearch?: () => void;
}

/**
 * Renders every explicit graph canvas state so the canvas is never silently blank.
 * Uses theme tokens exclusively so both light and dark modes meet contrast standards.
 */
export const GraphOverlays: React.FC<GraphOverlaysProps> = ({
  viewState,
  activeEntityId,
  activeEntityLabel,
  suggestedEntities,
  errorInfo,
  onSelectEntity,
  onClearEntity,
  onRetry,
  onFocusSearch,
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  if (viewState === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-xs text-center p-6"
      >
        <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary mb-3 shadow-xs">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-text">Loading graph...</p>
        <p className="text-xs text-text-secondary mt-1">
          Fetching nodes and relationships from the knowledge graph.
        </p>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div
        role="alert"
        className="absolute inset-0 z-15 flex flex-col items-center justify-center rounded-lg overflow-y-auto bg-surface/90 backdrop-blur-xs text-center px-6 pt-16 pb-6"
      >
        <div className="w-12 h-12 rounded-lg bg-error-bg border border-error-border flex items-center justify-center text-error mb-3 shrink-0">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-text">
          Couldn&apos;t load the graph
        </h3>
        <p className="text-xs text-text-secondary max-w-md mt-1 mb-4 leading-relaxed">
          The graph service did not return a valid response. Check your
          connection or try again.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <Button
            size="sm"
            variant="primary"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
          {activeEntityId && (
            <Button size="sm" variant="secondary" onClick={onClearEntity}>
              Choose another entity
            </Button>
          )}
        </div>

        <details className="w-full max-w-md text-left bg-surface-subtle border border-border rounded-lg px-3 py-2 text-xs text-text-secondary">
          <summary className="cursor-pointer font-medium text-text select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            Technical details
          </summary>
          <div className="mt-2 pt-2 border-t border-border-subtle space-y-1 font-mono text-[11px]">
            <div>
              Status:{" "}
              <span className="text-text font-semibold">
                {errorInfo?.statusCode ?? "Network error"}
              </span>
            </div>
            {errorInfo?.message && (
              <div className="break-words text-text-secondary">
                {errorInfo.message}
              </div>
            )}
          </div>
        </details>
      </div>
    );
  }

  if (viewState === "empty_catalog") {
    return (
      <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-surface/90 backdrop-blur-xs text-center p-6">
        <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-3">
          <Database className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-text">The graph is empty</h3>
        <p className="text-xs text-text-secondary max-w-sm mt-1 mb-5 leading-relaxed">
          No entities have been ingested yet. Connect a data source and run
          ingestion to populate the knowledge graph.
        </p>
        <Link to="/connections">
          <Button size="sm" variant="primary">
            Connect a data source
          </Button>
        </Link>
      </div>
    );
  }

  if (viewState === "idle") {
    return (
      <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-xs text-center p-6">
        <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary mb-3">
          <Icons.KnowledgeGraph size={24} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-text">
          Choose an entity to explore
        </h3>
        <p className="text-xs text-text-secondary max-w-md mt-1 mb-4 leading-relaxed">
          Search by entity name or ID above and press Load, or pick a suggested
          entity below to inspect its neighborhood.
        </p>

        {suggestedEntities.length > 0 ? (
          <div className="w-full max-w-lg">
            <p className="text-[11px] font-medium text-text-muted mb-2">
              Suggested entities
            </p>
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              role="list"
              aria-label="Suggested entities"
            >
              {suggestedEntities.slice(0, 5).map((entity) => {
                const color = getEntityColor(entity.entityType, isDark);
                return (
                  <button
                    key={entity.id}
                    type="button"
                    role="listitem"
                    onClick={() =>
                      onSelectEntity(entity.id, entity.canonicalName)
                    }
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-border-focus hover:bg-surface-hover text-xs text-text font-medium shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="max-w-[160px] truncate">
                      {entity.canonicalName}
                    </span>
                    <span className="text-[10px] text-text-secondary px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                      {entity.entityType}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          onFocusSearch && (
            <Button size="sm" variant="secondary" onClick={onFocusSearch}>
              Focus search bar
            </Button>
          )
        )}
      </div>
    );
  }

  if (viewState === "entity_not_found") {
    const displayName = activeEntityLabel || activeEntityId || "this entity";
    return (
      <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-surface/90 backdrop-blur-xs text-center p-6">
        <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-3">
          <Icons.KnowledgeGraph size={24} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-text">
          No graph node found for &ldquo;{displayName}&rdquo;
        </h3>
        <p className="text-xs text-text-secondary max-w-md mt-1 mb-4 leading-relaxed">
          This entity is not synced in the graph store yet, or no matching ID
          exists. Verify ingestion sync in Data Connections or choose another
          entity.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" variant="primary" onClick={onClearEntity}>
            Choose another entity
          </Button>
          <Link to="/connections">
            <Button size="sm" variant="secondary">
              Data Connections
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (viewState === "loaded_isolated") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 max-w-xl w-[calc(100%-2rem)] bg-surface/95 backdrop-blur-md border border-border rounded-lg px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2 text-text">
          <Info className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <span>
            This entity has no relationships yet. Map relationships during
            ingestion.
          </span>
        </div>
        <Link
          to="/connections"
          className="text-xs font-semibold text-primary hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Data Connections
        </Link>
      </div>
    );
  }

  return null;
};

interface GraphNodeListPanelProps {
  nodes: Array<{ data: GraphNodeData }>;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNodeData) => void;
  onClose: () => void;
}

/**
 * Keyboard-accessible list alternative to the HTML5 Canvas graph so users can
 * tab through, focus, and inspect every loaded node without a pointer device.
 */
export const GraphNodeListPanel: React.FC<GraphNodeListPanelProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onClose,
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <aside
      id="graph-node-list"
      aria-label="Loaded graph nodes"
      className="absolute top-16 left-4 z-20 w-72 max-h-[calc(100%-7.5rem)] bg-surface/95 backdrop-blur-md border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text">
          Graph Nodes ({nodes.length})
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close node list"
          className="p-1 text-text-secondary hover:text-text rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      <ul className="overflow-y-auto divide-y divide-border-subtle p-1">
        {nodes.map(({ data }) => {
          const isSelected = data.id === selectedNodeId;
          const color = data.color || getEntityColor(data.entityType, isDark);
          return (
            <li key={data.id}>
              <button
                type="button"
                onClick={() => onSelectNode(data)}
                aria-current={isSelected ? "true" : undefined}
                className={`w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "bg-primary-tint text-primary font-semibold"
                    : "text-text hover:bg-surface-hover"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{data.label || data.id}</span>
                </span>
                <span className="text-[10px] text-text-secondary shrink-0">
                  {data.entityType || "Entity"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
