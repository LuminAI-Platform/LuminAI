import React, { useState } from "react";
import {
  type PropertySchema,
  emptyProperty,
} from "./property-schema/propertySchemaTypes";
import { PropertySchemaRow } from "./property-schema/PropertySchemaRow";

export type {
  PropertyType,
  PropertySchema,
} from "./property-schema/propertySchemaTypes";

interface PropertySchemaFormProps {
  properties: PropertySchema[];
  onChange: (properties: PropertySchema[]) => void;
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
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover px-2.5 py-1.5 rounded-lg hover:bg-primary-tint transition-all cursor-pointer border border-transparent hover:border-primary-border"
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
        <div className="flex flex-col items-center justify-center py-8 border border-dashed border-zinc-800 rounded-lg text-center">
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
          {properties.map((prop) => (
            <PropertySchemaRow
              key={prop.id}
              prop={prop}
              isExpanded={expandedId === prop.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === prop.id ? null : prop.id)
              }
              onUpdate={(updates) => update(prop.id, updates)}
              onRemove={() => remove(prop.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
