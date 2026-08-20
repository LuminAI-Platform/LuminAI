import React from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, ArrowRight } from "lucide-react";
import { EntityIcon } from "../../ontology/components/EntityTypeEditor";
import type { EntityType } from "../../ontology/components/EntityTypeEditor";

interface EntityCardProps {
  id: string;
  canonicalName: string;
  entityType: string;
  properties: Record<string, unknown>;
  createdAt: string;
  highlights?: Record<string, string[]>;
  ontologyTypes?: EntityType[];
}

export const EntityCard: React.FC<EntityCardProps> = ({
  id,
  canonicalName,
  entityType,
  properties,
  createdAt,
  highlights = {},
  ontologyTypes = [],
}) => {
  // Find ontology type mapping
  const matchedType = ontologyTypes.find(
    (t) => t.name.toLowerCase() === entityType.toLowerCase()
  );

  const typeColor = matchedType?.color || "#3b82f6"; // Default blue
  const typeIcon = matchedType?.icon || "package";

  // Check if name is highlighted
  const nameHighlighted = highlights["canonicalName"]?.[0];

  // Extract property highlights
  const propertyHighlights = Object.entries(highlights).filter(
    ([key]) => key.startsWith("properties.")
  );

  // Format date
  const dateFormatted = new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div data-id={id} className="bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-black/40 flex flex-col justify-between gap-4 group">
      
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon Badge */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border-2 shrink-0 select-none"
            style={{
              backgroundColor: `${typeColor}15`,
              borderColor: `${typeColor}35`,
              color: typeColor,
            }}
          >
            <EntityIcon iconKey={typeIcon} size={15} />
          </div>
          
          <div className="min-w-0">
            {/* Title / Name */}
            <h3 className="text-sm font-bold text-zinc-100 leading-tight truncate group-hover:text-blue-400 transition-colors">
              {nameHighlighted ? (
                <span
                  dangerouslySetInnerHTML={{ __html: nameHighlighted }}
                  className="[&>em]:bg-blue-500/20 [&>em]:text-blue-400 [&>em]:not-italic [&>em]:font-semibold [&>em]:px-0.5 [&>em]:rounded"
                />
              ) : (
                canonicalName
              )}
            </h3>
            
            {/* Created date */}
            <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-1 select-none">
              <Calendar className="w-3 h-3" />
              <span>{dateFormatted}</span>
            </div>
          </div>
        </div>

        {/* Entity Type Badge */}
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 select-none capitalize"
          style={{
            backgroundColor: `${typeColor}12`,
            borderColor: `${typeColor}25`,
            color: typeColor,
          }}
        >
          {matchedType?.label || entityType}
        </span>
      </div>

      {/* Properties Fields Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-2 border-t border-b border-zinc-900">
        {Object.entries(properties).map(([key, val]) => {
          // Check if property is highlighted
          const propHighlightKey = `properties.${key}`;
          const isHighlighted = highlights[propHighlightKey];
          const displayVal = String(val);

          return (
            <div key={key} className="flex flex-col min-w-0">
              <span className="text-[10px] text-zinc-500 font-mono truncate select-none uppercase tracking-wider">
                {key}
              </span>
              <span className="text-xs text-zinc-300 font-medium truncate mt-0.5">
                {isHighlighted ? (
                  <span
                    dangerouslySetInnerHTML={{ __html: isHighlighted[0] }}
                    className="[&>em]:bg-blue-500/20 [&>em]:text-blue-400 [&>em]:not-italic [&>em]:font-semibold [&>em]:px-0.5 [&>em]:rounded"
                  />
                ) : (
                  displayVal
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Search Snippet Highlights (Google Style) */}
      {propertyHighlights.length > 0 && (
        <div className="text-[10px] leading-relaxed bg-zinc-950/40 border border-zinc-850 rounded-lg p-2.5 flex flex-col gap-1 select-none">
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-[8px]">
            Matches Found
          </span>
          {propertyHighlights.map(([key, snippetList]) => {
            const propName = key.replace("properties.", "");
            return (
              <div key={key} className="text-zinc-400">
                <span className="text-zinc-500 font-mono font-medium">{propName}:</span>{" "}
                <span
                  dangerouslySetInnerHTML={{ __html: snippetList[0] }}
                  className="italic [&>em]:bg-blue-500/20 [&>em]:text-blue-400 [&>em]:not-italic [&>em]:font-semibold [&>em]:px-0.5 [&>em]:rounded"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex justify-end pt-1">
        <Link
          to={`/explorer`} // Will route to /explorer/entity/${id} in Task S3-13
          className="text-[11px] font-bold text-zinc-500 group-hover:text-blue-500 transition-colors flex items-center gap-1.5 cursor-pointer select-none"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

    </div>
  );
};
