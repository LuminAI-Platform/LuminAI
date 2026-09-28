import React, { useEffect, useRef } from "react";
import cytoscape, { type Core, type EventObject } from "cytoscape";

export interface GraphNodeData {
  id: string;
  label: string;
  entityType?: string;
  properties?: Record<string, unknown>;
  color?: string;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  relationshipType?: string;
  weight?: number;
}

export interface GraphElements {
  nodes: Array<{ data: GraphNodeData }>;
  edges: Array<{ data: GraphEdgeData }>;
}

export type GraphLayoutType = "cose" | "circle" | "concentric" | "breadthfirst";

interface GraphCanvasProps {
  elements: GraphElements;
  layoutType?: GraphLayoutType;
  selectedNodeId?: string | null;
  onSelectNode: (node: GraphNodeData | null) => void;
  onExpandNode: (nodeId: string) => void;
  onInitCy?: (cy: Core) => void;
}

const TYPE_COLORS: Record<string, string> = {
  Person: "#3b82f6", // Blue
  Organization: "#10b981", // Emerald
  Product: "#8b5cf6", // Purple
  Dataset: "#f59e0b", // Amber
  Transaction: "#ec4899", // Pink
  Location: "#06b6d4", // Cyan
  Default: "#6366f1", // Indigo
};

/**
 * High-performance Cytoscape.js canvas with dark-mode styling and interactive physics
 */
export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  elements,
  layoutType = "cose",
  selectedNodeId,
  onSelectNode,
  onExpandNode,
  onInitCy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Convert elements to Cytoscape flat elements list
    const cyElements = [
      ...elements.nodes.map((n) => ({
        group: "nodes" as const,
        data: {
          ...n.data,
          color: n.data.color || TYPE_COLORS[n.data.entityType || ""] || TYPE_COLORS.Default,
        },
      })),
      ...elements.edges.map((e) => ({
        group: "edges" as const,
        data: {
          ...e.data,
          label: e.data.label || e.data.relationshipType || "",
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(color)",
            color: "#f4f4f5",
            "font-size": "11px",
            "font-family": "Inter, sans-serif",
            "font-weight": "bold",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-background-opacity": 0.8,
            "text-background-color": "#09090b",
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            width: 42,
            height: 42,
            "border-width": 2,
            "border-color": "#27272a",
            "transition-property": "border-width, border-color, width, height",
            "transition-duration": 0.2,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#ffffff",
            width: 48,
            height: 48,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#3f3f46",
            "target-arrow-color": "#71717a",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "9px",
            color: "#a1a1aa",
            "font-family": "Inter, sans-serif",
            "text-background-opacity": 0.9,
            "text-background-color": "#09090b",
            "text-background-padding": "2px",
            "text-rotation": "autorotate",
            "arrow-scale": 0.8,
          },
        },
        {
          selector: "edge:selected",
          style: {
            width: 2.5,
            "line-color": "#60a5fa",
            "target-arrow-color": "#60a5fa",
            color: "#93c5fd",
          },
        },
      ],
      layout: {
        name: layoutType,
        animate: true,
        animationDuration: 500,
        padding: 50,
      } as cytoscape.LayoutOptions,
    });

    cyRef.current = cy;
    if (onInitCy) onInitCy(cy);

    // Event: Node Click
    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target;
      onSelectNode(node.data());
    });

    // Event: Node Double Click -> Expand
    cy.on("dbltap", "node", (evt: EventObject) => {
      const node = evt.target;
      onExpandNode(node.id());
    });

    // Event: Tap background -> Deselect
    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        onSelectNode(null);
      }
    });

    // Highlight pre-selected node if given
    if (selectedNodeId) {
      const targetNode = cy.$id(selectedNodeId);
      if (targetNode.length > 0) {
        targetNode.select();
      }
    }

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, layoutType]);

  // Update selection dynamically without rebuilding the entire graph
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    if (selectedNodeId) {
      cy.nodes().unselect();
      const node = cy.$id(selectedNodeId);
      if (node.length > 0) {
        node.select();
      }
    }
  }, [selectedNodeId]);

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/80">
      {/* Background dot pattern */}
      <div className="absolute inset-0 bg-grid-dots opacity-40 pointer-events-none" />
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
