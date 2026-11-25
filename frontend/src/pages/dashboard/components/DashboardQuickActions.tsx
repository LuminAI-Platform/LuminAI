import React from "react";
import { Link } from "@tanstack/react-router";
import { Icons, ArrowRight, ICON_SIZES } from "../../../lib/icons";
import type { DashboardSummary } from "../dashboardTypes";

interface QuickLinkItem {
  to: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  getCountLabel?: (summary: DashboardSummary) => string | null;
}

const QUICK_ACTIONS: QuickLinkItem[] = [
  {
    to: "/connections",
    title: "Data Connections",
    description: "Connect external databases or upload flat files (CSV, JSON).",
    category: "Ingestion",
    icon: <Icons.DataConnections size={ICON_SIZES.card} aria-hidden="true" />,
    getCountLabel: (s) =>
      typeof s.totalConnections === "number"
        ? `${s.totalConnections.toLocaleString()} ${s.totalConnections === 1 ? "source" : "sources"}`
        : null,
  },
  {
    to: "/connections/pipelines",
    title: "Pipeline Monitor",
    description:
      "Observe real-time ingest streams, cleaning stages & throughput.",
    category: "Telemetry",
    icon: <Icons.PipelineMonitor size={ICON_SIZES.card} aria-hidden="true" />,
    getCountLabel: (s) =>
      typeof s.totalPipelines === "number"
        ? `${s.totalPipelines.toLocaleString()} ${s.totalPipelines === 1 ? "run" : "runs"}`
        : null,
  },
  {
    to: "/graph",
    title: "Knowledge Graph",
    description: "Explore interconnected records and semantic relationships.",
    category: "Relationships",
    icon: <Icons.KnowledgeGraph size={ICON_SIZES.card} aria-hidden="true" />,
    getCountLabel: (s) =>
      typeof s.totalEntities === "number"
        ? `${s.totalEntities.toLocaleString()} ${s.totalEntities === 1 ? "entity" : "entities"}`
        : null,
  },
  {
    to: "/ontology",
    title: "Ontology Manager",
    description:
      "Manage entity types, field properties, and relationship schemas.",
    category: "Schema",
    icon: <Icons.OntologyManager size={ICON_SIZES.card} aria-hidden="true" />,
  },
];

interface DashboardQuickActionsProps {
  summary?: DashboardSummary;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  summary,
}) => {
  return (
    <div
      className="flex flex-col gap-2.5 pt-1 scroll-mt-6"
      role="region"
      aria-label="Quick navigation"
    >
      <div className="flex items-center justify-between px-1 mb-0.5">
        <h3 className="text-xs font-semibold text-text">Quick navigation</h3>
      </div>

      {QUICK_ACTIONS.map((action) => {
        const countLabel =
          summary && action.getCountLabel
            ? action.getCountLabel(summary)
            : null;
        return (
          <Link
            key={action.to}
            to={action.to}
            className="group p-3.5 bg-surface border border-border hover:border-border-focus hover:shadow-xs rounded-lg transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface select-none"
            tabIndex={0}
            aria-label={`${action.title}: ${action.description}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border text-text/80 flex items-center justify-center shrink-0 group-hover:bg-primary-tint/30 group-hover:border-primary/30 group-hover:text-primary transition-colors">
                  {action.icon}
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-subtle border border-border text-text-secondary">
                  {action.category}
                </span>
              </div>
              <ArrowRight
                size={ICON_SIZES.dropdown}
                className="text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all"
                aria-hidden="true"
              />
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
                {action.title}
              </h4>
              {countLabel && (
                <span className="text-[11px] text-text-muted shrink-0">
                  {countLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary mt-1 leading-normal line-clamp-2">
              {action.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
};
