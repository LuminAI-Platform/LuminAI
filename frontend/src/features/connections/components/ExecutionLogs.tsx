import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import type {
  LogLevel,
  LogEntry,
  ExecutionError,
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
}

export const ExecutionLogs: React.FC<ExecutionLogsProps> = ({
  entries: controlledEntries,
  errors: controlledErrors,
  maxLines = 500,
  title = "Pipeline Execution Stream",
}) => {
  const [internalLogs, setLogs] = useState<LogEntry[]>([]);
  const [internalErrors, setErrors] = useState<ExecutionError[]>([]);
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(true);
  const [paused, setPaused] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const logIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logs = controlledEntries ?? internalLogs;
  const errors = controlledErrors ?? internalErrors;

  const fetchBackendLogs = useCallback(async () => {
    if (paused) return;
    try {
      const res = await apiFetch("/api/v1/pipelines?size=15", {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (res.ok) {
        const page = (await res.json()) as unknown;
        const runs: Record<string, unknown>[] = Array.isArray(page)
          ? page
          : Array.isArray((page as { content?: unknown[] })?.content)
            ? ((page as { content: unknown[] }).content as Record<
                string,
                unknown
              >[])
            : [];

        if (runs.length > 0) {
          const derived: LogEntry[] = [];
          runs.forEach((run) => {
            const runId = String(run.id ?? "");
            const source = String(
              run.connectorName ?? run.pipelineType ?? "pipeline",
            );
            const status = String(run.status ?? "RUNNING").toUpperCase();
            const started = run.startedAt
              ? new Date(String(run.startedAt))
              : new Date();

            derived.push({
              id: `be-${runId}-start`,
              ts: started,
              level: "INFO",
              source,
              message: `Run ${runId.slice(0, 8)} initialized (${String(run.connectorType ?? "connector")})`,
            });

            if (status === "RUNNING") {
              const speed = Number(run.throughput ?? 0);
              derived.push({
                id: `be-${runId}-prog`,
                ts: new Date(),
                level: "INFO",
                source,
                message: `Throughput: ${speed} records/sec · Progress: ${Number(run.progress ?? 0)}%`,
              });
            }

            if (status === "COMPLETED" || status === "FAILED") {
              derived.push({
                id: `be-${runId}-done`,
                ts: run.completedAt
                  ? new Date(String(run.completedAt))
                  : new Date(),
                level: status === "COMPLETED" ? "SUCCESS" : "ERROR",
                source,
                message: `Run ${runId.slice(0, 8)} ${status.toLowerCase()}. Duration: ${Number(run.durationSeconds ?? 0)}s.`,
              });
            }
          });

          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newEntries = derived.filter((l) => !existingIds.has(l.id));
            if (newEntries.length === 0) return prev;
            return [...prev, ...newEntries]
              .sort((a, b) => a.ts.getTime() - b.ts.getTime())
              .slice(-maxLines);
          });
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        if (logIntervalRef.current) {
          clearInterval(logIntervalRef.current);
          logIntervalRef.current = null;
        }
      }
    }
  }, [paused, maxLines]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchBackendLogs();
    });
    logIntervalRef.current = setInterval(fetchBackendLogs, 6000);
    return () => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    };
  }, [fetchBackendLogs]);

  useEffect(() => {
    if (isFollowing && !isUserScrollingRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setIsFollowing(atBottom);
  };

  const dismissError = (id: string) =>
    setErrors((prev) => prev.filter((e) => e.id !== id));

  const displayedLogs = useMemo(() => {
    let result = logs;
    if (filter !== "ALL") result = result.filter((l) => l.level === filter);
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(lower) ||
          l.source.toLowerCase().includes(lower),
      );
    }
    return result;
  }, [logs, filter, searchTerm]);

  const errorCount = errors.length;
  const warnCount = logs.filter((l) => l.level === "WARN").length;
  const errLogCount = logs.filter((l) => l.level === "ERROR").length;

  return (
    <div
      className="flex flex-col bg-surface border border-border rounded-lg overflow-hidden shadow-sm"
      data-testid="execution-logs"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-subtle border-b border-border select-none">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${paused ? "bg-text-secondary" : "bg-success"}`}
          />
          <span className="text-xs font-semibold text-text">{title}</span>
          <span className="text-[10px] text-text-secondary">
            {logs.length} entries
          </span>

          {warnCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warning-bg border border-warning-border text-warning">
              {warnCount}W
            </span>
          )}
          {errLogCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-error-bg border border-error-border text-error">
              {errLogCount}E
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isFollowing && !paused && (
            <span className="text-[9px] text-success px-1.5 py-0.5 bg-success-bg border border-success-border rounded font-medium">
              LIVE
            </span>
          )}
          <button
            onClick={() => setPaused((v) => !v)}
            title={paused ? "Resume stream" : "Pause stream"}
            className="p-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-text transition-all cursor-pointer"
          >
            {paused ? (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setLogs([])}
            title="Clear buffer"
            className="p-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-text transition-all cursor-pointer"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <LogFilterToolbar
        filter={filter}
        setFilter={setFilter}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

      {/* Error callouts section */}
      {errorCount > 0 && (
        <div className="flex flex-col gap-2 p-3 bg-error-bg border-b border-error-border">
          <div className="text-[10px] font-bold text-error uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            Active Failures ({errorCount})
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
      />
    </div>
  );
};
