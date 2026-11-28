import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Table } from "../../../lib/icons";
import { fetchDatasetPreview } from "../../../features/datasets/datasetApi";

interface DatasetPreviewTabProps {
  datasetId: string;
}

export const DatasetPreviewTab: React.FC<DatasetPreviewTabProps> = ({
  datasetId,
}) => {
  const [limit, setLimit] = useState<number>(100);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dataset-preview", datasetId, limit],
    queryFn: () => fetchDatasetPreview(datasetId, limit),
    enabled: !!datasetId,
  });

  if (isLoading) {
    return (
      <div className="p-12 rounded-xl border border-border bg-surface flex items-center justify-center gap-2 text-xs text-text-secondary">
        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
        <span>Streaming dataset sample rows...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 rounded-xl border border-error/30 bg-error/10 text-error text-xs">
        {(error as Error)?.message || "Failed to load dataset preview."}
      </div>
    );
  }

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-surface-subtle/40">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-text">Data Preview</h3>
          <span className="text-xs font-mono text-text-secondary">
            Showing {data?.previewCount ?? rows.length} of{" "}
            {(data?.totalRows ?? rows.length).toLocaleString()} rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="preview-limit-select"
            className="text-xs text-text-secondary"
          >
            Sample size:
          </label>
          <select
            id="preview-limit-select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text"
          >
            {[50, 100, 250, 500].map((val) => (
              <option key={val} value={val}>
                {val} rows
              </option>
            ))}
          </select>
          <button
            onClick={() => void refetch()}
            className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-subtle text-text-secondary hover:text-text cursor-pointer"
            title="Refresh sample"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-secondary">
          No preview rows found for this dataset artifact. Ensure the source
          connection has been synced or uploaded.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle sticky top-0 border-b border-border text-text-secondary font-semibold">
              <tr>
                {columns.map((col) => (
                  <th key={col.name} className="py-2.5 px-4 font-mono">
                    {col.name}
                    <span className="block text-[10px] font-normal text-purple-400">
                      {col.type}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-subtle/40">
                  {columns.map((col) => {
                    const val = row[col.name];
                    const isNull =
                      val === null || val === undefined || val === "";
                    return (
                      <td
                        key={col.name}
                        className="py-2 px-4 whitespace-nowrap text-text"
                      >
                        {isNull ? (
                          <span className="italic text-text-secondary">
                            NULL
                          </span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
