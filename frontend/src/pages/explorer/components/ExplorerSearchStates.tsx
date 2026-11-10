import React from "react";
import { RefreshCw } from "lucide-react";

export const ExplorerLoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/10 border border-zinc-900 rounded-2xl gap-3">
    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
    <span className="text-xs text-zinc-500 font-medium">
      Searching OpenSearch cluster...
    </span>
  </div>
);

interface ExplorerErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const ExplorerErrorState: React.FC<ExplorerErrorStateProps> = ({
  error,
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center py-16 bg-red-950/10 border border-red-500/20 rounded-2xl text-center p-6">
    <span className="text-xs text-red-400 font-bold mb-1">Search Error</span>
    <p className="text-[11px] text-zinc-500 max-w-sm mb-4">{error}</p>
    <button
      onClick={onRetry}
      className="px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
    >
      Retry Search
    </button>
  </div>
);
