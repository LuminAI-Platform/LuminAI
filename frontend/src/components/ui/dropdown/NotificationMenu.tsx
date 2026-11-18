import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Tooltip } from "../Tooltip";
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ICON_SIZES,
} from "../../../lib/icons";
import {
  useNotificationStore,
  formatRelativeTime,
  type NotificationType,
  type NotificationItem,
} from "../../../stores/notificationStore";

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  error: (
    <AlertCircle
      className="w-3.5 h-3.5 text-error shrink-0"
      aria-hidden="true"
    />
  ),
  warning: (
    <AlertTriangle
      className="w-3.5 h-3.5 text-warning shrink-0"
      aria-hidden="true"
    />
  ),
  success: (
    <CheckCircle2
      className="w-3.5 h-3.5 text-success shrink-0"
      aria-hidden="true"
    />
  ),
  info: (
    <Info className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
  ),
};

export interface NotificationMenuProps {
  defaultOpen?: boolean;
  portalled?: boolean;
  notifications?: NotificationItem[];
  unreadCount?: number;
}

export const NotificationMenu: React.FC<NotificationMenuProps> = ({
  defaultOpen,
  portalled = true,
  notifications: propNotifications,
  unreadCount: propUnreadCount,
}) => {
  const storeNotifications = useNotificationStore((s) => s.notifications);
  const storeUnreadCount = useNotificationStore((s) => s.unreadCount);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const notifications = propNotifications ?? storeNotifications;
  const unreadCount = propUnreadCount ?? storeUnreadCount;

  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(() => {
      fetchNotifications();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const handleItemClick = (id: string, link?: string) => {
    markAsRead(id);
    if (link) {
      try {
        navigate({ to: link as "/" });
      } catch {
        if (typeof window !== "undefined") {
          window.location.assign(link);
        }
      }
    }
  };

  return (
    <DropdownMenuRoot defaultOpen={defaultOpen}>
      <Tooltip
        label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        side="bottom"
      >
        <DropdownMenuTrigger asChild aria-label="Notifications">
          <button
            type="button"
            aria-label="Notifications"
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors relative cursor-pointer h-9 w-9 border border-transparent hover:border-border"
          >
            <Bell size={ICON_SIZES.header} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[15px] h-3.5 px-1 bg-primary text-primary-text text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent
        align="end"
        side="bottom"
        portalled={portalled}
        className="w-80 sm:w-96 p-2"
      >
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            Notifications & Alerts
          </span>
          {unreadCount > 0 ? (
            <span className="text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded bg-primary-tint">
              {unreadCount} unread
            </span>
          ) : (
            <span className="text-[10px] text-text-muted">All caught up</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-0.5">
          {isLoading && notifications.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-text-muted gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
              <span className="text-xs">Loading alerts...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center text-text-muted gap-1">
              <Bell className="w-5 h-5 opacity-30 mb-1" />
              <p className="text-xs font-medium text-text-secondary">
                No notifications or alerts
              </p>
              <p className="text-[10px]">
                Platform events and system alerts will appear here
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(item.id, item.link)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleItemClick(item.id, item.link);
                  }
                }}
                className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 transition-colors text-left cursor-pointer ${
                  item.read
                    ? "bg-surface border-border/40 hover:bg-surface-subtle/60 opacity-80"
                    : "bg-surface-subtle border-border hover:bg-surface-hover shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {TYPE_ICONS[item.type] || TYPE_ICONS.info}
                    <span
                      className={`truncate font-medium text-text ${
                        !item.read ? "font-semibold" : ""
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-text-muted">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                    {!item.read && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                        title="Unread"
                      />
                    )}
                  </div>
                </div>
                {item.message && (
                  <p className="text-[11px] text-text-secondary leading-snug line-clamp-2 pl-5">
                    {item.message}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between pt-1 px-1">
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={() => markAllAsRead()}
            className={`text-[11px] font-medium flex items-center gap-1 transition-colors ${
              unreadCount > 0
                ? "text-text-secondary hover:text-text cursor-pointer"
                : "text-text-muted/50 cursor-not-allowed"
            }`}
          >
            <CheckCheck size={ICON_SIZES.inline} aria-hidden="true" /> Mark all
            read
          </button>
          <button
            type="button"
            disabled={notifications.length === 0}
            onClick={() => clearAll()}
            className={`text-[11px] font-medium flex items-center gap-1 transition-colors ${
              notifications.length > 0
                ? "text-text-muted hover:text-error cursor-pointer"
                : "text-text-muted/50 cursor-not-allowed"
            }`}
          >
            <Trash2 size={ICON_SIZES.inline} aria-hidden="true" /> Clear all
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
