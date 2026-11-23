import React from "react";
import { Building } from "../../../lib/icons";
import type { TenantContextCardProps } from "../types";

export const TenantContextCard: React.FC<TenantContextCardProps> = ({
  tenantSlug,
  tenantId,
}) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-6 flex flex-col justify-between shadow-xs transition-colors">
      <div>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
          <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border text-text-secondary flex items-center justify-center">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">
              Tenant Organization
            </h3>
            <p className="text-xs text-text-secondary">
              Tenant-scoped workspace context
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
              Tenant Namespace (Slug)
            </label>
            <div className="p-2.5 bg-surface-subtle border border-border rounded-lg text-text font-mono text-xs">
              {tenantSlug}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
              Tenant UUID
            </label>
            <div className="p-2.5 bg-surface-subtle border border-border rounded-lg text-text-secondary font-mono text-[11px] truncate">
              {tenantId}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
