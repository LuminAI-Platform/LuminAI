import React from "react";
import type { ColumnConfig } from "../DataPreviewTable";
import type { ColumnMappingConfig } from "./fileUploadTypes";
import { sanitizePropertyName } from "./fileUploadTypes";

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
        <select
          disabled={!col.active}
          value={col.type}
          onChange={(e) =>
            updateColumnType(col.name, e.target.value as ColumnConfig["type"])
          }
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 w-full outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {["String", "Integer", "Double", "Boolean", "Timestamp"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-3 flex gap-2 pr-4">
        <select
          disabled={!col.active}
          value={colMap.targetEntityType}
          onChange={(e) => {
            const newEntity = e.target.value;
            if (newEntity === "__CREATE_NEW__") {
              setIsCreatingCustomEntity(true);
              return;
            }
            updateMapping(col.name, "targetEntityType", newEntity);
          }}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 w-1/2 outline-none focus:border-blue-500 disabled:opacity-50"
        >
          {ontologyEntityTypes
            .filter((entity) => entity.toLowerCase() !== "csv")
            .map((entity) => (
              <option key={entity} value={entity}>
                {entity === inferredEntityName ? `${entity}` : entity}
              </option>
            ))}
          <option value="__CREATE_NEW__">+ New Entity...</option>
        </select>
        <select
          disabled={!col.active}
          value={colMap.targetProperty}
          onChange={(e) =>
            updateMapping(col.name, "targetProperty", e.target.value)
          }
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 w-1/2 outline-none focus:border-blue-500 disabled:opacity-50"
        >
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
            return opts.map((prop) => (
              <option key={prop} value={prop}>
                {prop}
              </option>
            ));
          })()}
        </select>
      </div>

      <div className="col-span-3">
        <select
          disabled={!col.active}
          value={colMap.transformation}
          onChange={(e) =>
            updateMapping(col.name, "transformation", e.target.value)
          }
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 w-full outline-none focus:border-blue-500 disabled:opacity-50"
        >
          {["NONE", "UPPERCASE", "LOWERCASE", "TRIM", "DATE_PARSE"].map(
            (tx) => (
              <option key={tx} value={tx}>
                {tx === "NONE" ? "None (Pass through)" : tx}
              </option>
            ),
          )}
        </select>
      </div>
    </div>
  );
};
