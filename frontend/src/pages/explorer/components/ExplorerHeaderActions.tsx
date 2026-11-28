import React from "react";
import { Download, Eye, EyeOff } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";

interface ExplorerHeaderActionsProps {
  maskSensitiveData: boolean;
  onToggleMask: () => void;
  isExporting: boolean;
  filteredRecordCount: number;
  onExportCsv: () => void;
}

export const ExplorerHeaderActions: React.FC<ExplorerHeaderActionsProps> = ({
  maskSensitiveData,
  onToggleMask,
  isExporting,
  filteredRecordCount,
  onExportCsv,
}) => {
  const isShown = !maskSensitiveData;
  const exportTooltip = `Export ${filteredRecordCount.toLocaleString()} filtered ${
    filteredRecordCount === 1 ? "record" : "records"
  }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={isShown}
        aria-label={`Sensitive data: ${isShown ? "Shown" : "Hidden"}`}
        onClick={onToggleMask}
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-150 motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          maskSensitiveData
            ? "bg-surface border-border text-text hover:bg-surface-hover"
            : "bg-warning-bg border-warning-border text-warning hover:opacity-90"
        }`}
      >
        {maskSensitiveData ? (
          <EyeOff
            size={14}
            className="text-text-secondary shrink-0"
            aria-hidden="true"
          />
        ) : (
          <Eye size={14} className="shrink-0" aria-hidden="true" />
        )}
        <span className="whitespace-nowrap">
          Sensitive data:{" "}
          <strong className="font-semibold">
            {isShown ? "Shown" : "Hidden"}
          </strong>
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-150 motion-reduce:transition-none ${
            isShown ? "bg-warning" : "bg-border"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full bg-surface shadow-xs transition-transform duration-150 motion-reduce:transition-none ${
              isShown ? "translate-x-3.5" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>

      <Tooltip label={exportTooltip} side="bottom">
        <button
          type="button"
          onClick={onExportCsv}
          disabled={isExporting || filteredRecordCount === 0}
          title={exportTooltip}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-xs font-semibold text-text transition-colors duration-150 motion-reduce:transition-none cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download
            size={14}
            className={`text-primary ${
              isExporting ? "animate-bounce motion-reduce:animate-none" : ""
            }`}
            aria-hidden="true"
          />
          <span>
            {isExporting
              ? "Exporting..."
              : `Export Clean CSV (${filteredRecordCount.toLocaleString()})`}
          </span>
        </button>
      </Tooltip>
    </div>
  );
};
