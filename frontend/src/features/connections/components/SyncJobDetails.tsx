import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncJobStatus = "running" | "paused" | "completed" | "failed";

export interface SyncDataset {
  id: string;
  name: string;
  source: string;
  totalRecords: number;
  syncedRecords: number;
  failedRecords: number;
  status: SyncJobStatus;
  startedAt: Date;
}

export interface SyncJob {
  id: string;
  name: string;
  connection: string;
  connectionType: "postgresql" | "mysql" | "snowflake" | "kafka" | "s3";
  status: SyncJobStatus;
  datasets: SyncDataset[];
  startedAt: Date;
  estimatedEnd?: Date;
}

interface SyncJobDetailsProps {
  job?: SyncJob;
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<SyncJob["connectionType"], React.ReactNode> = {
  postgresql: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" />
    </svg>
  ),
  mysql: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
    </svg>
  ),
  snowflake: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="m20 10-8-8-8 8" />
      <path d="m4 14 8 8 8-8" />
      <path d="m2 12 10 0m0 0 10 0" />
      <path d="m6 8 2 2m8-2-2 2M6 16l2-2m8 2-2-2" />
    </svg>
  ),
  kafka: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      <path d="M5.6 5.6l2.1 2.1m10.6 10.6 2.1 2.1M18.4 5.6l-2.1 2.1M5.6 18.4l2.1-2.1" />
    </svg>
  ),
  s3: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
};

