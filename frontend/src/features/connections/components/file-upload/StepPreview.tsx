import React from "react";
import type { ColumnConfig } from "../DataPreviewTable";
import { DataPreviewTable } from "../DataPreviewTable";

interface StepPreviewProps {
  columnsConfig: ColumnConfig[];
  rows: Record<string, unknown>[];
  toggleColumn: (colName: string) => void;
}

export const StepPreview: React.FC<StepPreviewProps> = ({
  columnsConfig,
  rows,
  toggleColumn,
}) => {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between select-none">
        <span className="text-xs text-zinc-400">
          Reviewing interactive records layout mapping to destination nodes.
        </span>
        <span className="text-xs text-zinc-500">
          {columnsConfig.filter((c) => c.active).length} of{" "}
          {columnsConfig.length} columns active
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <DataPreviewTable
          columns={columnsConfig}
          rows={rows}
          onToggleColumn={toggleColumn}
        />
      </div>
    </div>
  );
};
