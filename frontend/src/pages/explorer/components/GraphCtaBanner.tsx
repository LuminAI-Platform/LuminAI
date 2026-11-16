import React from "react";
import { Share2 } from "lucide-react";

interface GraphCtaBannerProps {
  onExploreGraph: () => void;
}

export const GraphCtaBanner: React.FC<GraphCtaBannerProps> = ({
  onExploreGraph,
}) => {
  return (
    <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-6 py-4">
      <div>
        <h3 className="text-sm font-bold text-text mb-1">
          Visualize entity connections
        </h3>
        <p className="text-xs text-text-secondary max-w-sm">
          Open this entity in the Knowledge Graph to explore its semantic
          relationships, neighbour links, and relationship degrees.
        </p>
      </div>
      <button
        id="explore-graph-banner-btn"
        onClick={onExploreGraph}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-text text-xs font-semibold rounded-lg border border-primary transition-all duration-200 cursor-pointer shrink-0 ml-4 shadow-xs"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>Open in Graph</span>
      </button>
    </div>
  );
};
