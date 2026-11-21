export { formatCellValue, renderCleanCellValue } from "./cellValueFormatters";

export type ConnectionsTab = "all" | "connectors" | "files";

export type SourceStatus = "Connected" | "Syncing" | "Failed" | "Paused";

export interface IngestedFile {
  id: string;
  name: string;
  size: string;
  recordsCount: number;
  status: SourceStatus | "Synced";
  createdAt: string;
  lastSyncedAt?: string;
  schemaDriftWarning?: string;
  columns?: string[];
  sampleRows?: Record<string, unknown>[];
}

export interface CleanDataResponse {
  connectionId: string;
  totalRawRecords: number;
  totalCleanRecords: number;
  duplicatesMerged: number;
  compressionRatio: string;
  dataQualityScore: number;
  status: string;
  columns: string[];
  rows: Record<string, unknown>[];
  verifiedRecords?: number;
  needsReviewRecords?: number;
  rejectedRecords?: number;
  qualityBreakdown?: Record<string, number>;
  profilingDelta?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    improvements?: string[];
  };
}

export interface DatabaseConnector {
  id?: string;
  name: string;
  status: SourceStatus | string;
  pipelines: number;
  type: string;
  desc: string;
  lastSyncedAt?: string;
  rowsSynced?: number;
  schemaDriftWarning?: string;
}

export interface UnifiedSource {
  id: string;
  name: string;
  category: "database" | "file";
  typeLabel: string;
  rawType: string;
  status: SourceStatus;
  lastSyncAt?: string;
  rowsSynced?: number;
  schemaDriftWarning?: string;
  desc?: string;
  size?: string;
  pipelines?: number;
  fileRef?: IngestedFile;
  connectorRef?: DatabaseConnector;
}

export function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "never";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "recently";
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 15) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatExactTimestamp(dateInput?: string | Date | null): string {
  if (!dateInput) return "No sync recorded yet";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTimeAgo(dateStr: string): string {
  return formatRelativeTime(dateStr);
}

/**
 * Health Status Badge definition
 *
 * Rules:
 * - One color per meaning (Active/Online/Connected/Healthy -> success)
 * - Never use color alone; pair with label text
 * - Delete neon dots, glows, and pings
 */
export function getHealthStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (
    s.includes("connect") ||
    s.includes("active") ||
    s.includes("healthy") ||
    s.includes("online") ||
    (s.includes("sync") && !s.includes("syncing") && !s.includes("fail"))
  ) {
    return {
      dotColor: "bg-success",
      pingColor: "",
      badgeStyle:
        "bg-success-bg border-success-border text-success font-medium",
      isSyncing: false,
    };
  }
  if (s.includes("syncing") || s.includes("pending") || s.includes("running")) {
    return {
      dotColor: "bg-warning",
      pingColor: "",
      badgeStyle:
        "bg-warning-bg border-warning-border text-warning font-medium",
      isSyncing: true,
    };
  }
  if (s.includes("fail") || s.includes("error")) {
    return {
      dotColor: "bg-error",
      pingColor: "",
      badgeStyle: "bg-error-bg border-error-border text-error font-medium",
      isSyncing: false,
    };
  }
  return {
    dotColor: "bg-nodata",
    pingColor: "",
    badgeStyle: "bg-nodata-bg border-nodata-border text-nodata font-medium",
    isSyncing: false,
  };
}

export function formatColumnHeader(col: string): string {
  if (!col) return "";
  const lower = col.toLowerCase();
  if (lower === "id") return "ID";
  if (lower === "canonicalname") return "Canonical Name";
  if (lower === "entitytype") return "Entity Type";
  if (lower === "confidencescore") return "Confidence Score";
  if (lower === "sourcecount") return "Source Count";
  if (lower === "createdat" || lower === "created_at") return "Created At";
  if (lower === "updatedat" || lower === "updated_at") return "Updated At";
  if (lower === "records_count" || lower === "recordscount")
    return "Records Count";

  return col.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ");
}
