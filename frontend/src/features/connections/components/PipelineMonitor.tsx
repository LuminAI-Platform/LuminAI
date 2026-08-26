import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../../../lib/api";
import {
  PipelineJobCard,
  type PipelineJob,
  type PipelineJobStatus,
  type PipelineErrorEntry,
} from "./PipelineJobCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterStatus = "ALL" | PipelineJobStatus;

// ─── Mock seed data ───────────────────────────────────────────────────────────

const MOCK_ERRORS: PipelineErrorEntry[] = [
  {
    timestamp: new Date(Date.now() - 45_000).toISOString(),
    level: "ERROR",
    message: "Null constraint violation on column 'user_id' — row skipped.",
    record: "row#4821",
  },
  {
    timestamp: new Date(Date.now() - 30_000).toISOString(),
    level: "WARN",
    message: "Date parse failed for value '31/13/2025', defaulting to null.",
    record: "row#5103",
  },
  {
    timestamp: new Date(Date.now() - 12_000).toISOString(),
    level: "ERROR",
    message: "Foreign key reference missing: orders.customer_id not found.",
    record: "row#5881",
  },
];

function makeMockJobs(): PipelineJob[] {
  return [
    {
      id: "pipe-001",
      connectorName: "Snowflake Prod",
      connectorType: "Snowflake",
      status: "RUNNING",
      progress: 42,
      recordsInput: 500_000,
      recordsOutput: 210_000,
      recordsFailed: 3,
      throughput: 14_320,
      startedAt: new Date(Date.now() - 88_000).toISOString(),
      durationSeconds: 88,
      errors: MOCK_ERRORS,
    },
    {
      id: "pipe-002",
      connectorName: "Postgres Analytics",
      connectorType: "PostgreSQL",
      status: "RUNNING",
      progress: 71,
      recordsInput: 120_000,
      recordsOutput: 85_200,
      recordsFailed: 0,
      throughput: 9_850,
      startedAt: new Date(Date.now() - 210_000).toISOString(),
      durationSeconds: 210,
      errors: [],
    },
    {
      id: "pipe-003",
      connectorName: "S3 Event Logs",
      connectorType: "S3 / File",
      status: "COMPLETED",
      progress: 100,
      recordsInput: 78_400,
      recordsOutput: 78_390,
      recordsFailed: 10,
      throughput: 0,
      startedAt: new Date(Date.now() - 620_000).toISOString(),
      durationSeconds: 620,
      errors: [
        {
          timestamp: new Date(Date.now() - 600_000).toISOString(),
          level: "WARN",
          message:
            "Encoding mismatch detected on 10 rows — converted to UTF-8.",
        },
      ],
    },
    {
      id: "pipe-004",
      connectorName: "Kafka Stream Ingest",
      connectorType: "Kafka",
      status: "FAILED",
      progress: 28,
      recordsInput: 250_000,
      recordsOutput: 70_000,
      recordsFailed: 412,
      throughput: 0,
      startedAt: new Date(Date.now() - 3_400_000).toISOString(),
      durationSeconds: 3400,
      errors: [
        {
          timestamp: new Date(Date.now() - 3_390_000).toISOString(),
          level: "ERROR",
          message: "Broker connection lost: ECONNREFUSED kafka:9092",
        },
        {
          timestamp: new Date(Date.now() - 3_380_000).toISOString(),
          level: "ERROR",
          message: "Pipeline aborted after 3 consecutive broker failures.",
        },
      ],
    },
    {
      id: "pipe-005",
      connectorName: "MySQL CRM Export",
      connectorType: "MySQL",
      status: "CLEANED",
      progress: 100,
      recordsInput: 34_200,
      recordsOutput: 34_187,
      recordsFailed: 13,
      throughput: 0,
      startedAt: new Date(Date.now() - 1_800_000).toISOString(),
      durationSeconds: 1800,
      errors: [],
    },
  ];
}

// ─── Normalise raw API payload to PipelineJob ─────────────────────────────────

