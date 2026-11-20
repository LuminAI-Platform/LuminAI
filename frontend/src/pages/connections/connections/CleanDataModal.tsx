import React from "react";
import {
  type IngestedFile,
  type CleanDataResponse,
  formatColumnHeader,
  renderCleanCellValue,
} from "./connectionsTypes";
import {
  ShieldCheck,
  Download,
  Search,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "../../../lib/icons";

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

  const filteredRows = (cleanData?.rows || []).filter((r) => {
    if (selectedTableFilter !== "ALL" && r._table !== selectedTableFilter) {
      return false;
    }
    if (selectedStateFilter !== "ALL") {
      const stateStr = String(
        r.quality_state || r.record_state || r.qualityState || r.status || "",
      ).toUpperCase();
      if (!stateStr.includes(selectedStateFilter)) {
        return false;
      }
    }
    if (!cleanSearchFilter) return true;
    const q = cleanSearchFilter.toLowerCase();
    return Object.values(r).some((val) =>
      String(val).toLowerCase().includes(q),
    );
  });

  const exportCleanCsv = () => {
    if (!cleanData || !cleanData.rows || cleanData.rows.length === 0) return;
    const cols = cleanData.columns;
    const headerRow = cols.join(",");
    const bodyRows = cleanData.rows.map((row) =>
      cols
        .map((c) => {
          const v = row[c] ?? "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(","),
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + [headerRow, ...bodyRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `clean_${cleanPreviewFile.name.replace(/\.[^/.]+$/, "")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const verifiedCount =
    cleanData?.verifiedRecords ??
    (cleanData?.rows || []).filter(
      (r) =>
        String(r.quality_state || r.record_state || "").toUpperCase() ===
        "VERIFIED",
    ).length;

  const needsReviewCount =
    cleanData?.needsReviewRecords ??
    (cleanData?.rows || []).filter((r) =>
      String(r.quality_state || r.record_state || "")
        .toUpperCase()
        .includes("REVIEW"),
    ).length;

  const rejectedCount =
    cleanData?.rejectedRecords ??
    (cleanData?.rows || []).filter((r) =>
      String(r.quality_state || r.record_state || "")
        .toUpperCase()
        .includes("REJECT"),
    ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-surface border border-border rounded-lg w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border bg-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success-bg border border-success-border flex items-center justify-center text-success">
              <ShieldCheck className="w-4 h-4" />
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
              onClick={exportCleanCsv}
              disabled={!cleanData || cleanData.rows.length === 0}
              className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-text border border-border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="px-5 py-2.5 bg-surface-subtle border-b border-border flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-5">
            <div>
              <span className="text-[10px] uppercase text-text-secondary block font-semibold">
                Raw Records
              </span>
              <span className="font-mono text-text font-bold">
                {cleanData?.totalRawRecords ?? cleanPreviewFile.recordsCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-text-secondary block font-semibold">
                Clean Records
              </span>
              <span className="font-mono text-success font-bold">
                {cleanData?.totalCleanRecords ?? cleanPreviewFile.recordsCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-text-secondary block font-semibold">
                Duplicates Merged
              </span>
              <span className="font-mono text-primary font-bold">
                {cleanData?.duplicatesMerged ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-text-secondary block font-semibold">
                Verified
              </span>
              <span className="font-mono text-success font-bold">
                {verifiedCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-text-secondary block font-semibold">
                Needs Review
              </span>
              <span className="font-mono text-warning font-bold">
                {needsReviewCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-text-secondary block font-semibold">
                Quarantined
              </span>
              <span className="font-mono text-error font-bold">
                {rejectedCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-text-secondary block font-semibold">
                DAMA Quality Score
              </span>
              <span className="font-mono text-success font-bold">
                {cleanData?.dataQualityScore != null
                  ? `${cleanData.dataQualityScore}%`
                  : "N/A"}
              </span>
            </div>
          </div>
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter records..."
              value={cleanSearchFilter}
              onChange={(e) => setCleanSearchFilter(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-text placeholder:text-text-secondary focus:outline-none focus:border-border-focus"
            />
          </div>
        </div>

        {/* Quality State & Table Filters */}
        <div className="px-5 py-2 bg-surface border-b border-border flex items-center justify-between gap-4 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mr-1">
              Quality State:
            </span>
            {[
              { id: "ALL", label: "All" },
              { id: "VERIFIED", label: `Verified (${verifiedCount})` },
              { id: "REVIEW", label: `Review (${needsReviewCount})` },
              { id: "REJECT", label: `Quarantined (${rejectedCount})` },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStateFilter(st.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  selectedStateFilter === st.id
                    ? "bg-primary text-primary-text font-semibold shadow-xs"
                    : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {availableTables.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mr-1">
                Tables:
              </span>
              <button
                onClick={() => setSelectedTableFilter("ALL")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  selectedTableFilter === "ALL"
                    ? "bg-primary text-primary-text font-semibold shadow-xs"
                    : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
                }`}
              >
                All ({(cleanData?.rows || []).length})
              </button>
              {availableTables.map((tbl) => {
                const count = (cleanData?.rows || []).filter(
                  (r) => r._table === tbl,
                ).length;
                return (
                  <button
                    key={tbl}
                    onClick={() => setSelectedTableFilter(tbl)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                      selectedTableFilter === tbl
                        ? "bg-primary text-primary-text font-semibold shadow-xs"
                        : "bg-surface-subtle border border-border text-text-secondary hover:text-text"
                    }`}
                  >
                    {tbl} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
              <CheckCircle2 className="w-3.5 h-3.5" /> DAMA/ISO 25012 Audited ·
              All Records Verified
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
