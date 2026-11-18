import React, { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Icons, ArrowRight, BarChart3, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../../components/layout/PageHeader";
import { PipelineMonitor } from "../../features/connections/components/PipelineMonitor";
import { PipelineAnalysisView } from "../../features/connections/components/pipeline-analysis/PipelineAnalysisView";

type PipelineTab = "live" | "analysis";

export const PipelinePage: React.FC = () => {
  // Read initial tab from URL search parameters (?tab=analysis)
  const [activeTab, setActiveTab] = useState<PipelineTab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab")?.toLowerCase();
      if (tabParam === "analysis") return "analysis";
    }
    return "live";
  });

  // Track stream status reported by live monitor
  const [streamStatus, setStreamStatus] = useState<{
    isConnected: boolean;
    activeStreams: number;
    isPolling: boolean;
  }>({
    isConnected: false,
    activeStreams: 0,
    isPolling: false,
  });

  // Sync tab with URL search params (?tab=live or ?tab=analysis)
  const handleTabChange = useCallback((tab: PipelineTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "analysis") {
        url.searchParams.set("tab", "analysis");
      } else {
        url.searchParams.set("tab", "live");
      }
      window.history.pushState({}, "", url.toString());
    }
  }, []);

  // Listen to browser popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab")?.toLowerCase();
      setActiveTab(tabParam === "analysis" ? "analysis" : "live");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Derive dynamic header badge based on real live connection and active streams
  const headerBadge = (() => {
    if (!streamStatus.isConnected) {
      return {
        label: "Live feed disconnected",
        variant: "amber" as const,
        pulse: false,
      };
    }
    if (streamStatus.activeStreams > 0) {
      return {
        label: "Streams Active",
        variant: "emerald" as const,
        pulse: true,
      };
    }
    return {
      label: "No active streams",
      variant: "zinc" as const,
      pulse: false,
    };
  })();

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-2 pb-8 pt-1">
      {/* Sticky Top Page Header to prevent clipping */}
      <div className="sticky top-0 z-20 bg-page/95 backdrop-blur-sm pb-1">
        <PageHeader
          breadcrumbs={[
            { label: "Data Integration", to: "/connections" },
            { label: "Pipeline Monitor" },
          ]}
          title="Pipeline Monitor"
          description="Monitor ingest topics, data cleaning stage throughput, and real-time execution telemetry."
          icon={
            <Icons.PipelineMonitor
              size={ICON_SIZES.header}
              className="text-primary"
              aria-hidden="true"
            />
          }
          badge={headerBadge}
          actions={
            <div className="flex items-center gap-2">
              <Link
                to="/connections"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-transparent border border-border text-text hover:bg-surface-subtle transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Icons.DataConnections
                  size={ICON_SIZES.inline}
                  className="text-text-secondary"
                  aria-hidden="true"
                />
                <span>Connections</span>
              </Link>
              <Link
                to="/connections/schema-map"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover border border-primary text-primary-text shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Schema Studio</span>
                <ArrowRight size={ICON_SIZES.inline} aria-hidden="true" />
              </Link>
            </div>
          }
        />

        {/* Tab navigation bar directly under header */}
        <div
          className="flex items-center gap-2 mt-4 border-b border-border select-none"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "live"}
            onClick={() => handleTabChange("live")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "live"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-text-secondary hover:text-text hover:border-border"
            }`}
          >
            <Icons.PipelineMonitor
              size={ICON_SIZES.inline}
              aria-hidden="true"
            />
            <span>Live Telemetry</span>
            {streamStatus.isConnected && streamStatus.activeStreams > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "analysis"}
            onClick={() => handleTabChange("analysis")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "analysis"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-text-secondary hover:text-text hover:border-border"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analysis</span>
          </button>
        </div>
      </div>

      {/* Main Tab View */}
      {activeTab === "live" ? (
        <div className="bg-surface border border-border rounded-lg p-5">
          <PipelineMonitor onStreamStatusChange={setStreamStatus} />
        </div>
      ) : (
        <PipelineAnalysisView />
      )}
    </div>
  );
};
