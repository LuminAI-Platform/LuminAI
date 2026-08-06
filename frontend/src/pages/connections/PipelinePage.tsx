import React from "react";
import { PipelineMonitor } from "../../features/connections/components/PipelineMonitor";

export const PipelinePage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-6">
      {/* Page Header */}
      <div className="flex items-center justify-between select-none">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Pipeline Monitoring
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monitor active data cleaning jobs, throughput, and execution errors
          </p>
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-2">
          <a
            href="/connections"
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
          >
            ← Connections
          </a>
          <a
            href="/connections/schema-map"
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
          >
            Schema Map →
          </a>
        </div>
      </div>

      {/* Main monitor widget */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 shadow-2xl shadow-black/40">
        <PipelineMonitor />
      </div>
    </div>
  );
};
