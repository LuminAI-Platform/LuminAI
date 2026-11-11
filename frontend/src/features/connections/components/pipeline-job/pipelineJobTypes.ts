// ─── PipelineJob — types, constants & pure helpers ───────────────────────────

export type PipelineJobStatus = "RUNNING" | "CLEANED" | "COMPLETED" | "FAILED";

export interface PipelineErrorEntry {
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO";
  message: string;
  record?: string;
}

export interface PipelineJob {
  id: string;
  connectorName: string;
  connectorType: string;
  status: PipelineJobStatus;
  progress: number; // 0–100
  recordsInput: number;
  recordsOutput: number;
  recordsFailed: number;
  throughput: number; // records/sec
  startedAt: string; // ISO 8601
  durationSeconds: number;
  errors: PipelineErrorEntry[];
}

export const STATUS_META: Record<
  PipelineJobStatus,
  { label: string; dotClass: string; badgeClass: string; barColor: string }
> = {
  RUNNING: {
    label: "RUNNING",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    barColor: "#3b82f6",
  },
  CLEANED: {
    label: "CLEANED",
    dotClass: "bg-violet-500",
    badgeClass: "bg-violet-500/10 border-violet-500/30 text-violet-400",
    barColor: "#8b5cf6",
  },
  COMPLETED: {
    label: "COMPLETED",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    barColor: "#10b981",
  },
  FAILED: {
    label: "FAILED",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-500/10 border-red-500/30 text-red-400",
    barColor: "#ef4444",
  },
};

export const LOG_LEVEL_CLASS: Record<PipelineErrorEntry["level"], string> = {
  ERROR: "text-red-400",
  WARN: "text-amber-400",
  INFO: "text-zinc-400",
};

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
