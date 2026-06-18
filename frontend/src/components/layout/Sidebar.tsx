import React from "react";
import { Link } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const navItems = [
  {
    label: "Dashboard",
    to: "/",
    icon: (
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
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    label: "Explorer",
    to: "/explorer",
    icon: (
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
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    label: "Connections",
    to: "/connections",
    icon: (
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
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    label: "Ontology",
    to: "/ontology",
    icon: (
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
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: "Graph",
    to: "/graph",
    icon: (
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
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { logout } = useAuthStore();

  return (
    <>
      {/* Sidebar mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 ${mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar container */}
      <aside
        onMouseLeave={() => setCollapsed(true)}
        className={`fixed md:relative top-0 bottom-0 z-50 flex flex-col h-full bg-zinc-900 border-r border-zinc-800/80 transition-all duration-300 ease-in-out select-none ${collapsed ? "w-16" : "w-64"
          } ${mobileOpen ? "left-0" : "-left-full md:left-0"}`}
      >
        {/* Header Section */}
        <div
          className={`h-16 flex items-center border-b border-zinc-800/80 gap-3 overflow-hidden shrink-0 ${collapsed ? "justify-center px-0" : "px-5"
            }`}
        >
          <div
            onMouseEnter={() => setCollapsed(false)}
            className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center shrink-0 font-bold shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div
            className={`flex flex-col overflow-hidden transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
              }`}
          >
            <span className="text-[15px] font-semibold text-zinc-100 tracking-tight leading-none">
              LuminAI
            </span>
            <span className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase mt-0.5">
              Enterprise OS
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-hidden">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center p-2.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 rounded-lg gap-3 font-medium transition-all duration-150 border border-transparent hover:border-zinc-850 cursor-pointer"
              activeProps={{
                className:
                  "bg-blue-600/10! text-blue-500! font-semibold! border-blue-500/20! border!",
              }}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              <span
                className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${collapsed
                    ? "opacity-0 w-0 pointer-events-none"
                    : "opacity-100"
                  }`}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Footer section */}
        <div className="p-3 border-t border-zinc-800/80 flex flex-col gap-1 shrink-0">
          {/* Settings */}
          <Link
            to="/settings"
            className="flex items-center p-2.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 rounded-lg gap-3 font-medium transition-all duration-150 border border-transparent"
            activeProps={{
              className:
                "bg-blue-600/10! text-blue-500! font-semibold! border-blue-500/20! border!",
            }}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "Setting" : undefined}
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
              className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
                }`}
            >
              Setting
            </span>
          </Link>

          {/* Support */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-2.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 rounded-lg gap-3 font-medium transition-all duration-150 border border-transparent"
            title={collapsed ? "Support" : undefined}
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
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span
              className={`text-[13px] transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
                }`}
            >
              Support
            </span>
          </a>

          {/* User profile card */}
          {collapsed ? (
            /* Collapsed: render exactly like other footer items — bare SVG, p-2.5, no avatar wrapper */
            <div
              className="group flex items-center p-2.5 text-zinc-400 hover:bg-red-950/30 hover:border-red-500/30 hover:text-red-400 bg-zinc-850/60 border border-zinc-800/80 rounded-xl mt-2 cursor-pointer transition-all"
              onClick={() => logout()}
              title="Sign Out (Admin User)"
            >
              <svg
                className="shrink-0 transition-colors group-hover:text-red-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          ) : (
            /* Expanded: full card with avatar, user info, and logout button */
            <div className="group flex items-center gap-3 p-2 bg-zinc-850/60 border border-zinc-800/80 rounded-xl mt-2 transition-all">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0 overflow-hidden">
                <svg
                  className="text-zinc-400"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="flex flex-col overflow-hidden flex-1">
                <span className="text-[12px] font-semibold text-zinc-200 truncate leading-tight">
                  Admin User
                </span>
                <span className="text-[10px] text-zinc-500 truncate leading-none mt-0.5">
                  Global Tenant
                </span>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-850 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Sign Out"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
