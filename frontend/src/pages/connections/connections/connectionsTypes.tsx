import React from "react";

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

export function formatCellValue(
  val: unknown,
  colName: string,
): React.ReactNode {
  if (val === null || val === undefined || val === "") {
    return (
      <span className="text-[11px] text-nodata bg-nodata-bg border border-nodata-border px-1.5 py-0.5 rounded italic">
        No data
      </span>
    );
  }

  const colLower = colName.toLowerCase();

  if (
    colLower === "qualitystate" ||
    colLower === "quality_state" ||
    colLower === "recordstate" ||
    colLower === "record_state"
  ) {
    const s = String(val).toUpperCase();
    if (s.includes("VERIFIED")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-bg text-success border border-success-border">
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          VERIFIED
        </span>
      );
    }
    if (s.includes("REVIEW")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning-bg text-warning border border-warning-border">
          <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
          NEEDS REVIEW
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-error-bg text-error border border-error-border">
        <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
        REJECTED
      </span>
    );
  }

  if (
    colLower.includes("confidence") ||
    colLower.includes("score") ||
    colLower.includes("quality")
  ) {
    const numVal =
      typeof val === "number"
        ? Math.round(val <= 1 ? val * 100 : val)
        : parseInt(String(val), 10);

    if (!isNaN(numVal)) {
      const isHigh = numVal >= 90;
      const isMed = numVal >= 75;
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            isHigh
              ? "bg-success-bg text-success border-success-border"
              : isMed
                ? "bg-warning-bg text-warning border-warning-border"
                : "bg-error-bg text-error border-error-border"
          }`}
        >
          {numVal}%
        </span>
      );
    }
  }

  if (
    colLower === "entitytype" ||
    colLower === "entity_type" ||
    colLower === "type"
  ) {
    const typeStr = String(val);
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-subtle text-text border border-border">
        {typeStr}
      </span>
    );
  }

  if (colLower.includes("status")) {
    const s = String(val).toLowerCase();
    let badgeClass =
      "bg-nodata-bg text-nodata border-nodata-border font-medium";
    if (
      s.includes("active") ||
      s.includes("sync") ||
      s.includes("verified") ||
      s.includes("clean") ||
      s.includes("valid") ||
      s.includes("connected")
    ) {
      badgeClass =
        "bg-success-bg text-success border-success-border font-medium";
    } else if (
      s.includes("fail") ||
      s.includes("error") ||
      s.includes("corrupt")
    ) {
      badgeClass = "bg-error-bg text-error border-error-border font-medium";
    } else if (
      s.includes("pend") ||
      s.includes("queue") ||
      s.includes("wait")
    ) {
      badgeClass =
        "bg-warning-bg text-warning border-warning-border font-medium";
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badgeClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
        {String(val)}
      </span>
    );
  }

  if (typeof val === "boolean") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
          val
            ? "bg-success-bg text-success border-success-border"
            : "bg-nodata-bg text-nodata border-nodata-border"
        }`}
      >
        {val ? "True" : "False"}
      </span>
    );
  }

  if (typeof val === "object") {
    return (
      <span className="font-mono text-[11px] text-text-secondary truncate max-w-xs block">
        {JSON.stringify(val)}
      </span>
    );
  }

  return (
    <span className="text-xs text-text truncate max-w-xs block">
      {String(val)}
    </span>
  );
}

export function renderCleanCellValue(
  col: string,
  val: unknown,
): React.ReactNode {
  return formatCellValue(val, col);
}
