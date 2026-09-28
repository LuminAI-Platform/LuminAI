import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Filter,
  Eye,
} from "lucide-react";
import type { GraphLayoutType } from "./GraphCanvas";

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
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
      {/* Zoom / Navigation Controls */}
      <div className="flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg p-1 shadow-xl">
        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onFit}
          title="Fit to Screen"
          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onReset}
          title="Reset Viewport"
          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Layout Selection */}
      <div className="flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg p-1 shadow-xl">
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
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Entity Type Filter */}
      {entityTypes.length > 0 && onSelectEntityType && (
        <div className="flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg px-2.5 py-1 shadow-xl text-xs gap-1.5">
          <Eye className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={selectedEntityType || ""}
            onChange={(e) => onSelectEntityType(e.target.value || null)}
            className="bg-transparent text-zinc-200 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">
              All Entity Types
            </option>
            {entityTypes.map((t) => (
              <option key={t} value={t} className="bg-zinc-900">
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Relationship Type Filter */}
      {relationshipTypes.length > 0 && onSelectRelType && (
        <div className="flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg px-2.5 py-1 shadow-xl text-xs gap-1.5">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={selectedRelType || ""}
            onChange={(e) => onSelectRelType(e.target.value || null)}
            className="bg-transparent text-zinc-200 outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">
              All Relationships
            </option>
            {relationshipTypes.map((r) => (
              <option key={r} value={r} className="bg-zinc-900">
                {r}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
