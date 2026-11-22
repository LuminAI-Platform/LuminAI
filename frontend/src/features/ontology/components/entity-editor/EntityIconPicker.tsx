import React from "react";
import {
  EntityIcon,
  ENTITY_ICON_KEYS,
  ENTITY_ICON_LABELS,
} from "./EntityIcon";

interface EntityIconPickerProps {
  currentIcon: string;
  onSelectIcon: (key: string) => void;
}

export const EntityIconPicker: React.FC<EntityIconPickerProps> = ({
  currentIcon,
  onSelectIcon,
}) => {
  return (
    <div className="absolute z-60 mt-14 ml-6 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl flex flex-wrap gap-2 w-56">
      {ENTITY_ICON_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          title={ENTITY_ICON_LABELS[key]}
          onClick={() => onSelectIcon(key)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-all cursor-pointer ${
            currentIcon === key
              ? "bg-zinc-800 ring-1 ring-blue-500 text-blue-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <EntityIcon iconKey={key} size={15} />
        </button>
      ))}
    </div>
  );
};
