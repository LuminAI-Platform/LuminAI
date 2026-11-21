import type cytoscape from "cytoscape";
import type { Core, ElementDefinition, StylesheetStyle } from "cytoscape";
import { getEntityColor } from "../../../lib/entityColors";
import type { GraphElements, GraphLayoutType } from "./GraphCanvas";

export function readToken(varName: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

export function fitGraphNicely(cy: Core): void {
  if (cy.nodes().length === 0) return;
  cy.resize();
  cy.fit(undefined, 56);
  if (cy.nodes().length <= 2 && cy.zoom() > 1.25) {
    cy.zoom(1.25);
    cy.center();
  }
}

export function buildCytoscapeElements(
  elements: GraphElements,
  isDark: boolean,
): ElementDefinition[] {
  const visibleNodeIds = new Set(elements.nodes.map((n) => n.data.id));

  // Include ALL nodes (including isolated nodes with 0 edges) and only valid edges
  return [
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
}

export function buildCytoscapeStyles(isDark: boolean): StylesheetStyle[] {
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

  return [
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
  ];
}

export function runCytoscapeLayout(
  cy: Core,
  effectiveLayout: GraphLayoutType | "preset",
): void {
  if (effectiveLayout === "preset") {
    const centerX = cy.width() / 2;
    const centerY = cy.height() / 2;
    cy.nodes().positions(() => ({
      x: centerX,
      y: centerY,
    }));
    fitGraphNicely(cy);
    return;
  }

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
