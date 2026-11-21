import React from "react";

interface OntologyStatsBarProps {
  entityCount: number;
  relationshipCount: number;
  propertyCount: number;
}

export const OntologyStatsBar: React.FC<OntologyStatsBarProps> = ({
  entityCount,
  relationshipCount,
  propertyCount,
}) => {
  const stats = [
    {
      label: "Entity Types",
      value: entityCount,
      color: "#3b82f6",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
        </svg>
      ),
    },
    {
      label: "Relationship Types",
      value: relationshipCount,
      color: "#a855f7",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ),
    },
    {
      label: "Total Properties",
      value: propertyCount,
      color: "#10b981",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-5 shrink-0">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${s.color}18`, color: s.color }}
          >
            {s.icon}
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-100 leading-none">
              {s.value}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
