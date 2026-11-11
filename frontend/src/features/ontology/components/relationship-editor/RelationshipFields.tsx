import React from "react";
import type { RelationshipType, EntityTypeOption } from "./relationshipTypes";
import { CARDINALITY_OPTIONS } from "./relationshipTypes";

interface RelationshipFieldsProps {
  form: RelationshipType;
  set: (k: keyof RelationshipType, v: unknown) => void;
  entityOptions: EntityTypeOption[];
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export const RelationshipFields: React.FC<RelationshipFieldsProps> = ({
  form,
  set,
  entityOptions,
  error,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 px-6 py-5 overflow-y-auto"
    >
      {/* Name + Label */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="rel-name"
            className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
          >
            Internal Name *
          </label>
          <input
            id="rel-name"
            type="text"
            value={form.name}
            onChange={(e) =>
              set("name", e.target.value.toUpperCase().replace(/\s+/g, "_"))
            }
            placeholder="HAS_PRODUCT"
            className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 font-mono placeholder:text-zinc-600 transition-colors uppercase"
          />
          <span className="text-[10px] text-zinc-600">
            Snake-case, uppercase
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="rel-label"
            className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
          >
            Display Label *
          </label>
          <input
            id="rel-label"
            type="text"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Has Product"
            className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* Source → Target */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Entity Endpoints *
        </span>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label htmlFor="rel-source" className="text-[10px] text-zinc-600">
              Source
            </label>
            <select
              id="rel-source"
              value={form.sourceEntityTypeId}
              onChange={(e) => set("sourceEntityTypeId", e.target.value)}
              className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 transition-colors cursor-pointer"
            >
              <option value="">Select entity…</option>
              {entityOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {/* Directed arrow */}
          <div className="flex flex-col items-center gap-1 pt-4">
            <button
              type="button"
              id="rel-directed-toggle"
              onClick={() => set("directed", !form.directed)}
              title={form.directed ? "Directed edge" : "Undirected edge"}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                form.directed
                  ? "text-purple-400 border-purple-500/30 bg-purple-500/10"
                  : "text-zinc-500 border-zinc-700 bg-zinc-900"
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                {form.directed ? (
                  <>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="13 6 19 12 13 18" />
                  </>
                ) : (
                  <>
                    <polyline points="11 6 5 12 11 18" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="13 6 19 12 13 18" />
                  </>
                )}
              </svg>
            </button>
            <span className="text-[9px] text-zinc-600">
              {form.directed ? "directed" : "undirected"}
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-1">
            <label htmlFor="rel-target" className="text-[10px] text-zinc-600">
              Target
            </label>
            <select
              id="rel-target"
              value={form.targetEntityTypeId}
              onChange={(e) => set("targetEntityTypeId", e.target.value)}
              className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 transition-colors cursor-pointer"
            >
              <option value="">Select entity…</option>
              {entityOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cardinality */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Cardinality
        </span>
        <div className="grid grid-cols-2 gap-2">
          {CARDINALITY_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              id={`rel-cardinality-${c.value}`}
              onClick={() => set("cardinality", c.value)}
              className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                form.cardinality === c.value
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className="text-xs font-bold">{c.label}</span>
              <span className="text-[10px] opacity-70">{c.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="rel-description"
          className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
        >
          Description
        </label>
        <textarea
          id="rel-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="Describe what this relationship represents..."
          className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors resize-none"
        />
      </div>

      {error && (
        <div className="px-3 py-2.5 bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium">
          {error}
        </div>
      )}
    </form>
  );
};
