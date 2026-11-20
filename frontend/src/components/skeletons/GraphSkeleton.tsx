import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

export const GraphSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Data Mesh" }, { label: "Knowledge Graph" }]}
        title="Knowledge Graph Visualizer"
        description="Interactive graph canvas showing nodes, entity relationships, and cross-source fusion links."
        icon={
          <Icons.KnowledgeGraph
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        }
      />

      {/* Canvas Placeholder */}
      <div className="flex-1 rounded-xl border border-border bg-surface relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-surface-subtle/30 backdrop-blur-2xs flex flex-col items-center justify-center gap-3">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
    </div>
  );
};
