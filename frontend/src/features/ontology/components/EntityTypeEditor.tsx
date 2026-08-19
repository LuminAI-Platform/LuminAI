import React, { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { PropertySchemaForm } from "./PropertySchemaForm";
import type { PropertySchema } from "./PropertySchemaForm";

export interface EntityType {
  id?: string;
  name: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  properties: PropertySchema[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface EntityTypeEditorProps {
  initial?: EntityType;
  onClose: () => void;
  onSaved: (entity: EntityType) => void;
}

const ENTITY_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#64748b",
];

export const ENTITY_ICON_MAP: Record<string, React.ReactNode> = {
  building: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="12.01" />
      <line x1="12" y1="16" x2="12" y2="16.01" />
    </svg>
  ),
  user: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  package: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  ),
  briefcase: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  link: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  chart: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  globe: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  settings: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  clipboard: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  ),
  target: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
};

export const ENTITY_ICON_KEYS = Object.keys(ENTITY_ICON_MAP);

/** Shared renderer — pass the stored key, get an SVG back */
export const EntityIcon: React.FC<{ iconKey: string; size?: number }> = ({
  iconKey,
  size = 16,
}) => {
  const icon = ENTITY_ICON_MAP[iconKey] ?? ENTITY_ICON_MAP["package"];
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </span>
  );
};

const ENTITY_ICON_LABELS: Record<string, string> = {
  building: "Building",
  user: "User",
  package: "Package",
  briefcase: "Briefcase",
  link: "Link",
  chart: "Chart",
  globe: "Globe",
  settings: "Settings",
  clipboard: "Clipboard",
  target: "Target",
};

const EMPTY: EntityType = {
  name: "",
  label: "",
  description: "",
  color: "#3b82f6",
  icon: "package",
  properties: [],
};

export const EntityTypeEditor: React.FC<EntityTypeEditorProps> = ({
  initial,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<EntityType>(initial ?? EMPTY);
  const [activeTab, setActiveTab] = useState<"meta" | "properties">("meta");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

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
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            {/* Entity icon preview */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border-2 shrink-0 cursor-pointer select-none transition-all hover:scale-105"
              style={{
                backgroundColor: `${form.color}20`,
                borderColor: `${form.color}40`,
                color: form.color,
              }}
              onClick={() => {
                setIconPickerOpen(!iconPickerOpen);
                setColorPickerOpen(false);
              }}
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
          <div className="absolute z-60 mt-14 ml-6 bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl flex flex-wrap gap-2 w-56">
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
            <div className="flex flex-col gap-4">
              {/* Name + Label */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="entity-name"
                    className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
                  >
                    Internal Name *
                  </label>
                  <input
                    id="entity-name"
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      set("name", e.target.value.replace(/\s+/g, ""))
                    }
                    placeholder="CustomerProfile"
                    className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 font-mono placeholder:text-zinc-600 transition-colors"
                  />
                  <span className="text-[10px] text-zinc-600">
                    PascalCase, no spaces
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="entity-label"
                    className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
                  >
                    Display Label *
                  </label>
                  <input
                    id="entity-label"
                    type="text"
                    value={form.label}
                    onChange={(e) => set("label", e.target.value)}
                    placeholder="Customer Profile"
                    className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="entity-desc"
                  className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider"
                >
                  Description
                </label>
                <textarea
                  id="entity-desc"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                  placeholder="Describe what this entity type represents in the domain model..."
                  className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-blue-500/60 placeholder:text-zinc-600 transition-colors resize-none"
                />
              </div>

              {/* Color picker */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Node Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {ENTITY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        id={`entity-color-${c.replace("#", "")}`}
                        onClick={() => set("color", c)}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${
                          form.color === c
                            ? "border-white scale-110"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  <div
                    className="w-7 h-7 rounded-full border-2 cursor-pointer transition-all"
                    style={{
                      backgroundColor: form.color,
                      borderColor: form.color,
                    }}
                    title="Custom color"
                    onClick={() => setColorPickerOpen(!colorPickerOpen)}
                  />
                  {colorPickerOpen && (
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => set("color", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                  )}
                </div>
              </div>

              {/* Preview badge */}
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Preview
                </label>
                <div
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 self-start"
                  style={{
                    backgroundColor: `${form.color}15`,
                    borderColor: `${form.color}35`,
                  }}
                >
                  <span style={{ color: form.color }}>
                    <EntityIcon iconKey={form.icon} size={16} />
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: form.color }}
                  >
                    {form.label || form.name || "Entity Label"}
                  </span>
                  {form.properties.length > 0 && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        color: form.color,
                        backgroundColor: `${form.color}20`,
                      }}
                    >
                      {form.properties.length} props
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <PropertySchemaForm
              properties={form.properties}
              onChange={(props) => set("properties", props)}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 px-3 py-2.5 bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/60 shrink-0">
          <div className="text-[10px] text-zinc-600">
            {form.properties.length} propert
            {form.properties.length === 1 ? "y" : "ies"} defined
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="entity-editor-cancel-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="entity-editor-save-btn"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/40 rounded-lg shadow-lg shadow-blue-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};
