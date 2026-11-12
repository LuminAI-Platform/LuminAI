import React from "react";
import {
  type SourceColumn,
  type OntologyProperty,
  type ForeignKeyDefinition,
  DATA_TYPE_COLORS,
} from "./visualSchemaTypes";

interface SourcePanelProps {
  sourceColumns: SourceColumn[];
  ontologyProperties: OntologyProperty[];
  foreignKeys: Record<string, ForeignKeyDefinition>;
  draggingColId: string | null;
  sourceRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onDragStart: (colId: string) => void;
  onDragEnd: () => void;
  openFkModal: (col: SourceColumn) => void;
  removeMapping: (colId: string) => void;
  getMappedPropId: (colId: string) => string | undefined;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  sourceColumns,
  ontologyProperties,
  foreignKeys,
  draggingColId,
  sourceRefs,
  onDragStart,
  onDragEnd,
  openFkModal,
  removeMapping,
  getMappedPropId,
}) => {
  return (
    <div className="w-1/2 flex flex-col border-r border-zinc-800/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs font-semibold text-zinc-200">
            Source Columns & Graph Links
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Drag to map ontology property, or define foreign key relationship
            link
          </p>
        </div>
        <span className="text-[10px] text-zinc-600 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
          {sourceColumns.length} cols
        </span>
      </div>
      <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
        {sourceColumns.map((col) => {
          const mappedPropId = getMappedPropId(col.id);
          const mappedProp = ontologyProperties.find(
            (p) => p.id === mappedPropId,
          );
          const isDragging = draggingColId === col.id;
          const isMapped = !!mappedPropId;
          const fk = foreignKeys[col.id];

          return (
            <div
              key={col.id}
              id={`source-col-${col.id}`}
              ref={(el) => {
                sourceRefs.current[col.id] = el;
              }}
              draggable
              onDragStart={() => onDragStart(col.id)}
              onDragEnd={onDragEnd}
              className={`group relative flex items-center gap-3 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                isDragging
                  ? "border-blue-500/60 bg-blue-500/10 scale-[0.98] opacity-70"
                  : isMapped
                    ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-900/60"
              }`}
            >
              <div className="text-zinc-700 group-hover:text-zinc-500 transition-colors flex-shrink-0">
                <svg
                  width="10"
                  height="14"
                  viewBox="0 0 10 14"
                  fill="currentColor"
                >
                  <circle cx="2.5" cy="2.5" r="1.2" />
                  <circle cx="7.5" cy="2.5" r="1.2" />
                  <circle cx="2.5" cy="7" r="1.2" />
                  <circle cx="7.5" cy="7" r="1.2" />
                  <circle cx="2.5" cy="11.5" r="1.2" />
                  <circle cx="7.5" cy="11.5" r="1.2" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-zinc-100 font-mono truncate">
                    {col.name}
                  </span>
                  {col.nullable && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 bg-zinc-900 font-medium flex-shrink-0">
                      nullable
                    </span>
                  )}
                </div>
                {col.sample && (
                  <p className="text-[10px] text-zinc-500 font-mono truncate">
                    e.g. {col.sample}
                  </p>
                )}
              </div>

              <div className="flex-shrink-0">
                {fk ? (
                  <button
                    type="button"
                    id={`fk-badge-${col.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openFkModal(col);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[9px] font-mono transition-all cursor-pointer shadow-xs"
                    title={`Foreign key links to ${fk.targetEntityType} via ${fk.relationshipType}`}
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span>
                      {fk.relationshipType} → {fk.targetEntityType}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    id={`fk-link-btn-${col.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openFkModal(col);
                    }}
                    className="opacity-60 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/60 hover:border-purple-500/40 hover:bg-purple-500/10 text-zinc-500 hover:text-purple-300 text-[9px] transition-all cursor-pointer"
                    title="Add Graph Link / Foreign Key relationship"
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span>+ FK</span>
                  </button>
                )}
              </div>

              <span
                className={`text-[9px] font-semibold px-2 py-0.5 rounded border flex-shrink-0 ${
                  DATA_TYPE_COLORS[col.dataType] ??
                  "text-zinc-400 bg-zinc-900 border-zinc-800"
                }`}
              >
                {col.dataType}
              </span>

              {isMapped && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[9px] text-blue-400 font-mono truncate max-w-[80px]">
                    {mappedProp?.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMapping(col.id);
                    }}
                    className="p-0.5 hover:text-red-400 text-zinc-600 transition-colors cursor-pointer"
                    title="Remove mapping"
                  >
                    <svg
                      width="10"
                      height="10"
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
              )}

              <div
                className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all ${
                  isMapped
                    ? "bg-blue-500 border-blue-400"
                    : "bg-zinc-800 border-zinc-700 group-hover:border-blue-500/60"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
