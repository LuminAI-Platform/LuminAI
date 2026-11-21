import React, { useState, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { NavItem } from "./sidebarConfig";
import { Icons } from "../../../lib/icons";
import { usePendingReviewCount } from "../../../features/connections/usePendingReviewCount";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

interface SidebarNavListProps {
  navItems: NavItem[];
  collapsed: boolean;
  showAdminNavigation: boolean;
  setMobileOpen: (open: boolean) => void;
}

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
    <nav
      className={`sidebar-scroll flex-1 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden min-h-0 ${
        collapsed ? "px-2 items-center" : "pl-3.5 pr-3"
      }`}
    >
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
          Analytics & Intelligence
        </div>
      )}
      {navItems
        .filter((i) => i.section === "analytics")
        .map((i) => (
          <SidebarNavLinkItem
            key={i.to}
            to={i.to}
            label={i.label}
            icon={i.icon}
            collapsed={collapsed}
            exact={false}
            onNavigate={() => setMobileOpen(false)}
            pendingPath={pendingPath}
            setPendingPath={setPendingPath}
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
