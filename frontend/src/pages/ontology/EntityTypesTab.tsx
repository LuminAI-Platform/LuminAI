import React from "react";
import { EntityIcon } from "../../features/ontology/components/EntityTypeEditor";
import type { EntityType } from "../../features/ontology/components/EntityTypeEditor";

interface EntityTypesTabProps {
  entities: EntityType[];
  loading: boolean;
  onNewEntity: () => void;
  onEditEntity: (entity: EntityType) => void;
  onDeleteEntity: (id: string) => void;
}

export const EntityTypesTab: React.FC<EntityTypesTabProps> = ({
  entities,
  loading,
  onNewEntity,
  onEditEntity,
  onDeleteEntity,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          id="new-entity-btn"
          type="button"
          onClick={onNewEntity}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-lg transition-all cursor-pointer"
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
          New Entity Type
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
          <span>Loading entity types…</span>
        </div>
      ) : entities.length === 0 ? (
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
              <circle cx="12" cy="8" r="4" />
              <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-400">
            No entity types defined yet
          </span>
          <span className="text-xs text-zinc-600 mt-1 mb-4">
            Create your first entity type to start modelling your domain
          </span>
          <button
            onClick={onNewEntity}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-lg transition-all cursor-pointer"
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
            Create Entity Type
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {entities.map((entity) => (
            <div
              key={entity.id ?? entity.name}
              className="group relative bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col gap-3 hover:border-zinc-700 transition-all"
            >
              {/* Card header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center border-2 shrink-0"
                    style={{
                      backgroundColor: `${entity.color ?? "#3b82f6"}18`,
                      borderColor: `${entity.color ?? "#3b82f6"}35`,
                      color: entity.color ?? "#3b82f6",
                    }}
                  >
                    <EntityIcon iconKey={entity.icon ?? "package"} size={18} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-zinc-100 block leading-tight">
                      {entity.label || entity.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                      {entity.name}
                    </span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    id={`edit-entity-${entity.id}`}
                    type="button"
                    onClick={() => onEditEntity(entity)}
                    className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                    title="Edit"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {entity.id && (
                    <button
                      id={`delete-entity-${entity.id}`}
                      type="button"
                      onClick={() => onDeleteEntity(entity.id!)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                      title="Delete"
                    >
                      <svg
                        width="13"
                        height="13"
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

              {/* Description */}
              {entity.description && (
                <p className="text-[11px] text-zinc-500 leading-normal line-clamp-2">
                  {entity.description}
                </p>
              )}

              {/* Properties chips */}
              {entity.properties && entity.properties.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entity.properties.slice(0, 5).map((p) => (
                    <span
                      key={p.id}
                      className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                    >
                      {p.name}:{p.type.slice(0, 3)}
                    </span>
                  ))}
                  {entity.properties.length > 5 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500">
                      +{entity.properties.length - 5} more
                    </span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-auto">
                <span className="text-[10px] text-zinc-600">
                  {entity.properties?.length ?? 0} propert
                  {(entity.properties?.length ?? 0) === 1 ? "y" : "ies"}
                </span>
                {entity.version && (
                  <span className="text-[9px] font-medium text-zinc-600 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                    v{entity.version}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
