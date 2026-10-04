import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface FoundryPageHeaderProps {
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
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  zinc: "bg-zinc-850 text-zinc-400 border-zinc-700/60",
};

const DOT_COLORS = {
  emerald: "bg-emerald-400",
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  amber: "bg-amber-400",
  zinc: "bg-zinc-400",
};

export const FoundryPageHeader: React.FC<FoundryPageHeaderProps> = ({
  breadcrumbs,
  title,
  description,
  icon,
  badge,
  actions,
}) => {
  const variant = badge?.variant || "emerald";

  return (
    <div className="flex flex-col gap-2 pb-2 select-none border-b border-zinc-800/80">
      {/* Foundry Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500"
      >
        <span className="text-zinc-600 font-semibold uppercase tracking-wider">
          LuminAI
        </span>
        <ChevronRight className="w-3 h-3 text-zinc-700" />
        {breadcrumbs.map((item, idx) => (
          <React.Fragment key={idx}>
            {item.to ? (
              <Link
                to={item.to}
                className="hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-zinc-400 font-medium">{item.label}</span>
            )}
            {idx < breadcrumbs.length - 1 && (
              <ChevronRight className="w-3 h-3 text-zinc-700" />
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Main Title Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-sm shrink-0">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-zinc-100 font-sans tracking-tight">
                {title}
              </h1>
              {badge && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${BADGE_STYLES[variant]}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant]} ${
                      badge.pulse ? "animate-pulse" : ""
                    }`}
                  />
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl leading-relaxed">
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
