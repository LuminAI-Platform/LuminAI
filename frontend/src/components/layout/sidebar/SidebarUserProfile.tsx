import React from "react";
import { SidebarTooltip } from "../../ui/Tooltip";
import type { User as AuthUser } from "oidc-client-ts";

interface SidebarUserProfileProps {
  collapsed: boolean;
  user: AuthUser | null;
  logout: () => void;
}

export const SidebarUserProfile: React.FC<SidebarUserProfileProps> = ({
  collapsed,
  user,
  logout,
}) => {
  if (collapsed) {
    return (
      <SidebarTooltip
        label={`Sign out — ${user?.profile?.name || "Admin User"}`}
        enabled
      >
        <div
          className="group flex items-center p-2.5 text-zinc-400 hover:bg-red-950/30 hover:border-red-500/30 hover:text-red-400 bg-zinc-850/60 border border-zinc-800/80 rounded-lg mt-2 cursor-pointer transition-all"
          onClick={() => logout()}
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
      </SidebarTooltip>
    );
  }

  return (
    <div className="group flex items-center gap-3 p-2 bg-zinc-850/60 border border-zinc-800/80 rounded-lg mt-2 transition-all">
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
          {user?.profile?.name || "Admin User"}
        </span>
        <span className="text-[10px] text-zinc-500 truncate leading-none mt-0.5">
          {user?.profile?.email || "Global Tenant"}
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
  );
};
