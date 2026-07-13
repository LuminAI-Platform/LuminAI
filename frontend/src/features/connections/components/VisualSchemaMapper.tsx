import React, { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SourceColumn {
  id: string;
  name: string;
  dataType: "string" | "integer" | "float" | "boolean" | "timestamp" | "json";
  sample?: string;
  nullable?: boolean;
}

export interface OntologyProperty {
  id: string;
  name: string;
  entityClass: string;
  expectedType: string;
  required: boolean;
  description?: string;
}

export interface SchemaMapping {
  sourceColumnId: string;
  ontologyPropertyId: string;
  transform?: "direct" | "cast" | "normalize";
}

export interface SchemaMappingPayload {
  connectionId: string;
  sourceTable: string;
  targetEntity: string;
  mappings: SchemaMapping[];
  createdAt: string;
}

interface VisualSchemaMapperProps {
  connectionId?: string;
  sourceTable?: string;
  sourceColumns: SourceColumn[];
  ontologyProperties: OntologyProperty[];
  onSave?: (payload: SchemaMappingPayload) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATA_TYPE_COLORS: Record<string, string> = {
  string: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  integer: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  float: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  boolean: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  timestamp: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  json: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const VisualSchemaMapper: React.FC<VisualSchemaMapperProps> = ({
  connectionId = "conn_default",
  sourceTable = "raw_source",
  sourceColumns,
  ontologyProperties,
  onSave,
}) => {
  const [mappings, setMappings] = useState<SchemaMapping[]>([]);
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [hoverPropId, setHoverPropId] = useState<string | null>(null);
  const [savedPayload, setSavedPayload] = useState<SchemaMappingPayload | null>(
    null,
  );
  const [showPayload, setShowPayload] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Refs to measure card positions for SVG connector lines
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const propRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [connectorLines, setConnectorLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; id: string }[]
  >([]);

  const recalcLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const lines = mappings.map((m) => {
      const srcEl = sourceRefs.current[m.sourceColumnId];
      const propEl = propRefs.current[m.ontologyPropertyId];
      if (!srcEl || !propEl) return null;
      const srcRect = srcEl.getBoundingClientRect();
      const propRect = propEl.getBoundingClientRect();
      return {
        id: `${m.sourceColumnId}-${m.ontologyPropertyId}`,
        x1: srcRect.right - containerRect.left,
        y1: srcRect.top - containerRect.top + srcRect.height / 2,
        x2: propRect.left - containerRect.left,
        y2: propRect.top - containerRect.top + propRect.height / 2,
      };
    });
    setConnectorLines(lines.filter(Boolean) as typeof connectorLines);
  }, [mappings]);

  const [dragPreviewLine, setDragPreviewLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  useEffect(() => {
    if (!draggingColId || !hoverPropId || !containerRef.current) {
      setDragPreviewLine(null);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const srcEl = sourceRefs.current[draggingColId];
    const propEl = propRefs.current[hoverPropId];
    if (!srcEl || !propEl) {
      setDragPreviewLine(null);
      return;
    }
    const sRect = srcEl.getBoundingClientRect();
    const pRect = propEl.getBoundingClientRect();
    setDragPreviewLine({
      x1: sRect.right - containerRect.left,
      y1: sRect.top - containerRect.top + sRect.height / 2,
      x2: pRect.left - containerRect.left,
      y2: pRect.top - containerRect.top + pRect.height / 2,
    });
  }, [draggingColId, hoverPropId]);

  useEffect(() => {
    recalcLines();
    window.addEventListener("resize", recalcLines);
    return () => window.removeEventListener("resize", recalcLines);
  }, [recalcLines]);

  // ── Drag Handlers ──────────────────────────────────────────────────────────

  const onDragStart = (colId: string) => {
    setDraggingColId(colId);
  };

  const onDragEnd = () => {
    setDraggingColId(null);
    setHoverPropId(null);
  };

  const onDropOnProp = (propId: string) => {
    if (!draggingColId) return;
    setMappings((prev) => {
      // Remove any existing mapping for same source col or same prop target
      const filtered = prev.filter(
        (m) =>
          m.sourceColumnId !== draggingColId && m.ontologyPropertyId !== propId,
      );
      return [
        ...filtered,
        {
          sourceColumnId: draggingColId,
          ontologyPropertyId: propId,
          transform: "direct",
        },
      ];
    });
    setDraggingColId(null);
    setHoverPropId(null);
    // Give DOM time to update before recalculating
    setTimeout(recalcLines, 50);
  };

  const removeMapping = (sourceColumnId: string) => {
    setMappings((prev) =>
      prev.filter((m) => m.sourceColumnId !== sourceColumnId),
    );
    setTimeout(recalcLines, 50);
  };

  const getMappedPropId = (colId: string) =>
    mappings.find((m) => m.sourceColumnId === colId)?.ontologyPropertyId;

  const getMappedColId = (propId: string) =>
    mappings.find((m) => m.ontologyPropertyId === propId)?.sourceColumnId;

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const payload: SchemaMappingPayload = {
      connectionId,
      sourceTable,
      targetEntity: ontologyProperties[0]?.entityClass ?? "Entity",
      mappings,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("lumin_schema_mapping", JSON.stringify(payload));
    setSavedPayload(payload);
    setSaveSuccess(true);
    onSave?.(payload);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const unmappedCount = sourceColumns.length - mappings.length;
  const targetEntity = ontologyProperties[0]?.entityClass ?? "Entity";

  return (
    <div className="flex flex-col h-full gap-0 select-none">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Breadcrumb */}
          <span className="text-xs text-zinc-500 font-mono">{sourceTable}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-700"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-xs text-blue-400 font-mono">
            {targetEntity}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats pills */}
          <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
            {mappings.length} mapped
          </span>
          {unmappedCount > 0 && (
            <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full border bg-zinc-900 border-zinc-800 text-zinc-500">
              {unmappedCount} unmapped
            </span>
          )}
          <button
            id="schema-mapper-view-payload"
            onClick={() => setShowPayload((p) => !p)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-all cursor-pointer"
          >
            {showPayload ? "Hide" : "View"} Payload
          </button>
          <button
            id="schema-mapper-save"
            onClick={handleSave}
            disabled={mappings.length === 0}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              saveSuccess
                ? "bg-emerald-600 border border-emerald-500/40 text-white shadow-lg shadow-emerald-500/20"
                : mappings.length === 0
                  ? "bg-zinc-800/50 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 border border-blue-500/40 text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25"
            }`}
          >
            {saveSuccess ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Mapping
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Payload Preview ── */}
      {showPayload && savedPayload && (
        <div className="px-6 py-3 border-b border-zinc-800/80 bg-black/60 flex-shrink-0">
          <p className="text-[10px] text-zinc-500 mb-1.5 font-mono uppercase tracking-widest">
            API Payload Config
          </p>
          <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-32">
            {JSON.stringify(savedPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* ── Main Canvas ── */}
      <div ref={containerRef} className="flex flex-1 min-h-0 relative">
        {/* SVG connector lines layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: "visible" }}
        >
          <defs>
            <marker
              id="arrow-head"
              markerWidth="6"
              markerHeight="6"
              refX="3"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#3b82f6" opacity="0.7" />
            </marker>
          </defs>
          {connectorLines.map((line) => {
            const cx1 = line.x1 + (line.x2 - line.x1) * 0.4;
            const cx2 = line.x1 + (line.x2 - line.x1) * 0.6;
            return (
              <path
                key={line.id}
                d={`M ${line.x1} ${line.y1} C ${cx1} ${line.y1}, ${cx2} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeOpacity="0.6"
                strokeDasharray="none"
                markerEnd="url(#arrow-head)"
              />
            );
          })}
          {/* Drag preview line */}
          {dragPreviewLine && (
            <path
              d={`M ${dragPreviewLine.x1} ${dragPreviewLine.y1} C ${
                dragPreviewLine.x1 +
                (dragPreviewLine.x2 - dragPreviewLine.x1) * 0.4
              } ${dragPreviewLine.y1}, ${
                dragPreviewLine.x1 +
                (dragPreviewLine.x2 - dragPreviewLine.x1) * 0.6
              } ${dragPreviewLine.y2}, ${dragPreviewLine.x2} ${dragPreviewLine.y2}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeOpacity="0.9"
              strokeDasharray="5 3"
            />
          )}
        </svg>

        {/* ── Left Panel: Source Columns ── */}
        <div className="w-1/2 flex flex-col border-r border-zinc-800/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-xs font-semibold text-zinc-200">
                Source Columns
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Drag a row to connect it to an ontology property
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
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
                  {/* Drag handle */}
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

                  {/* Col info */}
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

                  {/* Type badge */}
                  <span
                    className={`text-[9px] font-semibold px-2 py-0.5 rounded border flex-shrink-0 ${DATA_TYPE_COLORS[col.dataType] ?? "text-zinc-400 bg-zinc-900 border-zinc-800"}`}
                  >
                    {col.dataType}
                  </span>

                  {/* Mapped indicator */}
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

                  {/* Right connector dot */}
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

        {/* ── Right Panel: Ontology Properties ── */}
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
                      ? "border-blue-500 bg-blue-500/15 scale-[1.01] shadow-lg shadow-blue-500/20"
                      : isMapped
                        ? "border-blue-500/30 bg-blue-500/5"
                        : isDropTarget
                          ? "border-zinc-700 bg-zinc-900/60 border-dashed"
                          : "border-zinc-800/80 bg-zinc-900/40"
                  }`}
                >
                  {/* Left connector dot */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all ${
                      isMapped
                        ? "bg-blue-500 border-blue-400"
                        : isHovered
                          ? "bg-blue-500/50 border-blue-500"
                          : "bg-zinc-800 border-zinc-700"
                    }`}
                  />

                  {/* Prop info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-zinc-100 font-mono truncate">
                        {prop.name}
                      </span>
                      {prop.required && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/10 font-medium flex-shrink-0">
                          required
                        </span>
                      )}
                    </div>
                    {prop.description && (
                      <p className="text-[10px] text-zinc-500 truncate">
                        {prop.description}
                      </p>
                    )}
                  </div>

                  {/* Expected type */}
                  <span className="text-[9px] text-zinc-500 font-mono flex-shrink-0">
                    {prop.expectedType}
                  </span>

                  {/* Mapped source indicator */}
                  {isMapped ? (
                    <span className="text-[9px] font-mono text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 flex-shrink-0 truncate max-w-[90px]">
                      ← {mappedCol?.name}
                    </span>
                  ) : isDropTarget ? (
                    <span className="text-[9px] text-zinc-600 flex-shrink-0 animate-pulse">
                      drop here
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer summary ── */}
      <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-zinc-500">
          <span>
            {mappings.length} of {sourceColumns.length} source columns mapped
          </span>
          <span>·</span>
          <span>
            {
              ontologyProperties.filter(
                (p) => p.required && !getMappedColId(p.id),
              ).length
            }{" "}
            required properties unfilled
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Drag from left panel, drop onto right panel
        </div>
      </div>
    </div>
  );
};
