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
      className="flex items-center p-2! text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 rounded-lg gap-3 font-medium transition-all duration-150 border border-transparent hover:border-zinc-850 cursor-pointer"
      activeProps={{
        className:
          "bg-blue-600/10! text-blue-500! font-semibold! border-blue-500/20! border!",
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
        <div className="px-2 pt-1 pb-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
          Explore & Overview
        </div>
      )}
      {navItems
        .filter((i) => i.section === "mesh")
        .map((i) => renderNavLink(i, collapsed, setMobileOpen))}

      {!collapsed && (
        <div className="px-2 pt-4 pb-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
          Data Integration
        </div>
      )}
      {navItems
        .filter((i) => i.section === "pipelines")
        .map((i) => renderNavLink(i, collapsed, setMobileOpen))}

      {!collapsed && (
        <div className="px-2 pt-4 pb-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
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
              className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 font-medium text-zinc-400 transition-all duration-150 hover:border-zinc-850 hover:bg-zinc-800/50 hover:text-zinc-100"
              activeProps={{
                className:
                  "bg-blue-600/10! text-blue-500! font-semibold! border-blue-500/20! border!",
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
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              <span
                className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${
                  collapsed
                    ? "opacity-0 w-0 pointer-events-none"
                    : "opacity-100"
                }`}
              >
                User registration
              </span>
            </Link>
          </SidebarTooltip>

          <SidebarTooltip label="Tenant registration" enabled={collapsed}>
            <Link
              to="/admin/tenants"
              className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 font-medium text-zinc-400 transition-all duration-150 hover:border-zinc-850 hover:bg-zinc-800/50 hover:text-zinc-100"
              activeProps={{
                className:
                  "bg-blue-600/10! text-blue-500! font-semibold! border-blue-500/20! border!",
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
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
              </svg>
              <span
                className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${
                  collapsed
                    ? "opacity-0 w-0 pointer-events-none"
                    : "opacity-100"
                }`}
              >
                Tenant registration
              </span>
            </Link>
          </SidebarTooltip>
        </>
      )}
    </nav>
  );
};
