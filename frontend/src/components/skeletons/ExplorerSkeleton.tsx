import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

export const ExplorerSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Data Mesh" }, { label: "Entity Explorer" }]}
        title="Entity Explorer"
        description="Search, filter, and inspect canonical entities and lineage records across the ontology graph."
        icon={
          <Icons.EntityExplorer
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        }
      />

      {/* Search Input Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>

      {/* Two Column Layout: Facet Sidebar + Entity Cards */}
      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
        <div className="w-64 rounded-xl border border-border bg-surface p-4 flex flex-col gap-4 shrink-0">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-7 w-full rounded-md" />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-5 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
