import React, { useEffect, useRef, useState } from "react";
import { Tooltip } from "../ui/Tooltip";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description: string;
  icon?: React.ReactNode;
  badge?: {
    label: string;
    variant?: "emerald" | "blue" | "purple" | "amber" | "zinc" | "error";
    pulse?: boolean;
  };
  actions?: React.ReactNode;
  /**
   * When true, uses a CSS container query (`@container`) so `actions` move to
   * their own left-aligned row below the title whenever the header container
   * width is below 1400px (accounting for sidebar width).
   */
  stackActionsBelowWide?: boolean;
}

function useIsTruncated<T extends HTMLElement>(dependency: string | undefined) {
  const ref = useRef<T | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };

    check();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(check);
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [dependency]);

  return { ref, isTruncated };
}

const BADGE_STYLES = {
  emerald: "bg-success-bg text-success border-success-border",
  blue: "bg-primary-tint text-primary border-primary-border",
  purple: "bg-primary-tint text-primary border-primary-border",
  amber: "bg-warning-bg text-warning border-warning-border",
  zinc: "bg-surface-subtle text-text-secondary border-border",
  error: "bg-error-bg text-error border-error-border",
};

const DOT_COLORS = {
  emerald: "bg-success",
  blue: "bg-primary",
  purple: "bg-primary",
  amber: "bg-warning",
  zinc: "bg-text-secondary",
  error: "bg-error",
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  badge,
  actions,
  stackActionsBelowWide = false,
}) => {
  const variant = badge?.variant || "emerald";
  const { ref: titleRef, isTruncated: isTitleTruncated } =
    useIsTruncated<HTMLHeadingElement>(title);
  const { ref: badgeLabelRef, isTruncated: isBadgeTruncated } =
    useIsTruncated<HTMLSpanElement>(badge?.label);

  return (
    <div className="@container pb-2 select-none border-b border-border">
      {/* Main Title Row */}
      <div
        className={
          stackActionsBelowWide
            ? "flex flex-col @[1400px]:flex-row @[1400px]:items-center @[1400px]:justify-between gap-3"
            : "flex flex-col md:flex-row md:items-center justify-between gap-3"
        }
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div className="p-2 rounded-lg bg-surface-subtle border border-border text-text-secondary shadow-sm shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 min-w-0 flex-nowrap">
              <Tooltip label={title} side="bottom" enabled={isTitleTruncated}>
                <h1
                  ref={titleRef}
                  className="text-lg font-bold text-text font-sans tracking-tight whitespace-nowrap truncate min-w-0"
                >
                  {title}
                </h1>
              </Tooltip>
              {badge && (
                <Tooltip
                  label={badge.label}
                  side="bottom"
                  enabled={isBadgeTruncated}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap min-w-0 shrink ${BADGE_STYLES[variant]}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[variant]}`}
                      aria-hidden="true"
                    />
                    <span ref={badgeLabelRef} className="truncate">
                      {badge.label}
                    </span>
                  </span>
                </Tooltip>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5 max-w-2xl leading-relaxed line-clamp-2">
              {description}
            </p>
          </div>
        </div>

        {actions && (
          <div
            className={
              stackActionsBelowWide
                ? "flex items-center justify-start gap-2.5 w-full @[1400px]:w-auto @[1400px]:justify-end shrink-0"
                : "flex items-center gap-2.5 shrink-0"
            }
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
