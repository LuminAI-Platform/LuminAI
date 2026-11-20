export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS" | "DEBUG";

export type StreamConnectionState = "live" | "idle" | "paused" | "disconnected";

export interface LogEntry {
  id: string;
  ts: Date;
  level: LogLevel;
  source: string;
  runId?: string;
  message: string;
  rowsIn?: number;
  rowsOut?: number;
  rowsRejected?: number;
  rowsQuarantined?: number;
}

export interface ExecutionError {
  id: string;
  ts: Date;
  code: string;
  source: string;
  message: string;
  detail?: string;
  retryable: boolean;
}

export const LEVEL_STYLES: Record<
  LogLevel,
  { label: string; cls: string; badgeCls: string }
> = {
  INFO: {
    label: "Info",
    cls: "text-primary",
    badgeCls: "bg-primary-tint text-primary border-primary-border",
  },
  SUCCESS: {
    label: "Success",
    cls: "text-success",
    badgeCls: "bg-success-bg text-success border-success-border",
  },
  WARN: {
    label: "Warn",
    cls: "text-warning",
    badgeCls: "bg-warning-bg text-warning border-warning-border",
  },
  ERROR: {
    label: "Error",
    cls: "text-error",
    badgeCls: "bg-error-bg text-error border-error-border",
  },
  DEBUG: {
    label: "Debug",
    cls: "text-text-secondary",
    badgeCls: "bg-surface-subtle text-text-secondary border-border",
  },
};

export function resolveStreamStatus(params: {
  isConnected: boolean;
  hasActiveRun: boolean;
  paused: boolean;
}): StreamConnectionState {
  if (params.paused) return "paused";
  if (!params.isConnected) return "disconnected";
  return params.hasActiveRun ? "live" : "idle";
}

export const formatTs = (d: Date): string => {
  if (Number.isNaN(d.getTime())) return "--:--:--";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const formatFullDateTime = (d: Date): string => {
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const getLocalDateKey = (d: Date): string => {
  if (Number.isNaN(d.getTime())) return "unknown";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDateSeparator = (
  d: Date,
  now: Date = new Date(),
): string => {
  if (Number.isNaN(d.getTime())) return "Unknown date";
  const formatted = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return isToday ? `Today — ${formatted}` : formatted;
};

export function formatRowCountsFragment(entry: {
  rowsIn?: number;
  rowsOut?: number;
  rowsRejected?: number;
  rowsQuarantined?: number;
}): string | null {
  const parts: string[] = [];
  if (typeof entry.rowsIn === "number") {
    parts.push(`In ${entry.rowsIn.toLocaleString()}`);
  }
  if (typeof entry.rowsOut === "number") {
    parts.push(`Out ${entry.rowsOut.toLocaleString()}`);
  }
  if (typeof entry.rowsQuarantined === "number") {
    parts.push(`Quarantined ${entry.rowsQuarantined.toLocaleString()}`);
  }
  if (typeof entry.rowsRejected === "number") {
    parts.push(`Rejected ${entry.rowsRejected.toLocaleString()}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatLogLineForCopy(log: LogEntry): string {
  const ts = Number.isNaN(log.ts.getTime()) ? "" : log.ts.toISOString();
  const runPart = log.runId ? ` [run:${log.runId}]` : "";
  const counts = formatRowCountsFragment(log);
  const countsPart = counts ? ` (${counts})` : "";
  return `${ts} [${log.level}] [${log.source}]${runPart} ${log.message}${countsPart}`;
}
