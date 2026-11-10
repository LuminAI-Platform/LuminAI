import React from "react";
import { Share2 } from "lucide-react";

interface GraphCtaBannerProps {
  onExploreGraph: () => void;
}

export const GraphCtaBanner: React.FC<GraphCtaBannerProps> = ({
  onExploreGraph,
}) => {
  return (
    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-6 py-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-200 mb-1">
          Visualize entity connections
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm">
          Open this entity in the Knowledge Graph to explore its semantic
          relationships, neighbour links, and relationship degrees.
        </p>
      </div>
      <button
        id="explore-graph-banner-btn"
        onClick={onExploreGraph}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg border border-blue-500/40 hover:border-blue-400/60 transition-all duration-200 cursor-pointer shrink-0 ml-4"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>Open in Graph</span>
      </button>
    </div>
  );
};