function normaliseJob(raw: Record<string, unknown>): PipelineJob {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Throughput Gauge ─────────────────────────────────────────────────────────

const ThroughputGauge: React.FC<{ value: number; max?: number }> = ({
  value,
  max = 50_000,
}) => {
  const pct = Math.min(value / max, 1);
  const angle = -135 + pct * 270; // sweep from -135° to +135°
  const r = 36;
  const cx = 48;
  const cy = 52;

  // Arc path helpers
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcX = (deg: number) => cx + r * Math.cos(toRad(deg));
  const arcY = (deg: number) => cy + r * Math.sin(toRad(deg));

  const trackStart = -135;
  const trackEnd = 135;
  const fillEnd = trackStart + pct * 270;

  const trackD = `M ${arcX(trackStart)} ${arcY(trackStart)} A ${r} ${r} 0 1 1 ${arcX(trackEnd)} ${arcY(trackEnd)}`;
  const fillD =
    pct > 0
      ? `M ${arcX(trackStart)} ${arcY(trackStart)} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${arcX(fillEnd)} ${arcY(fillEnd)}`
      : "";

  // Needle
  const needleAngle = angle;
  const nx = cx + (r - 6) * Math.cos(toRad(needleAngle));
  const ny = cy + (r - 6) * Math.sin(toRad(needleAngle));

  // Color zones
  const gaugeColor = pct < 0.4 ? "#3b82f6" : pct < 0.75 ? "#f59e0b" : "#ef4444";

  return (
    <svg width="96" height="68" viewBox="0 0 96 68">
      <defs>
        <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      {/* Track */}
      <path
        d={trackD}
        fill="none"
        stroke="#27272a"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Fill */}
      {pct > 0 && (
        <path
          d={fillD}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          style={{ transition: "all 0.6s ease" }}
        />
      )}
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke={gaugeColor}
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          transition: "all 0.6s ease",
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />
      <circle
        cx={cx}
        cy={cy}
        r="3"
        fill={gaugeColor}
        style={{ transition: "fill 0.6s ease" }}
      />
    </svg>
  );
};

// ─── Summary KPI Card ─────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, accent = "text-zinc-100", icon }) => (
  <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4">
    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
      {icon}
    </div>
    <div>
      <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`text-sm font-bold font-mono leading-tight mt-0.5 ${accent}`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ─── Filter Pill ──────────────────────────────────────────────────────────────

const FilterPill: React.FC<{
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  id: string;
}> = ({ label, count, active, onClick, id }) => (
  <button
    id={id}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
      active
        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
    }`}
  >
    {label}
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
        active ? "bg-blue-500/30 text-blue-100" : "bg-zinc-800 text-zinc-500"
      }`}
    >
      {count}
    </span>
  </button>
);

// ─── SSE connection status dot ─────────────────────────────────────────────────

const ConnectionDot: React.FC<{ connected: boolean; polling: boolean }> = ({
  connected,
  polling,
}) => (
  <div className="flex items-center gap-1.5">
    <span
      className={`w-1.5 h-1.5 rounded-full ${
        connected
          ? "bg-emerald-500 animate-pulse"
          : polling
            ? "bg-amber-500 animate-pulse"
            : "bg-zinc-600"
      }`}
    />
    <span className="text-[10px] text-zinc-500 select-none">
      {connected ? "SSE Live" : polling ? "Polling 3s" : "Disconnected"}
    </span>
  </div>
);

// ─── PipelineMonitor (main export) ────────────────────────────────────────────

