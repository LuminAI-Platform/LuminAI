import React from "react";
import { Building } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import type { TenantContextCardProps } from "../types";

export const TenantContextCard: React.FC<TenantContextCardProps> = ({
  tenantSlug,
  tenantId,
}) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-800/80">
          <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Tenant Organization
            </h3>
            <p className="text-xs text-zinc-400">
              Schema-isolated enterprise workspace
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Tenant Namespace (Slug)
            </label>
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono text-xs">
              {tenantSlug}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Tenant UUID
            </label>
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 font-mono text-[11px] truncate">
              {tenantId}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Data Isolation Level
            </label>
            <div className="flex items-center gap-2 text-zinc-300">
              <Badge variant="info">PostgreSQL Schema Per Tenant</Badge>
              <Badge variant="default">Neo4j Property Scoped</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
