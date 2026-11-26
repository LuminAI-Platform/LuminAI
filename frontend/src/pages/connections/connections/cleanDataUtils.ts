export type CleanQualityState = "VERIFIED" | "NEEDS_REVIEW" | "QUARANTINED";

export interface RowReasonItem {
  field?: string;
  problem: string;
  originalValue?: string;
}

const QUALITY_AND_INTERNAL_KEYS = new Set([
  "qualitystate",
  "quality_state",
  "recordstate",
  "record_state",
  "qualityscore",
  "quality_score",
  "confidencescore",
  "confidence_score",
  "_validationerrors",
  "_validationwarnings",
  "_originalattributes",
  "originalattributes",
  "_table",
]);

export function extractBusinessColumns(columns: string[]): string[] {
  return columns.filter(
    (col) => !QUALITY_AND_INTERNAL_KEYS.has(col.toLowerCase()),
  );
}

export function toSentenceCaseHeader(col: string): string {
  if (!col) return "";
  const lower = col.toLowerCase();
  if (lower === "id") return "ID";
  if (lower === "dob") return "DOB";
  if (lower === "mrn") return "MRN";
  if (lower === "ssn") return "SSN";

  const spaced = col
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!spaced) return col;
  const words = spaced.split(/\s+/).map((w, idx) => {
    const wl = w.toLowerCase();
    if (wl === "id" || wl === "dob" || wl === "mrn" || wl === "ssn") {
      return wl.toUpperCase();
    }
    if (idx === 0) {
      return wl.charAt(0).toUpperCase() + wl.slice(1);
    }
    return wl;
  });
  return words.join(" ");
}

export function getRowQualityState(
  row: Record<string, unknown>,
): CleanQualityState {
  const raw = String(
    row.qualityState ??
      row.quality_state ??
      row.recordState ??
      row.record_state ??
      row.status ??
      "",
  ).toUpperCase();
  if (raw.includes("REJECT") || raw.includes("QUARANTIN")) {
    return "QUARANTINED";
  }
  if (raw.includes("REVIEW")) {
    return "NEEDS_REVIEW";
  }
  return "VERIFIED";
}

function normalizeScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(num)) return null;
  return Math.round(num <= 1 && num > 0 ? num * 100 : num);
}

export function getRowScores(row: Record<string, unknown>): {
  qualityScore: number | null;
  confidenceScore: number | null;
  primaryScore: number | null;
  scoresDiffer: boolean;
} {
  const qualityScore = normalizeScore(row.qualityScore ?? row.quality_score);
  const confidenceScore = normalizeScore(
    row.confidenceScore ?? row.confidence_score,
  );
  const primaryScore = qualityScore ?? confidenceScore;
  const scoresDiffer =
    qualityScore !== null &&
    confidenceScore !== null &&
    qualityScore !== confidenceScore;
  return { qualityScore, confidenceScore, primaryScore, scoresDiffer };
}

function parseReasonText(rawText: string): RowReasonItem {
  const match = rawText.match(/^Field\s+'([^']+)'(?:\s*:\s*|\s+)(.+)$/i);
  if (match) {
    return { field: match[1], problem: match[2].trim() };
  }
  return { problem: rawText.trim() };
}

export function getRowReasons(row: Record<string, unknown>): RowReasonItem[] {
  const items: RowReasonItem[] = [];
  const errors = row._validationErrors ?? row.validationErrors;
  const warnings = row._validationWarnings ?? row.validationWarnings;
  const directReason = row.reason ?? row.quarantineReason ?? row.errorReason;

  if (Array.isArray(errors)) {
    errors.forEach((e) => {
      if (typeof e === "string" && e.trim()) items.push(parseReasonText(e));
    });
  }
  if (Array.isArray(warnings)) {
    warnings.forEach((w) => {
      if (typeof w === "string" && w.trim()) items.push(parseReasonText(w));
    });
  }
  if (typeof directReason === "string" && directReason.trim()) {
    items.push(parseReasonText(directReason));
  }
  return items;
}

export function getRowOriginalAttributes(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const raw = row._originalAttributes ?? row.originalAttributes;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function formatBreakdownTooltip(
  breakdown?: Record<string, number>,
  explanation?: string,
): string {
  if (explanation && explanation.trim()) return explanation.trim();
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return "Calculated by the data engine";
  }
  const entries = Object.entries(breakdown)
    .filter(([k, v]) => typeof v === "number" && k !== "overall_score")
    .map(([k, v]) => `${toSentenceCaseHeader(k)}: ${Math.round(v)}%`);
  if (entries.length === 0) return "Calculated by the data engine";
  return `Calculated by the data engine (${entries.join(" · ")})`;
}

export function exportCleanRowsToCsv(
  columns: string[],
  rows: Record<string, unknown>[],
  sourceName: string,
): void {
  if (rows.length === 0) return;
  const headerRow = columns
    .map((c) => `"${String(c).replace(/"/g, '""')}"`)
    .join(",");
  const bodyRows = rows.map((row) =>
    columns
      .map((c) => `"${String(row[c] ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[headerRow, ...bodyRows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clean_${sourceName.replace(/\.[^/.]+$/, "")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function sortCleanRows(
  rows: Record<string, unknown>[],
  sortColumn: string | null,
  sortDir: "asc" | "desc",
): Record<string, unknown>[] {
  if (!sortColumn) return rows;
  const mult = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortColumn === "__quality__") {
      const rank = { QUARANTINED: 0, NEEDS_REVIEW: 1, VERIFIED: 2 };
      const diff = rank[getRowQualityState(a)] - rank[getRowQualityState(b)];
      if (diff !== 0) return diff * mult;
      const sa = getRowScores(a).primaryScore ?? -1;
      const sb = getRowScores(b).primaryScore ?? -1;
      return (sa - sb) * mult;
    }
    const va = a[sortColumn];
    const vb = b[sortColumn];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const na = Number(va);
    const nb = Number(vb);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return (na - nb) * mult;
    }
    return String(va).localeCompare(String(vb)) * mult;
  });
}
