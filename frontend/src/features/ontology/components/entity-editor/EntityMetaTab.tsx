import React, { useState } from "react";
import type { EntityType } from "../../types";
import { ENTITY_COLORS } from "../../constants";
import { EntityIcon } from "./EntityIcon";

interface EntityMetaTabProps {
  form: EntityType;
  set: (k: keyof EntityType, v: unknown) => void;
}

export const EntityMetaTab: React.FC<EntityMetaTabProps> = ({ form, set }) => {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Name + Label */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="entity-name"
            className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
          >
            Internal Name *
          </label>
          <input
            id="entity-name"
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value.replace(/\s+/g, ""))}
            placeholder="CustomerProfile"
            className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 font-mono placeholder:text-zinc-600 transition-colors"
          />
          <span className="text-[10px] text-zinc-600">
            PascalCase, no spaces
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="entity-label"
            className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
          >
            Display Label *
          </label>
          <input
            id="entity-label"
            type="text"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Customer Profile"
            className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="entity-desc"
          className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Description
        </label>
        <textarea
          id="entity-desc"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="Describe what this entity type represents in the domain model..."
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors resize-none"
        />
      </div>

      {/* Color picker */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Node Color
        </label>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {ENTITY_COLORS.map((c: string) => (
              <button
                key={c}
                type="button"
                id={`entity-color-${c.replace("#", "")}`}
                onClick={() => set("color", c)}
                className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${
                  form.color === c
                    ? "border-white scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div
            className="w-7 h-7 rounded-full border-2 cursor-pointer transition-all"
            style={{ backgroundColor: form.color, borderColor: form.color }}
            title="Custom color"
            onClick={() => setColorPickerOpen(!colorPickerOpen)}
          />
          {colorPickerOpen && (
            <input
              type="color"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
          )}
        </div>
      </div>

      {/* Preview badge */}
      <div className="flex flex-col gap-2 mt-2">
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Preview
        </label>
        <div
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 self-start"
          style={{
            backgroundColor: `${form.color}15`,
            borderColor: `${form.color}35`,
          }}
        >
          <span style={{ color: form.color }}>
            <EntityIcon iconKey={form.icon} size={16} />
          </span>
          <span className="text-sm font-semibold" style={{ color: form.color }}>
            {form.label || form.name || "Entity Label"}
          </span>
          {form.properties.length > 0 && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ color: form.color, backgroundColor: `${form.color}20` }}
            >
              {form.properties.length} props
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
