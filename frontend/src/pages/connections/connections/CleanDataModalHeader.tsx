import React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ShieldCheck, Download, X, ICON_SIZES } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { Tooltip } from "../../../components/ui/Tooltip";

interface CleanDataModalHeaderProps {
  sourceName: string;
  filteredCount: number;
  canExport: boolean;
  onExport: () => void;
  onClose: () => void;
}

export const CleanDataModalHeader: React.FC<CleanDataModalHeaderProps> = ({
  sourceName,
  filteredCount,
  canExport,
  onExport,
  onClose,
}) => {
  const exportLabel = `Export ${filteredCount.toLocaleString()} ${filteredCount === 1 ? "record" : "records"}`;

  return (
    <div className="px-6 py-4 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
          <ShieldCheck size={ICON_SIZES.card} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RadixDialog.Title className="text-base font-semibold text-text leading-snug">
              Semantic clean data view
            </RadixDialog.Title>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-subtle border border-border text-text-secondary">
              Cleaned data
            </span>
          </div>
          <RadixDialog.Description className="text-xs text-text-secondary mt-0.5 truncate">
            Source: {sourceName}
          </RadixDialog.Description>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip
          label={canExport ? exportLabel : "No records to export"}
          side="bottom"
        >
          <span className="inline-flex">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onExport}
              disabled={!canExport}
              leftIcon={
                <Download size={ICON_SIZES.inline} aria-hidden="true" />
              }
            >
              {exportLabel}
            </Button>
          </span>
        </Tooltip>
        <Tooltip label="Close dialog" side="left">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X size={ICON_SIZES.dropdown} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
