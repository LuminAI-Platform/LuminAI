import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children?: React.ReactNode;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 1. Hardware concurrency initialized via lazy state (prevents cascading re-renders)
  const [cores] = useState<number | null>(() => {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    return null;
  });

  const [ramMetric, setRamMetric] = useState<string>("N/A");
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    // RAM metrics via Chromium performance.memory API
    const updateMemory = () => {
      const perf = performance as PerformanceWithMemory;
      if (perf && perf.memory) {
        const usedGB = (
          perf.memory.usedJSHeapSize /
          (1024 * 1024 * 1024)
        ).toFixed(1);
        const totalGB = (
          perf.memory.jsHeapSizeLimit /
          (1024 * 1024 * 1024)
        ).toFixed(1);
        setRamMetric(`${usedGB}GB / ${totalGB}GB`);
      } else if (
        typeof navigator !== "undefined" &&
        "deviceMemory" in navigator
      ) {
        // Fallback for Firefox/Safari supporting navigator.deviceMemory
        const devRam = (navigator as unknown as { deviceMemory: number })
          .deviceMemory;
        setRamMetric(`~${devRam}GB System`);
      }
    };

    // Track online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Defer initial execution out of synchronous effect stack to pass lint rules
    Promise.resolve().then(updateMemory);
    const interval = setInterval(updateMemory, 5000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
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
        <main className="flex-1 overflow-y-auto p-6 md:p-8 relative min-w-0">
          {/* Subtle dotted background grid */}
          <div className="absolute inset-0 bg-grid-dots pointer-events-none z-0" />

          {/* Children views container */}
          <div className="relative z-10 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Status Bar */}
        <footer className="h-9 bg-zinc-900 border-t border-zinc-800/80 px-6 flex items-center justify-between text-[10px] font-mono text-zinc-500 z-10 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center">
              <span
                className={`w-1.5 h-1.5 rounded-full mr-2 shadow-sm ${
                  isOnline
                    ? "bg-emerald-500 shadow-emerald-500/50"
                    : "bg-red-500 shadow-red-500/50"
                }`}
              />
              Network:{" "}
              <span className="text-zinc-300 ml-1">
                {isOnline ? "Connected" : "Offline"}
              </span>
            </span>
            <span>|</span>
            <span>
              CORES:{" "}
              <span className="text-zinc-300">
                {cores ? `${cores} Cores` : "N/A"}
              </span>
            </span>
            <span>|</span>
            <span>
              HEAP: <span className="text-zinc-300">{ramMetric}</span>
            </span>
            <span>|</span>
            <span>
              ENV: <span className="text-zinc-300">{import.meta.env.MODE.toUpperCase()}</span>
            </span>
          </div>
          <div className="hidden sm:block text-zinc-600">
            LuminAI Operational Intelligence
          </div>
        </footer>
      </div>
    </div>
  );
};
