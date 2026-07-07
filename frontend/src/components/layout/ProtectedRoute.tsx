import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
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
        navigate({ to: "/login", replace: true });
      }
    });
    // checkUser is a stable zustand action reference — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
