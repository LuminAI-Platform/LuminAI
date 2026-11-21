export type NotificationType = "error" | "warning" | "success" | "info";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO 8601 string
  read: boolean;
  link?: string;
}

export interface BackendActivity {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  timestamp?: string;
  status?: string;
}

export const STORAGE_READ_KEY = "luminai_read_notification_ids";
export const STORAGE_CLEARED_KEY = "luminai_cleared_notification_ids";
export const STORAGE_LOCAL_ALERTS_KEY = "luminai_local_alerts";

export function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / 1000,
    );
    if (isNaN(diff) || diff < 0) return "just now";
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "just now";
  }
}

export function getStoredSet(key: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveStoredSet(key: string, set: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    // Keep max 200 IDs to avoid unbounded storage growth
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function getStoredLocalAlerts(): NotificationItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredLocalAlerts(alerts: NotificationItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const recent = alerts.slice(0, 30);
    localStorage.setItem(STORAGE_LOCAL_ALERTS_KEY, JSON.stringify(recent));
  } catch {
    // ignore
  }
}

export function mapActivityToNotification(
  act: BackendActivity,
  readIds: Set<string>,
): NotificationItem {
  let type: NotificationType = "info";
  const st = (act.status || "").toUpperCase();
  if (st === "FAILED" || st === "ERROR") {
    type = "error";
  } else if (st === "RUNNING") {
    type = "warning";
  } else if (st === "SUCCESS" || st === "COMPLETED") {
    type = "success";
  }

  let link = "/connections/pipelines";
  const actType = (act.type || "").toUpperCase();
  if (actType === "CONNECTION_CREATE") {
    link = "/connections";
  } else if (actType === "ENTITY_SYNC") {
    link = "/explorer";
  } else if (actType === "ONTOLOGY_UPDATE") {
    link = "/ontology";
  }

  const id = act.id || `act-${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    type,
    title: act.title || "Platform Event",
    message: act.description || "Activity recorded.",
    timestamp: act.timestamp || new Date().toISOString(),
    read: readIds.has(id),
    link,
  };
}
