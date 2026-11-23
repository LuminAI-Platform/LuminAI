import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import type { SyncJobStatus, SyncDataset } from "./syncJobTypes";
import { STATUS_CONFIG } from "./syncJobTypes";
import {
  parseSyncDatasetFromApi,
  formatOutcomeSummary,
} from "./syncJobHelpers";

export function useSyncJobsData(controlledDatasets?: SyncDataset[]) {
  const [internalDatasets, setInternalDatasets] = useState<SyncDataset[]>([]);
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [liveNow, setLiveNow] = useState<number>(() => Date.now());
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const prevStatusesRef = useRef<Record<string, SyncJobStatus>>({});
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const datasets = controlledDatasets ?? internalDatasets;

  const fetchSyncJobs = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/pipelines?size=20", {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) return;

      const page = (await res.json()) as unknown;
      const items: Record<string, unknown>[] = Array.isArray(page)
        ? page
        : Array.isArray((page as { content?: unknown[] })?.content)
          ? ((page as { content: unknown[] }).content as Record<
              string,
              unknown
            >[])
          : [];

      const parsed = items.map((item, idx) =>
        parseSyncDatasetFromApi(item, idx),
      );

      const prevMap = prevStatusesRef.current;
      for (const ds of parsed) {
        const prevStatus = prevMap[ds.id];
        if (
          prevStatus === "running" &&
          (ds.status === "completed" ||
            ds.status === "completed_with_issues" ||
            ds.status === "failed")
        ) {
          const outcome = formatOutcomeSummary(ds);
          const statusText = STATUS_CONFIG[ds.status].label.toLowerCase();
          setLiveAnnouncement(`Sync ${statusText} for ${ds.name}: ${outcome}.`);
          break;
        }
      }
      const nextMap: Record<string, SyncJobStatus> = {};
      parsed.forEach((ds) => {
        nextMap[ds.id] = ds.status;
      });
      prevStatusesRef.current = nextMap;

      setInternalDatasets(parsed);

      const activeRun = parsed.find((d) => d.status === "running");
      if (activeRun && typeof activeRun.throughput === "number") {
        setSpeedHistory((h) =>
          [...h, Math.round(activeRun.throughput!)].slice(-24),
        );
      } else {
        setSpeedHistory([]);
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
    if (controlledDatasets !== undefined) return;
    Promise.resolve().then(() => {
      fetchSyncJobs();
    });
    syncIntervalRef.current = setInterval(fetchSyncJobs, 5000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [controlledDatasets, fetchSyncJobs]);

  return {
    datasets,
    selectedScope,
    setSelectedScope,
    speedHistory,
    liveNow,
    setLiveNow,
    liveAnnouncement,
  };
}
