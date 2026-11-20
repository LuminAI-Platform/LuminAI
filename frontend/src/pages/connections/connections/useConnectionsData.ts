import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/api";
import { useToast } from "../../../components/ui/ToastProvider";
import { deriveEngineStatus } from "../../../components/layout/engineStatusUtils";
import type { EngineMetricsResponse } from "../../dashboard/useDashboardData";
import type { DBType } from "../../../features/connections/components/db-connector/dbConnectorTypes";
import { useConnectionModalStore } from "../../../stores/connectionModalStore";
import type {
  IngestedFile,
  CleanDataResponse,
  DatabaseConnector,
  ConnectionsTab,
  UnifiedSource,
} from "./connectionsTypes";
import {
  parseRawConnections,
  buildUnifiedSources,
  CONNECTIONS_TAB_STORAGE_KEY,
  isValidConnectionsTab,
  resolveNonEmptyTab,
} from "./connectionsHelpers";

function getInitialTab(): ConnectionsTab {
  if (typeof window === "undefined") return "all";
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  if (isValidConnectionsTab(urlTab)) return urlTab;
  try {
    const saved = localStorage.getItem(CONNECTIONS_TAB_STORAGE_KEY);
    if (isValidConnectionsTab(saved)) return saved;
  } catch {
    // ignore storage errors
  }
  return "all";
}

function syncTabToUrlAndStorage(tab: ConnectionsTab) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONNECTIONS_TAB_STORAGE_KEY, tab);
  } catch {
    // ignore storage errors
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore history errors
  }
}

