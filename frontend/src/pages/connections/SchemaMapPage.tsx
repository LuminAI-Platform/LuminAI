import React from "react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { VisualSchemaMapper } from "../../features/connections/components/VisualSchemaMapper";
import { EntityTypeEditor } from "../../features/ontology/components/EntityTypeEditor";
import { useSchemaMapState } from "./schema-map/useSchemaMapState";
import { TemplatePicker } from "./schema-map/TemplatePicker";
import { SchemaMapRibbon } from "./schema-map/SchemaMapRibbon";
import {
  History,
  Layers,
  FolderDown,
  Database,
  AlertCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const SchemaMapPage: React.FC = () => {
  const {
    sources,
    sourceLabels,
    selectedSource,
    setSelectedSource,
    setSelectedOntology,
    savedMappings,
    showHistory,
    setShowHistory,
    dynamicOntologyMap,
    dynamicOntologyLabels,
    loadingOntology,
    isEntityEditorOpen,
    setIsEntityEditorOpen,
    isSeedModalOpen,
    setIsSeedModalOpen,
    generatingFromDataset,
    seedingDomain,
    sourceData,
    activeOntologyKey,
    ontologyProps,
    initialMapperLinks,
    handleSave,
    handleAutoGenerateFromDataset,
    handleSeedDomainTemplate,
    fetchOntologyTypes,
  } = useSchemaMapState();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top Header Bar ── */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0">
        <PageHeader
          breadcrumbs={[
            { label: "Data Pipelines", to: "/connections" },
            { label: "Schema Studio" },
          ]}
          title="Schema Studio & Graph Mapper"
          description="Map raw connector column schemas to semantic ontology entities and relationships."
          icon={<Layers className="w-5 h-5 text-blue-400" />}
          badge={{
            label: "Visual Designer",
            variant: "blue",
          }}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSeedModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span>Industry Templates</span>
              </button>
              <button
                onClick={() => setShowHistory(true)}
                disabled={savedMappings.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({savedMappings.length})</span>
              </button>
            </div>
          }
        />
      </div>

      {/* ── Source & Ontology Selectors Ribbon ── */}
      <SchemaMapRibbon
        sources={sources}
        sourceLabels={sourceLabels}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
        loadingOntology={loadingOntology}
        dynamicOntologyMap={dynamicOntologyMap}
        dynamicOntologyLabels={dynamicOntologyLabels}
        activeOntologyKey={activeOntologyKey}
        setSelectedOntology={setSelectedOntology}
        generatingFromDataset={generatingFromDataset}
        hasSourceColumns={Boolean(
          sourceData.columns && sourceData.columns.length > 0,
        )}
        onAutoGenerate={handleAutoGenerateFromDataset}
        onOpenEntityEditor={() => setIsEntityEditorOpen(true)}
      />

      {/* ── Main Mapper Canvas ── */}
      <div className="flex-1 min-h-0 bg-zinc-950/20 overflow-hidden relative">
        {Object.keys(sources).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-text">
              No Data Sources Connected
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mt-1 mb-4">
              Connect external databases or upload flat files (CSV, JSON) to
              start mapping schemas.
            </p>
            <Link
              to="/connections"
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-text border border-primary text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Add Connection
            </Link>
          </div>
        ) : Object.keys(dynamicOntologyMap).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-text">
              No Ontology Entities Available
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mt-1 mb-4">
              Create an entity type or install industry starter templates to map
              source columns.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSeedModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-text border border-primary text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Use Industry Templates
              </button>
              <button
                onClick={handleAutoGenerateFromDataset}
                className="px-4 py-2 rounded-lg bg-transparent hover:bg-surface-subtle text-text border border-border text-xs font-semibold transition-colors cursor-pointer"
              >
                Auto-create from Dataset
              </button>
            </div>
          </div>
        ) : (
          <VisualSchemaMapper
            key={`${selectedSource}_${activeOntologyKey}`}
            connectionId={selectedSource}
            sourceTable={sourceData.table}
            sourceColumns={sourceData.columns}
            ontologyProperties={ontologyProps}
            initialMappings={initialMapperLinks}
            onSave={handleSave}
          />
        )}
      </div>

      {/* ── Industry Starter Pack Templates Modal ── */}
      <TemplatePicker
        isOpen={isSeedModalOpen}
        seedingDomain={seedingDomain}
        onClose={() => setIsSeedModalOpen(false)}
        onSelectTemplate={handleSeedDomainTemplate}
      />

      {/* ── Custom Entity Modal ── */}
      {isEntityEditorOpen && (
        <EntityTypeEditor
          onClose={() => setIsEntityEditorOpen(false)}
          onSaved={async (saved) => {
            setIsEntityEditorOpen(false);
            await fetchOntologyTypes();
            if (saved?.name) {
              setSelectedOntology(saved.name);
            }
          }}
        />
      )}

      {/* ── Mapping History Modal ── */}
      <Modal
        open={showHistory}
        onOpenChange={(open) => setShowHistory(open)}
        title="Schema Mapping Execution History"
        description="Historical mappings saved to the platform ontology catalog."
        maxWidth="lg"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {savedMappings.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6">
              No mapping history saved yet.
            </p>
          ) : (
            savedMappings.map((m, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-zinc-300 font-semibold">
                      {m.sourceTable}
                    </span>
                    <span className="text-zinc-600">➔</span>
                    <span className="text-blue-400 font-semibold">
                      {m.targetEntity}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  {m.mappings.length} column mappings defined
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
