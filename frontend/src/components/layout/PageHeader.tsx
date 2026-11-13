import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

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
    variant?: "emerald" | "blue" | "purple" | "amber" | "zinc";
    pulse?: boolean;
  };
  actions?: React.ReactNode;
}

const BADGE_STYLES = {
  emerald: "bg-success-bg text-success border-success-border",
  blue: "bg-primary-tint text-primary border-primary-border",
  purple: "bg-primary-tint text-primary border-primary-border",
  amber: "bg-warning-bg text-warning border-warning-border",
  zinc: "bg-surface-subtle text-text-secondary border-border",
};

const DOT_COLORS = {
  emerald: "bg-success",
  blue: "bg-primary",
  purple: "bg-primary",
  amber: "bg-warning",
  zinc: "bg-text-secondary",
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  breadcrumbs,
  title,
  description,
  icon,
  badge,
  actions,
}) => {
  const variant = badge?.variant || "emerald";

  return (
    <div className="flex flex-col gap-2 pb-2 select-none border-b border-border">
      {/* Navigation Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-text-secondary"
      >
        <span className="text-text-secondary font-medium">LuminAI</span>
        <ChevronRight className="w-3 h-3 text-border" />
        {breadcrumbs.map((item, idx) => (
          <React.Fragment key={idx}>
            {item.to ? (
              <Link
                to={item.to}
                className="hover:text-text transition-colors cursor-pointer"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-text-secondary font-medium">
                {item.label}
              </span>
            )}
            {idx < breadcrumbs.length - 1 && (
              <ChevronRight className="w-3 h-3 text-border" />
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Main Title Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-lg bg-surface-subtle border border-border text-text-secondary shadow-sm shrink-0">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-text font-sans tracking-tight">
                {title}
              </h1>
              {badge && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${BADGE_STYLES[variant]}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant]}`}
                  />
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5 max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
};
