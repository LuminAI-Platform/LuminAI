import React from "react";
import type { RelationshipType } from "../../features/ontology/components/RelationshipTypeForm";

interface RelationshipsTabProps {
  relationships: RelationshipType[];
  loading: boolean;
  entityName: (id: string) => string;
  onNewRelationship: () => void;
  onEditRelationship: (rel: RelationshipType) => void;
  onDeleteRelationship: (id: string) => void;
}

export const RelationshipsTab: React.FC<RelationshipsTabProps> = ({
  relationships,
  loading,
  entityName,
  onNewRelationship,
  onEditRelationship,
  onDeleteRelationship,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          id="new-relationship-btn"
          type="button"
          onClick={onNewRelationship}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500/40 rounded-lg shadow-lg shadow-purple-500/10 transition-all cursor-pointer"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Relationship Type
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-zinc-500 text-xs">
          <svg
            className="animate-spin"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
          <span>Loading…</span>
        </div>
      ) : relationships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-lg bg-zinc-950/40">
          <div className="text-zinc-600 mb-3">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="13 6 19 12 13 18" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-400">
            No relationship types defined
          </span>
          <span className="text-xs text-zinc-600 mt-1 mb-4">
            Define how entity types connect in the knowledge graph
          </span>
          <button
            onClick={onNewRelationship}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500/40 rounded-lg transition-all cursor-pointer"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Relationship Type
          </button>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/40">
          <div className="overflow-x-auto min-w-0">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-12 bg-zinc-900/60 px-5 py-3 border-b border-zinc-800/80 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                <div className="col-span-3">Name</div>
                <div className="col-span-4">Endpoints</div>
                <div className="col-span-2">Cardinality</div>
                <div className="col-span-2">Direction</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
              <div className="divide-y divide-zinc-900">
                {relationships.map((rel) => (
                  <div
                    key={rel.id ?? rel.name}
                    className="group grid grid-cols-12 px-5 py-3.5 items-center hover:bg-zinc-900/30 transition-all text-xs"
                  >
                    <div className="col-span-3">
                      <span className="font-bold font-mono text-purple-400">
                        {rel.name}
                      </span>
                      <span className="block text-[10px] text-zinc-500 mt-0.5">
                        {rel.label}
                      </span>
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                      <span className="font-semibold text-zinc-300 text-[11px]">
                        {entityName(rel.sourceEntityTypeId)}
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-zinc-500 shrink-0"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="13 6 19 12 13 18" />
                      </svg>
                      <span className="font-semibold text-zinc-300 text-[11px]">
                        {entityName(rel.targetEntityTypeId)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {rel.cardinality.replace(/_/g, ":")}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          rel.directed
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-zinc-800 text-zinc-500 border-zinc-700"
                        }`}
                      >
                        {rel.directed ? "Directed" : "Undirected"}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        id={`edit-rel-${rel.id}`}
                        type="button"
                        onClick={() => onEditRelationship(rel)}
                        className="p-1.5 text-zinc-500 hover:text-purple-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {rel.id && (
                        <button
                          id={`delete-rel-${rel.id}`}
                          type="button"
                          onClick={() => onDeleteRelationship(rel.id!)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
