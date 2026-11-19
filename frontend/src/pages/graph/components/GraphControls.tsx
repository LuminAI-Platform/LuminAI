import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
} from "../../../lib/icons";
import type { GraphLayoutType } from "./GraphCanvas";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Select } from "../../../components/ui/dropdown";

export interface GraphControlsProps {
  layoutType: GraphLayoutType;
  onChangeLayout: (layout: GraphLayoutType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  disabled?: boolean;
  entityTypes?: string[];
  selectedEntityType?: string | null;
  onSelectEntityType?: (type: string | null) => void;
  relationshipTypes?: string[];
  selectedRelType?: string | null;
  onSelectRelType?: (type: string | null) => void;
  nodeCount?: number;
  isNodeListOpen?: boolean;
  onToggleNodeList?: () => void;
}

const LAYOUT_OPTIONS = [
  { id: "cose", label: "Force" },
  { id: "circle", label: "Circle" },
  { id: "concentric", label: "Concentric" },
  { id: "breadthfirst", label: "Tree" },
] as const;

/**
 * Control overlay toolbar for graph navigation, layout algorithms,
 * entity/relationship filtering, and keyboard-accessible node list toggle.
 */
export const GraphControls: React.FC<GraphControlsProps> = ({
  layoutType,
  onChangeLayout,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  disabled = false,
  entityTypes = [],
  selectedEntityType,
  onSelectEntityType,
  relationshipTypes = [],
  selectedRelType,
  onSelectRelType,
  nodeCount = 0,
  isNodeListOpen = false,
  onToggleNodeList,
}) => {
  const iconButtonClass =
    "p-1.5 text-text-secondary hover:text-text hover:bg-surface-hover rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div
      className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label="Graph controls"
    >
      {/* Zoom / Navigation Controls */}
      <div className="flex items-center bg-surface/95 backdrop-blur-md border border-border rounded-lg p-1 shadow-sm">
        <Tooltip label="Zoom in">
          <button
            type="button"
            onClick={onZoomIn}
            disabled={disabled}
            aria-label="Zoom in"
            className={iconButtonClass}
          >
            <ZoomIn className="w-4 h-4" aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label="Zoom out">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={disabled}
            aria-label="Zoom out"
            className={iconButtonClass}
          >
            <ZoomOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label="Fit graph to view">
          <button
            type="button"
            onClick={onFit}
            disabled={disabled}
            aria-label="Fit graph to view"
            className={iconButtonClass}
          >
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label="Reset layout">
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            aria-label="Reset layout"
            className={iconButtonClass}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Layout Selection */}
      <div
        className="flex items-center bg-surface/95 backdrop-blur-md border border-border rounded-lg p-1 shadow-sm"
        role="group"
        aria-label="Graph layout"
      >
        {LAYOUT_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            aria-pressed={layoutType === item.id}
            onClick={() => onChangeLayout(item.id)}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              layoutType === item.id && !disabled
                ? "bg-primary text-primary-text shadow-xs"
                : "text-text-secondary hover:text-text hover:bg-surface-hover disabled:hover:bg-transparent disabled:hover:text-text-secondary"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Entity Type Filter */}
      {entityTypes.length > 0 && onSelectEntityType && (
        <div className="w-44">
          <Select
            value={selectedEntityType || ""}
            onChange={(val) => onSelectEntityType(val || null)}
            options={[
              { value: "", label: "All Entity Types" },
              ...entityTypes.map((t) => ({ value: t, label: t })),
            ]}
            ariaLabel="Entity Type Filter"
            size="sm"
          />
        </div>
      )}

      {/* Relationship Type Filter */}
      {relationshipTypes.length > 0 && onSelectRelType && (
        <div className="w-44">
          <Select
            value={selectedRelType || ""}
            onChange={(val) => onSelectRelType(val || null)}
            options={[
              { value: "", label: "All Relationships" },
              ...relationshipTypes.map((r) => ({ value: r, label: r })),
            ]}
            ariaLabel="Relationship Type Filter"
            size="sm"
          />
        </div>
      )}

      {/* Keyboard-Accessible Node List Toggle */}
      {!disabled && nodeCount > 0 && onToggleNodeList && (
        <Tooltip label="Browse nodes with keyboard">
          <button
            type="button"
            onClick={onToggleNodeList}
            aria-expanded={isNodeListOpen}
            aria-controls="graph-node-list"
            aria-label={`Toggle node list (${nodeCount} nodes)`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isNodeListOpen
                ? "bg-primary text-primary-text border-primary"
                : "bg-surface/95 backdrop-blur-md text-text-secondary hover:text-text hover:bg-surface-hover border-border"
            }`}
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Nodes ({nodeCount})</span>
          </button>
        </Tooltip>
      )}
    </div>
  );
};
