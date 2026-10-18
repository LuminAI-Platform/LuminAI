import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Database,
  Layers,
  Check,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { DOMAIN_STARTER_PACKS, type DomainTemplate } from "../domainTemplates";
import { EntityIcon } from "./EntityTypeEditor";

interface AutoGenerateModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

interface ConnectionSummary {
  id: string;
  name: string;
  type: string;
  status?: string;
  config?: string;
  createdAt?: string;
}

interface InferredProp {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

function sanitizeEntityName(raw: string): string {
  const clean = raw
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1")
    .trim();
  if (!clean) return "GeneratedEntity";
  // Convert snake_case or spinal-case to PascalCase
  return clean
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function sanitizePropertyName(raw: string): string {
  const clean = raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1")
    .trim();
  if (!clean) return "prop";
  // camelCase
  const parts = clean.split("_").filter(Boolean);
  if (parts.length === 0) return "prop";
  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("")
  );
}

function inferTypeFromDataType(dt?: string): string {
  if (!dt) return "string";
  const lower = dt.toLowerCase();
  if (
    lower.includes("int") ||
    lower.includes("long") ||
    lower.includes("bigint")
  ) {
    return "integer";
  }
  if (
    lower.includes("float") ||
    lower.includes("double") ||
    lower.includes("decimal") ||
    lower.includes("num")
  ) {
    return "float";
  }
  if (lower.includes("bool")) {
    return "boolean";
  }
  if (lower.includes("date") && !lower.includes("time")) {
    return "date";
  }
  if (lower.includes("time") || lower.includes("timestamp")) {
    return "datetime";
  }
  return "string";
}

export const AutoGenerateModal: React.FC<AutoGenerateModalProps> = ({
  open,
  onClose,
  onGenerated,
}) => {
  const [activeTab, setActiveTab] = useState<"dataset" | "template">("dataset");

  // Dataset states
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConn, setSelectedConn] = useState<ConnectionSummary | null>(
    null,
  );
  const [entityName, setEntityName] = useState("");
  const [entityLabel, setEntityLabel] = useState("");
  const [entityColor, setEntityColor] = useState("#3b82f6");
  const [entityIcon, setEntityIcon] = useState("database");
  const [inferredProps, setInferredProps] = useState<InferredProp[]>([]);
  const [generating, setGenerating] = useState(false);

  // Template states
  const [selectedTemplate, setSelectedTemplate] = useState<DomainTemplate>(
    DOMAIN_STARTER_PACKS[0],
  );
  const [importingTemplate, setImportingTemplate] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSelectConnection = (conn: ConnectionSummary) => {
    setSelectedConn(conn);
    setError(null);

    const derivedName = sanitizeEntityName(conn.name);
    setEntityName(derivedName);
    setEntityLabel(derivedName.replace(/([A-Z])/g, " $1").trim());

    // Parse config for columns
    let cols: string[] = [];
    if (conn.config) {
      try {
        const parsed =
          typeof conn.config === "string"
            ? JSON.parse(conn.config)
            : conn.config;
        if (Array.isArray(parsed.columns)) {
          cols = parsed.columns;
        } else if (
          Array.isArray(parsed.sampleRows) &&
          parsed.sampleRows.length > 0
        ) {
          cols = Object.keys(parsed.sampleRows[0]);
        }
      } catch {
        // Fallback
      }
    }

    if (cols.length === 0) {
      cols = ["id", "name", "category", "status", "created_at"];
    }

    const props: InferredProp[] = cols.map((c) => ({
      name: sanitizePropertyName(c),
      type: inferTypeFromDataType(c),
      required:
        c.toLowerCase() === "id" ||
        c.toLowerCase().endsWith("_id") ||
        c.toLowerCase().endsWith("id"),
      description: `Inferred from column '${c}'`,
    }));

    setInferredProps(props);
  };

