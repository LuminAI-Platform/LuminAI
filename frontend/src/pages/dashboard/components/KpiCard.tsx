import React from "react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Tooltip } from "../../../components/ui/Tooltip";
import { ICON_SIZES } from "../../../lib/icons";

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: {
    text: string;
    variant?: BadgeVariant;
    tooltip?: string;
  };
  status?: "default" | "warning" | "danger" | "success";
  isLoading?: boolean;
  isCached?: boolean;
}

/**
 * KPI Metric Card for Dashboard Overview Row
 * Uses design system standard: 8px radius, 1px border, very light shadow.
 * - Icon scale: 18px in card tiles
 * - Tile styling: slightly brighter than dim stroke (text-text/80), tinted with status color when attention is needed
 * - Decorative icon has aria-hidden="true"
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  status = "default",
  isLoading = false,
  isCached = false,
}) => {
  const getIconContainerStyle = () => {
    if (status === "danger" || badge?.variant === "danger") {
      return "bg-error/10 border-error/30 text-error";
    }
    if (status === "warning" || badge?.variant === "warning") {
      return "bg-warning/10 border-warning/30 text-warning";
    }
    // Slightly brighter than the dim stroke (text-text-secondary):
    return "bg-surface-subtle border-border text-text/80";
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-5 transition-colors flex flex-col justify-between shadow-xs hover:border-text-secondary/40">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-secondary select-none">
          {title}
        </span>
        <div
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${getIconContainerStyle()}`}
        >
          {React.isValidElement(icon)
            ? React.cloneElement(
                icon as React.ReactElement<{
                  "aria-hidden"?: boolean;
                  size?: number;
                  className?: string;
                }>,
                {
                  "aria-hidden": true,
                  size: ICON_SIZES.card,
                },
              )
            : icon}
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
                {badge?.tooltip && !isCached ? (
                  <Tooltip label={badge.tooltip} side="top">
                    <span
                      title={badge.tooltip}
                      className="inline-flex cursor-help"
                    >
                      <Badge variant={badge.variant ?? "default"}>
                        {badge.text}
                      </Badge>
                    </span>
                  </Tooltip>
                ) : (
                  <Badge
                    variant={
                      isCached ? "nodata" : (badge?.variant ?? "default")
                    }
                  >
                    {isCached ? "Cached" : badge?.text}
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
