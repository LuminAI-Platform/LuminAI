export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS" | "DEBUG";

export interface LogEntry {
  id: string;
  ts: Date;
  level: LogLevel;
  source: string;
  message: string;
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

export const LEVEL_STYLES: Record<LogLevel, { label: string; cls: string }> = {
  INFO: { label: "INFO   ", cls: "text-blue-400" },
  SUCCESS: { label: "SUCCESS", cls: "text-emerald-400" },
  WARN: { label: "WARN   ", cls: "text-amber-400" },
  ERROR: { label: "ERROR  ", cls: "text-red-400" },
  DEBUG: { label: "DEBUG  ", cls: "text-zinc-500" },
};

export const formatTs = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
