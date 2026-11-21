import React from "react";
import { X } from "../../../lib/icons";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import type { GraphNodeData } from "./GraphCanvas";

export interface GraphNodeListPanelProps {
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
