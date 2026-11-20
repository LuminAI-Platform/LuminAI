import type { PipelineRunItem } from "../pipeline-analysis/pipelineAnalysisTypes";
import type {
  SyncDataset,
  SyncJobStatus,
  SyncSourceType,
} from "./syncJobTypes";

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) {
    return "–";
  }
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${remM}m`;
}

/**
 * Formats a start timestamp as "Today 15:47" or "Nov 19, 15:47".
 */
export function formatStartTime(
  date: Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!date || Number.isNaN(date.getTime())) return "–";
  const pad = (v: number) => String(v).padStart(2, "0");
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return `Today ${timePart}`;
  }
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${month} ${date.getDate()}, ${timePart}`;
}

export function parseMetadataJson(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

const FILE_EXT_RE = /\.(csv|json|jsonl|ndjson|tsv|parquet|xlsx|xls|txt)$/i;

/**
 * Resolves the honest source type ("File", "Database", or "API") from API fields
 * without contradicting the dataset title or pipelineType.
 */
export function resolveSourceType(
  rawConnectorType: string | undefined,
  rawPipelineType: string | undefined,
  name: string,
): SyncSourceType {
  const ct = (rawConnectorType ?? "").trim().toUpperCase();
  const pt = (rawPipelineType ?? "").trim().toUpperCase();

  if (ct === "FILE" || ct === "FLAT_FILE" || ct === "CSV" || ct === "JSON") {
    return "File";
  }
  if (ct === "API" || ct === "REST" || ct === "WEBHOOK") {
    return "API";
  }
  if (
    ct === "POSTGRESQL" ||
    ct === "POSTGRES" ||
    ct === "MYSQL" ||
    ct === "MSSQL" ||
    ct === "SQLSERVER" ||
    ct === "SNOWFLAKE" ||
    ct === "ORACLE" ||
    ct === "BIGQUERY"
  ) {
    return "Database";
  }
  // When connectorType is missing or generic fallback "Database", check if it's clearly a file ingestion
  if (pt === "FILE_INGESTION" || FILE_EXT_RE.test(name)) {
    return "File";
  }
  return "Database";
}

/**
 * Formats pipelineType in sentence case (e.g. "FILE_INGESTION" -> "File ingestion")
 * and omits it if it would contradict the resolved sourceType.
 */
export function resolvePipelineTypeLabel(
  rawPipelineType: string | undefined,
  sourceType: SyncSourceType,
): string | undefined {
  const pt = (rawPipelineType ?? "").trim().toUpperCase();
  if (!pt) return undefined;

  if (pt === "FILE_INGESTION") {
    return sourceType === "File" ? "File ingestion" : undefined;
  }
  if (pt === "DATABASE_SYNC" || pt === "DB_SYNC" || pt === "DB_INGESTION") {
    return sourceType === "Database" ? "Database sync" : undefined;
  }

  const words = pt.toLowerCase().replace(/_/g, " ").trim();
  if (!words) return undefined;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function resolveSyncStatus(
  rawStatus: string | undefined,
  rejected?: number,
  quarantined?: number,
): SyncJobStatus {
  const upper = (rawStatus ?? "").trim().toUpperCase();
  const hasIssues = (rejected ?? 0) > 0 || (quarantined ?? 0) > 0;

  if (upper === "FAILED" || upper === "ERROR") return "failed";
  if (upper === "PAUSED" || upper === "CANCELLED") return "paused";
  if (upper === "COMPLETED" || upper === "CLEANED" || upper === "VALIDATED") {
    return hasIssues ? "completed_with_issues" : "completed";
  }
  if (upper === "RUNNING" || upper === "INGESTING" || upper === "PENDING") {
    return "running";
  }
  return hasIssues ? "completed_with_issues" : "completed";
}

export function formatOutcomeSummary(ds: {
  syncedRecords?: number;
  totalRecords?: number;
  quarantinedRecords?: number;
  rejectedRecords?: number;
}): string {
  const hasQuarantined =
    typeof ds.quarantinedRecords === "number" && ds.quarantinedRecords > 0;
  const hasRejected =
    typeof ds.rejectedRecords === "number" && ds.rejectedRecords > 0;

  if (hasQuarantined || hasRejected) {
    const parts: string[] = [];
    if (typeof ds.syncedRecords === "number") {
      parts.push(`Loaded ${formatNumber(ds.syncedRecords)}`);
    }
    if (typeof ds.quarantinedRecords === "number") {
      parts.push(`Quarantined ${formatNumber(ds.quarantinedRecords)}`);
    }
    if (typeof ds.rejectedRecords === "number") {
      parts.push(`Rejected ${formatNumber(ds.rejectedRecords)}`);
    }
    return parts.join(" - ");
  }

  if (
    typeof ds.syncedRecords === "number" &&
    typeof ds.totalRecords === "number"
  ) {
    return `${formatNumber(ds.syncedRecords)} / ${formatNumber(ds.totalRecords)} records`;
  }
  if (typeof ds.syncedRecords === "number") {
    return `${formatNumber(ds.syncedRecords)} loaded`;
  }
  return "–";
}

export function parseSyncDatasetFromApi(
  item: Record<string, unknown>,
  index: number,
): SyncDataset {
  const id = String(item.id ?? `run-${index}`);
  const meta = parseMetadataJson(item.metadata);
  const metaFileName =
    typeof meta?.fileName === "string" && meta.fileName.trim()
      ? meta.fileName.trim()
      : undefined;

  const rawConnectorName =
    typeof item.connectorName === "string" && item.connectorName.trim()
      ? item.connectorName.trim()
      : undefined;

  const name = rawConnectorName ?? metaFileName ?? `Dataset ${index + 1}`;
  const rawConnectorType =
    typeof item.connectorType === "string" ? item.connectorType : undefined;
  const rawPipelineType =
    typeof item.pipelineType === "string" ? item.pipelineType : undefined;

  const sourceType = resolveSourceType(rawConnectorType, rawPipelineType, name);
  const pipelineTypeLabel = resolvePipelineTypeLabel(
    rawPipelineType,
    sourceType,
  );

  const totalRecords = readOptionalNumber(item.recordsInput);
  const syncedRecords = readOptionalNumber(item.recordsOutput);
  const rejectedRecords =
    readOptionalNumber(item.recordsRejected) ??
    readOptionalNumber(meta?.rejectedRecords) ??
    readOptionalNumber(meta?.recordsRejected) ??
    readOptionalNumber(item.recordsFailed);
  const quarantinedRecords =
    readOptionalNumber(item.recordsQuarantined) ??
    readOptionalNumber(item.quarantinedRecords) ??
    readOptionalNumber(meta?.quarantinedRecords) ??
    readOptionalNumber(meta?.recordsQuarantined);

  const rawStatus = String(item.status ?? "COMPLETED").toUpperCase();
  const status = resolveSyncStatus(
    rawStatus,
    rejectedRecords,
    quarantinedRecords,
  );

  const startedAt = item.startedAt ? new Date(String(item.startedAt)) : null;
  const completedAt = item.completedAt
    ? new Date(String(item.completedAt))
    : null;

  const apiDuration = readOptionalNumber(item.durationSeconds);
  let durationSeconds = apiDuration;
  if (
    durationSeconds === undefined &&
    startedAt &&
    completedAt &&
    !Number.isNaN(startedAt.getTime()) &&
    !Number.isNaN(completedAt.getTime())
  ) {
    durationSeconds = Math.max(
      0,
      Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000),
    );
  }

  const throughput = readOptionalNumber(item.throughput);

  const rawRun: PipelineRunItem = {
    id,
    connectionId: item.connectionId ? String(item.connectionId) : undefined,
    connectorName: name,
    connectorType: sourceType,
    pipelineType: rawPipelineType ?? "",
    status: rawStatus,
    progress: readOptionalNumber(item.progress) ?? 0,
    recordsInput: totalRecords ?? 0,
    recordsOutput: syncedRecords ?? 0,
    recordsFailed: rejectedRecords ?? 0,
    throughput: throughput ?? 0,
    startedAt: startedAt ? startedAt.toISOString() : new Date().toISOString(),
    completedAt: completedAt ? completedAt.toISOString() : null,
    durationSeconds: durationSeconds ?? 0,
    errorMessage:
      typeof item.errorMessage === "string" ? item.errorMessage : null,
    metadata:
      typeof item.metadata === "string"
        ? item.metadata
        : item.metadata
          ? JSON.stringify(item.metadata)
          : null,
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
  };

  return {
    id,
    connectionId: rawRun.connectionId,
    name,
    fileName: metaFileName,
    pipelineTypeLabel,
    sourceType,
    rawConnectorType: rawConnectorType ?? sourceType,
    totalRecords,
    syncedRecords,
    rejectedRecords,
    quarantinedRecords,
    status,
    rawStatus,
    startedAt,
    completedAt,
    durationSeconds,
    throughput:
      throughput !== undefined && throughput > 0 ? throughput : undefined,
    errorMessage: rawRun.errorMessage,
    metadata: rawRun.metadata,
    rawRun,
  };
}
