import type { EngineMetricsResponse } from "../../pages/dashboard/useDashboardData";

export type EngineStatusKind = "online" | "degraded" | "offline";

export function deriveEngineStatus(
  engineMetrics?: EngineMetricsResponse | null,
  hasError?: boolean,
): EngineStatusKind {
  if (hasError || !engineMetrics?.engineHealth) {
    return "offline";
  }
  const status = engineMetrics.engineHealth.status?.toUpperCase();
  if (status === "ONLINE") return "online";
  if (status === "DEGRADED") return "degraded";
  return "offline";
}

export function formatLastChecked(
  updatedAt?: number | null,
  nowMs: number = Date.now(),
): { label: string; staleMinutes: number } {
  if (!updatedAt || updatedAt <= 0) {
    return { label: "Not checked yet", staleMinutes: 0 };
  }
  const diffMs = Math.max(0, nowMs - updatedAt);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) {
    return { label: "Just now", staleMinutes: 0 };
  }
  if (diffMin < 60) {
    return { label: `${diffMin} min ago`, staleMinutes: diffMin };
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return { label: `${diffHours}h ago`, staleMinutes: diffMin };
  }
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(updatedAt));
  return { label: formatted, staleMinutes: diffMin };
}
