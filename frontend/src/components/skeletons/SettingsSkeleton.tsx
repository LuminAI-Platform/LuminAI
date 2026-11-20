import React from "react";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/Skeleton";

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
