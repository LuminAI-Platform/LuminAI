import React from "react";
import {
  type PropertySchema,
  type PropertyType,
  PROPERTY_TYPES,
  getTypeColor,
} from "./propertySchemaTypes";
import { Select } from "../../../../components/ui/dropdown";

interface PropertySchemaRowProps {
  prop: PropertySchema;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<PropertySchema>) => void;
  onRemove: () => void;
}

export const PropertySchemaRow: React.FC<PropertySchemaRowProps> = ({
  prop,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}) => {
  const color = getTypeColor(prop.type);

  return (
    <div className="border border-zinc-800/80 rounded-lg overflow-hidden bg-zinc-950/50">
      {/* Row header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-900/40 transition-all select-none"
        onClick={onToggleExpand}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-700 shrink-0"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0"
          style={{
            color,
            borderColor: `${color}30`,
            backgroundColor: `${color}12`,
          }}
        >
          {prop.type}
        </span>
        <span className="text-xs font-semibold text-zinc-200 flex-1 font-mono truncate">
          {prop.name || (
            <span className="text-zinc-600 font-normal italic">
              Unnamed property
            </span>
          )}
        </span>
        {prop.required && (
          <span className="text-[9px] font-bold text-error bg-error-bg border border-error-border px-1.5 py-0.5 rounded shrink-0">
            REQUIRED
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`text-zinc-600 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded fields */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/60 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`prop-name-${prop.id}`}
                className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
              >
                Property Name *
              </label>
              <input
                id={`prop-name-${prop.id}`}
                type="text"
                value={prop.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g. firstName"
                className="px-2.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 font-mono placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`prop-type-${prop.id}`}
                className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
              >
                Data Type *
              </label>
              <Select
                id={`prop-type-${prop.id}`}
                value={prop.type}
                onChange={(val) => onUpdate({ type: val as PropertyType })}
                options={PROPERTY_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
                ariaLabel="Data Type"
                size="sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`prop-default-${prop.id}`}
                className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
              >
                Default Value
              </label>
              <input
                id={`prop-default-${prop.id}`}
                type="text"
                value={prop.defaultValue}
                onChange={(e) => onUpdate({ defaultValue: e.target.value })}
                placeholder="Optional default..."
                className="px-2.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 font-mono placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`prop-required-${prop.id}`}
                className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
              >
                Required
              </label>
              <div className="flex items-center gap-3 h-8.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={prop.required}
                  id={`prop-required-${prop.id}`}
                  onClick={() => onUpdate({ required: !prop.required })}
                  className={`relative w-10 h-5 rounded-full transition-all duration-200 cursor-pointer border ${prop.required ? "bg-primary border-primary" : "bg-surface-muted border-border"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${prop.required ? "left-5" : "left-0.5"}`}
                  />
                </button>
                <span
                  className={`text-xs font-medium ${prop.required ? "text-primary" : "text-text-secondary"}`}
                >
                  {prop.required ? "Required" : "Optional"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`prop-desc-${prop.id}`}
              className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider"
            >
              Description
            </label>
            <input
              id={`prop-desc-${prop.id}`}
              type="text"
              value={prop.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Describe what this property stores..."
              className="px-2.5 py-2 bg-surface border border-border rounded-lg text-xs text-text outline-none focus:border-border-focus placeholder:text-text-secondary transition-colors"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              id={`prop-delete-${prop.id}`}
              onClick={onRemove}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-error px-2.5 py-1.5 rounded-lg hover:bg-error-bg border border-transparent hover:border-error-border transition-all cursor-pointer"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Remove Property
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
