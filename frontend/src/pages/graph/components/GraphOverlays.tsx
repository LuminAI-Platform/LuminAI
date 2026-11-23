import React from "react";
import { Link } from "@tanstack/react-router";
import { Icons, Loader2, Database, Info } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import type {
  GraphErrorInfo,
  GraphViewState,
  SuggestedEntity,
} from "../graphDataUtils";
import { GraphErrorOverlay } from "./GraphErrorOverlay";
import { GraphIdleOverlay } from "./GraphIdleOverlay";

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
      <GraphErrorOverlay
        errorInfo={errorInfo}
        activeEntityId={activeEntityId}
        onRetry={onRetry}
        onClearEntity={onClearEntity}
      />
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
      <GraphIdleOverlay
        suggestedEntities={suggestedEntities}
        onSelectEntity={onSelectEntity}
        onFocusSearch={onFocusSearch}
      />
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
        <Link to="/connections">
          <Button size="sm" variant="secondary">
            Data Connections
          </Button>
        </Link>
      </div>
    );
  }

  return null;
};

export { GraphNodeListPanel } from "./GraphNodeListPanel";
