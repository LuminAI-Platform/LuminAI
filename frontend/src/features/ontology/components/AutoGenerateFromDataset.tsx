import React, { useState } from "react";
import { Check, Loader2 } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { type ConnectionSummary, type InferredProp } from "./autoGenerateUtils";
import { TargetEntityModelForm } from "./TargetEntityModelForm";

interface AutoGenerateFromDatasetProps {
  connections: ConnectionSummary[];
  loadingConnections: boolean;
  selectedConn: ConnectionSummary | null;
  onSelectConnection: (conn: ConnectionSummary) => void;
  entityName: string;
  setEntityName: (name: string) => void;
  entityLabel: string;
  setEntityLabel: (label: string) => void;
  entityColor: string;
  setEntityColor: (color: string) => void;
  entityIcon: string;
  setEntityIcon: (icon: string) => void;
  inferredProps: InferredProp[];
  onSuccess: (msg: string) => void;
  onError: (err: string) => void;
  onClose: () => void;
}

export const AutoGenerateFromDataset: React.FC<
  AutoGenerateFromDatasetProps
> = ({
  connections,
  loadingConnections,
  selectedConn,
  onSelectConnection,
  entityName,
  setEntityName,
  entityLabel,
  setEntityLabel,
  entityColor,
  setEntityColor,
  entityIcon,
  setEntityIcon,
  inferredProps,
  onSuccess,
  onError,
  onClose,
}) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName.trim()) {
      onError("Entity Type name is required.");
      return;
    }

    setGenerating(true);
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

      onSuccess(
        `Successfully created Entity Type '${entityName}' with ${inferredProps.length} properties!`,
      );
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Failed to auto-generate entity type",
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loadingConnections) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-zinc-500 text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span>Loading connections and datasets…</span>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-zinc-800 rounded-xl">
        <p className="text-xs text-zinc-400">
          No active datasets or connections found in this tenant.
        </p>
        <p className="text-[11px] text-zinc-600 mt-1">
          Upload a file in Data Connections first or use an Industry Template
          tab.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
          1. Select Ingested Data Connection
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
          {connections.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectConnection(c)}
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

      <TargetEntityModelForm
        entityName={entityName}
        setEntityName={setEntityName}
        entityLabel={entityLabel}
        setEntityLabel={setEntityLabel}
        entityColor={entityColor}
        setEntityColor={setEntityColor}
        entityIcon={entityIcon}
        setEntityIcon={setEntityIcon}
      />

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
                      <span className="text-amber-400 font-bold">YES</span>
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
          onClick={handleGenerate}
          disabled={generating || !entityName}
          className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Generate Entity Type
        </button>
      </div>
    </div>
  );
};
