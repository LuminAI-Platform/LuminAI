import React from "react";
import { AlertCircle, RefreshCw } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import type { GraphErrorInfo } from "../graphDataUtils";

interface GraphErrorOverlayProps {
  errorInfo: GraphErrorInfo | null;
  activeEntityId: string | null;
  onRetry: () => void;
  onClearEntity: () => void;
}

export const GraphErrorOverlay: React.FC<GraphErrorOverlayProps> = ({
  errorInfo,
  activeEntityId,
  onRetry,
  onClearEntity,
}) => {
  return (
    <div
      role="alert"
      className="absolute inset-0 z-15 flex flex-col items-center justify-center rounded-lg overflow-y-auto bg-surface/90 backdrop-blur-xs text-center px-6 pt-16 pb-6"
    >
      <div className="w-12 h-12 rounded-lg bg-error-bg border border-error-border flex items-center justify-center text-error mb-3 shrink-0">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-text">
        Couldn&apos;t load the graph
      </h3>
      <p className="text-xs text-text-secondary max-w-md mt-1 mb-4 leading-relaxed">
        The graph service did not return a valid response. Check your connection
        or try again.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <Button
          size="sm"
          variant="primary"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Retry
        </Button>
        {activeEntityId && (
          <Button size="sm" variant="secondary" onClick={onClearEntity}>
            Choose another entity
          </Button>
        )}
      </div>

      <details className="w-full max-w-md text-left bg-surface-subtle border border-border rounded-lg px-3 py-2 text-xs text-text-secondary">
        <summary className="cursor-pointer font-medium text-text select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          Technical details
        </summary>
        <div className="mt-2 pt-2 border-t border-border-subtle space-y-1 font-mono text-[11px]">
          <div>
            Status:{" "}
            <span className="text-text font-semibold">
              {errorInfo?.statusCode ?? "Network error"}
            </span>
          </div>
          {errorInfo?.message && (
            <div className="break-words text-text-secondary">
              {errorInfo.message}
            </div>
          )}
        </div>
      </details>
    </div>
  );
};
