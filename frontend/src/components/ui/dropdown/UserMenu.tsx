import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Settings, LogOut } from "lucide-react";
import { useAuthStore } from "../../../stores/authStore";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuHeader,
  DropdownMenuSeparator,
} from "./DropdownMenu";

export interface UserMenuProps {
  className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({ className = "" }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  // Derive display values from the OIDC id_token profile claims
  const displayName =
    user?.profile?.name ||
    user?.profile?.preferred_username ||
    user?.profile?.email ||
    "User";

  const displayEmail = user?.profile?.email ?? "";

  // Generate initials for the avatar (up to 2 characters)
  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        showChevron
        aria-label={`User menu for ${displayName}`}
        className={`h-9 p-1 rounded-lg hover:bg-surface-subtle border border-transparent hover:border-border transition-colors cursor-pointer text-left select-none ${className}`}
      >
        <span className="flex items-center gap-2">
          {/* Avatar with initials */}
          <span className="w-7 h-7 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-text text-[11px] font-bold shrink-0">
            {initials}
          </span>

          {/* Name only */}
          <span className="hidden lg:inline-block text-xs font-semibold text-text max-w-[130px] truncate">
            {displayName}
          </span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" className="w-72">
        {/* User menu header: avatar, name, email (truncated with title attribute) */}
        <DropdownMenuHeader
          avatar={initials}
          name={displayName}
          email={displayEmail}
        />

        <DropdownMenuSeparator />

        {/* Workspace Settings */}
        <DropdownMenuItem
          icon={<Settings className="w-4 h-4 text-text-secondary" />}
          onClick={() => navigate({ to: "/settings" })}
        >
          Workspace Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Destructive Sign out row behind divider */}
        <DropdownMenuItem
          destructive
          icon={<LogOut className="w-4 h-4" />}
          onClick={() => logout()}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
