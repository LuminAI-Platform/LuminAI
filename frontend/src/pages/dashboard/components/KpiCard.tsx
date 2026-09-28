import React from "react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: {
    text: string;
    variant?: BadgeVariant;
  };
  isLoading?: boolean;
}

/**
 * KPI Metric Card for Dashboard Overview Row
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  isLoading = false,
}) => {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-400 select-none">
          {title}
        </span>
        <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-blue-400">
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1.5">
        {isLoading ? (
          <Skeleton className="w-24 h-7" />
        ) : (
          <span className="text-2xl font-bold tracking-tight text-zinc-100">
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-500 min-h-5">
        {isLoading ? (
          <Skeleton className="w-36 h-3" />
        ) : (
          <>
            <span>{subtitle}</span>
            {badge && (
              <Badge variant={badge.variant ?? "default"} withDot>
                {badge.text}
              </Badge>
            )}
          </>
        )}
      </div>
    </div>
  );
};
