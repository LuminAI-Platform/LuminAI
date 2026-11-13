import React, { useEffect, useRef } from "react";
import cytoscape, { type Core, type EventObject } from "cytoscape";
import { useThemeStore } from "../../../stores/themeStore";

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

/**
 * Color-blind-safe palette (Okabe-Ito subset calibrated with Luminex Navy)
 * Rule 7: For charts and graphs, use a color-blind-safe set of about five colors,
 * and don't rely on red versus green alone.
 */
const TYPE_COLORS: Record<string, string> = {
  Person: "#12297A", // Luminex Navy
  Organization: "#009E73", // Teal / Bluish Green
  Product: "#CC79A7", // Reddish Purple
  Dataset: "#E69F00", // Amber / Orange
  Transaction: "#56B4E9", // Sky Blue
  Location: "#566176", // Calm Neutral
  Default: "#12297A", // Luminex Navy
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

  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  const onSelectNodeRef = useRef(onSelectNode);
  const onExpandNodeRef = useRef(onExpandNode);
  const onInitCyRef = useRef(onInitCy);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
    onExpandNodeRef.current = onExpandNode;
    onInitCyRef.current = onInitCy;
  }, [onSelectNode, onExpandNode, onInitCy]);

  useEffect(() => {
    if (!containerRef.current) return;

    const nodeLabelColor = isDark ? "#E9EDF4" : "#1A2230";
    const nodeTextBgColor = isDark ? "#1A202A" : "#FFFFFF";
    const nodeBorderColor = isDark ? "#2C3441" : "#DFE3EA";
    const nodeSelectedBorder = isDark ? "#6B97FF" : "#12297A";
    const edgeLineColor = isDark ? "#2C3441" : "#DFE3EA";
    const edgeArrowColor = isDark ? "#A3ADBF" : "#566176";
    const edgeLabelColor = isDark ? "#A3ADBF" : "#566176";
    const edgeTextBgColor = isDark ? "#1A202A" : "#FFFFFF";
    const edgeSelected = isDark ? "#6B97FF" : "#12297A";

    // Convert elements to Cytoscape flat elements list
    const cyElements = [
      ...elements.nodes.map((n) => ({
        group: "nodes" as const,
        data: {
          ...n.data,
          color:
            n.data.color ||
            TYPE_COLORS[n.data.entityType || ""] ||
            TYPE_COLORS.Default,
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
            color: nodeLabelColor,
            "font-size": "11px",
            "font-family": "Inter, sans-serif",
            "font-weight": "bold",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-background-opacity": 0.85,
            "text-background-color": nodeTextBgColor,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            width: 42,
            height: 42,
            "border-width": 2,
            "border-color": nodeBorderColor,
            "transition-property": "border-width, border-color, width, height",
            "transition-duration": 0.2,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": nodeSelectedBorder,
            width: 48,
            height: 48,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": edgeLineColor,
            "target-arrow-color": edgeArrowColor,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "9px",
            color: edgeLabelColor,
            "font-family": "Inter, sans-serif",
            "text-background-opacity": 0.85,
            "text-background-color": edgeTextBgColor,
            "text-background-padding": "2px",
            "text-rotation": "autorotate",
            "arrow-scale": 0.8,
          },
        },
        {
          selector: "edge:selected",
          style: {
            width: 2.5,
            "line-color": edgeSelected,
            "target-arrow-color": edgeSelected,
            color: edgeSelected,
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
    if (onInitCyRef.current) onInitCyRef.current(cy);

    // Event: Node Click
    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target;
      onSelectNodeRef.current(node.data());
    });

    // Event: Node Double Click -> Expand
    cy.on("dbltap", "node", (evt: EventObject) => {
      const node = evt.target;
      onExpandNodeRef.current(node.id());
    });

    // Event: Tap background -> Deselect
    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        onSelectNodeRef.current(null);
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, layoutType, isDark]);

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
    <div className="relative w-full h-full bg-surface rounded-lg overflow-hidden border border-border">
      {/* Background dot pattern */}
      <div className="absolute inset-0 bg-grid-dots opacity-30 pointer-events-none" />
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
