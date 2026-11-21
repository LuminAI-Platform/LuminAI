import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SidebarTooltip } from "../../ui/Tooltip";
import { ICON_SIZES, Loader2, type LucideIcon } from "../../../lib/icons";

export interface SidebarNavLinkItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  exact?: boolean;
  onNavigate: () => void;
  pendingPath: string | null;
  setPendingPath: (path: string | null) => void;
  badgeCount?: number;
}

export const SidebarNavLinkItem: React.FC<SidebarNavLinkItemProps> = ({
  to,
  label,
  icon: Icon,
  collapsed,
  exact = false,
  onNavigate,
  pendingPath,
  setPendingPath,
  badgeCount,
}) => {
  const routerState = useRouterState();
  const isRouterBusy =
    routerState.status === "pending" || routerState.isLoading;
  const isItemPending = pendingPath === to && isRouterBusy;

  const formattedBadge =
    badgeCount !== undefined && badgeCount > 0
      ? badgeCount > 99
        ? "99+"
        : String(badgeCount)
      : null;

  const tooltipLabel = formattedBadge
    ? `${label} (${formattedBadge} pending review)`
    : label;

  return (
    <SidebarTooltip label={tooltipLabel} enabled={collapsed}>
      <Link
        to={to}
        preload="intent"
        activeOptions={{ exact }}
        aria-label={tooltipLabel}
        className={`flex items-center rounded-lg font-medium transition-all duration-150 border cursor-pointer relative ${
          collapsed ? "justify-center w-10 h-10 mx-auto p-0 gap-0" : "p-2 gap-3"
        } ${
          isItemPending
            ? "bg-primary-tint! text-primary! font-semibold! border-primary-border! border!"
            : "text-text-secondary hover:bg-surface-subtle hover:text-text border-transparent hover:border-border"
        }`}
        activeProps={{
          className:
            "bg-primary-tint! text-primary! font-semibold! border-primary-border! border!",
        }}
        onClick={() => {
          setPendingPath(to);
          onNavigate();
        }}
      >
        <span className="shrink-0 relative flex items-center justify-center">
          <Icon size={ICON_SIZES.sidebar} aria-hidden="true" />
          {collapsed && formattedBadge && (
            <span
              className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 px-0.5 rounded-full bg-primary text-[8px] font-bold text-primary-text flex items-center justify-center border border-surface leading-none shadow-xs"
              aria-hidden="true"
            >
              {formattedBadge}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="text-[13px] whitespace-nowrap flex-1 truncate">
            {label}
          </span>
        )}

        {/* Pending Review Badge (Expanded) */}
        {!collapsed && formattedBadge && (
          <span
            className="ml-auto inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-primary-tint text-primary border border-primary-border shrink-0"
            aria-label={`${formattedBadge} records pending review`}
          >
            {formattedBadge}
          </span>
        )}

        {/* Optimistic loading indicator */}
        {isItemPending && !collapsed && (
          <span
            className="ml-auto flex items-center shrink-0 text-primary"
            aria-label="Loading..."
          >
            <Loader2
              size={ICON_SIZES.inline}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          </span>
        )}
      </Link>
    </SidebarTooltip>
  );
};
