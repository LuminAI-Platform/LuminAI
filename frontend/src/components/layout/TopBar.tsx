import React, { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sun,
  Moon,
  Monitor,
  Plus,
  Bell,
  Clock,
  Search,
  LogOut,
  ChevronDown,
  Settings,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import { Tooltip } from "../ui/Tooltip";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();
  const { theme, resolvedTheme, toggleTheme } = useThemeStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click or Escape
  useEffect(() => {
    if (!isProfileOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileOpen]);

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
        {/* Theme Switcher Toggle (System / Light / Dark) */}
        <Tooltip
          label={
            theme === "system"
              ? `Theme: System (${resolvedTheme === "dark" ? "Dark" : "Light"}) — Click for Light`
              : theme === "light"
              ? "Theme: Light — Click for Dark"
              : "Theme: Dark — Click for System"
          }
          side="bottom"
        >
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-border"
            aria-label={
              theme === "system"
                ? `System theme (${resolvedTheme}). Switch to light theme`
                : theme === "light"
                ? "Light theme. Switch to dark theme"
                : "Dark theme. Switch to system theme"
            }
          >
            {theme === "system" ? (
              <Monitor className="w-4 h-4 text-text" />
            ) : theme === "light" ? (
              <Sun className="w-4 h-4 text-warning" />
            ) : (
              <Moon className="w-4 h-4 text-primary" />
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

        {/* User Identity Context & Profile Menu */}
        {user && (
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-subtle border border-transparent hover:border-border transition-colors cursor-pointer text-left select-none focus-visible:outline-2 focus-visible:outline-primary"
              aria-expanded={isProfileOpen}
              aria-haspopup="menu"
              aria-label={`User menu for ${displayName}`}
            >
              {/* Avatar with initials */}
              <div
                className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-text text-[11px] font-bold shrink-0"
              >
                {initials}
              </div>

              {/* Name only — no truncated email in the header */}
              <span className="hidden lg:inline-block text-xs font-semibold text-text max-w-[130px] truncate">
                {displayName}
              </span>

              <ChevronDown
                className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-150 ${
                  isProfileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-lg p-2 z-50 transition-colors animate-in fade-in duration-100"
              >
                {/* User info with full email */}
                <div className="flex items-start gap-3 p-3 bg-surface-subtle/60 rounded-lg border border-border/60 mb-1">
                  <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text text-xs font-bold shrink-0 select-none">
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-text truncate">
                      {displayName}
                    </span>
                    {displayEmail && (
                      <span
                        className="text-[11px] text-text-secondary break-all select-all leading-snug mt-0.5"
                        title={displayEmail}
                      >
                        {displayEmail}
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-border my-1.5" />

                {/* Workspace Settings Link */}
                <Link
                  to="/settings"
                  onClick={() => setIsProfileOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text hover:bg-surface-subtle rounded-lg transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-text-secondary" />
                  <span>Workspace Settings</span>
                </Link>

                <div className="border-t border-border my-1.5" />

                {/* Sign Out Button */}
                <button
                  id="topbar-logout-btn"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-error hover:bg-error-bg rounded-lg transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
