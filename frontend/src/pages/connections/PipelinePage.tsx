import React from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Database } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { PipelineMonitor } from "../../features/connections/components/PipelineMonitor";

export const PipelinePage: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-2 pb-6">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Data Integration", to: "/connections" },
          { label: "Pipeline Monitor" },
        ]}
        title="Pipeline Health & Stream Monitor"
        description="Monitor ingest topics, data cleaning stage throughput, and real-time execution telemetry."
        icon={<Activity className="w-5 h-5 text-primary" />}
        badge={{
          label: "Streams Active",
          variant: "emerald",
          pulse: true,
        }}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/connections"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-transparent border border-border text-text hover:bg-surface-subtle transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-text-secondary" />
              <span>Connections</span>
            </Link>
            <Link
              to="/connections/schema-map"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover border border-primary text-primary-text shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Schema Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        }
      />

      {/* Main monitor widget */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <PipelineMonitor />
      </div>
    </div>
  );
};