export function useConnectionsData() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [initialUploadFile, setInitialUploadFile] = useState<File | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [initialDbType, setInitialDbType] = useState<DBType>("postgresql");

  const [previewingFile, setPreviewingFile] = useState<IngestedFile | null>(
    null,
  );
  const [isRawPreviewLoading, setIsRawPreviewLoading] = useState(false);
  const [cleanPreviewFile, setCleanPreviewFile] = useState<IngestedFile | null>(
    null,
  );
  const [cleanData, setCleanData] = useState<CleanDataResponse | null>(null);
  const [isCleanDataLoading, setIsCleanDataLoading] = useState(false);
  const [cleanSearchFilter, setCleanSearchFilter] = useState("");
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>([]);
  const [customConnectors, setCustomConnectors] = useState<DatabaseConnector[]>(
    [],
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "file" | "connection";
  } | null>(null);
  const [editTarget, setEditTarget] = useState<UnifiedSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [togglingSourceId, setTogglingSourceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTabState] =
    useState<ConnectionsTab>(getInitialTab);
  const [isTabHidden, setIsTabHidden] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.hidden : false,
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const hasAutoAdjustedTabRef = useRef(false);

  const setActiveTab = useCallback((tab: ConnectionsTab) => {
    setActiveTabState(tab);
    syncTabToUrlAndStorage(tab);
  }, []);

  // Ensure the URL reflects the active tab on initial mount
  useEffect(() => {
    syncTabToUrlAndStorage(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume pending actions triggered from TopBar or Chooser modal
  const pendingAction = useConnectionModalStore((s) => s.pendingAction);
  const consumePendingAction = useConnectionModalStore(
    (s) => s.consumePendingAction,
  );

  useEffect(() => {
    if (!pendingAction) return;
    const { action, dbType } = consumePendingAction();
    if (action === "new-db") {
      setInitialDbType(dbType ?? "postgresql");
      setIsDbModalOpen(true);
    } else if (action === "upload") {
      setInitialUploadFile(null);
      setIsWizardOpen(true);
    }
  }, [pendingAction, consumePendingAction]);

  const openDbModalWithType = useCallback((dbType: DBType = "postgresql") => {
    setInitialDbType(dbType);
    setIsDbModalOpen(true);
  }, []);

  const openWizardWithFile = useCallback((file?: File | null) => {
    setInitialUploadFile(file ?? null);
    setIsWizardOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setIsWizardOpen(false);
    setInitialUploadFile(null);
  }, []);

  const isEngineOffline = useCallback(() => {
    if (!isOnline) return true;
    const metrics = queryClient.getQueryData<EngineMetricsResponse>([
      "engine-metrics",
    ]);
    if (!metrics) return false;
    return deriveEngineStatus(metrics, false) === "offline";
  }, [isOnline, queryClient]);

  const isPollingPaused = isTabHidden || isEngineOffline();

  const loadConnectors = useCallback(async (isInitial = false) => {
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
          errBody.message || `Failed to load connections (HTTP ${res.status})`,
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
          if (!mergedFiles.some((f) => f.id === lf.id || f.name === lf.name)) {
            mergedFiles.push(lf);
          }
        });

        setCustomConnectors(dbItems);
        setIngestedFiles(mergedFiles);

        // Never open on a tab with 0 items when another tab has items
        if (!hasAutoAdjustedTabRef.current) {
          hasAutoAdjustedTabRef.current = true;
          setActiveTabState((prev) => {
            const next = resolveNonEmptyTab(prev, {
              connectors: dbItems.length,
              files: mergedFiles.length,
            });
            if (next !== prev) {
              syncTabToUrlAndStorage(next);
            }
            return next;
          });
        }
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
  }, []);

  // Track browser visibility and online/offline state
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsTabHidden(hidden);
      if (
        !hidden &&
        !isEngineOffline() &&
        !cleanPreviewFile &&
        !previewingFile &&
        !isWizardOpen &&
        !isDbModalOpen &&
        !editTarget
      ) {
        loadConnectors(false);
      }
    };

    const handleFocus = () => {
      if (
        !document.hidden &&
        !isEngineOffline() &&
        !cleanPreviewFile &&
        !previewingFile &&
        !isWizardOpen &&
        !isDbModalOpen &&
        !editTarget
      ) {
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
  }, [
    loadConnectors,
    isEngineOffline,
    cleanPreviewFile,
    previewingFile,
    isWizardOpen,
    isDbModalOpen,
    editTarget,
  ]);

  // Initial load + 15s polling (paused when hidden, offline, or modal open)
  useEffect(() => {
    loadConnectors(true);
  }, [loadConnectors]);

  useEffect(() => {
    if (isPollingPaused) return;
    const interval = setInterval(() => {
      if (
        !document.hidden &&
        !isEngineOffline() &&
        !cleanPreviewFile &&
        !previewingFile &&
        !isWizardOpen &&
        !isDbModalOpen &&
        !editTarget
      ) {
        loadConnectors(false);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [
    isPollingPaused,
    isEngineOffline,
    loadConnectors,
    cleanPreviewFile,
    previewingFile,
    isWizardOpen,
    isDbModalOpen,
    editTarget,
  ]);

  const unifiedSources = useMemo(
    () => buildUnifiedSources(customConnectors, ingestedFiles),
    [customConnectors, ingestedFiles],
  );

  const handleOpenRawPreview = async (file: IngestedFile) => {
    setPreviewingFile(file);
    setIsRawPreviewLoading(true);
    try {
      const res = await apiFetch(`/api/v1/connections/${file.id}`, {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (res.ok) {
        const item = await res.json();
        let config: Record<string, unknown> = {};
        if (typeof item.config === "string") {
          try {
            config = JSON.parse(item.config);
          } catch {
            // ignore
          }
        } else if (item.config && typeof item.config === "object") {
          config = item.config;
        }

        const fetchedColumns = Array.isArray(config.columns)
          ? (config.columns as string[])
          : undefined;
        const fetchedSampleRows = Array.isArray(config.sampleRows)
          ? (config.sampleRows as Record<string, unknown>[])
          : undefined;

        if (fetchedColumns || fetchedSampleRows) {
          setPreviewingFile((prev) =>
            prev
              ? {
                  ...prev,
                  columns: fetchedColumns ?? prev.columns,
                  sampleRows: fetchedSampleRows ?? prev.sampleRows,
                }
              : null,
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsRawPreviewLoading(false);
    }
  };

  const handleInspectCleanData = async (file: IngestedFile) => {
    setCleanPreviewFile(file);
    setIsCleanDataLoading(true);
    setCleanData(null);
    setCleanSearchFilter("");

    try {
      const res = await apiFetch(
        `/api/v1/connections/${file.id}/clean-preview`,
        {
          headers: { "X-Suppress-Toast": "true" },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setCleanData(data);
      } else {
        const rawRows = file.sampleRows || [];
        const rawCols =
          file.columns || (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);
        setCleanData({
          connectionId: file.id,
          totalRawRecords: file.recordsCount || rawRows.length,
          totalCleanRecords: file.recordsCount || rawRows.length,
          duplicatesMerged: 0,
          compressionRatio: "1.0x",
          dataQualityScore: 0.0,
          status: "FAILED",
          columns: rawCols,
          rows: rawRows,
        });
      }
    } catch {
      const rawRows = file.sampleRows || [];
      const rawCols =
        file.columns || (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);
      setCleanData({
        connectionId: file.id,
        totalRawRecords: file.recordsCount || rawRows.length,
        totalCleanRecords: file.recordsCount || rawRows.length,
        duplicatesMerged: 0,
        compressionRatio: "1.0x",
        dataQualityScore: 0.0,
        status: "FAILED",
        columns: rawCols,
        rows: rawRows,
      });
    } finally {
      setIsCleanDataLoading(false);
    }
  };

  const handleTestConnection = async (source: UnifiedSource) => {
    setTestingSourceId(source.id);
    try {
      const res = await apiFetch("/api/v1/connections/discover", {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
        body: JSON.stringify({ connectionId: source.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || `Connection test failed for ${source.name}`,
        );
      }
      const schemas = await res.json();
      const count = Array.isArray(schemas) ? schemas.length : 0;
      toast.success(
        "Connection verified",
        `${source.name} responded (${count} schema${count === 1 ? "" : "s"} discovered).`,
      );
    } catch (err: unknown) {
      toast.error(
        "Connection test failed",
        err instanceof Error ? err.message : `Could not reach ${source.name}.`,
      );
    } finally {
      setTestingSourceId(null);
    }
  };

  const handleTogglePause = async (source: UnifiedSource) => {
    const nextBackendStatus =
      source.status === "Paused" ? "ACTIVE" : "INACTIVE";
    setTogglingSourceId(source.id);
    try {
      const res = await apiFetch(`/api/v1/connections/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextBackendStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update connection status.");
      }
      toast.success(
        nextBackendStatus === "INACTIVE"
          ? "Connection paused"
          : "Connection resumed",
        `${source.name} is now ${nextBackendStatus === "INACTIVE" ? "paused" : "connected"}.`,
      );
      await loadConnectors(false);
    } catch (err: unknown) {
      toast.error(
        "Status update failed",
        err instanceof Error
          ? err.message
          : "Could not update connection status.",
      );
    } finally {
      setTogglingSourceId(null);
    }
  };

  const handleSaveEdit = async (newName: string) => {
    if (!editTarget || !newName.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await apiFetch(`/api/v1/connections/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update connection.");
      }
      toast.success("Connection updated", `Renamed to "${newName.trim()}".`);
      setEditTarget(null);
      await loadConnectors(false);
    } catch (err: unknown) {
      toast.error(
        "Update failed",
        err instanceof Error ? err.message : "Failed to save changes.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "connection") {
        const res = await apiFetch(`/api/v1/connections/${deleteTarget.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error("Failed to delete connection.");
        }
      } else {
        try {
          await apiFetch(`/api/v1/connections/${deleteTarget.id}`, {
            method: "DELETE",
          });
        } catch {
          // ignore if local-only
        }
        try {
          const cached = JSON.parse(
            localStorage.getItem("local_ingested_files") || "[]",
          );
          const updated = cached.filter(
            (f: IngestedFile) => f.id !== deleteTarget.id,
          );
          localStorage.setItem("local_ingested_files", JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      toast.success(
        "Source deleted",
        `"${deleteTarget.name}" has been removed.`,
      );
      setDeleteTarget(null);
      await loadConnectors(false);
    } catch (err: unknown) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Failed to delete resource.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isWizardOpen,
    setIsWizardOpen,
    initialUploadFile,
    openWizardWithFile,
    closeWizard,
    isDbModalOpen,
    setIsDbModalOpen,
    initialDbType,
    openDbModalWithType,
    previewingFile,
    setPreviewingFile,
    isRawPreviewLoading,
    cleanPreviewFile,
    setCleanPreviewFile,
    cleanData,
    isCleanDataLoading,
    cleanSearchFilter,
    setCleanSearchFilter,
    ingestedFiles,
    customConnectors,
    unifiedSources,
    deleteTarget,
    setDeleteTarget,
    editTarget,
    setEditTarget,
    isDeleting,
    isSavingEdit,
    testingSourceId,
    togglingSourceId,
    isLoading,
    isRefreshing,
    isPollingPaused,
    lastRefreshedAt,
    error,
    activeTab,
    setActiveTab,
    loadConnectors,
    handleOpenRawPreview,
    handleInspectCleanData,
    handleTestConnection,
    handleTogglePause,
    handleSaveEdit,
    executeDelete,
  };
}
