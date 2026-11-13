import React from "react";
import { Link } from "@tanstack/react-router";
import { SidebarTooltip } from "../../ui/Tooltip";
import type { NavItem } from "./sidebarConfig";

interface SidebarNavListProps {
  navItems: NavItem[];
  collapsed: boolean;
  showAdminNavigation: boolean;
  setMobileOpen: (open: boolean) => void;
}

const renderNavLink = (
  item: NavItem,
  collapsed: boolean,
  setMobileOpen: (open: boolean) => void,
) => (
  <SidebarTooltip key={item.to} label={item.label} enabled={collapsed}>
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === "/connections" }}
      className="flex items-center p-2! text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg gap-3 font-medium transition-all duration-150 border border-transparent hover:border-border cursor-pointer"
      activeProps={{
        className:
          "bg-primary-tint! text-primary! font-semibold! border-primary-border! border!",
      }}
      onClick={() => setMobileOpen(false)}
    >
      {item.icon}
      <span
        className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${
          collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {item.label}
      </span>
    </Link>
  </SidebarTooltip>
);

export const SidebarNavList: React.FC<SidebarNavListProps> = ({
  navItems,
  collapsed,
  showAdminNavigation,
  setMobileOpen,
}) => {
  return (
    <nav className="flex-1 py-4 px-3.5 flex flex-col gap-1 overflow-y-auto overflow-x-hidden min-h-0">
      {!collapsed && (
        <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-text-secondary">
          Explore and overview
        </div>
      )}
      {navItems
        .filter((i) => i.section === "mesh")
        .map((i) => renderNavLink(i, collapsed, setMobileOpen))}

      {!collapsed && (
        <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-text-secondary">
          Data integration
        </div>
      )}
      {navItems
        .filter((i) => i.section === "pipelines")
        .map((i) => renderNavLink(i, collapsed, setMobileOpen))}

      {!collapsed && (
        <div className="px-2 pt-4 pb-1 text-[11px] font-medium text-text-secondary">
          Configuration
        </div>
      )}
      {navItems
        .filter((i) => i.section === "system")
        .map((i) => renderNavLink(i, collapsed, setMobileOpen))}

      {showAdminNavigation && (
        <>
          <SidebarTooltip label="User registration" enabled={collapsed}>
            <Link
              to="/admin/users"
              className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 font-medium text-text-secondary transition-all duration-150 hover:border-border hover:bg-surface-subtle hover:text-text"
              activeProps={{
                className:
                  "bg-primary-tint! text-primary! font-semibold! border-primary-border! border!",
              }}
              onClick={() => setMobileOpen(false)}
            >
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
              <span
                className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${
                  collapsed
                    ? "pointer-events-none w-0 opacity-0"
                    : "opacity-100"
                }`}
              >
                Users & Roles
              </span>
            </Link>
          </SidebarTooltip>

          <SidebarTooltip label="Tenant registration" enabled={collapsed}>
            <Link
              to="/admin/tenants"
              className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 font-medium text-text-secondary transition-all duration-150 hover:border-border hover:bg-surface-subtle hover:text-text"
              activeProps={{
                className:
                  "bg-primary-tint! text-primary! font-semibold! border-primary-border! border!",
              }}
              onClick={() => setMobileOpen(false)}
            >
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
              <span
                className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${
                  collapsed
                    ? "pointer-events-none w-0 opacity-0"
                    : "opacity-100"
                }`}
              >
                Tenants
              </span>
            </Link>
          </SidebarTooltip>
        </>
      )}
    </nav>
  );
};
