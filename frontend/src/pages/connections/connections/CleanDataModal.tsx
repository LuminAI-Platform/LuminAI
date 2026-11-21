import React from "react";
import { BodyPortal } from "../../../components/ui/BodyPortal";
import {
  type IngestedFile,
  type CleanDataResponse,
  formatColumnHeader,
  renderCleanCellValue,
} from "./connectionsTypes";
import {
  ShieldCheck,
  Download,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "../../../lib/icons";
import {
  computeQualityCounts,
  exportCleanDataToCsv,
  filterCleanDataRows,
} from "./cleanDataUtils";
import { CleanDataToolbar } from "./CleanDataToolbar";

interface CleanDataModalProps {
  cleanPreviewFile: IngestedFile;
  cleanData: CleanDataResponse | null;
  isCleanDataLoading: boolean;
  cleanSearchFilter: string;
  setCleanSearchFilter: (v: string) => void;
  onClose: () => void;
}

export const CleanDataModal: React.FC<CleanDataModalProps> = ({
  cleanPreviewFile,
  cleanData,
  isCleanDataLoading,
  cleanSearchFilter,
  setCleanSearchFilter,
  onClose,
}) => {
  const [selectedTableFilter, setSelectedTableFilter] =
    React.useState<string>("ALL");
  const [selectedStateFilter, setSelectedStateFilter] =
    React.useState<string>("ALL");

  const availableTables = React.useMemo(() => {
    const set = new Set<string>();
    (cleanData?.rows || []).forEach((r) => {
      if (r._table) set.add(String(r._table));
    });
    return Array.from(set);
  }, [cleanData]);

  const filteredRows = React.useMemo(
    () =>
      filterCleanDataRows(
        cleanData?.rows || [],
        selectedTableFilter,
        selectedStateFilter,
        cleanSearchFilter,
      ),
    [cleanData, selectedTableFilter, selectedStateFilter, cleanSearchFilter],
  );

  const { verifiedCount, needsReviewCount, rejectedCount } =
    computeQualityCounts(cleanData);

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Semantic Clean Data View"
          className="bg-surface border border-border rounded-lg w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border bg-surface flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-success-bg border border-success-border flex items-center justify-center text-success">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  Semantic Clean Data View
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-bg border border-success-border text-success">
                    Golden Records & Quality
                  </span>
                </h3>
                <p className="text-[11px] text-text-secondary">
                  Source: {cleanPreviewFile.name} · Cleaned, deduplicated, and
                  standardized
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportCleanDataToCsv(cleanData, cleanPreviewFile.name)
                }
                disabled={!cleanData || cleanData.rows.length === 0}
                className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-text border border-border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export
                CSV
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close clean data view"
                className="p-1 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <CleanDataToolbar
            cleanPreviewFile={cleanPreviewFile}
            cleanData={cleanData}
            verifiedCount={verifiedCount}
            needsReviewCount={needsReviewCount}
            rejectedCount={rejectedCount}
            cleanSearchFilter={cleanSearchFilter}
            setCleanSearchFilter={setCleanSearchFilter}
            selectedStateFilter={selectedStateFilter}
            setSelectedStateFilter={setSelectedStateFilter}
            selectedTableFilter={selectedTableFilter}
            setSelectedTableFilter={setSelectedTableFilter}
            availableTables={availableTables}
          />

          {/* Content Table */}
          <div className="flex-1 overflow-auto bg-surface min-h-0">
            {isCleanDataLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-text-secondary">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">
                  Computing semantic clean view from parquet engine...
                </span>
              </div>
            ) : !cleanData || cleanData.rows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-secondary text-xs">
                No clean records returned for this dataset.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-surface-subtle border-b border-border z-10 shadow-xs">
                  <tr>
                    <th className="py-2.5 px-3 font-mono text-[10px] uppercase text-text-secondary w-12 text-center">
                      #
                    </th>
                    {cleanData.columns.map((col) => (
                      <th
                        key={col}
                        className="py-2.5 px-3 font-semibold text-text uppercase tracking-wider text-[11px] whitespace-nowrap"
                      >
                        {formatColumnHeader(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.slice(0, 200).map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-surface-hover transition-colors"
                    >
                      <td className="py-2 px-3 font-mono text-[10px] text-text-secondary text-center select-none">
                        {idx + 1}
                      </td>
                      {cleanData.columns.map((col) => (
                        <td key={col} className="py-2 px-3 whitespace-nowrap">
                          {renderCleanCellValue(col, row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 bg-surface border-t border-border text-[11px] text-text-secondary flex items-center justify-between shrink-0">
            <span>
              Showing {Math.min(filteredRows.length, 200)} of{" "}
              {cleanData?.rows?.length || 0} records
            </span>
            {rejectedCount > 0 || needsReviewCount > 0 ? (
              <span className="flex items-center gap-1.5 text-warning font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                DAMA/ISO 25012 Audited · {rejectedCount} Quarantined ·{" "}
                {needsReviewCount} Require Review
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-success font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> DAMA/ISO 25012 Audited
                · All Records Verified
              </span>
            )}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
};
