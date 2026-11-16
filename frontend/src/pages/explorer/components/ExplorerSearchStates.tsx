import React from "react";
import { RefreshCw } from "lucide-react";

export const ExplorerLoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 bg-surface-subtle border border-border rounded-lg gap-3">
    <RefreshCw className="w-6 h-6 text-text-secondary animate-spin" />
    <span className="text-xs text-text-secondary font-medium">
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
  <div className="flex flex-col items-center justify-center py-16 bg-error-bg border border-error-border rounded-lg text-center p-6">
    <span className="text-xs text-error font-bold mb-1">Search Error</span>
    <p className="text-[11px] text-text-secondary max-w-sm mb-4">{error}</p>
    <button
      onClick={onRetry}
      className="px-3.5 py-1.5 text-xs font-semibold text-text hover:text-text bg-transparent hover:bg-surface-hover border border-border rounded-lg transition-colors cursor-pointer"
    >
      Retry Search
    </button>
  </div>
);
