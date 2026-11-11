import React from "react";
import type { ColumnConfig } from "../DataPreviewTable";
import type { ColumnMappingConfig } from "./fileUploadTypes";
import { sanitizePropertyName } from "./fileUploadTypes";
import { StepMappingRow } from "./StepMappingRow";

interface StepMappingProps {
  file: File | null;
  columnsConfig: ColumnConfig[];
  mappings: Record<string, ColumnMappingConfig>;
  ontologyEntityTypes: string[];
  primaryTargetEntity: string;
  inferredEntityName: string;
  isCreatingCustomEntity: boolean;
  customEntityInput: string;
  ontologyProperties: Record<string, string[]>;
  setIsCreatingCustomEntity: (v: boolean) => void;
  setCustomEntityInput: (v: string) => void;
  toggleColumn: (colName: string) => void;
  updateColumnType: (colName: string, type: ColumnConfig["type"]) => void;
  handlePrimaryEntityChange: (newEntity: string) => void;
  handleApplyCustomEntity: () => void;
  updateMapping: (
    colName: string,
    key: "targetEntityType" | "targetProperty" | "transformation",
    value: string,
  ) => void;
}

export const StepMapping: React.FC<StepMappingProps> = ({
  file,
  columnsConfig,
  mappings,
  ontologyEntityTypes,
  primaryTargetEntity,
  inferredEntityName,
  isCreatingCustomEntity,
  customEntityInput,
  ontologyProperties,
  setIsCreatingCustomEntity,
  setCustomEntityInput,
  toggleColumn,
  updateColumnType,
  handlePrimaryEntityChange,
  handleApplyCustomEntity,
  updateMapping,
}) => {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-lg flex items-center justify-between select-none">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">
            Map columns to Ontology Properties
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            LuminAI automatically inferred schema datatypes for all{" "}
            {columnsConfig.length} columns. Scroll the list below to configure
            all fields.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 font-medium">
            {columnsConfig.length} Columns Detected
          </div>
          <div className="text-xs px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400">
            File: {file?.name} ({Math.round((file?.size || 0) / 1024)} KB)
          </div>
        </div>
      </div>

      {/* Primary Target Entity Banner */}
      <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 font-bold">
            Ω
          </div>
          <div>
            <div className="font-semibold text-zinc-200 flex items-center gap-2">
              <span>Target Entity:</span>
              <span className="text-zinc-100 font-semibold text-sm">
                {primaryTargetEntity || inferredEntityName || "None"}
              </span>
              {inferredEntityName &&
                primaryTargetEntity === inferredEntityName && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium">
                    Auto-detected
                  </span>
                )}
            </div>
            <p className="text-[11px] text-zinc-500">
              All columns map to this Entity Type by default. You can switch
              target entity or fine-tune individual column properties below.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCreatingCustomEntity ? (
            <>
              <span className="text-zinc-400">Change Target:</span>
              <select
                value={primaryTargetEntity}
                onChange={(e) => handlePrimaryEntityChange(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-lg px-2.5 py-1.5 text-zinc-200 outline-none focus:border-blue-500 cursor-pointer font-medium"
              >
                {ontologyEntityTypes
                  .filter((e) => e.toLowerCase() !== "csv")
                  .map((entity) => (
                    <option key={entity} value={entity}>
                      {entity === inferredEntityName
                        ? `${entity} (Inferred from dataset)`
                        : entity}
                    </option>
                  ))}
                <option value="__CREATE_NEW__">
                  + Create New Entity Type...
                </option>
              </select>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New Entity Name (e.g. StudentSurvey)"
                value={customEntityInput}
                onChange={(e) => setCustomEntityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyCustomEntity();
                  if (e.key === "Escape") setIsCreatingCustomEntity(false);
                }}
                className="bg-zinc-900 border border-blue-500/60 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs outline-none focus:border-blue-400 w-56 font-mono"
                autoFocus
              />
              <button
                onClick={handleApplyCustomEntity}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setIsCreatingCustomEntity(false);
                  setCustomEntityInput("");
                }}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mappings Grid */}
      <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 shadow-inner flex flex-col min-h-0">
        <div className="overflow-x-auto min-w-0 flex-1 flex flex-col min-h-0">
          <div className="min-w-[760px] flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-12 bg-zinc-900/90 border-b border-zinc-800/80 px-3.5 py-2.5 text-xs font-semibold text-zinc-400 select-none sticky top-0 z-10 backdrop-blur-xs">
              <div className="col-span-1 text-center">Active</div>
              <div className="col-span-3">Source Column</div>
              <div className="col-span-2">Inferred Type</div>
              <div className="col-span-3">Target Entity Mapping</div>
              <div className="col-span-3">Transformation</div>
            </div>

            <div className="divide-y divide-zinc-900 flex-1 overflow-y-auto min-h-[220px]">
              {columnsConfig.map((col) => {
                const colMap = mappings[col.name] || {
                  targetEntityType: primaryTargetEntity || "Entity",
                  targetProperty: sanitizePropertyName(col.name),
                  transformation: "NONE",
                };
                return (
                  <StepMappingRow
                    key={col.name}
                    col={col}
                    colMap={colMap}
                    inferredEntityName={inferredEntityName}
                    ontologyEntityTypes={ontologyEntityTypes}
                    ontologyProperties={ontologyProperties}
                    setIsCreatingCustomEntity={setIsCreatingCustomEntity}
                    toggleColumn={toggleColumn}
                    updateColumnType={updateColumnType}
                    updateMapping={updateMapping}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/80 border-t border-zinc-800/80 px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400 select-none">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Showing{" "}
            <strong className="text-zinc-200">
              {columnsConfig.filter((c) => c.active).length}
            </strong>{" "}
            of <strong className="text-zinc-200">{columnsConfig.length}</strong>{" "}
            columns detected
          </span>
          <span className="text-zinc-400 text-xs flex items-center gap-1.5 font-medium">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            Scroll table to view all fields
          </span>
        </div>
      </div>
    </div>
  );
};
