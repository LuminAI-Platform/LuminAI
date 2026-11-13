import React from "react";
import { type SourceColumn, type OntologyProperty } from "./visualSchemaTypes";

interface TargetPanelProps {
  targetEntity: string;
  ontologyProperties: OntologyProperty[];
  sourceColumns: SourceColumn[];
  hoverPropId: string | null;
  draggingColId: string | null;
  propRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  setHoverPropId: (id: string | null) => void;
  onDropOnProp: (id: string) => void;
  getMappedColId: (propId: string) => string | undefined;
}

export const TargetPanel: React.FC<TargetPanelProps> = ({
  targetEntity,
  ontologyProperties,
  sourceColumns,
  hoverPropId,
  draggingColId,
  propRefs,
  setHoverPropId,
  onDropOnProp,
  getMappedColId,
}) => {
  return (
    <div className="w-1/2 flex flex-col overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs font-semibold text-zinc-200">
            Ontology Properties
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Drop a source column onto a property to map it
          </p>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
          {targetEntity}
        </span>
      </div>
      <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
        {ontologyProperties.map((prop) => {
          const mappedColId = getMappedColId(prop.id);
          const mappedCol = sourceColumns.find((c) => c.id === mappedColId);
          const isHovered = hoverPropId === prop.id;
          const isMapped = !!mappedColId;
          const isDropTarget = !!draggingColId;

          return (
            <div
              key={prop.id}
              id={`ontology-prop-${prop.id}`}
              ref={(el) => {
                propRefs.current[prop.id] = el;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverPropId(prop.id);
              }}
              onDragLeave={() => setHoverPropId(null)}
              onDrop={() => onDropOnProp(prop.id)}
              className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all ${
                isHovered && isDropTarget
                  ? "border-primary bg-primary-tint scale-[1.01] shadow-xs"
                  : isMapped
                    ? "border-primary-border bg-primary-tint/50"
                    : isDropTarget
                      ? "border-border bg-surface-subtle border-dashed"
                      : "border-border bg-surface-subtle"
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all ${
                  isMapped
                    ? "bg-primary border-primary"
                    : isHovered
                      ? "bg-primary-tint border-primary"
                      : "bg-surface-muted border-border"
                }`}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-text font-mono truncate">
                    {prop.name}
                  </span>
                  {prop.required && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-error-border text-error bg-error-bg font-medium flex-shrink-0">
                      required
                    </span>
                  )}
                </div>
                {prop.description && (
                  <p className="text-[10px] text-text-secondary truncate">
                    {prop.description}
                  </p>
                )}
              </div>

              <span className="text-[9px] text-text-secondary font-mono flex-shrink-0">
                {prop.expectedType}
              </span>

              {isMapped ? (
                <span className="text-[9px] font-mono text-primary px-2 py-0.5 rounded border border-primary-border bg-primary-tint flex-shrink-0 truncate max-w-[90px]">
                  ← {mappedCol?.name}
                </span>
              ) : isDropTarget ? (
                <span className="text-[9px] text-text-secondary flex-shrink-0 animate-pulse">
                  drop here
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
