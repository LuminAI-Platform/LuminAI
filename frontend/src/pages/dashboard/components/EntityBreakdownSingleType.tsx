import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Info } from "../../../lib/icons";

export interface EntityBreakdownSingleTypeProps {
  name: string;
  value: number;
  color: string;
  ariaLabel: string;
}

export const EntityBreakdownSingleType: React.FC<
  EntityBreakdownSingleTypeProps
> = ({ name, value, color, ariaLabel }) => {
  return (
    <div
      className="flex flex-col justify-between h-64 w-full"
      role="region"
      aria-label={ariaLabel}
    >
      {/* Ranked list row */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-bold text-text">{name}</span>
          </div>
          <div className="flex items-center gap-1 text-text-secondary">
            <span className="font-bold text-text text-sm">
              {value.toLocaleString()}
            </span>
            <span className="text-xs text-text-tertiary">(100%)</span>
          </div>
        </div>

        {/* Full progress ratio bar */}
        <div className="w-full h-2.5 rounded-full bg-surface-subtle overflow-hidden border border-border">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: "100%", backgroundColor: color }}
          />
        </div>
      </div>

      {/* Explanatory hint banner */}
      <div className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="text-xs text-text leading-relaxed font-medium">
              Only one entity type found. Map more types during ingestion.
            </p>
            <p className="text-[11px] text-text-secondary leading-normal">
              Columns like physician, insurer, and diagnosis were stored as
              attributes on {name}. Configure additional entity types to build a
              rich multi-class graph.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 border-t border-border/60">
          <Link
            to="/connections"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Data Connections</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
          <span className="text-text-tertiary text-xs">·</span>
          <Link
            to="/ontology"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>Ontology Manager</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
