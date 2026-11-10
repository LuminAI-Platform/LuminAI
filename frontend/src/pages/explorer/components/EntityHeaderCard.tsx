import React from "react";
import { Calendar, Share2 } from "lucide-react";
import { EntityIcon } from "../../../features/ontology/components/EntityTypeEditor";

interface EntityHeaderCardProps {
  canonicalName: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  typeColor?: string;
  typeIcon?: string;
  onExploreGraph: () => void;
}

export const EntityHeaderCard: React.FC<EntityHeaderCardProps> = ({
  canonicalName,
  entityType,
  entityId,
  createdAt,
  typeColor = "#3b82f6",
  typeIcon = "package",
  onExploreGraph,
}) => {
  const dateFormatted = new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
      <div className="flex items-start gap-5">
        {/* Icon Badge */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 shrink-0"
          style={{
            backgroundColor: `${typeColor}15`,
            borderColor: `${typeColor}35`,
            color: typeColor,
          }}
        >
          <EntityIcon iconKey={typeIcon} size={22} />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-bold text-zinc-100 leading-tight">
            {canonicalName}
          </h1>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Entity type chip */}
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg border capitalize tracking-wide"
              style={{
                backgroundColor: `${typeColor}12`,
                borderColor: `${typeColor}25`,
                color: typeColor,
              }}
            >
              {entityType}
            </span>

            {/* Created date */}
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Calendar className="w-3 h-3" />
              <span>Added {dateFormatted}</span>
            </div>

            {/* Entity ID */}
            <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
              ID: {entityId}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          id="explore-graph-btn"
          onClick={onExploreGraph}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl border border-blue-500/50 hover:border-blue-400/60 transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Explore Graph</span>
        </button>
      </div>
    </div>
  );
};
