import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { RefreshCw, Trash2, Play, ICON_SIZES } from "../../../lib/icons";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import {
  usePipelineStream,
  type PipelineProgressEvent,
  type PipelineErrorEvent,
  type PipelineCompleteEvent,
} from "../hooks/usePipelineStream";
import type { PipelineRunItem } from "./pipeline-analysis/pipelineAnalysisTypes";
import { parseSyncDatasetFromApi } from "./sync-job/syncJobHelpers";
import type {
  LogLevel,
  LogEntry,
  ExecutionError,
  StreamConnectionState,
} from "./execution-logs/executionLogTypes";
import {
  resolveStreamStatus,
  formatLogLineForCopy,
} from "./execution-logs/executionLogTypes";
import { ErrorBlock } from "./execution-logs/ErrorBlock";
import { LogFilterToolbar } from "./execution-logs/LogFilterToolbar";
import { LogConsole } from "./execution-logs/LogConsole";

export type { LogLevel, LogEntry, ExecutionError };

interface ExecutionLogsProps {
  entries?: LogEntry[];
  errors?: ExecutionError[];
  maxLines?: number;
  title?: string;
  streamConnected?: boolean;
  hasActiveRun?: boolean;
  onOpenRunDetail?: (
    runOrId: PipelineRunItem | string,
    triggerEl: HTMLElement | null,
  ) => void;
}

const STREAM_BADGE: Record<
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

export const ExecutionLogs: React.FC<ExecutionLogsProps> = ({
  entries: controlledEntries,
  errors: controlledErrors,
  maxLines = 500,
  title = "Pipeline Execution Stream",
  streamConnected: controlledConnected,
  hasActiveRun: controlledHasActiveRun,
  onOpenRunDetail,
}) => {
  const [internalLogs, setLogs] = useState<LogEntry[]>([]);
  const [internalErrors, setErrors] = useState<ExecutionError[]>([]);
  const [internalHasActiveRun, setInternalHasActiveRun] = useState(false);
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(true);
  const [paused, setPaused] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Always sort by full timestamp ascending (newest at bottom)
  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => a.ts.getTime() - b.ts.getTime()),
    [logs],
  );

  // Level counts across all current logs
  const levelCounts = useMemo<Record<LogLevel | "ALL", number>>(() => {
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
  }, [sortedLogs]);

  const displayedLogs = useMemo(() => {
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
  }, [sortedLogs, filter, searchTerm]);

  useEffect(() => {
    if (isFollowing && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLogs, isFollowing, paused]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setIsFollowing(atBottom);
  };

  const handleJumpToLatest = () => {
    setIsFollowing(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleCopyVisible = async () => {
    if (displayedLogs.length === 0) return;
    const text = displayedLogs.map(formatLogLineForCopy).join("\n");
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      // Clipboard may be unavailable
    }
  };

  const handleConfirmClear = () => {
    logs.forEach((l) => clearedIdsRef.current.add(l.id));
    setLogs([]);
    setConfirmClearOpen(false);
  };

  const handleOpenRunId = (runId: string, triggerEl: HTMLElement | null) => {
    if (!onOpenRunDetail) return;
    const cached = runsByIdRef.current[runId];
    onOpenRunDetail(cached ?? runId, triggerEl);
  };

  const handleReconnect = () => {
    sseReconnect();
    fetchBackendLogs();
  };

  const dismissError = (id: string) =>
    setErrors((prev) => prev.filter((e) => e.id !== id));

  const streamState = resolveStreamStatus({
    isConnected,
    hasActiveRun,
    paused,
  });
  const streamMeta = STREAM_BADGE[streamState];

  return (
    <section
      aria-label={title}
      className="flex flex-col bg-surface border border-border rounded-lg overflow-hidden shadow-sm"
      data-testid="execution-logs"
    >
      {/* ARIA live region for run completion announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Panel header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-surface-subtle border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-text truncate">{title}</h2>
          <span className="text-xs text-text-secondary shrink-0">
            {sortedLogs.length} {sortedLogs.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${streamMeta.cls}`}
            data-testid="stream-status-chip"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${streamMeta.dot}`}
              aria-hidden="true"
            />
            <span>{streamMeta.label}</span>
          </span>

          {streamState === "disconnected" && (
            <button
              type="button"
              onClick={handleReconnect}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border text-xs font-medium text-text hover:border-border-focus transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <RefreshCw size={12} aria-hidden="true" />
              <span>Reconnect</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            title={paused ? "Resume stream" : "Pause stream"}
            aria-label={paused ? "Resume stream" : "Pause stream"}
            className="p-1.5 rounded-md bg-surface border border-border text-text-secondary hover:text-text hover:border-border-focus transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {paused ? (
              <Play size={ICON_SIZES.inline} aria-hidden="true" />
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            disabled={logs.length === 0}
            title="Clear this view"
            aria-label="Clear this view"
            className="p-1.5 rounded-md bg-surface border border-border text-text-secondary hover:text-text hover:border-border-focus disabled:opacity-40 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Trash2 size={ICON_SIZES.inline} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <LogFilterToolbar
        filter={filter}
        setFilter={setFilter}
        counts={levelCounts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        visibleCount={displayedLogs.length}
        copiedAll={copiedAll}
        onCopyVisible={handleCopyVisible}
      />

      {/* Error callouts section */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-2 p-3 bg-error-bg border-b border-error-border">
          <div className="text-xs font-semibold text-error flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            <span>Active failures ({errors.length})</span>
          </div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {errors.map((err) => (
              <ErrorBlock key={err.id} error={err} onDismiss={dismissError} />
            ))}
          </div>
        </div>
      )}

      {/* Main log console */}
      <LogConsole
        logs={displayedLogs}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        isFollowing={isFollowing}
        onJumpToLatest={handleJumpToLatest}
        onOpenRunDetail={handleOpenRunId}
      />

      {/* Clear view confirmation dialog */}
      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear this view?"
        description="Clear this view? History is kept. Pipeline run records remain stored on the server."
        confirmText="Clear view"
        isDestructive={false}
        onConfirm={handleConfirmClear}
      />
    </section>
  );
};
