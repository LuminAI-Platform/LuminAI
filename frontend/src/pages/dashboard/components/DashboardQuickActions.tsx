import React from "react";
import { Link } from "@tanstack/react-router";
import { Icons, ArrowRight, ICON_SIZES } from "../../../lib/icons";

interface QuickLinkItem {
  to: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickLinkItem[] = [
  {
    to: "/connections",
    title: "Data Connections",
    description: "Connect external databases or upload flat files (CSV, JSON).",
    category: "Ingestion",
    icon: <Icons.DataConnections size={ICON_SIZES.card} aria-hidden="true" />,
  },
  {
    to: "/connections/pipelines",
    title: "Pipeline Monitor",
    description:
      "Observe real-time ingest streams, cleaning stages & throughput.",
    category: "Telemetry",
    icon: <Icons.PipelineMonitor size={ICON_SIZES.card} aria-hidden="true" />,
  },
  {
    to: "/graph",
    title: "Knowledge Graph",
    description: "Explore interconnected records and semantic relationships.",
    category: "Relationships",
    icon: <Icons.KnowledgeGraph size={ICON_SIZES.card} aria-hidden="true" />,
  },
  {
    to: "/ontology",
    title: "Data Model & Ontology",
    description:
      "Manage entity types, field properties, and relationship schemas.",
    category: "Schema",
    icon: <Icons.OntologyManager size={ICON_SIZES.card} aria-hidden="true" />,
  },
];

export const DashboardQuickActions: React.FC = () => {
  return (
    <div
      className="flex flex-col gap-2.5"
      role="region"
      aria-label="Quick Navigation"
    >
      <div className="flex items-center justify-between px-1 mb-0.5">
        <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
          Quick Navigation
        </h3>
        <span className="text-[10px] text-text-muted">Direct Shortcuts</span>
      </div>

      {QUICK_ACTIONS.map((action) => (
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
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-subtle border border-border text-text-secondary uppercase tracking-wider">
                {action.category}
              </span>
            </div>
            <ArrowRight
              size={ICON_SIZES.dropdown}
              className="text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all"
              aria-hidden="true"
            />
          </div>

          <h4 className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
            {action.title}
          </h4>
          <p className="text-[11px] text-text-secondary mt-1 leading-normal line-clamp-2">
            {action.description}
          </p>
        </Link>
      ))}
    </div>
  );
};
