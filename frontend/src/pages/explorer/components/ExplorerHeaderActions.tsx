import React from "react";
import { Download, Eye, EyeOff } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";

interface ExplorerHeaderActionsProps {
  maskSensitiveData: boolean;
  onTogglePrivacyMask: () => void;
  filteredRecordCount: number;
  isExporting: boolean;
  onExportCsv: () => void;
}

export const ExplorerHeaderActions: React.FC<ExplorerHeaderActionsProps> = ({
  maskSensitiveData,
  onTogglePrivacyMask,
  filteredRecordCount,
  isExporting,
  onExportCsv,
}) => {
  const exportTooltip = `Export ${filteredRecordCount.toLocaleString()} filtered ${filteredRecordCount === 1 ? "record" : "records"}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Global Privacy Mask Toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={maskSensitiveData}
        onClick={onTogglePrivacyMask}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
          maskSensitiveData
            ? "bg-primary-tint border-primary-border text-primary"
            : "bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-hover"
        }`}
      >
        {maskSensitiveData ? (
          <EyeOff size={14} aria-hidden="true" />
        ) : (
          <Eye size={14} aria-hidden="true" />
        )}
        <span>Mask sensitive data</span>
      </button>

      {/* Export Clean CSV with filtered record scope */}
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
            className={`text-primary ${isExporting ? "animate-bounce motion-reduce:animate-none" : ""}`}
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
