import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import {
  usePipelineStream,
  type PipelineProgressEvent,
  type PipelineErrorEvent,
  type PipelineCompleteEvent,
} from "../../hooks/usePipelineStream";
import type { PipelineRunItem } from "../pipeline-analysis/pipelineAnalysisTypes";
import type { LogEntry, ExecutionError } from "./executionLogTypes";
import { deriveLogsFromBackendPayload } from "./executionLogParser";

interface UseExecutionLogsDataOptions {
  controlledEntries?: LogEntry[];
  controlledErrors?: ExecutionError[];
  controlledConnected?: boolean;
  controlledHasActiveRun?: boolean;
  maxLines: number;
  paused: boolean;
}

export function useExecutionLogsData({
  controlledEntries,
  controlledErrors,
  controlledConnected,
  controlledHasActiveRun,
  maxLines,
  paused,
}: UseExecutionLogsDataOptions) {
  const [internalLogs, setLogs] = useState<LogEntry[]>([]);
  const [internalErrors, setErrors] = useState<ExecutionError[]>([]);
  const [internalHasActiveRun, setInternalHasActiveRun] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const runsByIdRef = useRef<Record<string, PipelineRunItem>>({});
  const clearedIdsRef = useRef<Set<string>>(new Set());
  const logIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isControlled = controlledEntries !== undefined;
  const logs = controlledEntries ?? internalLogs;
  const errors = controlledErrors ?? internalErrors;

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
      setLiveAnnouncement(
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
    [paused, appendEntries],
  );

  const { isConnected: sseConnected, reconnect: sseReconnect } =
    usePipelineStream({
      onProgress: handleSseProgress,
      onErrorEvent: handleSseError,
      onComplete: handleSseComplete,
    });

  const isConnected = controlledConnected ?? sseConnected;
  const hasActiveRun = controlledHasActiveRun ?? internalHasActiveRun;

  const fetchBackendLogs = useCallback(async () => {
    if (paused || isControlled) return;
    try {
      const res = await apiFetch("/api/v1/pipelines?size=20", {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) return;

      const page = (await res.json()) as unknown;
      const { derived, anyActive, runsById } =
        deriveLogsFromBackendPayload(page);
      Object.assign(runsByIdRef.current, runsById);
      setInternalHasActiveRun(anyActive);
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

  const clearLogs = useCallback(() => {
    logs.forEach((l) => clearedIdsRef.current.add(l.id));
    setLogs([]);
  }, [logs]);

  const handleReconnect = useCallback(() => {
    sseReconnect();
    fetchBackendLogs();
  }, [sseReconnect, fetchBackendLogs]);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const getCachedRun = useCallback((runId: string) => {
    return runsByIdRef.current[runId];
  }, []);

  return {
    logs,
    errors,
    isConnected,
    hasActiveRun,
    liveAnnouncement,
    clearLogs,
    handleReconnect,
    dismissError,
    getCachedRun,
  };
}
