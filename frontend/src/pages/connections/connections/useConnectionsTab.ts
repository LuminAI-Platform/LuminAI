import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ConnectionsTab } from "./connectionsTypes";
import {
  CONNECTIONS_TAB_STORAGE_KEY,
  isValidConnectionsTab,
  resolveNonEmptyTab,
} from "./connectionsHelpers";

export function getInitialTab(): ConnectionsTab {
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

export function syncTabToUrlAndStorage(tab: ConnectionsTab) {
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

export function useConnectionsTab() {
  const [activeTab, setActiveTabState] =
    useState<ConnectionsTab>(getInitialTab);
  const hasAutoAdjustedTabRef = useRef(false);

  const setActiveTab = useCallback((tab: ConnectionsTab) => {
    setActiveTabState(tab);
    syncTabToUrlAndStorage(tab);
  }, []);

  useEffect(() => {
    syncTabToUrlAndStorage(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adjustTabIfEmpty = useCallback(
    (counts: { connectors: number; files: number }) => {
      if (!hasAutoAdjustedTabRef.current) {
        hasAutoAdjustedTabRef.current = true;
        setActiveTabState((prev) => {
          const next = resolveNonEmptyTab(prev, counts);
          if (next !== prev) {
            syncTabToUrlAndStorage(next);
          }
          return next;
        });
      }
    },
    [],
  );

  return useMemo(
    () => ({ activeTab, setActiveTab, adjustTabIfEmpty }),
    [activeTab, setActiveTab, adjustTabIfEmpty],
  );
}
