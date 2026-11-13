import React from "react";
import { Link } from "@tanstack/react-router";
import { isPlatformAdmin, useAuthStore } from "../../stores/authStore";
import { SidebarTooltip, Tooltip, TooltipProvider } from "../ui/Tooltip";
import luminaiMark from "../../assets/luminai-mark.svg";
import { NAV_ITEMS } from "./sidebar/sidebarConfig";
import { SidebarNavList } from "./sidebar/SidebarNavList";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { user } = useAuthStore();
  const showAdminNavigation = isPlatformAdmin(user);

  return (
    <TooltipProvider>
      {/* Sidebar mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar container */}
      <aside
        className={`fixed md:relative top-0 bottom-0 z-50 flex flex-col h-full bg-surface border-r border-border transition-all duration-200 ease-in-out select-none ${
          collapsed ? "w-16" : "w-64"
        } ${mobileOpen ? "left-0" : "-left-full md:left-0"}`}
      >
        {/* Header Section with Manual Toggle */}
        <div
          className={`h-16 flex items-center border-b border-border gap-3 overflow-hidden shrink-0 ${
            collapsed ? "justify-center px-0" : "justify-between px-4"
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <Tooltip label="Toggle sidebar navigation" side="right">
              <button
                onClick={() => {
                  const next = !collapsed;
                  setCollapsed(next);
                  localStorage.setItem(
                    "luminai_sidebar_collapsed",
                    String(next),
                  );
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105"
              >
                <img
                  src={luminaiMark}
                  alt="LuminAI"
                  className="w-7 h-7 object-contain select-none"
                  draggable={false}
                />
              </button>
            </Tooltip>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold text-text tracking-tight leading-none">
                  LuminAI
                </span>
                <span className="text-[11px] font-medium text-text-secondary mt-0.5">
                  Data platform
                </span>
              </div>
            )}
          </div>
          {!collapsed && (
            <Tooltip label="Collapse sidebar" side="right">
              <button
                onClick={() => {
                  setCollapsed(true);
                  localStorage.setItem("luminai_sidebar_collapsed", "true");
                }}
                className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-subtle rounded-md transition-colors cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </Tooltip>
          )}
        </div>

        {/* Navigation list */}
        <SidebarNavList
          navItems={NAV_ITEMS}
          collapsed={collapsed}
          showAdminNavigation={showAdminNavigation}
          setMobileOpen={setMobileOpen}
        />

        {/* Footer section */}
        <div className="p-3 border-t border-border flex flex-col gap-1 shrink-0">
          {/* Settings */}
          <SidebarTooltip label="Settings" enabled={collapsed}>
            <Link
              to="/settings"
              className="flex items-center p-2.5 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg gap-3 font-medium transition-all duration-150 border border-transparent"
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
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span
                className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${
                  collapsed
                    ? "opacity-0 w-0 pointer-events-none"
                    : "opacity-100"
                }`}
              >
                Settings
              </span>
            </Link>
          </SidebarTooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
};
