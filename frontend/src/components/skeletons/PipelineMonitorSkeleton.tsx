import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

export const PipelineMonitorSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-2 pb-8 pt-1">
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
          badge={{
            label: "Connecting live stream...",
            variant: "zinc",
            pulse: true,
          }}
          actions={
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          }
        />

        {/* Tab Pills */}
        <div className="flex items-center gap-2 mt-3 pb-1 border-b border-border">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-36 rounded-lg" />
        </div>
      </div>

      {/* KPIs & Throughput Gauge Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-6 w-28 rounded-lg" />
      </div>

      {/* Job Cards */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-3"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between pt-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
