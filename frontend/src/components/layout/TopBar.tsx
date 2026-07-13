import React from "react";
import { useAuthStore } from "../../stores/authStore";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();

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
    <header className="h-16 bg-zinc-900 border-b border-zinc-800/80 flex items-center justify-between px-8 z-30">
      {/* Mobile Menu Toggle Button */}
      <button
        type="button"
        className="p-2 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 rounded-full flex items-center justify-center transition-all md:hidden cursor-pointer"
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
      <div className="flex items-center bg-zinc-850/60 border border-zinc-800/80 rounded-lg px-3 py-1.5 w-48 sm:w-64 md:w-96 gap-2 transition-all focus-within:border-blue-500/80 focus-within:bg-zinc-850">
        <svg
          className="text-zinc-500 shrink-0"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500 text-xs w-full"
          placeholder="Search ontology, pipelines, or clusters..."
        />
        <span className="bg-zinc-900 border border-zinc-800 text-zinc-500 text-[9px] px-1.5 py-0.5 rounded font-mono hidden sm:inline-block shrink-0">
          CMD K
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Notification Icon */}
        <button
          type="button"
          className="p-2 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 rounded-full flex items-center justify-center transition-all relative cursor-pointer"
          aria-label="Notifications"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>

        {/* History/Clock Icon */}
        <button
          type="button"
          className="p-2 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100 rounded-full flex items-center justify-center transition-all cursor-pointer"
          aria-label="History"
        >
          <svg
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
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-800 mx-1 hidden sm:block" />

        {/* Deploy Action */}
        <button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 shrink-0"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Deploy
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-800 mx-1 hidden sm:block" />

        {/* User Identity Context — populated from JWT claims after authentication */}
        {user && (
          <div className="flex items-center gap-2.5 group relative">
            {/* Avatar with initials */}
            <div
              className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-[11px] font-bold shrink-0 select-none"
              aria-label={`Logged in as ${displayName}`}
            >
              {initials}
            </div>

            {/* Name + email — hidden on small screens */}
            <div className="hidden lg:flex flex-col leading-tight">
              <span className="text-xs font-semibold text-zinc-200 truncate max-w-[120px]">
                {displayName}
              </span>
              {displayEmail && (
                <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                  {displayEmail}
                </span>
              )}
            </div>

            {/* Logout button */}
            <button
              id="topbar-logout-btn"
              type="button"
              onClick={logout}
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all cursor-pointer"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg
                width="15"
                height="15"
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
    </header>
  );
};