const formatDuration = (start: Date): string => {
  const seconds = Math.floor((Date.now() - start.getTime()) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

// ─── Speed sparkline ─────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = "#3b82f6",
  height = 32,
}) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = height;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${(data.length - 1) * step},${h}`}
        fill="url(#spark-fill)"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

// ─── Circular progress ring ───────────────────────────────────────────────────

interface ProgressRingProps {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  pct,
  size = 48,
  stroke = 4,
  color = "#3b82f6",
}) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct / 100, 1));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#27272a"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SyncJobStatus,
  { label: string; dot: string; badge: string }
> = {
  running: {
    label: "Running",
    dot: "bg-blue-500 animate-pulse",
    badge: "bg-blue-500/10 border-blue-500/25 text-blue-400",
  },
  paused: {
    label: "Paused",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 border-amber-500/25 text-amber-400",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
  },
  failed: {
    label: "Failed",
    dot: "bg-red-500",
    badge: "bg-red-500/10 border-red-500/25 text-red-400",
  },
};

const datasetStatusColor = (s: SyncJobStatus) => {
  switch (s) {
    case "running":
      return "#3b82f6";
    case "completed":
      return "#10b981";
    case "failed":
      return "#ef4444";
    default:
      return "#f59e0b";
  }
};

// ─── Main component ───────────────────────────────────────────────────────────

export const SyncJobDetails: React.FC<SyncJobDetailsProps> = ({
  job: jobProp,
  onPause,
  onResume,
  onCancel,
}) => {
  const [job, setJob] = useState<SyncJob | null>(() => jobProp ?? null);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Sync prop job into state when caller provides one
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (jobProp) setJob(jobProp);
  }, [jobProp]);

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll /api/v1/pipelines/runs — the real backend source for sync job data
  const fetchSyncJobs = useCallback(async () => {
    try {
      const res = await apiFetch(
        "/api/v1/pipelines/runs?size=10&sort=startedAt,desc",
      );
      if (res.ok) {
        const page = await res.json();
        // Spring Page wrapper: { content: PipelineRunDto[] }
        const items: Record<string, unknown>[] = Array.isArray(page)
          ? page
          : Array.isArray(page?.content)
            ? page.content
            : [];
        if (items.length > 0) {
          // Map the first (most recent) run as the active job
          const raw = items[0];
          const statusRaw = String(raw.status ?? "RUNNING").toLowerCase();
          const mappedStatus = (
            ["running", "paused", "completed", "failed"].includes(statusRaw)
              ? statusRaw
              : "running"
          ) as SyncJobStatus;

          // Map each pipeline run as a dataset entry in the breakdown
          const datasets: SyncDataset[] = items.map(
            (item: Record<string, unknown>, i: number) => {
              const dsStatus = String(item.status ?? "RUNNING").toLowerCase();
              return {
                id: String(item.id ?? `ds-${i}`),
                name: String(
                  item.pipelineType ?? item.connectorName ?? `dataset-${i}`,
                ),
                source: String(item.connectorType ?? "database"),
                totalRecords: Number(item.recordsInput ?? 1000),
                syncedRecords: Number(item.recordsOutput ?? 0),
                failedRecords: Number(item.recordsFailed ?? 0),
                status: (["running", "paused", "completed", "failed"].includes(
                  dsStatus,
                )
                  ? dsStatus
                  : "running") as SyncJobStatus,
                startedAt: item.startedAt
                  ? new Date(String(item.startedAt))
                  : new Date(),
              };
            },
          );

          const throughput =
            typeof raw.throughput === "number" ? Math.round(raw.throughput) : 0;

          setJob({
            id: String(raw.id ?? `job-${Date.now()}`),
            name: `Sync: ${String(raw.connectorName ?? "Pipeline")}`,
            connection: String(raw.connectorName ?? "Data Connector"),
            connectionType: String(raw.connectorType ?? "postgresql")
              .toLowerCase()
              .replace(/\s+/g, "") as SyncJob["connectionType"],
            status: mappedStatus,
            startedAt: raw.startedAt
              ? new Date(String(raw.startedAt))
              : new Date(),
            estimatedEnd: undefined,
            datasets,
          });

          if (throughput > 0) {
            setCurrentSpeed(throughput);
            setSpeedHistory((h) => {
              const next = [...h, throughput].slice(-24);
              setAvgSpeed(
                Math.floor(next.reduce((a, b) => a + b, 0) / next.length),
              );
              return next;
            });
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      }
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSyncJobs();
    });
    syncIntervalRef.current = setInterval(fetchSyncJobs, 5000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [fetchSyncJobs]);

  // Tick timer: keeps duration display live
  const advance = useCallback(() => {
    tickRef.current++;
    setTick(tickRef.current);
  }, []);

  useEffect(() => {
    const id = setInterval(advance, 1000);
    return () => clearInterval(id);
  }, [advance]);

  // ── Empty State ─────────────────────────────────────────────────────────────
  if (!job || !job.id || !job.datasets || job.datasets.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center p-8 bg-zinc-950 border border-zinc-800/80 rounded-xl shadow-2xl shadow-black/40 text-center select-none min-h-[280px]"
        data-testid="sync-job-details-empty"
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-600 mb-3"
        >
          <path d="M21.5 2v6h-6" />
          <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
        <span className="text-sm font-semibold text-zinc-400">
          No Active Sync Jobs
        </span>
        <span className="text-xs text-zinc-500 mt-1 max-w-[280px]">
          Connect a database or ingest a file to monitor real-time pipeline
          execution details
        </span>
      </div>
    );
  }

  // ── Derived totals ──────────────────────────────────────────────────────────
  const totalRecords = job.datasets.reduce((a, d) => a + d.totalRecords, 0);
  const totalSynced = job.datasets.reduce((a, d) => a + d.syncedRecords, 0);
  const totalFailed = job.datasets.reduce((a, d) => a + d.failedRecords, 0);
  const overallPct = totalRecords > 0 ? (totalSynced / totalRecords) * 100 : 0;
  const activeDatasets = job.datasets.filter(
    (d) => d.status === "running",
  ).length;
  const cfg = STATUS_CONFIG[job.status];

  return (
    <div
      className="flex flex-col gap-4 bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl shadow-black/40"
      data-testid="sync-job-details"
    >
      {/* ── Job Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 bg-zinc-900/50 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 leading-none">
              {job.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-zinc-500 text-[10px]">
                {SOURCE_ICONS[job.connectionType]}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                {job.connection}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}
          >
            {cfg.label}
          </span>

          {/* Controls */}
          {job.status === "running" && (
            <button
              onClick={() => {
                setJob((j) => (j ? { ...j, status: "paused" } : null));
                onPause?.(job.id);
              }}
              title="Pause sync"
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          )}
          {job.status === "paused" && (
            <button
              onClick={() => {
                setJob((j) => (j ? { ...j, status: "running" } : null));
                onResume?.(job.id);
              }}
              title="Resume sync"
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all cursor-pointer"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
          )}
          {(job.status === "running" || job.status === "paused") && (
            <button
              onClick={() => {
                setJob((j) => (j ? { ...j, status: "failed" } : null));
                onCancel?.(job.id);
              }}
              title="Cancel sync"
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
            >
              <svg
                width="13"
                height="13"
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
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5">
        {/* Overall Progress */}
        <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3">
          <div className="relative flex-shrink-0">
            <ProgressRing
              pct={overallPct}
              color={job.status === "failed" ? "#ef4444" : "#3b82f6"}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-300 font-mono">
              {Math.floor(overallPct)}%
            </span>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
              Progress
            </div>
            <div className="text-xs font-mono text-zinc-200 font-semibold leading-tight mt-0.5">
              {formatNumber(totalSynced)}
              <span className="text-zinc-500 font-normal">
                /{formatNumber(totalRecords)}
              </span>
            </div>
          </div>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3">
          <div className="flex-shrink-0">
            <Sparkline data={speedHistory} color="#3b82f6" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
              Speed
            </div>
            <div className="text-xs font-mono text-blue-400 font-bold leading-tight mt-0.5">
              {formatNumber(currentSpeed)}
              <span className="text-zinc-500 font-normal text-[10px]">
                {" "}
                rec/s
              </span>
            </div>
            <div className="text-[9px] text-zinc-600 mt-0.5">
              avg {formatNumber(avgSpeed)} rec/s
            </div>
          </div>
        </div>

        {/* Errors */}
        <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
              Errors
            </div>
            <div
              className={`text-xs font-mono font-bold leading-tight mt-0.5 ${totalFailed > 0 ? "text-red-400" : "text-zinc-400"}`}
            >
              {formatNumber(totalFailed)}
              <span className="text-zinc-600 font-normal text-[10px]">
                {" "}
                records
              </span>
            </div>
          </div>
        </div>

        {/* Duration / active datasets */}
        <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
              Duration
            </div>
            {/* re-render each tick to show live elapsed time */}
            <div
              key={tick}
              className="text-xs font-mono text-zinc-200 font-semibold leading-tight mt-0.5"
            >
              {formatDuration(job.startedAt)}
            </div>
            <div className="text-[9px] text-zinc-600 mt-0.5">
              {activeDatasets} dataset
              {activeDatasets !== 1 ? "s" : ""} active
            </div>
          </div>
        </div>
      </div>

      {/* ── Dataset breakdown table ──────────────────────────────────────────── */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 select-none">
          Dataset Breakdown
        </div>

        <div className="flex flex-col gap-2">
          {job.datasets.map((ds) => {
            const pct =
              ds.totalRecords > 0
                ? (ds.syncedRecords / ds.totalRecords) * 100
                : 0;
            const color = datasetStatusColor(ds.status);
            const dsCfg = STATUS_CONFIG[ds.status];

            return (
              <div
                key={ds.id}
                className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-3"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dsCfg.dot}`}
                    />
                    <span className="text-xs font-mono text-zinc-200 truncate">
                      {ds.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] font-mono text-zinc-400">
                      {formatNumber(ds.syncedRecords)} /{" "}
                      {formatNumber(ds.totalRecords)}
                    </span>
                    {ds.failedRecords > 0 && (
                      <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                        {ds.failedRecords} err
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${dsCfg.badge}`}
                    >
                      {Math.floor(pct)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
