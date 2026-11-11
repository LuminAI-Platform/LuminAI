import React from "react";
import {
  type SourceColumn,
  type ForeignKeyDefinition,
} from "./visualSchemaTypes";

interface FkModalProps {
  activeCol: SourceColumn;
  targetEntity: string;
  foreignKeys: Record<string, ForeignKeyDefinition>;
  availableEntities: string[];
  availableRelationshipTypes: string[];
  isCustomEntity: boolean;
  setIsCustomEntity: (v: boolean) => void;
  fkTargetEntity: string;
  setFkTargetEntity: (v: string) => void;
  isCustomRel: boolean;
  setIsCustomRel: (v: boolean) => void;
  fkRelType: string;
  setFkRelType: (v: string) => void;
  fkDirection: "OUTGOING" | "INCOMING";
  setFkDirection: (v: "OUTGOING" | "INCOMING") => void;
  onClose: () => void;
  onSave: () => void;
  onRemove: (colId: string) => void;
}

export const FkModal: React.FC<FkModalProps> = ({
  activeCol,
  targetEntity,
  foreignKeys,
  availableEntities,
  availableRelationshipTypes,
  isCustomEntity,
  setIsCustomEntity,
  fkTargetEntity,
  setFkTargetEntity,
  isCustomRel,
  setIsCustomRel,
  fkRelType,
  setFkRelType,
  fkDirection,
  setFkDirection,
  onClose,
  onSave,
  onRemove,
}) => {
  return (
    <div
      id="fk-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="fk-modal-container"
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 w-full max-w-md shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100">
                Target Relationship Link (Foreign Key)
              </h3>
              <p className="text-[10px] text-zinc-400">
                Define cross-entity graph link for column{" "}
                <span className="font-mono text-purple-300 font-bold">
                  {activeCol.name}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Target Entity Type
            </label>
            <div className="space-y-1.5">
              <select
                id="fk-target-entity-select"
                value={isCustomEntity ? "CUSTOM" : fkTargetEntity}
                onChange={(e) => {
                  if (e.target.value === "CUSTOM") {
                    setIsCustomEntity(true);
                  } else {
                    setIsCustomEntity(false);
                    setFkTargetEntity(e.target.value);
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
              >
                {availableEntities.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent}
                  </option>
                ))}
                <option value="CUSTOM">+ Custom Entity Type...</option>
              </select>
              {isCustomEntity && (
                <input
                  id="fk-custom-entity-input"
                  type="text"
                  placeholder="e.g. Vendor, Merchant, Organization"
                  value={fkTargetEntity}
                  onChange={(e) => setFkTargetEntity(e.target.value)}
                  className="w-full bg-zinc-950 border border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Relationship Edge Type (Neo4j Cypher Label)
            </label>
            <div className="space-y-1.5">
              <select
                id="fk-relation-type-select"
                value={isCustomRel ? "CUSTOM" : fkRelType}
                onChange={(e) => {
                  if (e.target.value === "CUSTOM") {
                    setIsCustomRel(true);
                  } else {
                    setIsCustomRel(false);
                    setFkRelType(e.target.value);
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500"
              >
                {availableRelationshipTypes.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
                <option value="CUSTOM">+ Custom Relationship...</option>
              </select>
              {isCustomRel && (
                <input
                  id="fk-custom-relation-input"
                  type="text"
                  placeholder="e.g. PURCHASED_BY, ISSUED_TO"
                  value={fkRelType}
                  onChange={(e) =>
                    setFkRelType(
                      e.target.value.toUpperCase().replace(/\s+/g, "_"),
                    )
                  }
                  className="w-full bg-zinc-950 border border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono uppercase focus:outline-none focus:border-purple-500"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Graph Traversal Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="fk-direction-outgoing"
                onClick={() => setFkDirection("OUTGOING")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                  fkDirection === "OUTGOING"
                    ? "bg-purple-600/30 border-purple-500 text-purple-200 shadow-xs"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                Outgoing ({targetEntity} → {fkTargetEntity})
              </button>
              <button
                type="button"
                id="fk-direction-incoming"
                onClick={() => setFkDirection("INCOMING")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                  fkDirection === "INCOMING"
                    ? "bg-purple-600/30 border-purple-500 text-purple-200 shadow-xs"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                Incoming ({fkTargetEntity} → {targetEntity})
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          {foreignKeys[activeCol.id] ? (
            <button
              type="button"
              id="fk-modal-remove-btn"
              onClick={() => onRemove(activeCol.id)}
              className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
            >
              Remove Link
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="fk-modal-apply-btn"
              onClick={onSave}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 cursor-pointer transition-all"
            >
              Apply Relationship Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
