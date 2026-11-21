import React, { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type EventObject } from "cytoscape";
import { useThemeStore } from "../../../stores/themeStore";
import {
  buildCytoscapeElements,
  buildCytoscapeStyles,
  fitGraphNicely,
  runCytoscapeLayout,
} from "./graphCanvasUtils";

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
  onInitCy?: (cy: Core | null) => void;
}

/**
 * Cytoscape.js graph canvas with ResizeObserver-backed sizing, theme token styling,
 * isolated-node support, and automatic fit-to-view after layout completion.
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
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const isDark = useThemeStore((s) => s.isDark);

  const onSelectNodeRef = useRef(onSelectNode);
  const onExpandNodeRef = useRef(onExpandNode);
  const onInitCyRef = useRef(onInitCy);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
    onExpandNodeRef.current = onExpandNode;
    onInitCyRef.current = onInitCy;
  }, [onSelectNode, onExpandNode, onInitCy]);

  // Track container dimensions via ResizeObserver so layout never runs on a 0x0 canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = (width: number, height: number) => {
      const w = Math.round(width);
      const h = Math.round(height);
      setContainerSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h },
      );
      if (cyRef.current && w > 0 && h > 0) {
        fitGraphNicely(cyRef.current);
      }
    };

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      updateSize(rect.width, rect.height);
    }

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          updateSize(entry.contentRect.width, entry.contentRect.height);
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    const handleResize = () => {
      const r = el.getBoundingClientRect();
      updateSize(r.width, r.height);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasValidSize = containerSize.width > 0 && containerSize.height > 0;
  const hasNodes = elements.nodes.length > 0;

  // Initialize Cytoscape and run layout only after BOTH data and container size are known
  useEffect(() => {
    if (!containerRef.current || !hasValidSize || !hasNodes) {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
        if (onInitCyRef.current) onInitCyRef.current(null);
      }
      return;
    }

    const cyElements = buildCytoscapeElements(elements, isDark);
    const effectiveLayout = elements.nodes.length === 1 ? "preset" : layoutType;

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      boxSelectionEnabled: false,
      autounselectify: false,
      minZoom: 0.2,
      maxZoom: 3,
      style: buildCytoscapeStyles(isDark),
      layout: { name: "preset" },
    });

    cyRef.current = cy;
    if (onInitCyRef.current) onInitCyRef.current(cy);

    runCytoscapeLayout(cy, effectiveLayout);

    cy.on("tap", "node", (evt: EventObject) => {
      onSelectNodeRef.current(evt.target.data());
    });

    cy.on("dbltap", "node", (evt: EventObject) => {
      onExpandNodeRef.current(evt.target.id());
    });

    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        onSelectNodeRef.current(null);
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
      if (onInitCyRef.current) onInitCyRef.current(null);
    };
  }, [elements, layoutType, isDark, hasValidSize, hasNodes]);

  // Update selection dynamically without rebuilding the entire graph
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().unselect();
    if (selectedNodeId) {
      const node = cy.$id(selectedNodeId);
      if (node.length > 0) {
        node.select();
      }
    }
  }, [selectedNodeId]);

  return (
    <div className="relative w-full h-full min-h-[520px] bg-surface rounded-lg overflow-hidden border border-border">
      {/* Subtle background dot grid */}
      <div
        className="absolute inset-0 bg-grid-dots opacity-30 pointer-events-none"
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="img"
        aria-label={
          hasNodes
            ? `Knowledge graph canvas showing ${elements.nodes.length} nodes and ${elements.edges.length} edges`
            : "Knowledge graph canvas"
        }
        className="w-full h-full min-h-[520px] cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
