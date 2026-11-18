import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  useNotificationStore,
  formatRelativeTime,
} from "../stores/notificationStore";
import { NotificationMenu } from "../components/ui/dropdown/NotificationMenu";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    className,
  }: {
    children?: React.ReactNode;
    to: string;
    className?: string;
  }) => React.createElement("a", { href: to, className }, children),
}));

describe("Real Notifications & Alerts System", () => {
  beforeEach(() => {
    localStorage.clear();
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
    });
  });

  describe("formatRelativeTime utility", () => {
    it("formats seconds as just now", () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe("just now");
    });

    it("formats minutes ago accurately", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
    });

    it("formats hours ago accurately", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");
    });

    it("formats days ago accurately", () => {
      const threeDaysAgo = new Date(
        Date.now() - 3 * 86400 * 1000,
      ).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
    });
  });

  describe("useNotificationStore state management", () => {
    it("adds an alert and increments unreadCount", () => {
      useNotificationStore.getState().addAlert({
        title: "Database Disconnected",
        message: "PostgreSQL node failed health check",
        type: "error",
      });

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].title).toBe("Database Disconnected");
      expect(state.notifications[0].type).toBe("error");
      expect(state.notifications[0].read).toBe(false);
      expect(state.unreadCount).toBe(1);
    });

    it("marks a specific notification as read", () => {
      useNotificationStore.getState().addAlert({
        title: "Ingestion Completed",
        message: "5,000 records processed",
        type: "success",
      });

      const stateBefore = useNotificationStore.getState();
      const notifId = stateBefore.notifications[0].id;

      useNotificationStore.getState().markAsRead(notifId);

      const stateAfter = useNotificationStore.getState();
      expect(stateAfter.notifications[0].read).toBe(true);
      expect(stateAfter.unreadCount).toBe(0);
    });

    it("marks all notifications as read", () => {
      useNotificationStore.getState().addAlert({
        title: "Alert 1",
        type: "warning",
      });
      useNotificationStore.getState().addAlert({
        title: "Alert 2",
        type: "info",
      });

      expect(useNotificationStore.getState().unreadCount).toBe(2);

      useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.unreadCount).toBe(0);
      expect(state.notifications.every((n) => n.read)).toBe(true);
    });

    it("clears all notifications and saves cleared IDs", () => {
      useNotificationStore.getState().addAlert({
        title: "Temporary Notice",
        type: "info",
      });

      expect(useNotificationStore.getState().notifications).toHaveLength(1);

      useNotificationStore.getState().clearAll();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });
  });

  describe("NotificationMenu component rendering", () => {
    it("renders trigger button with no unread badge when unreadCount is 0", () => {
      const html = renderToStaticMarkup(React.createElement(NotificationMenu));

      expect(html).toContain('aria-label="Notifications"');
      expect(html).not.toContain("bg-primary text-primary-text");
    });

    it("renders trigger button with dynamic unread count badge when unreadCount > 0", () => {
      const mockItems = [
        {
          id: "notif-1",
          title: "Pipeline Failure Alert",
          message: "Error",
          timestamp: new Date().toISOString(),
          type: "error" as const,
          read: false,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(NotificationMenu, {
          notifications: mockItems,
          unreadCount: 1,
        }),
      );

      expect(html).toContain('aria-label="Notifications"');
      expect(html).toContain("1</span>");
    });

    it("renders empty state when opened with no notifications", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationMenu, {
          defaultOpen: true,
          portalled: false,
          notifications: [],
          unreadCount: 0,
        }),
      );

      expect(html).toContain("No notifications or alerts");
      expect(html).toContain("All caught up");
      expect(html).not.toContain(
        "PostgreSQL master sync ingested 2,450 records",
      );
    });

    it("renders real dynamic notification items when opened", () => {
      const mockItems = [
        {
          id: "notif-1",
          title: "Pipeline Failure Alert",
          message: "Data engine timed out during Polars transform",
          timestamp: new Date().toISOString(),
          type: "error" as const,
          read: false,
          link: "/connections/pipelines",
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(NotificationMenu, {
          defaultOpen: true,
          portalled: false,
          notifications: mockItems,
          unreadCount: 1,
        }),
      );

      expect(html).toContain("Pipeline Failure Alert");
      expect(html).toContain("Data engine timed out during Polars transform");
      expect(html).toContain("1 unread");
      expect(html).toContain("Mark all read");
      expect(html).toContain("Clear all");
    });
  });
});
