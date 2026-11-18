import React from "react";
import { Link } from "@tanstack/react-router";
import { Icons, ArrowRight, ICON_SIZES } from "../../../lib/icons";

export const DashboardQuickActions: React.FC = () => {
  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/connections"
        className="group p-4 bg-surface border border-border hover:border-border-focus rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border text-text/80 flex items-center justify-center">
            <Icons.DataConnections size={ICON_SIZES.card} aria-hidden="true" />
          </div>
          <ArrowRight
            size={ICON_SIZES.dropdown}
            className="text-text-muted group-hover:text-text group-hover:translate-x-0.5 transition-all"
            aria-hidden="true"
          />
        </div>
        <h4 className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
          Data Connections
        </h4>
        <p className="text-[11px] text-text-secondary mt-1 leading-normal">
          Connect external databases or upload flat files (CSV, JSON).
        </p>
      </Link>

      <Link
        to="/graph"
        className="group p-4 bg-surface border border-border hover:border-border-focus rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border text-text/80 flex items-center justify-center">
            <Icons.KnowledgeGraph size={ICON_SIZES.card} aria-hidden="true" />
          </div>
          <ArrowRight
            size={ICON_SIZES.dropdown}
            className="text-text-muted group-hover:text-text group-hover:translate-x-0.5 transition-all"
            aria-hidden="true"
          />
        </div>
        <h4 className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
          Knowledge Graph
        </h4>
        <p className="text-[11px] text-text-secondary mt-1 leading-normal">
          Explore interconnected records and semantic relationships.
        </p>
      </Link>

      <Link
        to="/ontology"
        className="group p-4 bg-surface border border-border hover:border-border-focus rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border text-text/80 flex items-center justify-center">
            <Icons.OntologyManager size={ICON_SIZES.card} aria-hidden="true" />
          </div>
          <ArrowRight
            size={ICON_SIZES.dropdown}
            className="text-text-muted group-hover:text-text group-hover:translate-x-0.5 transition-all"
            aria-hidden="true"
          />
        </div>
        <h4 className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
          Data Model & Ontology
        </h4>
        <p className="text-[11px] text-text-secondary mt-1 leading-normal">
          Manage entity types, field properties, and relationship schemas.
        </p>
      </Link>
    </div>
  );
};
