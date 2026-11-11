import { useState, useEffect, useCallback, useRef } from "react";
import type { SchemaMapping } from "./visualSchemaTypes";

export function useConnectorLines(
  mappings: SchemaMapping[],
  draggingColId: string | null,
  hoverPropId: string | null,
) {
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const propRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [connectorLines, setConnectorLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; id: string }[]
  >([]);
  const [dragPreviewLine, setDragPreviewLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const recalcLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const lines = mappings.map((m) => {
      const srcEl = sourceRefs.current[m.sourceColumnId];
      const propEl = propRefs.current[m.ontologyPropertyId];
      if (!srcEl || !propEl) return null;
      const srcRect = srcEl.getBoundingClientRect();
      const propRect = propEl.getBoundingClientRect();
      return {
        id: `${m.sourceColumnId}-${m.ontologyPropertyId}`,
        x1: srcRect.right - containerRect.left,
        y1: srcRect.top - containerRect.top + srcRect.height / 2,
        x2: propRect.left - containerRect.left,
        y2: propRect.top - containerRect.top + propRect.height / 2,
      };
    });
    setConnectorLines(lines.filter(Boolean) as typeof connectorLines);
  }, [mappings]);

  useEffect(() => {
    if (!draggingColId || !hoverPropId || !containerRef.current) {
      setDragPreviewLine(null);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const srcEl = sourceRefs.current[draggingColId];
    const propEl = propRefs.current[hoverPropId];
    if (!srcEl || !propEl) {
      setDragPreviewLine(null);
      return;
    }
    const sRect = srcEl.getBoundingClientRect();
    const pRect = propEl.getBoundingClientRect();
    setDragPreviewLine({
      x1: sRect.right - containerRect.left,
      y1: sRect.top - containerRect.top + sRect.height / 2,
      x2: pRect.left - containerRect.left,
      y2: pRect.top - containerRect.top + pRect.height / 2,
    });
  }, [draggingColId, hoverPropId]);

  useEffect(() => {
    recalcLines();
    const frame = requestAnimationFrame(recalcLines);
    const timer = setTimeout(recalcLines, 120);
    window.addEventListener("resize", recalcLines);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener("resize", recalcLines);
    };
  }, [recalcLines]);

  return {
    sourceRefs,
    propRefs,
    containerRef,
    connectorLines,
    dragPreviewLine,
    recalcLines,
  };
}
