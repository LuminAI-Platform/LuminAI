import React, { useMemo, useState, useEffect } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import type { IngestedFile, CleanDataResponse } from "./connectionsTypes";
import { AlertTriangle, RefreshCw, ICON_SIZES } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { BrandLoader } from "../../../components/ui/BrandLoader";
import { CleanDataModalHeader } from "./CleanDataModalHeader";
import { CleanDataTelemetryStrip } from "./CleanDataTelemetryStrip";
import { CleanDataFilterBar, type CleanStateTab } from "./CleanDataFilterBar";
import { CleanDataTable } from "./CleanDataTable";
import { CleanDataRowPanel } from "./CleanDataRowPanel";
import {
  exportCleanRowsToCsv,
  extractBusinessColumns,
  getRowQualityState,
  getRowReasons,
  sortCleanRows,
} from "./cleanDataUtils";

interface CleanDataModalProps {
  cleanPreviewFile: IngestedFile;
  cleanData: CleanDataResponse | null;
  cleanDataError?: string | null;
  isCleanDataLoading: boolean;
  cleanSearchFilter: string;
  setCleanSearchFilter: (v: string) => void;
  onRetry?: () => void;
  onClose: () => void;
}

export const CleanDataModal: React.FC<CleanDataModalProps> = ({
  cleanPreviewFile,
  cleanData,
  cleanDataError = null,
  isCleanDataLoading,
  cleanSearchFilter,
  setCleanSearchFilter,
  onRetry,
  onClose,
}) => {
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>("ALL");
  const [selectedStateFilter, setSelectedStateFilter] =
    useState<CleanStateTab>("ALL");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedTableFilter("ALL");
    setSelectedStateFilter("ALL");
    setHiddenColumns(new Set());
    setSortColumn(null);
    setSelectedRowIndex(null);
  }, [cleanPreviewFile.id]);

  const rows = useMemo(() => cleanData?.rows ?? [], [cleanData]);
  const businessColumns = useMemo(
    () => extractBusinessColumns(cleanData?.columns ?? []),
    [cleanData?.columns],
  );
  const visibleColumns = useMemo(
    () => businessColumns.filter((c) => !hiddenColumns.has(c)),
    [businessColumns, hiddenColumns],
  );
  const availableTables = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r._table) set.add(String(r._table));
    });
    return Array.from(set);
  }, [rows]);

  const verifiedCount =
    cleanData?.verifiedRecords ??
    rows.filter((r) => getRowQualityState(r) === "VERIFIED").length;
  const needsReviewCount =
    cleanData?.needsReviewRecords ??
    rows.filter((r) => getRowQualityState(r) === "NEEDS_REVIEW").length;
  const rejectedCount =
    cleanData?.rejectedRecords ??
    rows.filter((r) => getRowQualityState(r) === "QUARANTINED").length;

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (selectedTableFilter !== "ALL" && r._table !== selectedTableFilter) {
        return false;
      }
      if (
        selectedStateFilter !== "ALL" &&
        getRowQualityState(r) !== selectedStateFilter
      ) {
        return false;
      }
      if (!cleanSearchFilter.trim()) return true;
      const q = cleanSearchFilter.trim().toLowerCase();
      return Object.values(r).some((val) =>
        String(val ?? "")
          .toLowerCase()
          .includes(q),
      );
    });
    return sortCleanRows(filtered, sortColumn, sortDir);
  }, [
    rows,
    selectedTableFilter,
    selectedStateFilter,
    cleanSearchFilter,
    sortColumn,
    sortDir,
  ]);

  const showReasonColumn =
    selectedStateFilter === "QUARANTINED" ||
    selectedStateFilter === "NEEDS_REVIEW" ||
    filteredRows.some((r) => getRowReasons(r).length > 0);

  const handleSort = (col: string) => {
    if (sortColumn === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(col);
      setSortDir("asc");
    }
    setSelectedRowIndex(null);
  };

  const handleToggleColumn = (col: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const selectedRow =
    selectedRowIndex !== null ? (filteredRows[selectedRowIndex] ?? null) : null;
  const hasIssues = rejectedCount > 0 || needsReviewCount > 0;
  const portalContainer =
    typeof document !== "undefined" ? document.body : undefined;

  return (
    <RadixDialog.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <RadixDialog.Portal container={portalContainer}>
        <RadixDialog.Overlay className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-xs animate-dialog-backdrop" />
        <RadixDialog.Content
          aria-modal="true"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99999] bg-surface border border-border rounded-xl w-[calc(100vw-32px)] max-w-6xl h-[86vh] flex flex-col overflow-hidden shadow-lg focus:outline-none animate-dialog-content"
        >
          <CleanDataModalHeader
            sourceName={cleanPreviewFile.name}
            filteredCount={filteredRows.length}
            canExport={!isCleanDataLoading && filteredRows.length > 0}
            onExport={() =>
              cleanData &&
              exportCleanRowsToCsv(
                cleanData.columns,
                filteredRows,
                cleanPreviewFile.name,
              )
            }
            onClose={onClose}
          />
          <CleanDataTelemetryStrip
            cleanData={cleanData}
            recordsCount={cleanPreviewFile.recordsCount}
            verifiedCount={verifiedCount}
            needsReviewCount={needsReviewCount}
            rejectedCount={rejectedCount}
            cleanSearchFilter={cleanSearchFilter}
            onSearchChange={setCleanSearchFilter}
          />
          <CleanDataFilterBar
            selectedStateFilter={selectedStateFilter}
            onSelectStateFilter={(tab) => {
              setSelectedStateFilter(tab);
              setSelectedRowIndex(null);
            }}
            verifiedCount={verifiedCount}
            needsReviewCount={needsReviewCount}
            rejectedCount={rejectedCount}
            availableTables={availableTables}
            selectedTableFilter={selectedTableFilter}
            onSelectTableFilter={(tbl) => {
              setSelectedTableFilter(tbl);
              setSelectedRowIndex(null);
            }}
            totalRowsCount={rows.length}
            rows={rows}
            allColumns={businessColumns}
            hiddenColumns={hiddenColumns}
            onToggleColumn={handleToggleColumn}
            onResetColumns={() => setHiddenColumns(new Set())}
          />

          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {isCleanDataLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-secondary">
                <BrandLoader variant="inline" size={24} />
                <span className="text-xs">
                  Loading cleaned records from the data engine...
                </span>
              </div>
            ) : cleanDataError ? (
              <div
                role="alert"
                className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-error-bg border border-error-border text-error flex items-center justify-center">
                  <AlertTriangle size={ICON_SIZES.header} aria-hidden="true" />
                </div>
                <div className="max-w-md space-y-1">
                  <p className="text-sm font-semibold text-text">
                    Failed to load clean records
                  </p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {cleanDataError}
                  </p>
                </div>
                {onRetry && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onRetry}
                    leftIcon={
                      <RefreshCw size={ICON_SIZES.inline} aria-hidden="true" />
                    }
                  >
                    Retry
                  </Button>
                )}
              </div>
            ) : !cleanData || filteredRows.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-secondary text-xs px-6 text-center">
                {rows.length === 0
                  ? "No clean records returned for this dataset."
                  : "No loaded records match the current filter."}
              </div>
            ) : (
              <>
                <CleanDataTable
                  rows={filteredRows}
                  visibleColumns={visibleColumns}
                  showReasonColumn={showReasonColumn}
                  sortColumn={sortColumn}
                  sortDir={sortDir}
                  onSort={handleSort}
                  selectedRowIndex={selectedRowIndex}
                  onSelectRow={(idx) =>
                    setSelectedRowIndex((cur) => (cur === idx ? null : idx))
                  }
                  resetScrollKey={`${cleanPreviewFile.id}-${selectedStateFilter}`}
                />
                {selectedRow && (
                  <CleanDataRowPanel
                    row={selectedRow}
                    businessColumns={businessColumns}
                    onClose={() => setSelectedRowIndex(null)}
                  />
                )}
              </>
            )}
          </div>

          <div className="px-6 py-3 bg-surface border-t border-border text-xs text-text-secondary flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span>
              Showing {Math.min(filteredRows.length, 200).toLocaleString()} of{" "}
              {rows.length.toLocaleString()} loaded records
            </span>
            {cleanData?.audit?.auditedAt ? (
              <span className="text-text-secondary">
                {cleanData.audit.standard
                  ? `${cleanData.audit.standard} audited`
                  : "Audited"}{" "}
                · {cleanData.audit.auditedAt}
              </span>
            ) : cleanData ? (
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  hasIssues ? "text-warning" : "text-text-secondary"
                }`}
              >
                {hasIssues && (
                  <AlertTriangle size={ICON_SIZES.inline} aria-hidden="true" />
                )}
                {rejectedCount.toLocaleString()} quarantined ·{" "}
                {needsReviewCount.toLocaleString()} need review
              </span>
            ) : (
              <span className="text-text-muted">Summary unavailable</span>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
