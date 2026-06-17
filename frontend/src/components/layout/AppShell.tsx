import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 shadow-sm shadow-emerald-500/50" />
              Cluster:{" "}
              <span className="text-zinc-300 ml-1">lumin-us-east-1</span>
            </span>
            <span>|</span>
            <span>
              CPU: <span className="text-zinc-300">12%</span>
            </span>
            <span>|</span>
            <span>
              RAM: <span className="text-zinc-300">4.2GB / 16GB</span>
            </span>
          </div>
          <div className="hidden sm:block text-zinc-600">
            VERSION 2.4.1-STABLE
          </div>
        </footer>
      </div>
    </div>
  );
};
