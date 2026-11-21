import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { apiFetch } from "../../../lib/api";
import type { DBType } from "../../../features/connections/components/db-connector/dbConnectorTypes";
import { useConnectionModalStore } from "../../../stores/connectionModalStore";
import type {
  IngestedFile,
  DatabaseConnector,
  ConnectionsTab,
} from "./connectionsTypes";
import {
  parseRawConnections,
  buildUnifiedSources,
  CONNECTIONS_TAB_STORAGE_KEY,
  isValidConnectionsTab,
  resolveNonEmptyTab,
} from "./connectionsHelpers";
import { useConnectionPreviews } from "./useConnectionPreviews";
import { useConnectionMutations } from "./useConnectionMutations";
import { useConnectionsPolling } from "./useConnectionsPolling";

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

function readLocalIngestedFiles(): IngestedFile[] {
  try {
    const cached = localStorage.getItem("local_ingested_files");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function mergeWithLocalFiles(fileItems: IngestedFile[]): IngestedFile[] {
  const localFiles = readLocalIngestedFiles();
  const merged = fileItems.map((f) => {
    const localMatch = localFiles.find(
      (lf) => lf.id === f.id || lf.name === f.name,
    );
    if (!localMatch) return f;
    return {
      ...f,
      columns:
        f.columns && f.columns.length > 0 ? f.columns : localMatch.columns,
      sampleRows:
        f.sampleRows && f.sampleRows.length > 0
          ? f.sampleRows
          : localMatch.sampleRows,
    };
  });

  localFiles.forEach((lf) => {
    if (!merged.some((f) => f.id === lf.id || f.name === lf.name)) {
      merged.push(lf);
    }
  });
  return merged;
}

export function useConnectionsData() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [initialUploadFile, setInitialUploadFile] = useState<File | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [initialDbType, setInitialDbType] = useState<DBType>("postgresql");
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>([]);
  const [customConnectors, setCustomConnectors] = useState<DatabaseConnector[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTabState] =
    useState<ConnectionsTab>(getInitialTab);

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
        const mergedFiles = mergeWithLocalFiles(fileItems);
        setCustomConnectors(dbItems);
        setIngestedFiles(mergedFiles);

        if (!hasAutoAdjustedTabRef.current) {
          hasAutoAdjustedTabRef.current = true;
          setActiveTabState((prev) => {
            const next = resolveNonEmptyTab(prev, {
              connectors: dbItems.length,
              files: mergedFiles.length,
            });
            if (next !== prev) syncTabToUrlAndStorage(next);
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
      setIngestedFiles(readLocalIngestedFiles());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const previews = useConnectionPreviews();
  const mutations = useConnectionMutations(loadConnectors);

  const hasOpenOverlay = Boolean(
    previews.cleanPreviewFile ||
    previews.previewingFile ||
    isWizardOpen ||
    isDbModalOpen ||
    mutations.editTarget,
  );

  const { isPollingPaused } = useConnectionsPolling({
    loadConnectors,
    hasOpenOverlay,
  });

  const unifiedSources = useMemo(
    () => buildUnifiedSources(customConnectors, ingestedFiles),
    [customConnectors, ingestedFiles],
  );

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
    ...previews,
    ingestedFiles,
    customConnectors,
    unifiedSources,
    ...mutations,
    isLoading,
    isRefreshing,
    isPollingPaused,
    lastRefreshedAt,
    error,
    activeTab,
    setActiveTab,
    loadConnectors,
  };
}
