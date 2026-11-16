import React from "react";
import { Link } from "@tanstack/react-router";
import { Sun, Moon, Plus, Bell, Clock, Search, LogOut } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import { Tooltip } from "../ui/Tooltip";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

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
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 md:px-8 z-30 transition-colors">
      {/* Mobile Menu Toggle Button */}
      <button
        type="button"
        className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors md:hidden cursor-pointer"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Search Bar Container */}
      <div className="flex items-center bg-surface-subtle border border-border rounded-lg px-3 py-1.5 w-48 sm:w-64 md:w-96 gap-2 transition-colors focus-within:border-border-focus">
        <Search className="w-4 h-4 text-text-secondary shrink-0" />
        <input
          type="text"
          className="bg-transparent border-none outline-none text-text placeholder:text-text-secondary text-xs w-full"
          placeholder="Search entities, connections, or pipelines..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Switcher Toggle (Light theme default / Dark theme user option) */}
        <Tooltip
          label={
            theme === "light" ? "Switch to dark theme" : "Switch to light theme"
          }
          side="bottom"
        >
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-border"
            aria-label={
              theme === "light"
                ? "Switch to dark theme"
                : "Switch to light theme"
            }
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-warning" />
            )}
          </button>
        </Tooltip>

        {/* Notification Icon (No neon glows) */}
        <Tooltip label="Notifications" side="bottom">
          <button
            type="button"
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-text-secondary rounded-full" />
          </button>
        </Tooltip>

        {/* History/Clock Icon */}
        <Tooltip label="History" side="bottom">
          <button
            type="button"
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            aria-label="History"
          >
            <Clock className="w-4 h-4" />
          </button>
        </Tooltip>

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {/* New Connection Action - Navy is the only filled button color */}
        <Link
          to="/connections"
          className="bg-primary hover:bg-primary-hover text-primary-text font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer border border-primary shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Connection</span>
        </Link>

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {/* User Identity Context */}
        {user && (
          <div className="flex items-center gap-2.5 group relative">
            {/* Avatar with initials */}
            <div
              className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-text text-[11px] font-bold shrink-0 select-none"
              aria-label={`Logged in as ${displayName}`}
            >
              {initials}
            </div>

            {/* Name + email */}
            <div className="hidden lg:flex flex-col leading-tight">
              <span className="text-xs font-semibold text-text truncate max-w-[120px]">
                {displayName}
              </span>
              {displayEmail && (
                <span className="text-[10px] text-text-secondary truncate max-w-[120px]">
                  {displayEmail}
                </span>
              )}
            </div>

            {/* Logout button */}
            <Tooltip label="Sign out" side="bottom">
              <button
                id="topbar-logout-btn"
                type="button"
                onClick={logout}
                className="p-1.5 text-text-secondary hover:text-error hover:bg-error-bg rounded-md transition-colors cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </header>
  );
};
