import React, { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SidebarTooltip } from "../../ui/Tooltip";
import type { NavItem } from "./sidebarConfig";
import {
  Icons,
  ICON_SIZES,
  Loader2,
  type LucideIcon,
} from "../../../lib/icons";
import { usePendingReviewCount } from "../../../features/connections/usePendingReviewCount";

interface SidebarNavListProps {
  navItems: NavItem[];
  collapsed: boolean;
  showAdminNavigation: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface SidebarNavLinkItemProps {
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

const SidebarNavLinkItem: React.FC<SidebarNavLinkItemProps> = ({
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
        className={`flex items-center p-2 rounded-lg gap-3 font-medium transition-all duration-150 border cursor-pointer relative ${
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
        <span
          className={`text-[13px] transition-opacity duration-200 whitespace-nowrap flex-1 truncate ${
            collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {label}
        </span>

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

export const SidebarNavList: React.FC<SidebarNavListProps> = ({
  navItems,
  collapsed,
  showAdminNavigation,
  setMobileOpen,
}) => {
  const routerState = useRouterState();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const { data: pendingReviewCount = 0 } = usePendingReviewCount();

  // Clear optimistic pending state once route completes
  useEffect(() => {
    if (routerState.status !== "pending" && !routerState.isLoading) {
      setPendingPath(null);
    }
  }, [routerState.status, routerState.isLoading]);

  return (
    <nav className="flex-1 py-4 px-3.5 flex flex-col gap-1 overflow-y-auto overflow-x-hidden min-h-0">
      {!collapsed && (
        <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-text-secondary select-none">
          Explore and overview
        </div>
      )}
      {navItems
        .filter((i) => i.section === "mesh")
        .map((i) => (
          <SidebarNavLinkItem
            key={i.to}
            to={i.to}
            label={i.label}
            icon={i.icon}
            collapsed={collapsed}
            exact={i.to === "/"}
            onNavigate={() => setMobileOpen(false)}
            pendingPath={pendingPath}
            setPendingPath={setPendingPath}
          />
        ))}

      {!collapsed && (
        <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-text-secondary select-none">
          Data integration
        </div>
      )}
      {navItems
        .filter((i) => i.section === "pipelines")
        .map((i) => (
          <SidebarNavLinkItem
            key={i.to}
            to={i.to}
            label={i.label}
            icon={i.icon}
            collapsed={collapsed}
            exact={i.to === "/connections"}
            onNavigate={() => setMobileOpen(false)}
            pendingPath={pendingPath}
            setPendingPath={setPendingPath}
            badgeCount={
              i.badgeKey === "fusionReview" ? pendingReviewCount : undefined
            }
          />
        ))}

      {!collapsed && (
        <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-text-secondary select-none">
          Configuration
        </div>
      )}
      {navItems
        .filter((i) => i.section === "system")
        .map((i) => (
          <SidebarNavLinkItem
            key={i.to}
            to={i.to}
            label={i.label}
            icon={i.icon}
            collapsed={collapsed}
            exact={i.to === "/ontology"}
            onNavigate={() => setMobileOpen(false)}
            pendingPath={pendingPath}
            setPendingPath={setPendingPath}
          />
        ))}

      {showAdminNavigation && (
        <>
          <SidebarNavLinkItem
            to="/admin/users"
            label="Users & Roles"
            icon={Icons.Users}
            collapsed={collapsed}
            onNavigate={() => setMobileOpen(false)}
            pendingPath={pendingPath}
            setPendingPath={setPendingPath}
          />

          <SidebarNavLinkItem
            to="/admin/tenants"
            label="Tenants"
            icon={Icons.Tenants}
            collapsed={collapsed}
            onNavigate={() => setMobileOpen(false)}
            pendingPath={pendingPath}
            setPendingPath={setPendingPath}
          />
        </>
      )}
    </nav>
  );
};
