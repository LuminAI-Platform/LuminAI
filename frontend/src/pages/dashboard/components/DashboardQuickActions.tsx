import React from "react";
import { Link } from "@tanstack/react-router";
import { Database, GitBranch, Layers, ArrowRight } from "lucide-react";

export const DashboardQuickActions: React.FC = () => {
  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/connections"
        className="group p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
        </div>
        <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-zinc-200 transition-colors">
          Data Connections
        </h4>
        <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
          Connect external databases or upload flat files (CSV, JSON).
        </p>
      </Link>

      <Link
        to="/graph"
        className="group p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center">
            <GitBranch className="w-4 h-4" />
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
        </div>
        <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-zinc-200 transition-colors">
          Knowledge Graph
        </h4>
        <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
          Explore interconnected records and semantic relationships.
        </p>
      </Link>

      <Link
        to="/ontology"
        className="group p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
        </div>
        <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-zinc-200 transition-colors">
          Data Model & Ontology
        </h4>
        <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
          Manage entity types, field properties, and relationship schemas.
        </p>
      </Link>
    </div>
  );
};
