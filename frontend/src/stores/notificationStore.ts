import { create } from "zustand";
import { apiFetch } from "../lib/api";

export type NotificationType = "error" | "warning" | "success" | "info";

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

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO 8601 string
  read: boolean;
  link?: string;
}

interface BackendActivity {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  timestamp?: string;
  status?: string;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  addAlert: (alert: {
    title: string;
    message?: string;
    type?: NotificationType;
    link?: string;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const STORAGE_READ_KEY = "luminai_read_notification_ids";
const STORAGE_CLEARED_KEY = "luminai_cleared_notification_ids";
const STORAGE_LOCAL_ALERTS_KEY = "luminai_local_alerts";

function getStoredSet(key: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredSet(key: string, set: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    // Keep max 200 IDs to avoid unbounded storage growth
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function getStoredLocalAlerts(): NotificationItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLocalAlerts(alerts: NotificationItem[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const recent = alerts.slice(0, 30);
    localStorage.setItem(STORAGE_LOCAL_ALERTS_KEY, JSON.stringify(recent));
  } catch {
    // ignore
  }
}

function mapActivityToNotification(
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

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const readIds = getStoredSet(STORAGE_READ_KEY);
      const clearedIds = getStoredSet(STORAGE_CLEARED_KEY);
      const localAlerts = getStoredLocalAlerts();

      let backendItems: NotificationItem[] = [];
      try {
        const res = await apiFetch("/api/v1/dashboard/activity?limit=25", {
          headers: { "X-Suppress-Toast": "true" },
        });
        if (res.ok) {
          const activities = (await res.json()) as BackendActivity[];
          if (Array.isArray(activities)) {
            backendItems = activities.map((a) =>
              mapActivityToNotification(a, readIds),
            );
          }
        }
      } catch (err) {
        console.debug("[Notifications] Backend activity fetch standby:", err);
      }

      // Merge backend items and local alerts, filtering out cleared IDs
      const combined = [...localAlerts, ...backendItems].filter(
        (item) => !clearedIds.has(item.id),
      );

      // Deduplicate by ID
      const seen = new Set<string>();
      const deduped: NotificationItem[] = [];
      for (const item of combined) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          deduped.push({
            ...item,
            read: readIds.has(item.id) || item.read,
          });
        }
      }

      // Sort newest first
      deduped.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      const unreadCount = deduped.filter((n) => !n.read).length;
      set({ notifications: deduped, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addAlert: (alert) => {
    const readIds = getStoredSet(STORAGE_READ_KEY);
    const clearedIds = getStoredSet(STORAGE_CLEARED_KEY);
    const id = `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newItem: NotificationItem = {
      id,
      type: alert.type || "warning",
      title: alert.title,
      message: alert.message || "",
      timestamp: new Date().toISOString(),
      read: false,
      link: alert.link,
    };

    // Save to local storage
    const currentLocal = getStoredLocalAlerts().filter(
      (a) => !clearedIds.has(a.id),
    );
    saveStoredLocalAlerts([newItem, ...currentLocal]);

    set((state) => {
      const updated = [newItem, ...state.notifications].filter(
        (i) => !clearedIds.has(i.id),
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read && !readIds.has(n.id))
          .length,
      };
    });
  },

  markAsRead: (id: string) => {
    const readIds = getStoredSet(STORAGE_READ_KEY);
    readIds.add(id);
    saveStoredSet(STORAGE_READ_KEY, readIds);

    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },

  markAllAsRead: () => {
    const readIds = getStoredSet(STORAGE_READ_KEY);
    const { notifications } = get();
    for (const n of notifications) {
      readIds.add(n.id);
    }
    saveStoredSet(STORAGE_READ_KEY, readIds);

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    const clearedIds = getStoredSet(STORAGE_CLEARED_KEY);
    const { notifications } = get();
    for (const n of notifications) {
      clearedIds.add(n.id);
    }
    saveStoredSet(STORAGE_CLEARED_KEY, clearedIds);
    saveStoredLocalAlerts([]);

    set({ notifications: [], unreadCount: 0 });
  },
}));

// Listen to globally dispatched toast events and automatically register alerts
if (typeof window !== "undefined") {
  window.addEventListener("luminai:toast", (event: Event) => {
    const customEvent = event as CustomEvent<{
      type: NotificationType;
      title: string;
      description?: string;
    }>;
    if (customEvent.detail && customEvent.detail.title) {
      useNotificationStore.getState().addAlert({
        title: customEvent.detail.title,
        message: customEvent.detail.description,
        type: customEvent.detail.type || "info",
      });
    }
  });
}
