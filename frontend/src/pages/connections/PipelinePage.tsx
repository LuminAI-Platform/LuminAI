import React from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Database } from "lucide-react";
import { FoundryPageHeader } from "../../components/layout/FoundryPageHeader";
import { PipelineMonitor } from "../../features/connections/components/PipelineMonitor";

export const PipelinePage: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-2 pb-6">
      {/* Foundry Page Header */}
      <FoundryPageHeader
        breadcrumbs={[
          { label: "Data Pipelines", to: "/connections" },
          { label: "Pipeline Monitor" },
        ]}
        title="Pipeline Health & Stream Monitor"
        description="Monitor distributed Kafka ingest topics, DuckDB cleaning stage throughput, and real-time execution telemetry."
        icon={<Activity className="w-5 h-5 text-emerald-400" />}
        badge={{
          label: "Streams Healthy",
          variant: "emerald",
          pulse: true,
        }}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/connections"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              <span>Connections</span>
            </Link>
            <Link
              to="/connections/schema-map"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-900/30"
            >
              <span>Schema Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        }
      />

      {/* Main monitor widget */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 shadow-2xl shadow-black/40">
        <PipelineMonitor />
      </div>
    </div>
  );
};
