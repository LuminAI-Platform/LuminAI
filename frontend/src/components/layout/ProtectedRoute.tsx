import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { isPlatformAdmin, useAuthStore } from "../../stores/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Saves the current path to sessionStorage so we can redirect back after login.
 * Skips saving if we're already on /login to avoid a redirect loop.
 */
function saveRedirectPath() {
  const path = window.location.pathname;
  if (path !== "/login") {
    sessionStorage.setItem("post_login_redirect", path);
  }
}

/**
 * ProtectedRoute — guards all shell routes.
 *
 * Flow:
 *  1. On mount, calls checkUser() which reads sessionStorage via oidc-client-ts.
 *  2. While the check is in-flight, isLoading === true → show the loading screen.
 *  3. Once resolved:
 *     - isAuthenticated === true  → render children (the AppShell)
 *     - isAuthenticated === false → navigate to /login
 *
 * StrictMode note: useEffect runs twice in dev. checkUser() is idempotent —
 * the store guard inside it (`isLoading` flag) prevents duplicate network calls.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkUser().then((user) => {
      if (!user) {
        saveRedirectPath();
        navigate({ to: "/login", replace: true });
      }
    });
    // checkUser is a stable zustand action reference — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      saveRedirectPath();
      navigate({ to: "/login", replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-grid-dots opacity-40 pointer-events-none" />

        {/* Glowing backdrop element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="flex flex-col items-center gap-6 relative z-10">
          {/* Futuristic loading ring */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-800/80" />
            <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 border-r-blue-500/30 animate-spin" />
            <div className="absolute inset-2 rounded-full border border-zinc-900 bg-zinc-950/80 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-zinc-400 font-mono">
              Authenticating
            </h3>
            <p className="text-[11px] text-zinc-500">
              Establishing secure connection to LuminAI...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render children when authenticated; null while navigate() fires
  return isAuthenticated ? <>{children}</> : null;
};

export const AdminRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = isPlatformAdmin(user);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !isAdmin) {
      navigate({ to: "/", replace: true });
    }
  }, [isAuthenticated, isLoading, isAdmin, navigate, user]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-full w-full items-center justify-center py-32">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-800/80" />
          <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 border-r-blue-500/30 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-400"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Access denied
            </h2>
            <p className="mt-1 text-xs text-zinc-500 max-w-xs">
              This page requires platform administrator privileges. You are
              being redirected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
