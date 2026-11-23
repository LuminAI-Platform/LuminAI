import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import {
  usePipelineStream,
  type PipelineProgressEvent,
  type PipelineErrorEvent,
  type PipelineCompleteEvent,
} from "../../hooks/usePipelineStream";
import type { PipelineRunItem } from "../pipeline-analysis/pipelineAnalysisTypes";
import { parseSyncDatasetFromApi } from "../sync-job/syncJobHelpers";
import type { LogLevel, LogEntry } from "./executionLogTypes";

interface UseExecutionLogStreamOptions {
  maxLines: number;
  isControlled: boolean;
  paused: boolean;
  onLiveAnnouncement: (msg: string) => void;
}

export function useExecutionLogStream({
  maxLines,
  isControlled,
  paused,
  onLiveAnnouncement,
}: UseExecutionLogStreamOptions) {
  const [internalLogs, setLogs] = useState<LogEntry[]>([]);
  const [internalHasActiveRun, setInternalHasActiveRun] = useState(false);
  const runsByIdRef = useRef<Record<string, PipelineRunItem>>({});
  const clearedIdsRef = useRef<Set<string>>(new Set());
  const logIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendEntries = useCallback(
    (incoming: LogEntry[]) => {
      setLogs((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const nextEntries = incoming.filter(
          (l) => !existingIds.has(l.id) && !clearedIdsRef.current.has(l.id),
        );
        if (nextEntries.length === 0) return prev;
        return [...prev, ...nextEntries]
          .sort((a, b) => a.ts.getTime() - b.ts.getTime())
          .slice(-maxLines);
      });
    },
    [maxLines],
  );

  const handleSseProgress = useCallback(
    (evt: PipelineProgressEvent) => {
      if (paused) return;
      setInternalHasActiveRun(true);
      const source = runsByIdRef.current[evt.runId]?.connectorName ?? evt.step;
      appendEntries([
        {
          id: `sse-prog-${evt.runId}-${evt.step}-${evt.progress}-${Date.now()}`,
          ts: new Date(),
          level: "INFO",
          source,
          runId: evt.runId,
          message:
            evt.message ||
            `Step ${evt.step} in progress (${Math.round(evt.progress)}%)`,
        },
      ]);
    },
    [paused, appendEntries],
  );

  const handleSseError = useCallback(
    (evt: PipelineErrorEvent) => {
      if (paused) return;
      const source = runsByIdRef.current[evt.runId]?.connectorName ?? evt.step;
      appendEntries([
        {
          id: `sse-err-${evt.runId}-${evt.step}-${Date.now()}`,
          ts: new Date(),
          level: evt.severity === "warning" ? "WARN" : "ERROR",
          source,
          runId: evt.runId,
          message: evt.error,
        },
      ]);
    },
    [paused, appendEntries],
  );

  const handleSseComplete = useCallback(
    (evt: PipelineCompleteEvent) => {
      const source =
        runsByIdRef.current[evt.runId]?.connectorName ?? "pipeline";
      const hasIssues = evt.errorsCount > 0;
      const msg = hasIssues
        ? `Run completed with issues (${evt.duration})`
        : `Run completed (${evt.duration})`;
      onLiveAnnouncement(
        `Pipeline run for ${source} ${hasIssues ? "completed with issues" : "completed"}.`,
      );
      if (paused) return;
      appendEntries([
        {
          id: `sse-done-${evt.runId}`,
          ts: new Date(),
          level: hasIssues ? "WARN" : "SUCCESS",
          source,
          runId: evt.runId,
          message: msg,
          rowsIn: evt.totalRecords,
          rowsOut: evt.cleanedRecords,
          rowsRejected: evt.errorsCount,
        },
      ]);
    },
    [paused, appendEntries, onLiveAnnouncement],
  );

  const { isConnected: sseConnected, reconnect: sseReconnect } =
    usePipelineStream({
      onProgress: handleSseProgress,
      onErrorEvent: handleSseError,
      onComplete: handleSseComplete,
    });

  const fetchBackendLogs = useCallback(async () => {
    if (paused || isControlled) return;
    try {
      const res = await apiFetch("/api/v1/pipelines?size=20", {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) return;

      const page = (await res.json()) as unknown;
      const runs: Record<string, unknown>[] = Array.isArray(page)
        ? page
        : Array.isArray((page as { content?: unknown[] })?.content)
          ? ((page as { content: unknown[] }).content as Record<
              string,
              unknown
            >[])
          : [];

      const parsedDatasets = runs.map((r, i) => parseSyncDatasetFromApi(r, i));
      const anyActive = parsedDatasets.some((d) => d.status === "running");
      setInternalHasActiveRun(anyActive);

      const derived: LogEntry[] = [];
      parsedDatasets.forEach((ds) => {
        if (ds.rawRun) {
          runsByIdRef.current[ds.id] = ds.rawRun;
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

      appendEntries(derived);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        if (logIntervalRef.current) {
          clearInterval(logIntervalRef.current);
          logIntervalRef.current = null;
        }
      }
    }
  }, [paused, isControlled, appendEntries]);

  useEffect(() => {
    if (isControlled) return;
    Promise.resolve().then(() => {
      fetchBackendLogs();
    });
    logIntervalRef.current = setInterval(fetchBackendLogs, 6000);
    return () => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    };
  }, [isControlled, fetchBackendLogs]);

  const clearInternalLogs = useCallback((allLogs: LogEntry[]) => {
    allLogs.forEach((l) => clearedIdsRef.current.add(l.id));
    setLogs([]);
  }, []);

  return {
    internalLogs,
    internalHasActiveRun,
    sseConnected,
    sseReconnect,
    runsByIdRef,
    fetchBackendLogs,
    clearInternalLogs,
  };
}
