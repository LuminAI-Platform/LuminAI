import React, { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";

export type RelationshipCardinality =
  | "ONE_TO_ONE"
  | "ONE_TO_MANY"
  | "MANY_TO_ONE"
  | "MANY_TO_MANY";

export interface RelationshipType {
  id?: string;
  name: string;
  label: string;
  sourceEntityTypeId: string;
  targetEntityTypeId: string;
  cardinality: RelationshipCardinality;
  description: string;
  directed: boolean;
}

interface EntityTypeOption {
  id: string;
  name: string;
}

interface RelationshipTypeFormProps {
  initial?: RelationshipType;
  onClose: () => void;
  onSaved: (rel: RelationshipType) => void;
}

const CARDINALITY_OPTIONS: {
  value: RelationshipCardinality;
  label: string;
  desc: string;
}[] = [
  {
    value: "ONE_TO_ONE",
    label: "1 : 1",
    desc: "One source relates to one target",
  },
  {
    value: "ONE_TO_MANY",
    label: "1 : N",
    desc: "One source relates to many targets",
  },
  {
    value: "MANY_TO_ONE",
    label: "N : 1",
    desc: "Many sources relate to one target",
  },
  {
    value: "MANY_TO_MANY",
    label: "N : N",
    desc: "Many sources relate to many targets",
  },
];

const EMPTY: RelationshipType = {
  name: "",
  label: "",
  sourceEntityTypeId: "",
  targetEntityTypeId: "",
  cardinality: "ONE_TO_MANY",
  description: "",
  directed: true,
};

export const RelationshipTypeForm: React.FC<RelationshipTypeFormProps> = ({
  initial,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<RelationshipType>(initial ?? EMPTY);
  const [entityOptions, setEntityOptions] = useState<EntityTypeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entity types for source/target selects
  useEffect(() => {
    apiFetch("/api/v1/ontology/entity-types")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setEntityOptions(
            (data as Record<string, unknown>[]).map((d) => ({
              id: String(d.id ?? ""),
              name: String(d.name ?? ""),
            })),
          );
        }
      })
      .catch(() => setEntityOptions([]));
  }, []);

  const set = (k: keyof RelationshipType, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.label.trim()) {
      setError("Name and label are required.");
      return;
    }
    if (!form.sourceEntityTypeId || !form.targetEntityTypeId) {
      setError("Source and target entity types are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const method = form.id ? "PUT" : "POST";
      const url = form.id
        ? `/api/v1/ontology/relationship-types/${form.id}`
        : "/api/v1/ontology/relationship-types";
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      });
      const saved = (await res.json()) as RelationshipType;
      onSaved(saved);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save relationship type.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {form.id ? "Edit Relationship Type" : "New Relationship Type"}
              </h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Define a typed edge between two entity classes
              </p>
            </div>
          </div>
          <button
            type="button"
            id="rel-form-close-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
          >
            <svg
              width="14"
              height="14"
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

        {/* Form body */}
        <form
          onSubmit={handleSubmit}
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
                <label
                  htmlFor="rel-source"
                  className="text-[10px] text-zinc-600"
                >
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
                <label
                  htmlFor="rel-target"
                  className="text-[10px] text-zinc-600"
                >
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
                  className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    form.cardinality === c.value
                      ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <span className="text-xs font-bold font-mono">{c.label}</span>
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/60">
          <button
            type="button"
            id="rel-form-cancel-btn"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="rel-form-save-btn"
            form=""
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500/40 rounded-lg shadow-lg shadow-purple-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <svg
                className="animate-spin"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 12a9 9 0 1 1-6.22-8.56" />
              </svg>
            ) : (
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
            )}
            {saving
              ? "Saving…"
              : form.id
                ? "Update Relationship"
                : "Create Relationship"}
          </button>
        </div>
      </div>
    </div>
  );
};
