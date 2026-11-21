import React from "react";
import type { EntityType } from "../../types";
import { EntityIcon, ENTITY_ICON_KEYS, ENTITY_ICON_LABELS } from "./EntityIcon";

interface EntityEditorHeaderProps {
  form: EntityType;
  iconPickerOpen: boolean;
  onToggleIconPicker: () => void;
  onSelectIcon: (iconKey: string) => void;
  onClose: () => void;
}

export const EntityEditorHeader: React.FC<EntityEditorHeaderProps> = ({
  form,
  iconPickerOpen,
  onToggleIconPicker,
  onSelectIcon,
  onClose,
}) => {
  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0 select-none bg-zinc-950/60">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center border-2 shrink-0 cursor-pointer select-none transition-all hover:scale-105"
            style={{
              backgroundColor: `${form.color}20`,
              borderColor: `${form.color}40`,
              color: form.color,
            }}
            onClick={onToggleIconPicker}
            title="Change icon"
          >
            <EntityIcon iconKey={form.icon} size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {form.id ? "Edit Entity Type" : "New Entity Type"}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {form.name || "Define a new node class for the knowledge graph"}
            </p>
          </div>
        </div>
        <button
          type="button"
          id="entity-editor-close-btn"
          aria-label="Close"
          onClick={onClose}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {iconPickerOpen && (
        <div className="absolute z-60 mt-14 ml-6 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl flex flex-wrap gap-2 w-56">
          {ENTITY_ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={ENTITY_ICON_LABELS[key]}
              onClick={() => onSelectIcon(key)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-all cursor-pointer ${
                form.icon === key
                  ? "bg-zinc-800 ring-1 ring-blue-500 text-blue-400"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <EntityIcon iconKey={key} size={15} />
            </button>
          ))}
        </div>
      )}
    </>
  );
};
