import React, { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type EventObject } from "cytoscape";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";

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

function readToken(varName: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
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

    const nodeLabelColor = readToken(
      "--color-text",
      isDark ? "#e9edf4" : "#1a2230",
    );
    const nodeTextBgColor = readToken(
      "--color-surface",
      isDark ? "#1a202a" : "#ffffff",
    );
    const nodeBorderColor = readToken(
      "--color-border",
      isDark ? "#2c3441" : "#dfe3ea",
    );
    const nodeSelectedBorder = readToken(
      "--color-primary",
      isDark ? "#6b97ff" : "#12297a",
    );
    const edgeLineColor = readToken(
      "--color-border",
      isDark ? "#2c3441" : "#dfe3ea",
    );
    const edgeArrowColor = readToken(
      "--color-text-secondary",
      isDark ? "#a3adbf" : "#566176",
    );
    const edgeLabelColor = readToken(
      "--color-text-secondary",
      isDark ? "#a3adbf" : "#566176",
    );
    const edgeTextBgColor = readToken(
      "--color-surface",
      isDark ? "#1a202a" : "#ffffff",
    );
    const edgeSelected = readToken(
      "--color-primary",
      isDark ? "#6b97ff" : "#12297a",
    );

    const visibleNodeIds = new Set(elements.nodes.map((n) => n.data.id));

    // Include ALL nodes (including isolated nodes with 0 edges) and only valid edges
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
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(color)",
            color: nodeLabelColor,
            "font-size": "12px",
            "font-family": "Inter, system-ui, sans-serif",
            "font-weight": "bold",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "text-background-opacity": 0.9,
            "text-background-color": nodeTextBgColor,
            "text-background-padding": "4px",
            "text-background-shape": "roundrectangle",
            width: 46,
            height: 46,
            "border-width": 2,
            "border-color": nodeBorderColor,
            "transition-property": "border-width, border-color, width, height",
            "transition-duration": 0.2,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3.5,
            "border-color": nodeSelectedBorder,
            width: 52,
            height: 52,
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
            "font-size": "10px",
            color: edgeLabelColor,
            "font-family": "Inter, system-ui, sans-serif",
            "text-background-opacity": 0.9,
            "text-background-color": edgeTextBgColor,
            "text-background-padding": "2px",
            "text-rotation": "autorotate",
            "arrow-scale": 0.85,
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
      layout: { name: "preset" },
    });

    cyRef.current = cy;
    if (onInitCyRef.current) onInitCyRef.current(cy);

    // Run layout explicitly and fit to view once layout completes
    if (effectiveLayout === "preset") {
      const centerX = cy.width() / 2;
      const centerY = cy.height() / 2;
      cy.nodes().positions(() => ({
        x: centerX,
        y: centerY,
      }));
      fitGraphNicely(cy);
    } else {
      const layout = cy.layout({
        name: effectiveLayout,
        animate: true,
        animationDuration: 400,
        padding: 56,
        fit: true,
      } as cytoscape.LayoutOptions);
      layout.one("layoutstop", () => {
        fitGraphNicely(cy);
      });
      layout.run();
    }

    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target;
      onSelectNodeRef.current(node.data());
    });

    cy.on("dbltap", "node", (evt: EventObject) => {
      const node = evt.target;
      onExpandNodeRef.current(node.id());
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
