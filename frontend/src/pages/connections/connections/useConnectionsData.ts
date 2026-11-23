import { useState, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/api";
import { deriveEngineStatus } from "../../../components/layout/engineStatusUtils";
import type { EngineMetricsResponse } from "../../dashboard/useDashboardData";
import type { IngestedFile, DatabaseConnector } from "./connectionsTypes";
import { parseRawConnections, buildUnifiedSources } from "./connectionsHelpers";
import { useConnectionsTab } from "./useConnectionsTab";
import { useConnectionsModals } from "./useConnectionsModals";
import { useConnectionsActions } from "./useConnectionsActions";

export function useConnectionsData() {
  const queryClient = useQueryClient();

  const modalState = useConnectionsModals();
  const tabState = useConnectionsTab();

  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>([]);
  const [customConnectors, setCustomConnectors] = useState<DatabaseConnector[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [isTabHidden, setIsTabHidden] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.hidden : false,
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const isEngineOffline = useCallback(() => {
    if (!isOnline) return true;
    const metrics = queryClient.getQueryData<EngineMetricsResponse>([
      "engine-metrics",
    ]);
    if (!metrics) return false;
    return deriveEngineStatus(metrics, false) === "offline";
  }, [isOnline, queryClient]);

  const isPollingPaused = isTabHidden || isEngineOffline();

  const loadConnectors = useCallback(
    async (isInitial = false) => {
      if (isInitial) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      try {
        const res = await apiFetch("/api/v1/connections", {
          headers: { "X-Suppress-Toast": "true" },
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            errBody.message ||
              `Failed to load connections (HTTP ${res.status})`,
          );
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          const { fileItems, dbItems } = parseRawConnections(data);

          let localFiles: IngestedFile[] = [];
          try {
            const cached = localStorage.getItem("local_ingested_files");
            if (cached) localFiles = JSON.parse(cached);
          } catch {
            // ignore
          }

          const mergedFiles = fileItems.map((f) => {
            const localMatch = localFiles.find(
              (lf) => lf.id === f.id || lf.name === f.name,
            );
            if (localMatch) {
              return {
                ...f,
                columns:
                  f.columns && f.columns.length > 0
                    ? f.columns
                    : localMatch.columns,
                sampleRows:
                  f.sampleRows && f.sampleRows.length > 0
                    ? f.sampleRows
                    : localMatch.sampleRows,
              };
            }
            return f;
          });

          localFiles.forEach((lf) => {
            if (
              !mergedFiles.some((f) => f.id === lf.id || f.name === lf.name)
            ) {
              mergedFiles.push(lf);
            }
          });

          setCustomConnectors(dbItems);
          setIngestedFiles(mergedFiles);

          tabState.adjustTabIfEmpty({
            connectors: dbItems.length,
            files: mergedFiles.length,
          });
        } else {
          setCustomConnectors([]);
          setIngestedFiles([]);
        }
        setLastRefreshedAt(new Date());
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load registered connections";
        setError(msg);
        setCustomConnectors([]);
        try {
          const cached = localStorage.getItem("local_ingested_files");
          setIngestedFiles(cached ? JSON.parse(cached) : []);
        } catch {
          setIngestedFiles([]);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [tabState],
  );

  const actionsState = useConnectionsActions({ loadConnectors });

  const isModalActive =
    !!actionsState.cleanPreviewFile ||
    !!actionsState.previewingFile ||
    modalState.isWizardOpen ||
    modalState.isDbModalOpen ||
    !!actionsState.editTarget;

  // Track browser visibility and online/offline state
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsTabHidden(hidden);
      if (!hidden && !isEngineOffline() && !isModalActive) {
        loadConnectors(false);
      }
    };

    const handleFocus = () => {
      if (!document.hidden && !isEngineOffline() && !isModalActive) {
        loadConnectors(false);
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadConnectors, isEngineOffline, isModalActive]);

  // Initial load
  useEffect(() => {
    loadConnectors(true);
  }, [loadConnectors]);

  // 15s polling (paused when hidden, offline, or modal open)
  useEffect(() => {
    if (isPollingPaused) return;
    const interval = setInterval(() => {
      if (!document.hidden && !isEngineOffline() && !isModalActive) {
        loadConnectors(false);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isPollingPaused, isEngineOffline, loadConnectors, isModalActive]);

  const unifiedSources = useMemo(
    () => buildUnifiedSources(customConnectors, ingestedFiles),
    [customConnectors, ingestedFiles],
  );

  return {
    ...modalState,
    ...tabState,
    ...actionsState,
    ingestedFiles,
    customConnectors,
    unifiedSources,
    isLoading,
    isRefreshing,
    isPollingPaused,
    lastRefreshedAt,
    error,
    loadConnectors,
  };
}
