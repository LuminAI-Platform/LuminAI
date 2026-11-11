// ─── DataPreview helpers — type badge styles ──────────────────────────────────
import type { ColumnConfig } from "../DataPreviewTable";

export function getTypeBadgeStyles(type: ColumnConfig["type"]): string {
  switch (type) {
    case "Integer":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    case "Double":
      return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    case "Boolean":
      return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
    case "Timestamp":
      return "bg-teal-500/10 text-teal-400 border border-teal-500/20";
    default:
      return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
  }
}

export function exportToCsv(
  filteredRows: Record<string, unknown>[],
  columns: ColumnConfig[],
): void {
  if (filteredRows.length === 0) return;
  const activeCols = columns.filter((col) => col.active);
  const headers = activeCols.map((col) => col.name);
  const escapeCsv = (val: unknown): string => {
    if (val == null) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCsv).join(","),
    ...filteredRows.map((row) =>
      headers.map((col) => escapeCsv(row[col])).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `preview_dataset_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
