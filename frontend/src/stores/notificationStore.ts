import { create } from "zustand";
import { apiFetch } from "../lib/api";
import {
  STORAGE_CLEARED_KEY,
  STORAGE_READ_KEY,
  formatRelativeTime,
  getStoredLocalAlerts,
  getStoredSet,
  mapActivityToNotification,
  saveStoredLocalAlerts,
  saveStoredSet,
  type BackendActivity,
  type NotificationItem,
  type NotificationType,
} from "./notificationHelpers";

export { formatRelativeTime };
export type { NotificationItem, NotificationType };

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
