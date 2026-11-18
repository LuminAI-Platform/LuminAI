import React from "react";
import type { ColumnConfig } from "../DataPreviewTable";
import type { ColumnMappingConfig } from "./fileUploadTypes";
import { sanitizePropertyName } from "./fileUploadTypes";
import { Select } from "../../../../components/ui/dropdown";

const COLUMN_TYPES: { value: string; label: string }[] = [
  { value: "String", label: "String" },
  { value: "Integer", label: "Integer" },
  { value: "Double", label: "Double" },
  { value: "Boolean", label: "Boolean" },
  { value: "Timestamp", label: "Timestamp" },
];

const TRANSFORMATION_OPTIONS = [
  { value: "NONE", label: "None (Pass through)" },
  { value: "UPPERCASE", label: "UPPERCASE" },
  { value: "LOWERCASE", label: "LOWERCASE" },
  { value: "TRIM", label: "TRIM" },
  { value: "DATE_PARSE", label: "DATE_PARSE" },
];

interface StepMappingRowProps {
  col: ColumnConfig;
  colMap: ColumnMappingConfig;
  inferredEntityName: string;
  ontologyEntityTypes: string[];
  ontologyProperties: Record<string, string[]>;
  setIsCreatingCustomEntity: (v: boolean) => void;
  toggleColumn: (colName: string) => void;
  updateColumnType: (colName: string, type: ColumnConfig["type"]) => void;
  updateMapping: (
    colName: string,
    key: "targetEntityType" | "targetProperty" | "transformation",
    value: string,
  ) => void;
}

export const StepMappingRow: React.FC<StepMappingRowProps> = ({
  col,
  colMap,
  inferredEntityName,
  ontologyEntityTypes,
  ontologyProperties,
  setIsCreatingCustomEntity,
  toggleColumn,
  updateColumnType,
  updateMapping,
}) => {
  return (
    <div
      className={`grid grid-cols-12 px-3 py-2 items-center text-xs transition-colors ${
        col.active ? "hover:bg-zinc-900/20" : "bg-zinc-900/10 opacity-60"
      }`}
    >
      <div className="col-span-1 flex justify-center">
        <input
          type="checkbox"
          checked={col.active}
          onChange={() => toggleColumn(col.name)}
          className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-blue-500 focus:ring-blue-500 cursor-pointer"
        />
      </div>

      <div className="col-span-3 font-mono font-semibold text-zinc-200 truncate pr-4">
        {col.name}
      </div>

      <div className="col-span-2 pr-4">
        <Select
          disabled={!col.active}
          value={col.type}
          onChange={(val) =>
            updateColumnType(col.name, val as ColumnConfig["type"])
          }
          options={COLUMN_TYPES}
          ariaLabel={`Type for ${col.name}`}
          size="sm"
        />
      </div>

      <div className="col-span-3 flex gap-2 pr-4">
        <div className="w-1/2">
          <Select
            disabled={!col.active}
            value={colMap.targetEntityType}
            onChange={(newEntity) => {
              if (newEntity === "__CREATE_NEW__") {
                setIsCreatingCustomEntity(true);
                return;
              }
              updateMapping(col.name, "targetEntityType", newEntity);
            }}
            options={[
              ...ontologyEntityTypes
                .filter((entity) => entity.toLowerCase() !== "csv")
                .map((entity) => ({
                  value: entity,
                  label: entity === inferredEntityName ? `${entity}` : entity,
                })),
              { value: "__CREATE_NEW__", label: "+ New Entity…" },
            ]}
            ariaLabel={`Target entity for ${col.name}`}
            size="sm"
          />
        </div>
        <div className="w-1/2">
          {(() => {
            const cleanProp = sanitizePropertyName(col.name);
            const available = ontologyProperties[colMap.targetEntityType] || [];
            const opts = available.length > 0 ? [...available] : [cleanProp];
            if (
              colMap.targetProperty &&
              !opts.includes(colMap.targetProperty)
            ) {
              opts.unshift(colMap.targetProperty);
            }
            return (
              <Select
                disabled={!col.active}
                value={colMap.targetProperty}
                onChange={(prop) =>
                  updateMapping(col.name, "targetProperty", prop)
                }
                options={opts.map((p) => ({ value: p, label: p }))}
                ariaLabel={`Target property for ${col.name}`}
                size="sm"
              />
            );
          })()}
        </div>
      </div>

      <div className="col-span-3">
        <Select
          disabled={!col.active}
          value={colMap.transformation}
          onChange={(tx) => updateMapping(col.name, "transformation", tx)}
          options={TRANSFORMATION_OPTIONS}
          ariaLabel={`Transformation for ${col.name}`}
          size="sm"
        />
      </div>
    </div>
  );
};
