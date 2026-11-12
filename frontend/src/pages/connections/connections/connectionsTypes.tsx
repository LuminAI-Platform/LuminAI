export interface IngestedFile {
  id: string;
  name: string;
  size: string;
  recordsCount: number;
  status: "Synced" | "Failed" | "Syncing";
  createdAt: string;
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
}

export interface DatabaseConnector {
  id?: string;
  name: string;
  status: string;
  pipelines: number;
  type: string;
  desc: string;
  lastSyncedAt?: string;
}

export function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "Just now";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "Recently";
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 15) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function getHealthStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (
    s.includes("connect") ||
    (s.includes("sync") && !s.includes("syncing") && !s.includes("fail"))
  ) {
    return {
      dotColor: "bg-emerald-500",
      pingColor: "bg-emerald-400",
      badgeStyle: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      isSyncing: false,
    };
  }
  if (s.includes("syncing") || s.includes("pending") || s.includes("running")) {
    return {
      dotColor: "bg-amber-400",
      pingColor: "bg-amber-300",
      badgeStyle: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      isSyncing: true,
    };
  }
  if (s.includes("fail") || s.includes("error") || s.includes("inactive")) {
    return {
      dotColor: "bg-red-500",
      pingColor: "bg-red-400",
      badgeStyle: "bg-red-500/10 border-red-500/20 text-red-400",
      isSyncing: false,
    };
  }
  return {
    dotColor: "bg-zinc-500",
    pingColor: "bg-zinc-400",
    badgeStyle: "bg-zinc-900 border-zinc-800 text-zinc-400",
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

  return col
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function renderCleanCellValue(col: string, val: unknown) {
  if (
    val === undefined ||
    val === null ||
    String(val).trim() === "" ||
    String(val).trim().toLowerCase() === "null" ||
    String(val).trim().toLowerCase() === "undefined"
  ) {
    return <span className="text-zinc-600 select-none font-sans">—</span>;
  }

  const colLower = col.toLowerCase();

  if (colLower.includes("confidence")) {
    let numVal: number | null = null;
    if (typeof val === "number") {
      numVal = val <= 1 ? Math.round(val * 100) : Math.round(val);
    } else if (typeof val === "string") {
      const parsed = parseFloat(val.replace("%", ""));
      if (!isNaN(parsed)) {
        numVal = parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
      }
    }

    if (numVal !== null) {
      const isHigh = numVal >= 90;
      const isMed = numVal >= 75;
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            isHigh
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
              : isMed
                ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                : "bg-red-500/10 text-red-400 border-red-500/25"
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
    const t = typeStr.toLowerCase();
    let badgeColor = "bg-zinc-800/80 text-zinc-300 border-zinc-700/60";
    if (t.includes("person") || t.includes("user") || t.includes("contact")) {
      badgeColor = "bg-violet-500/15 text-violet-300 border-violet-500/30";
    } else if (
      t.includes("org") ||
      t.includes("company") ||
      t.includes("business")
    ) {
      badgeColor = "bg-sky-500/15 text-sky-300 border-sky-500/30";
    } else if (
      t.includes("dataset") ||
      t.includes("table") ||
      t.includes("file")
    ) {
      badgeColor = "bg-teal-500/15 text-teal-300 border-teal-500/30";
    } else if (
      t.includes("transaction") ||
      t.includes("event") ||
      t.includes("order")
    ) {
      badgeColor = "bg-amber-500/15 text-amber-300 border-amber-500/30";
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badgeColor}`}
      >
        {typeStr}
      </span>
    );
  }

  if (colLower.includes("status")) {
    const s = String(val).toLowerCase();
    let badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/25";
    if (
      s.includes("active") ||
      s.includes("sync") ||
      s.includes("verified") ||
      s.includes("clean") ||
      s.includes("valid")
    ) {
      badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    } else if (
      s.includes("fail") ||
      s.includes("error") ||
      s.includes("corrupt")
    ) {
      badgeClass = "bg-red-500/10 text-red-400 border-red-500/25";
    } else if (
      s.includes("pend") ||
      s.includes("queue") ||
      s.includes("wait")
    ) {
      badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/25";
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badgeClass}`}
      >
        {String(val)}
      </span>
    );
  }

  return (
    <span className="text-zinc-300 font-mono text-[11px] truncate">
      {String(val)}
    </span>
  );
}
