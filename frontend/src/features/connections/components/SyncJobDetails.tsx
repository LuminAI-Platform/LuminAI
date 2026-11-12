import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import type {
  SyncJobStatus,
  SyncDataset,
  SyncJob,
} from "./sync-job/syncJobTypes";
import { SOURCE_ICONS, STATUS_CONFIG } from "./sync-job/syncJobTypes";
import { SyncJobKpiCards } from "./sync-job/SyncJobKpiCards";
import { SyncDatasetRow } from "./sync-job/SyncDatasetRow";

export type { SyncJobStatus, SyncDataset, SyncJob };

interface SyncJobDetailsProps {
  job?: SyncJob;
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

export const SyncJobDetails: React.FC<SyncJobDetailsProps> = ({
  job: controlledJob,
  onPause,
  onResume,
  onCancel,
}) => {
  const [internalJob, setJob] = useState<SyncJob | null>(null);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [avgSpeed, setAvgSpeed] = useState<number>(0);
  const [, setTick] = useState(0);
  const [now, setNow] = useState(0);

  const tickRef = useRef(0);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const job = controlledJob ?? internalJob;

  const fetchSyncJobs = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/pipelines?size=20", {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (res.ok) {
        const page = (await res.json()) as unknown;
        const items: Record<string, unknown>[] = Array.isArray(page)
          ? page
          : Array.isArray((page as { content?: unknown[] })?.content)
            ? ((page as { content: unknown[] }).content as Record<
                string,
                unknown
              >[])
            : [];
        if (items.length > 0) {
          const raw = items[0];
          const statusRaw = String(raw.status ?? "RUNNING").toLowerCase();
          const mappedStatus = (
            ["running", "paused", "completed", "failed"].includes(statusRaw)
              ? statusRaw
              : "running"
          ) as SyncJobStatus;

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

  const advance = useCallback(() => {
    const ts = Date.now();
    setNow(ts);
    tickRef.current++;
    setTick(tickRef.current);
  }, []);

  useEffect(() => {
    const id = setInterval(advance, 1000);
    return () => clearInterval(id);
  }, [advance]);

  if (!job) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
            <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-zinc-300">
          No active sync pipeline
        </p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Start a pipeline ingestion job or upload a dataset to monitor
          real-time sync metrics here.
        </p>
      </div>
    );
  }

  const totalRecords = job.datasets.reduce(
    (acc, ds) => acc + ds.totalRecords,
    0,
  );
  const totalSynced = job.datasets.reduce(
    (acc, ds) => acc + ds.syncedRecords,
    0,
  );
  const totalErrors = job.datasets.reduce(
    (acc, ds) => acc + ds.failedRecords,
    0,
  );
  const overallPct = totalRecords > 0 ? (totalSynced / totalRecords) * 100 : 0;
  const durationSec = Math.max(
    0,
    Math.floor((now - job.startedAt.getTime()) / 1000),
  );
  const cfg = STATUS_CONFIG[job.status];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col gap-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5">
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
          {onPause && job.status === "running" && (
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
          {onResume && job.status === "paused" && (
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
          {onCancel &&
            (job.status === "running" || job.status === "paused") && (
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

      {/* KPI Row */}
      <SyncJobKpiCards
        job={job}
        overallPct={overallPct}
        totalSynced={totalSynced}
        totalRecords={totalRecords}
        currentSpeed={currentSpeed}
        speedHistory={speedHistory}
        avgSpeed={avgSpeed}
        totalErrors={totalErrors}
        durationSec={durationSec}
      />

      {/* Dataset Breakdown */}
      <div className="px-5 flex flex-col gap-2">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
          Datasets ({job.datasets.length})
        </div>
        <div className="flex flex-col gap-2">
          {job.datasets.map((ds) => (
            <SyncDatasetRow key={ds.id} ds={ds} />
          ))}
        </div>
      </div>
    </div>
  );
};
