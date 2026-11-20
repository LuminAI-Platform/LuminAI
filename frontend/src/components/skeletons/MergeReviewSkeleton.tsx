import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

export const MergeReviewSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-4rem)] p-6 max-w-[1700px] mx-auto overflow-hidden">
      <PageHeader
        title="Merge & Link Review Console"
        breadcrumbs={[
          { label: "Data Pipeline", to: "/connections" },
          { label: "Merge Review" },
        ]}
        description="Inspect high-confidence record pairs flagged by Graph Linkage algorithms."
        icon={
          <Icons.FusionReview
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        }
      />

      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
        <div className="w-80 rounded-xl border border-border bg-surface p-3 flex flex-col gap-3 shrink-0">
          <Skeleton className="h-8 w-full rounded-lg" />
          <div className="space-y-2 flex-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-border bg-surface p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <Skeleton className="h-6 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <Skeleton className="h-full rounded-lg" />
            <Skeleton className="h-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};
