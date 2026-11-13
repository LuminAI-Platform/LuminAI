// ─── DataPreview helpers — type badge styles ──────────────────────────────────
import type { ColumnConfig } from "../DataPreviewTable";

export function getTypeBadgeStyles(type: ColumnConfig["type"]): string {
  switch (type) {
    case "Integer":
      return "bg-warning-bg text-warning border border-warning-border";
    case "Double":
      return "bg-primary-tint text-primary border border-primary-border";
    case "Boolean":
      return "bg-warning-bg text-warning border border-warning-border";
    case "Timestamp":
      return "bg-surface-subtle text-text-secondary border border-border";
    default:
      return "bg-surface-subtle text-text-secondary border border-border";
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
