import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 w-full">
      <PageHeader
        breadcrumbs={[{ label: "Overview" }, { label: "Operations" }]}
        title="Platform Operations Dashboard"
        description="Unified telemetry across ontology entities, active connections, and execution health."
        icon={
          <Icons.Dashboard
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        badge={{
          label: "Connecting...",
          variant: "zinc",
          pulse: true,
        }}
        actions={
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl bg-surface border border-border flex flex-col gap-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Telemetry Card Skeleton */}
      <div className="p-5 rounded-xl bg-surface border border-border flex flex-col gap-4">
        <div className="flex justify-between items-center pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-xl bg-surface border border-border flex flex-col gap-4 min-h-[300px]">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="flex-1 w-full rounded-lg min-h-[220px]" />
        </div>
        <div className="p-5 rounded-xl bg-surface border border-border flex flex-col gap-4 min-h-[300px]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="flex-1 w-full rounded-lg min-h-[220px]" />
        </div>
      </div>
    </div>
  );
};
