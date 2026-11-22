import React, { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { PropertySchemaForm } from "./PropertySchemaForm";
import type { EntityType } from "../types";
import { EntityIcon } from "./entity-editor/EntityIcon";
import { EntityMetaTab } from "./entity-editor/EntityMetaTab";
import { hydrateInitialEntity } from "./entity-editor/hydrateEntity";
import { EntityIconPicker } from "./entity-editor/EntityIconPicker";

interface EntityTypeEditorProps {
  initial?: EntityType;
  initialEntity?: EntityType | null;
  isOpen?: boolean;
  onClose: () => void;
  onSaved?: (entity: EntityType) => void;
  onSave?: (entity: EntityType) => void;
}

export type { EntityType };
export { EntityIcon };

export const EntityTypeEditor: React.FC<EntityTypeEditorProps> = ({
  initial,
  initialEntity,
  onClose,
  onSaved,
  onSave,
}) => {
  const activeInitial = initial || initialEntity || undefined;
  const [form, setForm] = useState<EntityType>(() =>
    hydrateInitialEntity(activeInitial),
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
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Entity type name is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(
        form.id ? `/api/v1/ontology/entities/${form.id}` : "/api/v1/ontology/entities",
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      if (!res.ok) throw new Error("Failed to save entity type");
      const saved = await res.json();
      onSaved?.(saved);
      onSave?.(saved);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      hideHeader
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-[85vh] max-h-[720px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                id="entity-icon-picker-btn"
                onClick={() => setIconPickerOpen(!iconPickerOpen)}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-zinc-600"
                style={{
                  backgroundColor: `${form.color}20`,
                  color: form.color,
                }}
              >
                <EntityIcon iconKey={form.icon} size={16} />
              </button>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {form.id ? "Edit Entity Type" : "New Entity Type"}
              </h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {form.name || "Define a new node class for the knowledge graph"}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="entity-editor-close-btn"
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

        {iconPickerOpen && (
          <EntityIconPicker
            currentIcon={form.icon}
            onSelectIcon={(key) => {
              set("icon", key);
              setIconPickerOpen(false);
            }}
          />
        )}

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

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface shrink-0">
          <div className="text-[10px] text-text-secondary">
            {form.properties.length} propert
            {form.properties.length === 1 ? "y" : "ies"} defined
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Entity Type"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
