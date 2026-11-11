import React, { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";
import type {
  RelationshipCardinality,
  RelationshipType,
  EntityTypeOption,
} from "./relationship-editor/relationshipTypes";
import { EMPTY_RELATIONSHIP } from "./relationship-editor/relationshipTypes";
import { RelationshipFields } from "./relationship-editor/RelationshipFields";

export type { RelationshipCardinality, RelationshipType };

interface RelationshipTypeFormProps {
  initial?: RelationshipType;
  onClose: () => void;
  onSaved: (rel: RelationshipType) => void;
}

export const RelationshipTypeForm: React.FC<RelationshipTypeFormProps> = ({
  initial,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<RelationshipType>(
    initial ?? EMPTY_RELATIONSHIP,
  );
  const [entityOptions, setEntityOptions] = useState<EntityTypeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Source and Target entity types must be selected.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center">
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
        <RelationshipFields
          form={form}
          set={set}
          entityOptions={entityOptions}
          error={error}
          onSubmit={handleSubmit}
        />

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
