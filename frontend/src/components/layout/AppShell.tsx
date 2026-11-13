import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { TooltipProvider } from "../ui/Tooltip";

interface AppShellProps {
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("luminai_sidebar_collapsed");
      if (stored !== null) return stored === "true";
      return window.innerWidth < 1280;
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    // Track online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-page text-text font-sans">
        {/* Collapsible Sidebar Drawer */}
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Top Navigation */}
          <TopBar onMenuClick={() => setMobileOpen(true)} />

          {/* Scrollable View Container */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7 relative min-w-0 bg-page">
            {/* Subtle calm background pattern */}
            <div className="absolute inset-0 bg-grid-dots pointer-events-none z-0" />

            {/* Children views container */}
            <div className="relative z-10 max-w-[1720px] mx-auto w-full">
              {children}
            </div>
          </main>

          {/* Status Bar */}
          <footer className="h-9 bg-surface border-t border-border px-6 flex items-center justify-between text-xs text-text-secondary z-10 shrink-0 select-none">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                {isOnline ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-error" />
                )}
                <span>Network:</span>
                <span
                  className={`font-medium ${isOnline ? "text-success" : "text-error"}`}
                >
                  {isOnline ? "Connected" : "Offline"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span>System:</span>
                <span className="text-success font-medium">Online</span>
              </span>
              <span>
                Environment:{" "}
                <span className="text-text font-medium">
                  {import.meta.env.MODE.charAt(0).toUpperCase() +
                    import.meta.env.MODE.slice(1)}
                </span>
              </span>
            </div>
            <div className="hidden sm:block text-text-secondary">
              LuminAI Data Platform
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
};
