import React, { useState, useEffect } from "react";
import { apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { PropertySchemaForm } from "./PropertySchemaForm";
import type { EntityType, PropertySchema } from "../types";
import {
  EntityIcon,
  ENTITY_ICON_KEYS,
  ENTITY_ICON_LABELS,
} from "./entity-editor/EntityIcon";
import { EntityMetaTab } from "./entity-editor/EntityMetaTab";

interface EntityTypeEditorProps {
  initial?: EntityType;
  onClose: () => void;
  onSaved: (entity: EntityType) => void;
}

export type { EntityType };
export { EntityIcon };

const EMPTY: EntityType = {
  name: "",
  label: "",
  description: "",
  color: "#3b82f6",
  icon: "package",
  properties: [],
};

function hydrateInitialEntity(initial?: EntityType): EntityType {
  if (!initial) return EMPTY;
  let props = initial.properties ?? [];
  const rawSchema = (
    initial as unknown as {
      propertiesSchema?: string | Record<string, unknown>;
    }
  ).propertiesSchema;
  if ((!props || props.length === 0) && rawSchema) {
    try {
      const parsed =
        typeof rawSchema === "string" ? JSON.parse(rawSchema) : rawSchema;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as Record<string, unknown>).properties
      ) {
        const schemaProps = (
          parsed as {
            properties: Record<
              string,
              { type?: string; default?: unknown; description?: string }
            >;
          }
        ).properties;
        const reqList = Array.isArray(
          (parsed as { required?: string[] }).required,
        )
          ? (parsed as { required: string[] }).required
          : [];
        props = Object.entries(schemaProps).map(([name, def]) => ({
          id: name,
          name,
          type: (def?.type
            ? def.type.toUpperCase()
            : "STRING") as PropertySchema["type"],
          required: reqList.includes(name),
          defaultValue: def?.default !== undefined ? String(def.default) : "",
          description: def?.description || "",
        }));
      }
    } catch {
      // fallback
    }
  }
  return { ...initial, properties: props };
}

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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0 select-none bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border-2 shrink-0 cursor-pointer select-none transition-all hover:scale-105"
              style={{
                backgroundColor: `${form.color}20`,
                borderColor: `${form.color}40`,
                color: form.color,
              }}
              onClick={() => setIconPickerOpen(!iconPickerOpen)}
              title="Change icon"
            >
              <EntityIcon iconKey={form.icon} size={16} />
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

        {/* Icon picker dropdown */}
        {iconPickerOpen && (
          <div className="absolute z-60 mt-14 ml-6 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl flex flex-wrap gap-2 w-56">
            {ENTITY_ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                title={ENTITY_ICON_LABELS[key]}
                onClick={() => {
                  set("icon", key);
                  setIconPickerOpen(false);
                }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-all cursor-pointer ${
                  form.icon === key
                    ? "bg-zinc-800 ring-1 ring-blue-500 text-blue-400"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <EntityIcon iconKey={key} size={15} />
              </button>
            ))}
          </div>
        )}

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
