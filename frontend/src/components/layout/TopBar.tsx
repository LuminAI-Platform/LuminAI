import React from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import {
  ThemeMenu,
  NotificationMenu,
  HistoryMenu,
  UserMenu,
} from "../ui/dropdown";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user } = useAuthStore();

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

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Menu (Light, Dark, System) */}
        <ThemeMenu />

        {/* Notification Menu */}
        <NotificationMenu />

        {/* History Menu */}
        <HistoryMenu />

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {/* New Connection Action */}
        <Link
          to="/connections"
          className="bg-primary hover:bg-primary-hover text-primary-text font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer border border-primary shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Connection</span>
        </Link>

        {/* Divider */}
        {user && <div className="w-px h-5 bg-border mx-1 hidden sm:block" />}

        {/* Shared User Menu */}
        {user && <UserMenu />}
      </div>
    </header>
  );
};
