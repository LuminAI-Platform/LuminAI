import React from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "../../../lib/icons";
import type { GraphLayoutType } from "./GraphCanvas";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Select } from "../../../components/ui/dropdown";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";

interface GraphControlsProps {
  layoutType: GraphLayoutType;
  onChangeLayout: (layout: GraphLayoutType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  entityTypes?: string[];
  selectedEntityType?: string | null;
  onSelectEntityType?: (type: string | null) => void;
  relationshipTypes?: string[];
  selectedRelType?: string | null;
  onSelectRelType?: (type: string | null) => void;
}

/**
 * Control overlay toolbar for graph navigation, layout algorithms, and relationship filtering
 */
export const GraphControls: React.FC<GraphControlsProps> = ({
  layoutType,
  onChangeLayout,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  entityTypes = [],
  selectedEntityType,
  onSelectEntityType,
  relationshipTypes = [],
  selectedRelType,
  onSelectRelType,
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
      {/* Zoom / Navigation Controls */}
      <div className="flex items-center bg-surface/90 backdrop-blur-md border border-border rounded-lg p-1 shadow-xs">
        <Tooltip label="Zoom in">
          <button
            onClick={onZoomIn}
            className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label="Zoom out">
          <button
            onClick={onZoomOut}
            className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label="Fit to screen">
          <button
            onClick={onFit}
            className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label="Reset viewport">
          <button
            onClick={onReset}
            className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>

      {/* Layout Selection */}
      <div className="flex items-center bg-surface/90 backdrop-blur-md border border-border rounded-lg p-1 shadow-xs">
        {(
          [
            { id: "cose", label: "Force" },
            { id: "circle", label: "Circle" },
            { id: "concentric", label: "Concentric" },
            { id: "breadthfirst", label: "Tree" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeLayout(item.id)}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              layoutType === item.id
                ? "bg-primary text-primary-text shadow-xs"
                : "text-text-secondary hover:text-text hover:bg-surface-hover"
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

      {/* Shared Entity Types Legend */}
      {entityTypes.length > 0 && (
        <div className="flex items-center gap-2 bg-surface/90 backdrop-blur-md border border-border rounded-lg px-2.5 py-1 text-xs shadow-xs">
          <span className="text-[11px] font-semibold text-text-secondary select-none">
            Legend:
          </span>
          <div className="flex items-center gap-2.5 flex-wrap">
            {entityTypes.map((type) => {
              const color = getEntityColor(type, isDark);
              return (
                <div
                  key={type}
                  className="flex items-center gap-1.5 select-none"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] font-medium text-text">
                    {type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