export const PipelineMonitor: React.FC = () => {
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [sseConnected, setSseConnected] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const useMockRef = useRef(false);

  // ── Ingest raw payload ──────────────────────────────────────────────────────
  const ingestPayload = useCallback((raw: unknown) => {
    try {
      const dataObj = raw as Record<string, unknown>;
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray(dataObj?.content)
          ? (dataObj.content as unknown[])
          : [raw];
      const normalised = (arr as Record<string, unknown>[]).map(normaliseJob);
      setJobs(normalised);
      setLastUpdated(new Date());
      setFetchError(null);
    } catch {
      // keep existing jobs
    }
  }, []);

  // ── Polling fallback ────────────────────────────────────────────────────────
  const fetchOnce = useCallback(async () => {
    if (useMockRef.current) return;
    try {
      const res = await apiFetch("/api/v1/pipelines/runs");
      const data = await res.json();
      ingestPayload(data);
    } catch {
      // If backend unavailable, switch to mock
      useMockRef.current = true;
      setJobs(makeMockJobs());
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [ingestPayload]);

  // ── Animate mock running jobs ───────────────────────────────────────────────
  const advanceMock = useCallback(() => {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.status !== "RUNNING") return j;
        const delta = Math.floor(Math.random() * 3_000 + 500);
        const newOutput = Math.min(j.recordsInput, j.recordsOutput + delta);
        const progress = (newOutput / j.recordsInput) * 100;
        const status: PipelineJobStatus =
          progress >= 100 ? "COMPLETED" : "RUNNING";
        return {
          ...j,
          recordsOutput: newOutput,
          progress,
          status,
          throughput: Math.floor(Math.random() * 5_000 + 8_000),
          durationSeconds: j.durationSeconds + 3,
        };
      }),
    );
    setLastUpdated(new Date());
  }, []);

  // ── Mount: try SSE first, fall back to polling ──────────────────────────────
  useEffect(() => {
    let sseOk = false;

    const trySSE = () => {
      try {
        const token =
          document.cookie
            .split("; ")
            .find((r) => r.startsWith("access_token="))
            ?.split("=")[1] ?? "";
        const url = `${
          (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
          "http://localhost:8080"
        }/api/v1/pipelines/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;

        const es = new EventSource(url);
        sseRef.current = es;

        const timeout = setTimeout(() => {
          if (!sseOk) {
            es.close();
            startPolling();
          }
        }, 3000);

        const handleEvent = (e: MessageEvent) => {
          clearTimeout(timeout);
          sseOk = true;
          setSseConnected(true);
          setPolling(false);
          setIsLoading(false);
          try {
            ingestPayload(JSON.parse(e.data));
          } catch {
            /* ignore */
          }
        };

        es.onmessage = handleEvent;
        es.addEventListener("pipeline-update", handleEvent);
        es.addEventListener("JOB_PROGRESS", handleEvent);
        es.addEventListener("JOB_COMPLETE", handleEvent);
        es.addEventListener("RECORD_CLEANED", handleEvent);
        es.addEventListener("ENTITY_MATCHED", handleEvent);

        es.onerror = () => {
          clearTimeout(timeout);
          es.close();
          setSseConnected(false);
          if (!sseOk) startPolling();
        };
      } catch {
        startPolling();
      }
    };

    const startPolling = () => {
      setPolling(true);
      // Initial fetch
      fetchOnce().then(() => {
        // If backend was unavailable, mock is already set
        if (useMockRef.current) {
          // animate mock every 3s
          pollRef.current = setInterval(advanceMock, 3000);
        } else {
          pollRef.current = setInterval(fetchOnce, 3000);
        }
      });
    };

    trySSE();

    return () => {
      sseRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchOnce, ingestPayload, advanceMock]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const running = jobs.filter((j) => j.status === "RUNNING");
  const totalThroughput = running.reduce((a, j) => a + j.throughput, 0);
  const totalInput = jobs.reduce((a, j) => a + j.recordsInput, 0);
  const totalFailed = jobs.reduce((a, j) => a + j.recordsFailed, 0);

  const counts: Record<FilterStatus, number> = {
    ALL: jobs.length,
    RUNNING: jobs.filter((j) => j.status === "RUNNING").length,
    CLEANED: jobs.filter((j) => j.status === "CLEANED").length,
    COMPLETED: jobs.filter((j) => j.status === "COMPLETED").length,
    FAILED: jobs.filter((j) => j.status === "FAILED").length,
  };

  const visible =
    filter === "ALL" ? jobs : jobs.filter((j) => j.status === filter);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div id="pipeline-monitor" className="flex flex-col gap-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between select-none">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 leading-tight">
            Pipeline Monitor
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time data cleaning job status &amp; throughput
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionDot connected={sseConnected} polling={polling} />
          {lastUpdated && (
            <span className="text-[10px] text-zinc-600 font-mono select-none">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Summary Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Active pipelines + gauge */}
        <div className="col-span-2 lg:col-span-1 flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4">
          <ThroughputGauge value={totalThroughput} />
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
              Total Throughput
            </div>
            <div className="text-sm font-bold font-mono text-blue-400 leading-tight mt-0.5">
              {formatNumber(totalThroughput)}
              <span className="text-zinc-500 font-normal text-[10px]">
                {" "}
                rec/s
              </span>
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">
              {running.length} active pipeline{running.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <KpiCard
          label="Active Records"
          value={formatNumber(totalInput)}
          sub={`${formatNumber(jobs.reduce((a, j) => a + j.recordsOutput, 0))} processed`}
          accent="text-zinc-100"
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
        />

        <KpiCard
          label="Failed Records"
          value={formatNumber(totalFailed)}
          sub={
            totalInput > 0
              ? `${((totalFailed / totalInput) * 100).toFixed(2)}% error rate`
              : "—"
          }
          accent={totalFailed > 0 ? "text-red-400" : "text-zinc-400"}
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />

        <KpiCard
          label="Total Jobs"
          value={jobs.length}
          sub={`${counts.COMPLETED} completed · ${counts.FAILED} failed`}
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
      </div>

      {/* ── Filter Tabs ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          ["ALL", "RUNNING", "CLEANED", "COMPLETED", "FAILED"] as FilterStatus[]
        ).map((f) => (
          <FilterPill
            key={f}
            id={`pipeline-filter-${f.toLowerCase()}`}
            label={f}
            count={counts[f]}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {/* ── Table Header ───────────────────────────────────────────────────── */}
      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 select-none border-b border-zinc-800/60">
        <div className="col-span-3">Connector</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-3">Progress</div>
        <div className="col-span-2">Throughput</div>
        <div className="col-span-2 text-right">Started · Errors</div>
      </div>

      {/* ── Job List ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-zinc-400 text-xs gap-2 select-none">
          <svg
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" className="opacity-25" />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4"
              className="opacity-75"
            />
          </svg>
          Loading pipeline jobs…
        </div>
      ) : fetchError ? (
        <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium">
          {fetchError}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-zinc-800/80 rounded-xl bg-zinc-950/60 select-none">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-zinc-600 mb-3"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="text-sm font-semibold text-zinc-400">
            No {filter === "ALL" ? "" : filter.toLowerCase()} pipeline jobs
          </span>
          <span className="text-xs text-zinc-500 mt-1">
            Jobs will appear here once pipelines are triggered
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((job) => (
            <PipelineJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
};
