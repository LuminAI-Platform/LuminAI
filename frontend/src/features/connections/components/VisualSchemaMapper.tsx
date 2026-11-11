import React from "react";
import {
  type SourceColumn,
  type OntologyProperty,
  type SchemaMapping,
  type ForeignKeyDefinition,
  type SchemaMappingPayload,
  DEFAULT_TARGET_ENTITIES,
  DEFAULT_RELATION_TYPES,
} from "./visual-schema/visualSchemaTypes";
import { useSchemaMapper } from "./visual-schema/useSchemaMapper";
import { SourcePanel } from "./visual-schema/SourcePanel";
import { TargetPanel } from "./visual-schema/TargetPanel";
import { FkModal } from "./visual-schema/FkModal";
import { PayloadPreview } from "./visual-schema/PayloadPreview";
import { MapperToolbar } from "./visual-schema/MapperToolbar";

export type {
  SourceColumn,
  OntologyProperty,
  SchemaMapping,
  ForeignKeyDefinition,
  SchemaMappingPayload,
};

interface VisualSchemaMapperProps {
  connectionId?: string;
  sourceTable?: string;
  sourceColumns: SourceColumn[];
  ontologyProperties: OntologyProperty[];
  availableEntities?: string[];
  availableRelationshipTypes?: string[];
  initialMappings?: SchemaMapping[];
  initialForeignKeys?: ForeignKeyDefinition[];
  onSave?: (payload: SchemaMappingPayload) => void;
}

export const VisualSchemaMapper: React.FC<VisualSchemaMapperProps> = ({
  connectionId = "conn_default",
  sourceTable = "raw_source",
  sourceColumns,
  ontologyProperties,
  availableEntities = DEFAULT_TARGET_ENTITIES,
  availableRelationshipTypes = DEFAULT_RELATION_TYPES,
  initialMappings = [],
  initialForeignKeys = [],
  onSave,
}) => {
  const {
    mappings,
    foreignKeys,
    activeFkColId,
    setActiveFkColId,
    fkTargetEntity,
    setFkTargetEntity,
    fkRelType,
    setFkRelType,
    fkDirection,
    setFkDirection,
    isCustomEntity,
    setIsCustomEntity,
    isCustomRel,
    setIsCustomRel,
    draggingColId,
    hoverPropId,
    setHoverPropId,
    showPayload,
    setShowPayload,
    saveSuccess,
    saveError,
    sourceRefs,
    propRefs,
    containerRef,
    connectorLines,
    dragPreviewLine,
    onDragStart,
    onDragEnd,
    onDropOnProp,
    removeMapping,
    getMappedPropId,
    getMappedColId,
    openFkModal,
    saveFkModal,
    removeFk,
    handleSave,
    currentPayload,
    targetEntity,
  } = useSchemaMapper({
    connectionId,
    sourceTable,
    sourceColumns,
    ontologyProperties,
    availableEntities,
    availableRelationshipTypes,
    initialMappings,
    initialForeignKeys,
    onSave,
  });

  const unmappedCount = sourceColumns.length - mappings.length;
  const fkCount = Object.keys(foreignKeys).length;
  const activeCol = sourceColumns.find((c) => c.id === activeFkColId);

  return (
    <div className="flex flex-col h-full gap-0 select-none">
      <MapperToolbar
        sourceTable={sourceTable}
        targetEntity={targetEntity}
        mappingsCount={mappings.length}
        fkCount={fkCount}
        unmappedCount={unmappedCount}
        showPayload={showPayload}
        saveSuccess={saveSuccess}
        saveError={saveError}
        onTogglePayload={() => setShowPayload((p) => !p)}
        onSave={handleSave}
      />

      {showPayload && (
        <PayloadPreview
          currentPayload={currentPayload}
          mappedCount={mappings.length}
          fkCount={fkCount}
        />
      )}

      {/* ── Main Canvas ── */}
      <div ref={containerRef} className="flex flex-1 min-h-0 relative">
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
                markerEnd="url(#arrow-head)"
              />
            );
          })}
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

        <SourcePanel
          sourceColumns={sourceColumns}
          ontologyProperties={ontologyProperties}
          foreignKeys={foreignKeys}
          draggingColId={draggingColId}
          sourceRefs={sourceRefs}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          openFkModal={openFkModal}
          removeMapping={removeMapping}
          getMappedPropId={getMappedPropId}
        />

        <TargetPanel
          targetEntity={targetEntity}
          ontologyProperties={ontologyProperties}
          sourceColumns={sourceColumns}
          hoverPropId={hoverPropId}
          draggingColId={draggingColId}
          propRefs={propRefs}
          setHoverPropId={setHoverPropId}
          onDropOnProp={onDropOnProp}
          getMappedColId={getMappedColId}
        />
      </div>

      {activeFkColId && activeCol && (
        <FkModal
          activeCol={activeCol}
          targetEntity={targetEntity}
          foreignKeys={foreignKeys}
          availableEntities={availableEntities}
          availableRelationshipTypes={availableRelationshipTypes}
          isCustomEntity={isCustomEntity}
          setIsCustomEntity={setIsCustomEntity}
          fkTargetEntity={fkTargetEntity}
          setFkTargetEntity={setFkTargetEntity}
          isCustomRel={isCustomRel}
          setIsCustomRel={setIsCustomRel}
          fkRelType={fkRelType}
          setFkRelType={setFkRelType}
          fkDirection={fkDirection}
          setFkDirection={setFkDirection}
          onClose={() => setActiveFkColId(null)}
          onSave={saveFkModal}
          onRemove={removeFk}
        />
      )}

      {/* ── Footer summary ── */}
      <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-zinc-500">
          <span>
            {mappings.length} of {sourceColumns.length} source columns mapped
          </span>
          <span>·</span>
          <span className="text-purple-400">
            {fkCount} graph relationships defined
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
          Drag to map properties · Click + FK to define cross-entity links
        </div>
      </div>
    </div>
  );
};
