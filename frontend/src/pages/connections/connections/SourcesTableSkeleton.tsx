import React from "react";
import { Skeleton } from "../../../components/ui/Skeleton";

export const SourcesTableSkeleton: React.FC = () => (
  <div
    className="border border-border rounded-lg overflow-hidden bg-surface"
    aria-label="Loading data sources"
  >
    <div className="p-3 border-b border-border flex flex-wrap items-center gap-3">
      <Skeleton className="h-8 flex-1 min-w-[200px] rounded-lg" />
      <Skeleton className="h-8 w-36 rounded-lg" />
      <Skeleton className="h-8 w-40 rounded-lg" />
    </div>
    <div className="divide-y divide-border">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="px-4 py-3.5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  </div>
);
