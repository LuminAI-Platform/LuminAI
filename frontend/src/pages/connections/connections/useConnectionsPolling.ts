import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deriveEngineStatus } from "../../../components/layout/engineStatusUtils";
import type { EngineMetricsResponse } from "../../dashboard/useDashboardData";

interface UseConnectionsPollingOptions {
  loadConnectors: (isInitial?: boolean) => Promise<void>;
  hasOpenOverlay: boolean;
}

export function useConnectionsPolling({
  loadConnectors,
  hasOpenOverlay,
}: UseConnectionsPollingOptions) {
  const queryClient = useQueryClient();
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

  // Track browser visibility and online/offline state
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsTabHidden(hidden);
      if (!hidden && !isEngineOffline() && !hasOpenOverlay) {
        loadConnectors(false);
      }
    };

    const handleFocus = () => {
      if (!document.hidden && !isEngineOffline() && !hasOpenOverlay) {
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
  }, [loadConnectors, isEngineOffline, hasOpenOverlay]);

  // Initial load
  useEffect(() => {
    loadConnectors(true);
  }, [loadConnectors]);

  // 15s polling (paused when hidden, offline, or modal open)
  useEffect(() => {
    if (isPollingPaused) return;
    const interval = setInterval(() => {
      if (!document.hidden && !isEngineOffline() && !hasOpenOverlay) {
        loadConnectors(false);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isPollingPaused, isEngineOffline, loadConnectors, hasOpenOverlay]);

  return { isPollingPaused };
}
