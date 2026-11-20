import React from "react";
import { useAuthStore } from "../../stores/authStore";
import { useConnectionModalStore } from "../../stores/connectionModalStore";
import {
  ThemeMenu,
  NotificationMenu,
  HistoryMenu,
  UserMenu,
} from "../ui/dropdown";
import { Tooltip } from "../ui/Tooltip";
import { Icons, Search, Plus, ICON_SIZES } from "../../lib/icons";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user } = useAuthStore();
  const openChooser = useConnectionModalStore((state) => state.openChooser);

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 md:px-8 z-30 transition-colors">
      {/* Mobile Menu Toggle Button */}
      <Tooltip label="Open navigation menu" side="bottom">
        <button
          type="button"
          className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors md:hidden cursor-pointer"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Icons.Menu size={ICON_SIZES.header} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Search Bar Container */}
      <div className="flex items-center bg-surface-subtle border border-border rounded-lg px-3 py-1.5 w-48 sm:w-64 md:w-96 gap-2 transition-colors focus-within:border-border-focus">
        <Search
          size={ICON_SIZES.dropdown}
          className="text-text-secondary shrink-0"
          aria-hidden="true"
        />
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

        {/* New Connection Action — opens chooser dialog */}
        <button
          type="button"
          onClick={openChooser}
          className="bg-primary hover:bg-primary-hover text-primary-text font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer border border-primary shadow-xs"
        >
          <Plus size={ICON_SIZES.inline} aria-hidden="true" />
          <span>New connection</span>
        </button>

        {/* Divider */}
        {user && <div className="w-px h-5 bg-border mx-1 hidden sm:block" />}

        {/* Shared User Menu */}
        {user && <UserMenu />}
      </div>
    </header>
  );
};
