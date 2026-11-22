import type { StylesheetStyle } from "cytoscape";

export function readToken(varName: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
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
        width: 2,
        "line-color": edgeLineColor,
        "target-arrow-color": edgeArrowColor,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        label: "data(label)",
        color: edgeLabelColor,
        "font-size": "10px",
        "font-family": "Inter, system-ui, sans-serif",
        "text-rotation": "autorotate",
        "text-background-opacity": 0.85,
        "text-background-color": edgeTextBgColor,
        "text-background-padding": "2px",
        "text-background-shape": "roundrectangle",
        "arrow-scale": 1,
      },
    },
    {
      selector: "edge:selected",
      style: {
        width: 3.5,
        "line-color": edgeSelected,
        "target-arrow-color": edgeSelected,
      },
    },
  ];
}
