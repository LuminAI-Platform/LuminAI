import React from "react";
import { FilterX, Check } from "lucide-react";
import { EntityIcon } from "../../ontology/components/EntityTypeEditor";
import type { EntityType } from "../../ontology/components/EntityTypeEditor";

interface FacetFilterSidebarProps {
  selectedTypes: string[];
  onChange: (selectedTypes: string[]) => void;
  facets: Record<string, number>;
  ontologyTypes: EntityType[];
}

export const FacetFilterSidebar: React.FC<FacetFilterSidebarProps> = ({
  selectedTypes,
  onChange,
  facets,
  ontologyTypes,
}) => {
  const handleToggle = (typeName: string) => {
    const isSelected = selectedTypes.includes(typeName);
    let updated: string[];
    
    if (isSelected) {
      updated = selectedTypes.filter((t) => t !== typeName);
    } else {
      updated = [...selectedTypes, typeName];
    }
    
    onChange(updated);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <aside className="w-full md:w-64 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-5 select-none">
      
      {/* Title & Clear Action */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-blue-500"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
            Entity Filters
          </span>
        </div>

        {selectedTypes.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[10px] font-bold text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <FilterX className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Checklist list */}
      <div className="flex flex-col gap-1.5">
        {ontologyTypes.length === 0 ? (
          <div className="text-center py-6 text-[11px] text-zinc-500 italic">
            No entity types defined in ontology
          </div>
        ) : (
          ontologyTypes.map((type) => {
            const isChecked = selectedTypes.includes(type.name);
            const count = facets[type.name] ?? 0;
            const color = type.color || "#3b82f6";
            const icon = type.icon || "package";
            const isDisabled = count === 0 && !isChecked;

            return (
              <div
                key={type.id}
                onClick={() => handleToggle(type.name)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isChecked
                    ? "bg-zinc-850/60 border-zinc-700/80 text-zinc-100"
                    : "bg-zinc-950/20 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200"
                } ${isDisabled ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Custom checkbox box */}
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      isChecked
                        ? "bg-blue-600 border-blue-500 shadow-md shadow-blue-500/25"
                        : "bg-zinc-900 border-zinc-750"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Icon Indicator */}
                  <div
                    className="w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${color}10`,
                      color,
                    }}
                  >
                    <EntityIcon iconKey={icon} size={11} />
                  </div>

                  {/* Label */}
                  <span className="text-xs font-semibold truncate">
                    {type.label || type.name}
                  </span>
                </div>

                {/* Count Badge */}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono transition-colors shrink-0 ${
                    isChecked
                      ? "bg-zinc-800 text-zinc-300"
                      : count > 0
                      ? "bg-zinc-950/80 text-zinc-500"
                      : "bg-zinc-950/40 text-zinc-650"
                  }`}
                >
                  {count}
                </span>
              </div>
            );
          })
        )}
      </div>

    </aside>
  );
};
