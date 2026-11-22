import React, { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type EventObject } from "cytoscape";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import { buildCytoscapeStyles } from "./graphCanvasStyles";

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

function fitGraphNicely(cy: Core) {
  if (cy.nodes().length === 0) return;
  cy.resize();
  cy.fit(undefined, 56);
  if (cy.nodes().length <= 2 && cy.zoom() > 1.25) {
    cy.zoom(1.25);
    cy.center();
  }
}

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

  useEffect(() => {
    if (!containerRef.current || !hasValidSize || !hasNodes) {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
        if (onInitCyRef.current) onInitCyRef.current(null);
      }
      return;
    }

    const visibleNodeIds = new Set(elements.nodes.map((n) => n.data.id));

    const cyElements = [
      ...elements.nodes.map((n) => ({
        group: "nodes" as const,
        data: {
          ...n.data,
          label: n.data.label || n.data.id,
          color: n.data.color || getEntityColor(n.data.entityType, isDark),
        },
      })),
      ...elements.edges
        .filter(
          (e) =>
            visibleNodeIds.has(e.data.source) &&
            visibleNodeIds.has(e.data.target),
        )
        .map((e) => ({
          group: "edges" as const,
          data: {
            ...e.data,
            label: e.data.label || e.data.relationshipType || "",
          },
        })),
    ];

    const effectiveLayout = elements.nodes.length === 1 ? "preset" : layoutType;

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      boxSelectionEnabled: false,
      autounselectify: false,
      minZoom: 0.2,
      maxZoom: 3,
      style: buildCytoscapeStyles(isDark),
      layout: {
        name: effectiveLayout,
        animate: false,
        padding: 56,
      } as cytoscape.LayoutOptions,
    });

    cyRef.current = cy;
    if (onInitCyRef.current) onInitCyRef.current(cy);

    cy.on("tap", "node", (evt: EventObject) => {
      const nodeData = evt.target.data() as GraphNodeData;
      onSelectNodeRef.current(nodeData);
    });

    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        onSelectNodeRef.current(null);
      }
    });

    cy.on("dbltap", "node", (evt: EventObject) => {
      const nodeData = evt.target.data() as GraphNodeData;
      onExpandNodeRef.current(nodeData.id);
    });

    fitGraphNicely(cy);

    return () => {
      cy.destroy();
      cyRef.current = null;
      if (onInitCyRef.current) onInitCyRef.current(null);
    };
  }, [elements, layoutType, isDark, hasValidSize, hasNodes]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    if (selectedNodeId) {
      const selected = cy.$id(selectedNodeId);
      if (selected.length > 0) {
        selected.select();
      }
    }
  }, [selectedNodeId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-surface"
      style={{ minHeight: "100%" }}
    />
  );
};
