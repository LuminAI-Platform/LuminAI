import type {
  PipelineJob,
  PipelineJobStatus,
  PipelineErrorEntry,
} from "../PipelineJobCard";

export type FilterStatus = "ALL" | PipelineJobStatus;

export function normaliseJob(raw: Record<string, unknown>): PipelineJob {
  const status = String(
    raw.status ?? "RUNNING",
  ).toUpperCase() as PipelineJobStatus;

  const errors: PipelineErrorEntry[] = Array.isArray(raw.errors)
    ? (raw.errors as Record<string, unknown>[]).map((e) => ({
        timestamp: String(e.timestamp ?? new Date().toISOString()),
        level: (["ERROR", "WARN", "INFO"].includes(String(e.level))
          ? e.level
          : "ERROR") as PipelineErrorEntry["level"],
        message: String(e.message ?? "Unknown error"),
        record: e.record ? String(e.record) : undefined,
      }))
    : [];

  return {
    id: String(raw.id ?? `job-${Date.now()}`),
    connectorName: String(raw.connectorName ?? raw.name ?? "Pipeline"),
    connectorType: String(raw.connectorType ?? raw.type ?? "Database"),
    status,
    progress: Number(raw.progress ?? 0),
    recordsInput: Number(raw.recordsInput ?? raw.rowsTotal ?? 0),
    recordsOutput: Number(raw.recordsOutput ?? raw.rowsProcessed ?? 0),
    recordsFailed: Number(raw.recordsFailed ?? raw.rowsFailed ?? 0),
    throughput: Number(raw.throughput ?? raw.currentSpeed ?? 0),
    startedAt: String(raw.startedAt ?? new Date().toISOString()),
    durationSeconds: Number(raw.durationSeconds ?? 0),
    errors,
  };
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