  // Fetch connections on open
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccessMsg(null);
    setLoadingConnections(true);
    apiFetch("/api/v1/connections")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConnections(data);
          if (data.length > 0) {
            handleSelectConnection(data[0]);
          }
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load connections"),
      )
      .finally(() => setLoadingConnections(false));
  }, [open]);

  const handleGenerateFromDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim()) {
      setError("Entity Type name is required.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const payload = {
        name: entityName.trim(),
        label: entityLabel.trim() || entityName.trim(),
        color: entityColor,
        icon: entityIcon,
        description: `Auto-generated from connection '${selectedConn?.name || "Dataset"}'`,
        properties: inferredProps.map((p) => ({
          name: p.name,
          type: p.type,
          required: p.required,
          defaultValue: null,
          description: p.description,
        })),
      };

      const res = await apiFetch("/api/v1/ontology/entity-types", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || "Failed to create entity type");
      }

      setSuccessMsg(
        `Successfully created Entity Type '${entityName}' with ${inferredProps.length} properties!`,
      );
      setTimeout(() => {
        onGenerated();
        onClose();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to auto-generate entity type",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleImportTemplate = async () => {
    setImportingTemplate(true);
    setError(null);
    try {
      let createdEntitiesCount = 0;
      const createdEntityIds: Record<string, string> = {};

      // 1. Fetch current entity types to prevent conflict
      const existingRes = await apiFetch("/api/v1/ontology/entity-types");
      const existingEntities: Array<{ id: string; name: string }> =
        await existingRes.json().catch(() => []);
      for (const e of existingEntities) {
        createdEntityIds[e.name.toLowerCase()] = e.id;
      }

      // 2. Create entities
      for (const et of selectedTemplate.entityTypes) {
        if (createdEntityIds[et.name.toLowerCase()]) {
          continue; // Already exists
        }
        try {
          const res = await apiFetch("/api/v1/ontology/entity-types", {
            method: "POST",
            body: JSON.stringify({
              name: et.name,
              label: et.label,
              color: et.color,
              icon: et.icon,
              description: et.description,
              properties: et.properties.map((p) => ({
                name: p.name,
                type: p.type,
                required: p.required,
                defaultValue: null,
                description: p.description,
              })),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            createdEntityIds[et.name.toLowerCase()] = data.id;
            createdEntitiesCount++;
          }
        } catch {
          // ignore duplicate
        }
      }

      // 3. Create relationships if defined
      let createdRelsCount = 0;
      if (selectedTemplate.relationships) {
        for (const rel of selectedTemplate.relationships) {
          const srcId = createdEntityIds[rel.sourceEntity.toLowerCase()];
          const tgtId = createdEntityIds[rel.targetEntity.toLowerCase()];
          if (!srcId || !tgtId) continue;

          try {
            const relRes = await apiFetch(
              "/api/v1/ontology/relationship-types",
              {
                method: "POST",
                body: JSON.stringify({
                  name: rel.name,
                  description: rel.description,
                  sourceEntityTypeId: srcId,
                  targetEntityTypeId: tgtId,
                  cardinality: rel.cardinality,
                }),
              },
            );
            if (relRes.ok) {
              createdRelsCount++;
            }
          } catch {
            // ignore duplicate
          }
        }
      }

      setSuccessMsg(
        `Imported ${createdEntitiesCount} entity types and ${createdRelsCount} relationship types from ${selectedTemplate.name}!`,
      );
      setTimeout(() => {
        onGenerated();
        onClose();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import domain template",
      );
    } finally {
      setImportingTemplate(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      maxWidth="3xl"
      hideHeader={true}
    >
      <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Auto-Generate Ontology Models
              </h2>
              <p className="text-[11px] text-zinc-500">
                Generate dynamic schema definitions directly from ingested data
                sources or industry templates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-900/30">
          <button
            type="button"
            onClick={() => {
              setActiveTab("dataset");
              setError(null);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "dataset"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            From Ingested Dataset
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("template");
              setError(null);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "template"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            From Industry Template
          </button>
        </div>

        {/* Status messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-950/30 border border-red-500/20 text-red-400 text-xs rounded-xl">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === "dataset" ? (
            <div className="flex flex-col gap-5">
              {loadingConnections ? (
                <div className="py-12 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span>Loading connections and datasets…</span>
                </div>
              ) : connections.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400">
                    No active datasets or connections found in this tenant.
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Upload a file in Data Connections first or use an Industry
                    Template tab.
                  </p>
                </div>
              ) : (
                <>
                  {/* Select Connection */}
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                      1. Select Ingested Data Connection
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {connections.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectConnection(c)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-xs flex items-center justify-between ${
                            selectedConn?.id === c.id
                              ? "bg-blue-600/10 border-blue-500/50 text-white shadow-md shadow-blue-950"
                              : "bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="font-semibold block truncate text-zinc-200">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase font-mono">
                              Type: {c.type}
                            </span>
                          </div>
                          {selectedConn?.id === c.id && (
                            <Check className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Entity Metadata Configuration */}
                  <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col gap-3">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      2. Target Entity Model Definition
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          Entity Identifier (PascalCase)
                        </label>
                        <input
                          type="text"
                          value={entityName}
                          onChange={(e) => setEntityName(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                          placeholder="e.g. CustomerRecord"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          Display Label
                        </label>
                        <input
                          type="text"
                          value={entityLabel}
                          onChange={(e) => setEntityLabel(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                          placeholder="e.g. Customer Record"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-6 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-400">
                          Color:
                        </span>
                        <div className="flex items-center gap-1.5">
                          {[
                            "#3b82f6",
                            "#8b5cf6",
                            "#06b6d4",
                            "#10b981",
                            "#f59e0b",
                            "#ef4444",
                            "#ec4899",
                          ].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEntityColor(c)}
                              className={`w-5 h-5 rounded-md border transition-all cursor-pointer ${
                                entityColor === c
                                  ? "scale-115 ring-2 ring-white border-transparent"
                                  : "border-transparent opacity-70 hover:opacity-100"
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-400">Icon:</span>
                        <div className="flex items-center gap-1.5">
                          {[
                            "database",
                            "building",
                            "user",
                            "package",
                            "chart",
                            "globe",
                          ].map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              onClick={() => setEntityIcon(ic)}
                              className={`px-2 py-1 text-[10px] rounded-md border flex items-center gap-1 transition-all cursor-pointer ${
                                entityIcon === ic
                                  ? "bg-zinc-800 border-blue-500 text-blue-400 font-semibold"
                                  : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              <EntityIcon iconKey={ic} size={12} />
                              <span className="capitalize">{ic}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inferred Properties Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        3. Inferred Attributes & Types ({inferredProps.length})
                      </label>
                      <span className="text-[10px] text-zinc-500">
                        Automatically detected from dataset schema
                      </span>
                    </div>
                    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/60 max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-900/80 text-[10px] font-semibold text-zinc-400 uppercase border-b border-zinc-800">
                          <tr>
                            <th className="px-3 py-2">Property Name</th>
                            <th className="px-3 py-2">Inferred Type</th>
                            <th className="px-3 py-2">Required</th>
                            <th className="px-3 py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
                          {inferredProps.map((p, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/30">
                              <td className="px-3 py-2 font-semibold text-zinc-200">
                                {p.name}
                              </td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-semibold">
                                  {p.type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-zinc-400">
                                {p.required ? (
                                  <span className="text-amber-400 font-bold">
                                    YES
                                  </span>
                                ) : (
                                  "NO"
                                )}
                              </td>
                              <td className="px-3 py-2 text-zinc-500 truncate max-w-xs">
                                {p.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateFromDataset}
                      disabled={generating || !entityName}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {generating && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      Generate Entity Type
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Select Industry Ontology Starter Pack
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DOMAIN_STARTER_PACKS.map((pack) => (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedTemplate(pack)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        selectedTemplate.id === pack.id
                          ? "bg-purple-950/20 border-purple-500/50 shadow-lg shadow-purple-950/40"
                          : "bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${pack.badgeColor}`}
                          >
                            {pack.badge}
                          </span>
                          <h3 className="text-sm font-bold text-zinc-100 mt-2">
                            {pack.name}
                          </h3>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-normal">
                            {pack.description}
                          </p>
                        </div>
                        {selectedTemplate.id === pack.id && (
                          <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-400">
                        <span>{pack.entityTypes.length} Entity Types</span>
                        <span>•</span>
                        <span>
                          {pack.relationships?.length ?? 0} Relationships
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Template details preview */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Included Domain Model Components
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.entityTypes.map((et) => (
                    <div
                      key={et.name}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-xs"
                    >
                      <EntityIcon iconKey={et.icon} size={13} />
                      <span className="font-semibold text-zinc-200">
                        {et.name}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        ({et.properties.length} props)
                      </span>
                    </div>
                  ))}
                </div>
                {selectedTemplate.relationships &&
                  selectedTemplate.relationships.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase">
                        Directional Relationships:
                      </span>
                      {selectedTemplate.relationships.map((rel) => (
                        <div
                          key={rel.name}
                          className="flex items-center gap-2 text-[11px] text-purple-400 font-mono"
                        >
                          <span className="text-zinc-300">
                            {rel.sourceEntity}
                          </span>
                          <ArrowRight className="w-3 h-3 text-purple-400" />
                          <span className="text-zinc-300">
                            {rel.targetEntity}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            [{rel.name}]
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportTemplate}
                  disabled={importingTemplate}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-lg shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {importingTemplate && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Import {selectedTemplate.name} Model
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
