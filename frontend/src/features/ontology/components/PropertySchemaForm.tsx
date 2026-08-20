import React, { useState } from "react";

export type PropertyType =
  | "STRING"
  | "INTEGER"
  | "FLOAT"
  | "BOOLEAN"
  | "DATE"
  | "DATETIME"
  | "ARRAY"
  | "OBJECT";

export interface PropertySchema {
  id: string;
  name: string;
  type: PropertyType;
  required: boolean;
  defaultValue: string;
  description: string;
}

interface PropertySchemaFormProps {
  properties: PropertySchema[];
  onChange: (properties: PropertySchema[]) => void;
}

const PROPERTY_TYPES: { value: PropertyType; label: string; color: string }[] =
  [
    { value: "STRING", label: "String", color: "#60a5fa" },
    { value: "INTEGER", label: "Integer", color: "#a78bfa" },
    { value: "FLOAT", label: "Float", color: "#c084fc" },
    { value: "BOOLEAN", label: "Boolean", color: "#34d399" },
    { value: "DATE", label: "Date", color: "#fb923c" },
    { value: "DATETIME", label: "DateTime", color: "#f97316" },
    { value: "ARRAY", label: "Array", color: "#facc15" },
    { value: "OBJECT", label: "Object", color: "#94a3b8" },
  ];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function emptyProperty(): PropertySchema {
  return {
    id: generateId(),
    name: "",
    type: "STRING",
    required: false,
    defaultValue: "",
    description: "",
  };
}

export const PropertySchemaForm: React.FC<PropertySchemaFormProps> = ({
  properties,
  onChange,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addProperty = () => {
    const p = emptyProperty();
    onChange([...properties, p]);
    setExpandedId(p.id);
  };

  const update = (id: string, updates: Partial<PropertySchema>) =>
    onChange(properties.map((p) => (p.id === id ? { ...p, ...updates } : p)));

  const remove = (id: string) => {
    onChange(properties.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const getColor = (type: PropertyType) =>
    PROPERTY_TYPES.find((t) => t.value === type)?.color ?? "#94a3b8";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">
          Properties
        </span>
        <button
          type="button"
          id="add-property-btn"
          onClick={addProperty}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 transition-all cursor-pointer border border-transparent hover:border-blue-500/20"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Property
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 border border-dashed border-zinc-800 rounded-xl text-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-zinc-600 mb-2"
          >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <span className="text-xs text-zinc-500 font-medium">
            No properties defined
          </span>
          <span className="text-[10px] text-zinc-600 mt-0.5">
            Click "Add Property" to define schema fields
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {properties.map((prop) => {
            const expanded = expandedId === prop.id;
            const color = getColor(prop.type);
            return (
              <div
                key={prop.id}
                className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/50"
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-900/40 transition-all select-none"
                  onClick={() => setExpandedId(expanded ? null : prop.id)}
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
                    <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded shrink-0">
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
                    className={`text-zinc-600 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {expanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-zinc-800/60 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Property Name *
                        </label>
                        <input
                          id={`prop-name-${prop.id}`}
                          type="text"
                          value={prop.name}
                          onChange={(e) =>
                            update(prop.id, { name: e.target.value })
                          }
                          placeholder="e.g. firstName"
                          className="px-2.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 font-mono placeholder:text-zinc-600 transition-colors"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Data Type *
                        </label>
                        <select
                          id={`prop-type-${prop.id}`}
                          value={prop.type}
                          onChange={(e) =>
                            update(prop.id, {
                              type: e.target.value as PropertyType,
                            })
                          }
                          className="px-2.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 transition-colors cursor-pointer"
                        >
                          {PROPERTY_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Default Value
                        </label>
                        <input
                          id={`prop-default-${prop.id}`}
                          type="text"
                          value={prop.defaultValue}
                          onChange={(e) =>
                            update(prop.id, { defaultValue: e.target.value })
                          }
                          placeholder="Optional default..."
                          className="px-2.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 font-mono placeholder:text-zinc-600 transition-colors"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Required
                        </label>
                        <div className="flex items-center gap-3 h-8.5">
                          <button
                            type="button"
                            id={`prop-required-${prop.id}`}
                            onClick={() =>
                              update(prop.id, { required: !prop.required })
                            }
                            className={`relative w-10 h-5 rounded-full transition-all duration-200 cursor-pointer border ${prop.required ? "bg-blue-600 border-blue-500" : "bg-zinc-800 border-zinc-700"}`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${prop.required ? "left-5" : "left-0.5"}`}
                            />
                          </button>
                          <span
                            className={`text-xs font-medium ${prop.required ? "text-blue-400" : "text-zinc-500"}`}
                          >
                            {prop.required ? "Required" : "Optional"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Description
                      </label>
                      <input
                        id={`prop-desc-${prop.id}`}
                        type="text"
                        value={prop.description}
                        onChange={(e) =>
                          update(prop.id, { description: e.target.value })
                        }
                        placeholder="Describe what this property stores..."
                        className="px-2.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        id={`prop-delete-${prop.id}`}
                        onClick={() => remove(prop.id)}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
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
          })}
        </div>
      )}
    </div>
  );
};
