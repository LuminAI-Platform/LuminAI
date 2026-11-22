import React from "react";
import { EntityIcon } from "./EntityTypeEditor";

interface TargetEntityModelFormProps {
  entityName: string;
  setEntityName: (name: string) => void;
  entityLabel: string;
  setEntityLabel: (label: string) => void;
  entityColor: string;
  setEntityColor: (color: string) => void;
  entityIcon: string;
  setEntityIcon: (icon: string) => void;
}

const PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

const ICONS = [
  "database",
  "building",
  "user",
  "package",
  "chart",
  "globe",
];

export const TargetEntityModelForm: React.FC<TargetEntityModelFormProps> = ({
  entityName,
  setEntityName,
  entityLabel,
  setEntityLabel,
  entityColor,
  setEntityColor,
  entityIcon,
  setEntityIcon,
}) => {
  return (
    <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col gap-3">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        2. Target Entity Model Definition
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">
            Entity Identifier (PascalCase)
          </label>
          <input
            type="text"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
            placeholder="e.g. CustomerRecord"
          />
        </div>
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">
            Display Label
          </label>
          <input
            type="text"
            value={entityLabel}
            onChange={(e) => setEntityLabel(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
            placeholder="e.g. Customer Record"
          />
        </div>
      </div>
      <div className="flex items-center gap-6 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Color:</span>
          <div className="flex items-center gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEntityColor(c)}
                className={`w-5 h-5 rounded-md border transition-all cursor-pointer ${
                  entityColor === c
                    ? "scale-115 ring-2 ring-white border-transparent"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Icon:</span>
          <div className="flex items-center gap-1.5">
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setEntityIcon(ic)}
                className={`px-2 py-1 text-[10px] rounded-md border flex items-center gap-1 transition-all cursor-pointer ${
                  entityIcon === ic
                    ? "bg-zinc-800 border-blue-500 text-blue-400 font-semibold"
                    : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <EntityIcon iconKey={ic} size={12} />
                <span className="capitalize">{ic}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
