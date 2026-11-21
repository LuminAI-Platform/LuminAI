import type { PipelineRunItem } from "../pipeline-analysis/pipelineAnalysisTypes";
import { parseSyncDatasetFromApi } from "../sync-job/syncJobHelpers";
import type {
  LogLevel,
  LogEntry,
  StreamConnectionState,
} from "./executionLogTypes";

export const STREAM_BADGE: Record<
  StreamConnectionState,
  { label: string; dot: string; cls: string }
> = {
  live: {
    label: "Live",
    dot: "bg-success animate-pulse motion-reduce:animate-none",
    cls: "bg-success-bg text-success border-success-border",
  },
  idle: {
    label: "Idle",
    dot: "bg-nodata",
    cls: "bg-nodata-bg text-nodata border-nodata-border",
  },
  paused: {
    label: "Paused",
    dot: "bg-warning",
    cls: "bg-warning-bg text-warning border-warning-border",
  },
  disconnected: {
    label: "Disconnected",
    dot: "bg-error",
    cls: "bg-error-bg text-error border-error-border",
  },
};

export interface ParsedRunsResult {
  derived: LogEntry[];
  anyActive: boolean;
  runsById: Record<string, PipelineRunItem>;
}

export function deriveLogsFromBackendPayload(page: unknown): ParsedRunsResult {
  const runs: Record<string, unknown>[] = Array.isArray(page)
    ? page
    : Array.isArray((page as { content?: unknown[] })?.content)
      ? ((page as { content: unknown[] }).content as Record<string, unknown>[])
      : [];

  const parsedDatasets = runs.map((r, i) => parseSyncDatasetFromApi(r, i));
  const anyActive = parsedDatasets.some((d) => d.status === "running");
  const runsById: Record<string, PipelineRunItem> = {};
  const derived: LogEntry[] = [];

  parsedDatasets.forEach((ds) => {
    if (ds.rawRun) {
      runsById[ds.id] = ds.rawRun;
    }
    const startTs = ds.startedAt ?? new Date();

    derived.push({
      id: `be-${ds.id}-start`,
      ts: startTs,
      level: "INFO",
      source: ds.name,
      runId: ds.id,
      message: `Run started (${ds.sourceType})`,
    });

    if (ds.status === "running") {
      const speedPart =
        typeof ds.throughput === "number"
          ? ` · ${Math.round(ds.throughput).toLocaleString()} rec/s`
          : "";
      derived.push({
        id: `be-${ds.id}-prog`,
        ts: new Date(Math.max(startTs.getTime() + 1, Date.now())),
        level: "INFO",
        source: ds.name,
        runId: ds.id,
        message: `Sync in progress${speedPart}`,
        rowsIn: ds.totalRecords,
        rowsOut: ds.syncedRecords,
        rowsRejected: ds.rejectedRecords,
        rowsQuarantined: ds.quarantinedRecords,
      });
    } else if (
      ds.status === "completed" ||
      ds.status === "completed_with_issues" ||
      ds.status === "failed"
    ) {
      const endTs =
        ds.completedAt ??
        (typeof ds.durationSeconds === "number"
          ? new Date(startTs.getTime() + ds.durationSeconds * 1000)
          : new Date(startTs.getTime() + 1000));

      const level: LogLevel =
        ds.status === "failed"
          ? "ERROR"
          : ds.status === "completed_with_issues"
            ? "WARN"
            : "SUCCESS";

      const durText =
        typeof ds.durationSeconds === "number"
          ? ` in ${ds.durationSeconds}s`
          : "";

      const message =
        ds.status === "failed"
          ? `Run failed${durText}${ds.errorMessage ? `: ${ds.errorMessage}` : ""}`
          : ds.status === "completed_with_issues"
            ? `Run completed with issues${durText}`
            : `Run completed${durText}`;

      derived.push({
        id: `be-${ds.id}-done`,
        ts: endTs,
        level,
        source: ds.name,
        runId: ds.id,
        message,
        rowsIn: ds.totalRecords,
        rowsOut: ds.syncedRecords,
        rowsRejected: ds.rejectedRecords,
        rowsQuarantined: ds.quarantinedRecords,
      });
    }
  });

  return { derived, anyActive, runsById };
}

export function computeLevelCounts(
  sortedLogs: LogEntry[],
): Record<LogLevel | "ALL", number> {
  const counts: Record<LogLevel | "ALL", number> = {
    ALL: sortedLogs.length,
    INFO: 0,
    SUCCESS: 0,
    WARN: 0,
    ERROR: 0,
    DEBUG: 0,
  };
  sortedLogs.forEach((l) => {
    counts[l.level] = (counts[l.level] ?? 0) + 1;
  });
  return counts;
}

export function filterLogEntries(
  sortedLogs: LogEntry[],
  filter: LogLevel | "ALL",
  searchTerm: string,
): LogEntry[] {
  let result = sortedLogs;
  if (filter !== "ALL") {
    result = result.filter((l) => l.level === filter);
  }
  if (searchTerm.trim()) {
    const lower = searchTerm.trim().toLowerCase();
    result = result.filter(
      (l) =>
        l.message.toLowerCase().includes(lower) ||
        l.source.toLowerCase().includes(lower) ||
        (l.runId ? l.runId.toLowerCase().includes(lower) : false),
    );
  }
  return result;
}
