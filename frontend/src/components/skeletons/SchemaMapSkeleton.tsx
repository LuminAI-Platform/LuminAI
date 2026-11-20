import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

export const SchemaMapSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { label: "Data Integration", to: "/connections" },
          { label: "Schema Studio" },
        ]}
        title="Schema Studio & Mapping Canvas"
        description="Map incoming raw columns to target ontology entity properties with visual node links."
        icon={
          <Icons.SchemaStudio
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        }
      />

      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>

      <div className="flex-1 grid grid-cols-2 gap-5 min-h-0">
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
