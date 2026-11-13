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
    dotClass: "bg-warning",
    badgeClass: "bg-warning-bg border-warning-border text-warning",
    barColor: "var(--color-warning)",
  },
  CLEANED: {
    label: "CLEANED",
    dotClass: "bg-primary",
    badgeClass: "bg-primary-tint border-primary-border text-primary",
    barColor: "var(--color-primary)",
  },
  COMPLETED: {
    label: "COMPLETED",
    dotClass: "bg-success",
    badgeClass: "bg-success-bg border-success-border text-success",
    barColor: "var(--color-success)",
  },
  FAILED: {
    label: "FAILED",
    dotClass: "bg-error",
    badgeClass: "bg-error-bg border-error-border text-error",
    barColor: "var(--color-error)",
  },
};

export const LOG_LEVEL_CLASS: Record<PipelineErrorEntry["level"], string> = {
  ERROR: "text-error",
  WARN: "text-warning",
  INFO: "text-text-secondary",
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
