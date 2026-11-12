import React from "react";
import { Loader2, Plus } from "lucide-react";
import type {
  SourceColumn,
  OntologyProperty,
} from "../../../features/connections/components/VisualSchemaMapper";

interface SchemaMapRibbonProps {
  sources: Record<string, { table: string; columns: SourceColumn[] }>;
  sourceLabels: Record<string, string>;
  selectedSource: string;
  setSelectedSource: (s: string) => void;
  loadingOntology: boolean;
  dynamicOntologyMap: Record<string, OntologyProperty[]>;
  dynamicOntologyLabels: Record<string, string>;
  activeOntologyKey: string;
  setSelectedOntology: (s: string) => void;
  generatingFromDataset: boolean;
  hasSourceColumns: boolean;
  onAutoGenerate: () => void;
  onOpenEntityEditor: () => void;
}

export const SchemaMapRibbon: React.FC<SchemaMapRibbonProps> = ({
  sources,
  sourceLabels,
  selectedSource,
  setSelectedSource,
  loadingOntology,
  dynamicOntologyMap,
  dynamicOntologyLabels,
  activeOntologyKey,
  setSelectedOntology,
  generatingFromDataset,
  hasSourceColumns,
  onAutoGenerate,
  onOpenEntityEditor,
}) => {
  return (
    <div className="px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">
            Source Dataset:
          </span>
          {Object.keys(sources).length > 0 ? (
            <select
              id="source-selector"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
            >
              {Object.keys(sources).map((k) => (
                <option key={k} value={k}>
                  {sourceLabels[k] || sources[k].table}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-zinc-500 italic">
              No connected data sources
            </span>
          )}
        </div>

        <span className="text-zinc-600">➔</span>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">
            Target Entity:
          </span>
          {loadingOntology ? (
            <span className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading entities...
            </span>
          ) : Object.keys(dynamicOntologyMap).length > 0 ? (
            <select
              id="target-ontology-selector"
              value={activeOntologyKey}
              onChange={(e) => setSelectedOntology(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
            >
              {Object.keys(dynamicOntologyMap).map((k) => (
                <option key={k} value={k}>
                  {dynamicOntologyLabels[k] || k}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-zinc-500 italic">
              No entity types found
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          id="btn-auto-create-entity"
          onClick={onAutoGenerate}
          disabled={generatingFromDataset || !hasSourceColumns}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 transition-colors cursor-pointer disabled:opacity-40"
          title="Auto-detect and create entity type directly from selected dataset columns"
        >
          {generatingFromDataset ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>Auto-create from Data</span>
        </button>

        <button
          onClick={onOpenEntityEditor}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Custom Entity</span>
        </button>
      </div>
    </div>
  );
};
