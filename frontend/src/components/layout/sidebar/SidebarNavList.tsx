import React, { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SidebarTooltip } from "../../ui/Tooltip";
import type { NavItem } from "./sidebarConfig";

interface SidebarNavListProps {
  navItems: NavItem[];
  collapsed: boolean;
  showAdminNavigation: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface SidebarNavLinkItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  exact?: boolean;
  onNavigate: () => void;
  pendingPath: string | null;
  setPendingPath: (path: string | null) => void;
}

const SidebarNavLinkItem: React.FC<SidebarNavLinkItemProps> = ({
  to,
  label,
  icon,
  collapsed,
  exact = false,
  onNavigate,
  pendingPath,
  setPendingPath,
}) => {
  const routerState = useRouterState();
  const isRouterBusy =
    routerState.status === "pending" || routerState.isLoading;
  const isItemPending = pendingPath === to && isRouterBusy;

  return (
    <SidebarTooltip label={label} enabled={collapsed}>
      <Link
        to={to}
        preload="intent"
        activeOptions={{ exact }}
        className={`flex items-center p-2! rounded-lg gap-3 font-medium transition-all duration-150 border cursor-pointer ${
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
        <span className="shrink-0">{icon}</span>
        <span
          className={`text-[13px] transition-opacity duration-200 whitespace-nowrap flex-1 ${
            collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {label}
        </span>

        {/* Instant optimistic loading indicator */}
        {isItemPending && !collapsed && (
          <span
            className="ml-auto flex items-center shrink-0 text-primary"
            aria-label="Loading..."
          >
            <svg
              className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
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

  // Clear optimistic pending state once route completes
  useEffect(() => {
    if (routerState.status !== "pending" && !routerState.isLoading) {
      setPendingPath(null);
    }
  }, [routerState.status, routerState.isLoading]);

  return (
    <nav className="flex-1 py-4 px-3.5 flex flex-col gap-1 overflow-y-auto overflow-x-hidden min-h-0">
      {!collapsed && (
        <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-text-secondary">
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
        <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-text-secondary">
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
          />
        ))}

      {!collapsed && (
        <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-text-secondary">
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
            icon={
              <svg
                className="shrink-0"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            collapsed={collapsed}
            onNavigate={() => setMobileOpen(false)}
            pendingPath={pendingPath}
            setPendingPath={setPendingPath}
          />

          <SidebarNavLinkItem
            to="/admin/tenants"
            label="Tenants"
            icon={
              <svg
                className="shrink-0"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 21h18" />
                <path d="M9 8h1" />
                <path d="M9 12h1" />
                <path d="M9 16h1" />
                <path d="M14 8h1" />
                <path d="M14 12h1" />
                <path d="M14 16h1" />
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
              </svg>
            }
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
