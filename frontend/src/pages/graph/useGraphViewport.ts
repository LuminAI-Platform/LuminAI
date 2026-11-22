import { useCallback, type RefObject } from "react";
import type { Core } from "cytoscape";
import type {
  GraphNodeData,
  GraphLayoutType,
} from "./components/GraphCanvas";

export function useGraphViewport(
  cyRef: RefObject<Core | null>,
  layoutType: GraphLayoutType,
  setSelectedNode: (node: GraphNodeData | null) => void,
) {
  const handleZoomIn = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.zoom({
      level: cyRef.current.zoom() * 1.25,
      renderedPosition: {
        x: cyRef.current.width() / 2,
        y: cyRef.current.height() / 2,
      },
    });
  }, [cyRef]);

  const handleZoomOut = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.zoom({
      level: cyRef.current.zoom() * 0.8,
      renderedPosition: {
        x: cyRef.current.width() / 2,
        y: cyRef.current.height() / 2,
      },
    });
  }, [cyRef]);

  const handleFit = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;
    cy.fit(undefined, 48);
    if (cy.nodes().length <= 2 && cy.zoom() > 1.25) {
      cy.zoom(1.25);
      cy.center();
    }
  }, [cyRef]);

  const handleReset = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;
    const layout = cy.layout({
      name: layoutType,
      animate: true,
      animationDuration: 400,
      padding: 48,
    } as cytoscape.LayoutOptions);
    layout.one("layoutstop", () => {
      cy.fit(undefined, 48);
      if (cy.nodes().length <= 2 && cy.zoom() > 1.25) {
        cy.zoom(1.25);
        cy.center();
      }
    });
    layout.run();
  }, [cyRef, layoutType]);

  const handleFocusNode = useCallback(
    (nodeData: GraphNodeData) => {
      setSelectedNode(nodeData);
      const cy = cyRef.current;
      if (!cy) return;
      cy.nodes().unselect();
      const target = cy.$id(nodeData.id);
      if (target.length > 0) {
        target.select();
        cy.animate({
          center: { eles: target },
          duration: 250,
        });
      }
    },
    [cyRef, setSelectedNode],
  );

  return {
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleReset,
    handleFocusNode,
  };
}
