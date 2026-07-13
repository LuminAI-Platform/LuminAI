import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ExecutionLogsProps {
  /** Controlled log entries — omit to use demo simulation */
  entries?: LogEntry[];
  /** Controlled error blocks — omit to use demo simulation */
  errors?: ExecutionError[];
  /** Enable auto-scrolling demo simulation */
  demo?: boolean;
  /** Max displayed log lines */
  maxLines?: number;
  /** Panel title */
  title?: string;
}

// ─── Static seed data for demo ────────────────────────────────────────────────

const SEED_LOGS: Omit<LogEntry, "id" | "ts">[] = [
  {
    level: "INFO",
    source: "Orchestrator",
    message: "Sync job job-demo-001 dispatched to executor pool.",
  },
  {
    level: "INFO",
    source: "Kafka",
    message: "Connected to brokers at upstash-kafka-prod:9092. 3 partitions.",
  },
  {
    level: "INFO",
    source: "DataEngine",
    message: "Polars thread pool instantiated — 8 workers, 64-bit alignment.",
  },
  {
    level: "SUCCESS",
    source: "MinIO",
    message: "Bucket 'lumin-raw-bucket' health OK. Free space: 2.1 TB.",
  },
  {
    level: "DEBUG",
    source: "Scheduler",
    message: "Heartbeat ACK received from coordinator-02 (RTT 4ms).",
  },
  {
    level: "INFO",
    source: "Sync",
    message: "Schema diff resolved. 0 breaking changes detected.",
  },
];

const LIVE_LOG_POOL: Omit<LogEntry, "id" | "ts">[] = [
  {
    level: "INFO",
    source: "DataEngine",
    message: "Batch #%n committed — 12,480 records flushed.",
  },
  {
    level: "INFO",
    source: "Kafka",
    message: "Offset committed for partition 2 → #%n.",
  },
  {
    level: "DEBUG",
    source: "Polars",
    message: "Lazy plan evaluated. Predicate pushdown applied.",
  },
  {
    level: "INFO",
    source: "LakeWriter",
    message: "Delta table snapshot created at txn #%n.",
  },
  {
    level: "SUCCESS",
    source: "Sync",
    message: "Checkpoint saved. ETA updated to ~%n seconds.",
  },
  {
    level: "WARN",
    source: "Parser",
    message: "Nullable field 'email' missing in %n rows. Coercing to NULL.",
  },
  {
    level: "INFO",
    source: "Compressor",
    message: "Snappy codec: %n KB → %n KB (ratio 3.2×).",
  },
  {
    level: "DEBUG",
    source: "MemPool",
    message: "GC cycle #%n — freed 140 MB spill buffers.",
  },
  {
    level: "INFO",
    source: "Orchestrator",
    message: "Sub-task executor reported healthy at tick #%n.",
  },
  {
    level: "ERROR",
    source: "NetLayer",
    message: "Transient connection reset to replica-3. Retrying (1/3).",
  },
  {
    level: "SUCCESS",
    source: "NetLayer",
    message: "Reconnected to replica-3 after 240ms backoff.",
  },
  {
    level: "INFO",
    source: "Validator",
    message: "Constraint checks passed for batch #%n.",
  },
  {
    level: "WARN",
    source: "Throttle",
    message: "Rate limiter engaged — sleeping 200ms (quota: 15K rec/s).",
  },
  {
    level: "DEBUG",
    source: "QueryPlanner",
    message: "CTE rewrite saved %n full-table scans.",
  },
];

