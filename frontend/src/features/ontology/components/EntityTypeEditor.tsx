import React, { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { PropertySchemaForm } from "./PropertySchemaForm";
import type { EntityType } from "../types";
import { EntityIcon } from "./entity-editor/EntityIcon";
import { EntityMetaTab } from "./entity-editor/EntityMetaTab";
import { hydrateInitialEntity } from "./entity-editor/hydrateEntity";
import { EntityEditorHeader } from "./entity-editor/EntityEditorHeader";

interface EntityTypeEditorProps {
  initial?: EntityType;
  onClose: () => void;
  onSaved: (entity: EntityType) => void;
}

export type { EntityType };
export { EntityIcon };

export const EntityTypeEditor: React.FC<EntityTypeEditorProps> = ({
  initial,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<EntityType>(() =>
    hydrateInitialEntity(initial),
  );
  const [activeTab, setActiveTab] = useState<"meta" | "properties">("meta");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const set = (k: keyof EntityType, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.label.trim()) {
      setError("Name and label are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const method = form.id ? "PUT" : "POST";
      const url = form.id
        ? `/api/v1/ontology/entity-types/${form.id}`
        : "/api/v1/ontology/entity-types";
      const res = await apiFetch(url, { method, body: JSON.stringify(form) });
      const saved = (await res.json()) as EntityType;
      onSaved(saved);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save entity type.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      maxWidth="2xl"
      hideHeader={true}
    >
      <div className="flex flex-col h-full">
        <EntityEditorHeader
          form={form}
          iconPickerOpen={iconPickerOpen}
          onToggleIconPicker={() => setIconPickerOpen((prev) => !prev)}
          onSelectIcon={(key) => {
            set("icon", key);
            setIconPickerOpen(false);
          }}
          onClose={onClose}
        />

        {/* Tabs */}
        <div className="flex border-b border-zinc-800/80 px-6 shrink-0">
          {(["meta", "properties"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              id={`entity-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer capitalize ${
                activeTab === tab
                  ? "border-blue-500 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "meta"
                ? "General"
                : `Properties (${form.properties.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "meta" ? (
            <EntityMetaTab form={form} set={set} />
          ) : (
            <PropertySchemaForm
              properties={form.properties}
              onChange={(props) => set("properties", props)}
            />
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 px-3 py-2.5 bg-error-bg border border-error-border text-error rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface shrink-0">
          <div className="text-[10px] text-text-secondary">
            {form.properties.length} propert
            {form.properties.length === 1 ? "y" : "ies"} defined
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="entity-editor-cancel-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-text hover:text-text bg-transparent hover:bg-surface-subtle border border-border rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="entity-editor-save-btn"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover border border-primary rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  ? "Update Entity Type"
                  : "Create Entity Type"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
