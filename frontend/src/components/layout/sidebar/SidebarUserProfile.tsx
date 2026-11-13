import React from "react";
import { SidebarTooltip } from "../../ui/Tooltip";
import type { User as AuthUser } from "oidc-client-ts";
import { User, LogOut } from "lucide-react";

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
        <button
          type="button"
          className="group flex items-center justify-center p-2.5 text-text-secondary hover:bg-error-bg hover:border-error/40 hover:text-error bg-surface-subtle border border-border rounded-lg mt-2 cursor-pointer transition-colors w-full"
          onClick={() => logout()}
        >
          <User className="w-4 h-4 shrink-0 transition-colors group-hover:text-error" />
        </button>
      </SidebarTooltip>
    );
  }

  return (
    <div className="group flex items-center gap-3 p-2 bg-surface-subtle border border-border rounded-lg mt-2 transition-colors">
      <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 overflow-hidden text-text-secondary">
        <User className="w-4 h-4" />
      </div>
      <div className="flex flex-col overflow-hidden flex-1">
        <span className="text-[12px] font-semibold text-text truncate leading-tight">
          {user?.profile?.name || "Admin User"}
        </span>
        <span className="text-[10px] text-text-secondary truncate leading-none mt-0.5">
          {user?.profile?.email || "Global Tenant"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => logout()}
        className="p-1.5 text-text-secondary hover:text-error hover:bg-error-bg rounded-lg transition-colors cursor-pointer shrink-0"
        title="Sign Out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};
