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
  isCached?: boolean;
}

/**
 * KPI Metric Card for Dashboard Overview Row
 * Uses design system standard: 8px radius, 1px border, very light shadow.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  isLoading = false,
  isCached = false,
}) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 transition-colors flex flex-col justify-between shadow-xs hover:border-text-secondary/40">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-secondary select-none">
          {title}
        </span>
        <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary">
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
        {isLoading ? (
          <Skeleton className="w-24 h-7" />
        ) : (
          <>
            <span
              className={`text-3xl font-semibold tabular-nums tracking-tight text-text ${
                isCached ? "opacity-70" : ""
              }`}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-secondary min-h-5">
        {isLoading ? (
          <Skeleton className="w-36 h-3" />
        ) : (
          <>
            <span className="truncate">{subtitle}</span>
            {(badge || isCached) && (
              <div className="shrink-0">
                <Badge
                  variant={isCached ? "nodata" : (badge?.variant ?? "default")}
                >
                  {isCached ? "Cached" : badge?.text}
                </Badge>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
