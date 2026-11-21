import type { CleanDataResponse } from "./connectionsTypes";

export interface QualityCounts {
  verifiedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
}

export function computeQualityCounts(
  cleanData: CleanDataResponse | null,
): QualityCounts {
  const rows = cleanData?.rows || [];
  const verifiedCount =
    cleanData?.verifiedRecords ??
    rows.filter(
      (r) =>
        String(r.quality_state || r.record_state || "").toUpperCase() ===
        "VERIFIED",
    ).length;

  const needsReviewCount =
    cleanData?.needsReviewRecords ??
    rows.filter((r) =>
      String(r.quality_state || r.record_state || "")
        .toUpperCase()
        .includes("REVIEW"),
    ).length;

  const rejectedCount =
    cleanData?.rejectedRecords ??
    rows.filter((r) =>
      String(r.quality_state || r.record_state || "")
        .toUpperCase()
        .includes("REJECT"),
    ).length;

  return { verifiedCount, needsReviewCount, rejectedCount };
}

export function filterCleanDataRows(
  rows: Record<string, unknown>[],
  selectedTableFilter: string,
  selectedStateFilter: string,
  searchFilter: string,
): Record<string, unknown>[] {
  return rows.filter((r) => {
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
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return Object.values(r).some((val) =>
      String(val).toLowerCase().includes(q),
    );
  });
}

export function exportCleanDataToCsv(
  cleanData: CleanDataResponse | null,
  fileName: string,
): void {
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
  const csvContent = [headerRow, ...bodyRows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `clean_${fileName.replace(/\.[^/.]+$/, "")}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