const DEMO_ERRORS: ExecutionError[] = [
  {
    id: "err-1",
    ts: new Date(Date.now() - 45_000),
    code: "NET_RESET_001",
    source: "NetLayer → replica-3",
    message: "Connection reset by peer during streaming read.",
    detail:
      "TCP RST received after 2,048 ms idle timeout. The replica failover resolved automatically after 240 ms backoff. No data loss detected for this batch window.",
    retryable: true,
  },
  {
    id: "err-2",
    ts: new Date(Date.now() - 10_000),
    code: "PARSE_NULL_012",
    source: "Parser → public.users",
    message: "Nullable constraint violation on field 'email' (3 rows).",
    detail:
      "Rows [48821, 49103, 49204] contained empty strings for a NOT NULL declared column. Values coerced to NULL per schema relaxation policy.",
    retryable: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 1000;
const uid = () => `log-${_idCounter++}`;

const randomN = () => Math.floor(Math.random() * 9_000 + 1_000);

const interpolate = (tpl: string): string =>
  tpl.replace(/%n/g, () => String(randomN()));

const formatTs = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const LEVEL_STYLES: Record<LogLevel, { label: string; cls: string }> = {
  INFO: { label: "INFO   ", cls: "text-blue-400" },
  SUCCESS: { label: "SUCCESS", cls: "text-emerald-400" },
  WARN: { label: "WARN   ", cls: "text-amber-400" },
  ERROR: { label: "ERROR  ", cls: "text-red-400" },
  DEBUG: { label: "DEBUG  ", cls: "text-zinc-500" },
};

const SOURCE_CLS = "text-violet-400/80 font-semibold";

// ─── ErrorBlock ───────────────────────────────────────────────────────────────

interface ErrorBlockProps {
  error: ExecutionError;
  onDismiss?: (id: string) => void;
}

const ErrorBlock: React.FC<ErrorBlockProps> = ({ error, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        error.retryable
          ? "border-amber-500/25 bg-amber-500/5"
          : "border-red-500/25 bg-red-500/5"
      }`}
    >
      {/* Error header row */}
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div
          className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${
            error.retryable
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          {error.retryable ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
            >
              <path d="M12 9v4m0 4h.01" />
              <path d="m10.363 3.591-8.106 13.534C1.115 18.217 2.09 20 3.77 20h16.46c1.68 0 2.655-1.783 1.513-2.875L13.637 3.591a1.742 1.742 0 0 0-3.274 0z" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                error.retryable
                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  : "text-red-400 bg-red-500/10 border-red-500/20"
              }`}
            >
              {error.code}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {error.source}
            </span>
            <span className="text-[10px] text-zinc-600 ml-auto">
              {formatTs(error.ts)}
            </span>
          </div>

          <p
            className={`text-xs mt-1.5 leading-relaxed font-medium ${
              error.retryable ? "text-amber-200/80" : "text-red-200/80"
            }`}
          >
            {error.message}
          </p>

          {error.detail && (
            <>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer select-none"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`transform transition-transform ${expanded ? "rotate-90" : ""}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {expanded ? "Hide" : "Show"} detail
              </button>

              {expanded && (
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-2 border-l-2 border-zinc-700 pl-3 font-mono">
                  {error.detail}
                </p>
              )}
            </>
          )}
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            onClick={() => onDismiss(error.id)}
            className="flex-shrink-0 p-1 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer rounded"
            title="Dismiss error"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Retryable footer */}
      {error.retryable && (
        <div className="px-3 py-2 bg-amber-500/5 border-t border-amber-500/15 flex items-center gap-2">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span className="text-[10px] text-amber-500/70">
            Auto-retry enabled — system will attempt recovery automatically.
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const ExecutionLogs: React.FC<ExecutionLogsProps> = ({
  entries: entriesProp,
  errors: errorsProp,
  demo = true,
  maxLines = 200,
  title = "Execution Logs",
}) => {
  const [logs, setLogs] = useState<LogEntry[]>(() =>
    SEED_LOGS.map((l, i) => ({
      ...l,
      id: `seed-${i}`,
      ts: new Date(Date.now() - (SEED_LOGS.length - i) * 4_000),
    })),
  );
  const [errors, setErrors] = useState<ExecutionError[]>(
    errorsProp ?? DEMO_ERRORS,
  );
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(true);
  const [paused, setPaused] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // Sync controlled props
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (entriesProp) setLogs(entriesProp);
  }, [entriesProp]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (errorsProp) setErrors(errorsProp);
  }, [errorsProp]);

  // Auto-scroll
  useEffect(() => {
    if (isFollowing && !isUserScrollingRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  // Detect manual scroll-up
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setIsFollowing(atBottom);
  };

  // Demo live log generation
  const emitLog = useCallback(() => {
    if (!demo || paused) return;
    const template =
      LIVE_LOG_POOL[Math.floor(Math.random() * LIVE_LOG_POOL.length)];
    const entry: LogEntry = {
      id: uid(),
      ts: new Date(),
      level: template.level,
      source: template.source,
      message: interpolate(template.message),
    };
    setLogs((prev) => [...prev, entry].slice(-maxLines));
  }, [demo, paused, maxLines]);

  useEffect(() => {
    const interval = setInterval(emitLog, 900 + Math.random() * 600);
    return () => clearInterval(interval);
  }, [emitLog]);

  // Dismiss error
  const dismissError = (id: string) =>
    setErrors((prev) => prev.filter((e) => e.id !== id));

  // Filtered logs
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

  const LEVEL_FILTERS: (LogLevel | "ALL")[] = [
    "ALL",
    "INFO",
    "SUCCESS",
    "WARN",
    "ERROR",
    "DEBUG",
  ];

  return (
    <div
      className="flex flex-col bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl shadow-black/40"
      data-testid="execution-logs"
    >
      {/* ── Panel header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/80 select-none">
        <div className="flex items-center gap-2.5">
          {/* Live indicator dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${paused ? "bg-zinc-600" : "bg-emerald-500 animate-pulse"}`}
          />
          <span className="text-xs font-semibold text-zinc-100">{title}</span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {logs.length} entries
          </span>

          {/* Warn / Error summary badges */}
          {warnCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
              {warnCount}W
            </span>
          )}
          {errLogCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
              {errLogCount}E
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-scroll badge */}
          {isFollowing && !paused && (
            <span className="text-[9px] text-emerald-500 font-mono px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
              LIVE
            </span>
          )}

          {/* Pause / Resume */}
          <button
            onClick={() => setPaused((v) => !v)}
            title={paused ? "Resume stream" : "Pause stream"}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
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

          {/* Clear */}
          <button
            onClick={() => setLogs([])}
            title="Clear logs"
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/25 transition-all cursor-pointer"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Toolbar (filters + search) ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-zinc-900/30 border-b border-zinc-800/60">
        {/* Level filter tabs */}
        <div className="flex items-center gap-1">
          {LEVEL_FILTERS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                filter === lvl
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="ml-auto relative w-44">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-600 pointer-events-none">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-zinc-900 border border-zinc-800/80 rounded-lg text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/60 transition-colors font-mono"
          />
        </div>
      </div>

      {/* ── Log console ──────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="font-mono text-[10px] leading-relaxed overflow-y-auto bg-black/70 flex flex-col"
        style={{ minHeight: 220, maxHeight: 320 }}
      >
        {displayedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-600 select-none">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            No log entries match current filters
          </div>
        ) : (
          displayedLogs.map((entry) => {
            const lvl = LEVEL_STYLES[entry.level];
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-0 px-4 py-0.5 hover:bg-zinc-900/40 transition-colors group ${
                  entry.level === "ERROR"
                    ? "bg-red-500/5 border-l-2 border-red-500/40"
                    : entry.level === "WARN"
                      ? "bg-amber-500/5 border-l-2 border-amber-500/30"
                      : "border-l-2 border-transparent"
                }`}
              >
                <span className="text-zinc-700 flex-shrink-0 w-[58px]">
                  [{formatTs(entry.ts)}]
                </span>
                <span className={`flex-shrink-0 w-[68px] font-bold ${lvl.cls}`}>
                  {lvl.label}
                </span>
                <span className={`flex-shrink-0 mr-2 ${SOURCE_CLS}`}>
                  [{entry.source}]
                </span>
                <span className="text-zinc-300 break-all">{entry.message}</span>
              </div>
            );
          })
        )}

        {/* Blinking cursor when live */}
        {!paused && isFollowing && (
          <div className="px-4 py-1 text-zinc-600 flex items-center gap-1">
            <span className="animate-pulse">█</span>
          </div>
        )}
      </div>

      {/* ── Error blocks section ─────────────────────────────────────────────── */}
      {errorCount > 0 && (
        <div className="border-t border-zinc-800/80">
          <div className="px-4 py-2.5 bg-zinc-900/30 border-b border-zinc-800/60 flex items-center gap-2 select-none">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
              Error Blocks
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {errorCount} active
            </span>
          </div>

          <div className="flex flex-col gap-2 p-4">
            {errors.map((err) => (
              <ErrorBlock key={err.id} error={err} onDismiss={dismissError} />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer status bar ─────────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-zinc-900/40 border-t border-zinc-800/60 flex items-center justify-between select-none">
        <span className="text-[10px] text-zinc-600 font-mono">
          Showing {displayedLogs.length} / {logs.length} lines
        </span>
        <button
          onClick={() => {
            setIsFollowing(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className={`text-[10px] font-semibold transition-all cursor-pointer ${
            isFollowing ? "text-zinc-700" : "text-blue-400 hover:text-blue-300"
          }`}
        >
          {isFollowing ? "✓ Following tail" : "↓ Jump to tail"}
        </button>
      </div>
    </div>
  );
};
