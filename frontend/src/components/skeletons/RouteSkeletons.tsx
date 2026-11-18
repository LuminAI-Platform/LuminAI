import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Dashboard Skeleton
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. Pipeline Monitor Skeleton
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Connections Skeleton
// ─────────────────────────────────────────────────────────────────────────────
export const ConnectionsSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 w-full">
      <PageHeader
        breadcrumbs={[{ label: "Data Integration" }, { label: "Connections" }]}
        title="Data Ingestion & Connectors"
        description="Configure structured database ingestion, local file uploads, and continuous sync pipelines."
        icon={
          <Icons.DataConnections
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        }
      />

      {/* Tab Switcher Skeleton */}
      <div className="flex items-center gap-3 border-b border-border pb-2">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded" />
              <Skeleton className="h-6 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Explorer Skeleton
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 5. Knowledge Graph Skeleton
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. Schema Studio Skeleton
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. Fusion Review Skeleton
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 8. Ontology Manager Skeleton
// ─────────────────────────────────────────────────────────────────────────────
export const OntologySkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 w-full">
      <PageHeader
        breadcrumbs={[
          { label: "System Architecture" },
          { label: "Ontology Manager" },
        ]}
        title="Ontology & Schema Manager"
        description="Manage domain entities, typed properties, directional relationships, and version release schemas."
        icon={
          <Icons.OntologyManager
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        }
      />

      <div className="flex items-center gap-3 border-b border-border pb-2">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-14 rounded" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. Settings Skeleton
// ─────────────────────────────────────────────────────────────────────────────
export const SettingsSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 w-full">
      <PageHeader
        breadcrumbs={[
          { label: "Configuration", to: "/settings" },
          { label: "Workspace Settings" },
        ]}
        title="Workspace & Tenant Settings"
        description="Manage authenticated user identity, multi-tenant boundaries, access control roles, and API configuration."
        icon={
          <Icons.Settings
            size={ICON_SIZES.header}
            className="text-text-secondary"
            aria-hidden="true"
          />
        }
        actions={<Skeleton className="h-8 w-24 rounded-lg" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>

      <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
};
